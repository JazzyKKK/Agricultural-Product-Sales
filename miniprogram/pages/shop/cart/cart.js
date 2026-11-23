// pages/shop/cart/cart.js 购物车
const app = getApp();
const util = require('../../../utils/util.js');

Page({
  data: {
    items: [],     // 含 subtotalText、priceText
    totalText: '0.00'
  },

  onShow() {
    this.refreshCart();
  },

  // 从全局读取购物车并渲染
  refreshCart() {
    const cart = app.globalData.cart || [];
    let total = 0;
    const items = cart.map(it => {
      const subtotal = (it.price || 0) * (it.qty || 0);
      total += subtotal;
      return Object.assign({}, it, {
        priceText: util.formatMoney(it.price),
        subtotalText: util.formatMoney(subtotal)
      });
    });
    this.setData({ items, totalText: util.formatMoney(total) });
  },

  // 数量减少（数量为1再减则询问删除）
  onMinus(e) {
    const idx = e.currentTarget.dataset.index;
    const cart = app.globalData.cart;
    const it = cart[idx];
    if (!it) return;
    if (it.qty <= 1) {
      this.removeItem(idx);
      return;
    }
    it.qty -= 1;
    app.saveCart();
    this.refreshCart();
  },

  // 数量增加
  onPlus(e) {
    const idx = e.currentTarget.dataset.index;
    const cart = app.globalData.cart;
    const it = cart[idx];
    if (!it) return;
    it.qty += 1;
    app.saveCart();
    this.refreshCart();
  },

  // 输入数量
  onQtyInput(e) {
    const idx = e.currentTarget.dataset.index;
    const cart = app.globalData.cart;
    const it = cart[idx];
    if (!it) return;
    let v = parseInt(e.detail.value) || 1;
    if (v < 1) v = 1;
    it.qty = v;
    app.saveCart();
    this.refreshCart();
  },

  // 删除单项（带确认）
  removeItem(idx) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该商品吗？',
      success: res => {
        if (res.confirm) {
          app.globalData.cart.splice(idx, 1);
          app.saveCart();
          this.refreshCart();
        }
      }
    });
  },

  // 删除按钮
  onDelete(e) {
    const idx = e.currentTarget.dataset.index;
    this.removeItem(idx);
  },

  // 去结算
  onCheckout() {
    if (!this.data.items.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/shop/checkout/checkout?from=cart' });
  },

  // 去逛逛
  goHome() {
    wx.switchTab({ url: '/pages/shop/home/home' });
  }
});
