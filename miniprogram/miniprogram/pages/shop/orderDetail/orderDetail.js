// pages/shop/orderDetail/orderDetail.js 订单详情
const dbApi = require('../../../utils/db.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    id: '',
    order: null,
    items: [],
    totalText: '0.00',
    statusLabel: '',
    statusCls: '',
    loading: true
  },

  onLoad(query) {
    this.setData({ id: query.id });
  },

  onShow() {
    if (this.data.id) this.loadOrder();
  },

  // 加载订单
  loadOrder() {
    this.setData({ loading: true });
    dbApi.getOrder(this.data.id).then(o => {
      if (!o) {
        this.setData({ loading: false });
        wx.showToast({ title: '订单不存在', icon: 'none' });
        return;
      }
      const items = (o.items || []).map(it => Object.assign({}, it, {
        priceText: util.formatMoney(it.price),
        subtotalText: util.formatMoney((it.price || 0) * (it.qty || 0))
      }));
      const statusMap = {
        pending: { label: '待付款', cls: 'status-pending' },
        paid: { label: '待发货', cls: 'status-paid' },
        shipped: { label: '已发货', cls: 'status-shipped' },
        done: { label: '已完成', cls: 'status-done' },
        closed: { label: '已关闭', cls: 'status-closed' }
      };
      const st = statusMap[o.status] || { label: o.status, cls: '' };
      // 关键：把订单真实的 _id 回写，避免从微信支付发货管理入口
      // （传入 out_trade_no，即 orderNo）进入时，后续取消/确认收货
      // 调用 updateOrderStatus 时拿到的还是 orderNo 导致 doc(id) 失败
      this.setData({
        id: o._id,
        order: Object.assign({}, o, {
          timeText: util.formatTime(o.createTime)
        }),
        items,
        totalText: util.formatMoney(o.totalAmount),
        statusLabel: st.label,
        statusCls: st.cls,
        loading: false
      });
    }).catch(err => {
      console.error('加载订单失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 拨打电话
  onCall() {
    const phone = this.data.order && this.data.order.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  // 取消订单
  onCancel() {
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: res => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        dbApi.updateOrderStatus(this.data.id, 'closed').then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已取消', icon: 'success' });
          this.loadOrder();
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
      }
    });
  },

  // 确认收货
  onConfirm() {
    wx.showModal({
      title: '提示',
      content: '确认已收到商品？',
      success: res => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        dbApi.updateOrderStatus(this.data.id, 'done').then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已确认收货', icon: 'success' });
          this.loadOrder();
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
      }
    });
  },

  // 待付款订单 - 提示联系商家付款（开发环境支付不可用）
  onContactSeller() {
    wx.showModal({
      title: '联系商家付款',
      content: '请添加商家微信或拨打电话完成付款，付款后商家会为您更新订单状态。',
      showCancel: false
    });
  }
});
