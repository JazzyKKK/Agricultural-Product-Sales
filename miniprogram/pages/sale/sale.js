// pages/sale/sale.js 新建销售
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

Page({
  data: {
    customer: null,            // 选中的客户 { _id, name, phone }
    isWalkIn: false,           // 散客
    items: [],                 // 销售明细
    payMethod: 'cash',
    payMethods: [
      { key: 'cash', label: '现金' },
      { key: 'wechat', label: '微信' },
      { key: 'alipay', label: '支付宝' },
      { key: 'card', label: '银行卡' }
    ],
    remark: '',
    totalAmountText: '0.00',
    totalQty: 0,
    submitting: false,

    // 客户选择弹窗
    showCustomerPicker: false,
    customerKeyword: '',
    customerList: [],

    // 商品选择弹窗
    showProductPicker: false,
    productList: []
  },

  onLoad() {
    this.loadProducts();
  },

  onShow() {
    // 从销售页跳转新增客户后返回，自动选中该客户
    const app = getApp();
    if (app.globalData._pendingCustomer) {
      const c = app.globalData._pendingCustomer;
      delete app.globalData._pendingCustomer;
      this.setData({
        customer: { _id: c._id, name: c.name, phone: c.phone },
        isWalkIn: false,
        showCustomerPicker: false
      });
      return;
    }
    // 客户选择弹窗打开时刷新列表
    if (this.data.showCustomerPicker) this.searchCustomer();
  },

  // ===== 商品目录 =====
  async loadProducts() {
    try {
      const list = await dbApi.listProducts();
      this._allProducts = list;
      this.filterProducts();
    } catch (e) {
      console.error('加载商品失败', e);
    }
  },

  filterProducts() {
    const list = (this._allProducts || []).map(p => ({
      ...p,
      priceText: util.formatMoney(p.price)
    }));
    this.setData({ productList: list });
  },

  openProductPicker() {
    this.setData({ showProductPicker: true });
  },

  closeProductPicker() {
    this.setData({ showProductPicker: false });
  },

  // 选中一个商品加入明细
  pickProduct(e) {
    const p = e.currentTarget.dataset.p;
    const items = this.data.items.slice();
    // 若已存在同商品同价格则数量+1
    const exist = items.findIndex(it => it.productId === p._id && it.price === p.price);
    if (exist >= 0) {
      items[exist].qty = +(items[exist].qty + 1).toFixed(2);
    } else {
      items.push({
        productId: p._id,
        name: p.name,
        category: p.category,
        spec: p.spec || '',
        price: p.price,
        priceText: util.formatMoney(p.price),
        unit: p.unit || '斤',
        qty: 1
      });
    }
    this.setData({ items, showProductPicker: false });
    this.recalc();
  },

  // 修改数量
  onQtyInput(e) {
    const idx = e.currentTarget.dataset.idx;
    let val = parseFloat(e.detail.value);
    if (isNaN(val) || val < 0) val = 0;
    const items = this.data.items.slice();
    items[idx].qty = val;
    this.setData({ items });
    this.recalc();
  },

  // 修改单价
  onPriceInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const fen = util.yuanToFen(e.detail.value);
    const items = this.data.items.slice();
    items[idx].price = fen;
    items[idx].priceText = util.formatMoney(fen);
    this.setData({ items });
    this.recalc();
  },

  changeQty(e) {
    const idx = e.currentTarget.dataset.idx;
    const delta = e.currentTarget.dataset.delta;
    const items = this.data.items.slice();
    let q = +(items[idx].qty + delta).toFixed(2);
    if (q < 0) q = 0;
    items[idx].qty = q;
    this.setData({ items });
    this.recalc();
  },

  removeItem(e) {
    const idx = e.currentTarget.dataset.idx;
    const items = this.data.items.slice();
    items.splice(idx, 1);
    this.setData({ items });
    this.recalc();
  },

  recalc() {
    let total = 0;
    let qty = 0;
    this.data.items.forEach(it => {
      total += it.price * it.qty;
      qty += Number(it.qty) || 0;
    });
    this.setData({
      totalAmountText: util.formatMoney(total),
      totalQty: +qty.toFixed(2)
    });
  },

  // ===== 客户选择 =====
  openCustomerPicker() {
    this.setData({ showCustomerPicker: true, customerKeyword: '' });
    this.searchCustomer();
  },

  closeCustomerPicker() {
    this.setData({ showCustomerPicker: false });
  },

  onCustomerKeywordInput(e) {
    this.setData({ customerKeyword: e.detail.value });
    this.searchCustomer();
  },

  async searchCustomer() {
    try {
      const list = await dbApi.listCustomers(this.data.customerKeyword);
      this.setData({ customerList: list });
    } catch (e) {
      console.error(e);
    }
  },

  pickCustomer(e) {
    const c = e.currentTarget.dataset.c;
    this.setData({
      customer: { _id: c._id, name: c.name, phone: c.phone },
      isWalkIn: false,
      showCustomerPicker: false
    });
  },

  setWalkIn() {
    this.setData({
      customer: null,
      isWalkIn: true,
      showCustomerPicker: false
    });
  },

  clearCustomer() {
    this.setData({ customer: null, isWalkIn: false });
  },

  goAddCustomer() {
    wx.navigateTo({ url: '/pages/customerEdit/customerEdit?from=sale' });
  },

  // ===== 其他 =====
  pickPay(e) {
    this.setData({ payMethod: e.currentTarget.dataset.key });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.items.length) {
      wx.showToast({ title: '请添加销售商品', icon: 'none' });
      return;
    }
    if (!this.data.customer && !this.data.isWalkIn) {
      wx.showToast({ title: '请选择客户或散客', icon: 'none' });
      return;
    }
    // 校验数量
    for (const it of this.data.items) {
      if (!it.qty || it.qty <= 0) {
        wx.showToast({ title: `${it.name} 数量需大于0`, icon: 'none' });
        return;
      }
    }

    this.setData({ submitting: true });
    const items = this.data.items.map(it => ({
      productId: it.productId,
      name: it.name,
      category: it.category,
      spec: it.spec,
      price: it.price,
      qty: Number(it.qty),
      amount: Math.round(it.price * it.qty)
    }));
    const totalAmount = items.reduce((s, it) => s + it.amount, 0);

    const saleData = {
      orderNo: util.genOrderNo(),
      customerId: this.data.customer ? this.data.customer._id : '',
      customerName: this.data.customer ? this.data.customer.name : '散客',
      customerPhone: this.data.customer ? this.data.customer.phone : '',
      items,
      totalAmount,
      payMethod: this.data.payMethod,
      remark: this.data.remark
    };

    try {
      await dbApi.addSale(saleData);
      if (this.data.customer) {
        await dbApi.incCustomerStats(this.data.customer._id, totalAmount);
      }
      wx.showToast({ title: '记账成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      console.error('提交失败', e);
      wx.showToast({ title: '提交失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  }
});
