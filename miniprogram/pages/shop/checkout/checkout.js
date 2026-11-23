// pages/shop/checkout/checkout.js 确认订单
const app = getApp();
const util = require('../../../utils/util.js');
const dbApi = require('../../../utils/db.js');

Page({
  data: {
    from: 'cart',
    items: [],     // 含 subtotalText、priceText、name、qty、spec、image
    totalText: '0.00',
    customerName: '',
    phone: '',
    address: '',
    remark: '',
    submitting: false,
    loading: true
  },

  onLoad(query) {
    const from = query.from || 'cart';
    this.setData({ from });
    if (from === 'cart') {
      this.loadFromCart();
    } else {
      // buynow：根据 productId + qty 查商品
      this.loadFromBuynow(query.productId, parseInt(query.qty) || 1);
    }
  },

  // 从购物车加载
  loadFromCart() {
    const cart = app.globalData.cart || [];
    if (!cart.length) {
      this.setData({ items: [], totalText: '0.00', loading: false });
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    let total = 0;
    const items = cart.map(it => {
      const subtotal = (it.price || 0) * (it.qty || 0);
      total += subtotal;
      return {
        productId: it.productId,
        name: it.name,
        category: it.category,
        spec: it.spec || '',
        image: it.image || '',
        price: it.price,
        qty: it.qty,
        priceText: util.formatMoney(it.price),
        subtotalText: util.formatMoney(subtotal)
      };
    });
    this.setData({ items, totalText: util.formatMoney(total), loading: false });
  },

  // 立即购买：查询单个商品组成清单
  loadFromBuynow(productId, qty) {
    const db = wx.cloud.database();
    db.collection('products').doc(productId).get().then(res => {
      const p = res.data;
      if (!p) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const subtotal = (p.price || 0) * qty;
      const items = [{
        productId: p._id,
        name: p.name,
        category: p.category,
        spec: p.spec || '',
        image: p.image || '',
        price: p.price,
        qty: qty,
        priceText: util.formatMoney(p.price),
        subtotalText: util.formatMoney(subtotal)
      }];
      this.setData({ items, totalText: util.formatMoney(subtotal), loading: false });
    }).catch(err => {
      console.error('加载商品失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 表单输入
  onNameInput(e) { this.setData({ customerName: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onAddressInput(e) { this.setData({ address: e.detail.value }); },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  // 提交订单
  onSubmit() {
    if (this.data.submitting) return;
    const { customerName, phone, address, items, remark } = this.data;
    if (!customerName.trim()) { wx.showToast({ title: '请填写收货人姓名', icon: 'none' }); return; }
    if (!phone.trim()) { wx.showToast({ title: '请填写手机号', icon: 'none' }); return; }
    if (!address.trim()) { wx.showToast({ title: '请填写收货地址', icon: 'none' }); return; }
    if (!items.length) { wx.showToast({ title: '没有商品', icon: 'none' }); return; }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    // 传给云函数的 items 只含 productId 和 qty，价格由云函数核价
    const payload = {
      items: items.map(it => ({ productId: it.productId, qty: it.qty })),
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      remark: (remark || '').trim()
    };

    wx.cloud.callFunction({
      name: 'createOrder',
      data: payload
    }).then(res => {
      wx.hideLoading();
      console.log('[createOrder] 云函数完整返回', JSON.stringify(res));
      const result = (res && res.result) ? res.result : {};
      console.log('[createOrder] result=', result);
      if (!result || result.code !== 'OK') {
        this.setData({ submitting: false });
        wx.showToast({ title: (result && result.msg) || '下单失败', icon: 'none' });
        return;
      }
      this.handlePayResult(result);
    }).catch(err => {
      console.error('下单失败', err);
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '下单失败，请重试', icon: 'none' });
    });
  },

  // 处理支付结果（payment / payError）— 极端防御版
  handlePayResult(result) {
    this.setData({ submitting: false });
    const safeResult = result || {};
    const orderId = safeResult.orderId;
    const payment = safeResult.payment;
    const payError = safeResult.payError;
    const debug = safeResult.debug;

    console.log('[handlePayResult] orderId=', orderId, 'payment=', payment, 'payError=', payError, 'debug=', debug);

    const clearCartAndGo = (paid = false) => {
      if (this.data.from === 'cart') {
        app.globalData.cart = [];
        app.saveCart();
      }
      if (paid) {
        // 支付成功 → 跳到支付成功页（简洁展示，不显示物流等复杂信息）
        wx.redirectTo({ url: '/pages/shop/paySuccess/paySuccess' });
      } else if (orderId) {
        // 未支付/取消/异常 → 跳到订单详情页（待付款状态）
        wx.redirectTo({ url: '/pages/shop/orderDetail/orderDetail?id=' + orderId });
      } else {
        wx.showToast({ title: '订单已创建', icon: 'none' });
      }
    };

    // 路径 1：payment 对象存在且字段完整
    if (payment && typeof payment === 'object') {
      const ts = payment.timeStamp;
      const pkg = payment.package;
      const sign = payment.paySign;
      if (ts && pkg && sign) {
        console.log('[requestPayment] 调起支付，参数=', { timeStamp: ts, package: pkg, paySign: sign });
        try {
          wx.requestPayment({
            timeStamp: String(ts),
            nonceStr: String(payment.nonceStr || ''),
            package: String(pkg),
            signType: payment.signType || 'MD5',
            paySign: String(sign),
            success: () => {
              console.log('[requestPayment] 支付成功');
              // 支付成功后调用云函数标记订单为已支付
              // 必须用云函数：前端 update 受安全规则限制（订单由云函数创建，_openid 不匹配）
              if (orderId) {
                wx.cloud.callFunction({
                  name: 'markPaid',
                  data: { orderId: orderId }
                }).then(res => {
                  console.log('[markPaid] 云函数返回:', JSON.stringify(res.result));
                  clearCartAndGo(true);
                }).catch(err => {
                  console.error('[markPaid] 调用失败', err);
                  wx.showToast({ title: '支付成功，订单状态同步中', icon: 'none', duration: 2000 });
                  clearCartAndGo(true);
                });
              } else {
                clearCartAndGo(true);
              }
            },
            fail: (err) => {
              console.warn('[requestPayment] 支付取消/失败', err);
              wx.showToast({ title: '支付未完成，可稍后在订单中支付', icon: 'none', duration: 2500 });
              clearCartAndGo();
            }
          });
        } catch (e) {
          console.error('[requestPayment] 调用异常', e);
          wx.showToast({ title: '支付调用异常', icon: 'none' });
          clearCartAndGo();
        }
        return;
      }
      // payment 存在但字段不全
      console.error('[handlePayResult] payment 字段不全', payment);
      wx.showToast({ title: '支付参数异常，订单待付款', icon: 'none', duration: 2500 });
      clearCartAndGo();
      return;
    }

    // 路径 2：云函数返回了支付错误信息
    if (payError) {
      console.error('[handlePayResult] 支付错误:', payError, debug);
      wx.showModal({
        title: '支付暂不可用',
        content: String(payError) + (debug ? '\n\n' + String(debug).slice(0, 300) : ''),
        showCancel: false,
        success: () => clearCartAndGo()
      });
      return;
    }

    // 路径 3：既无 payment 也无 payError，视为订单已创建
    clearCartAndGo();
  }
});
