// pages/shop/detail/detail.js 商品详情
const app = getApp();
const util = require('../../../utils/util.js');

Page({
  data: {
    id: '',
    product: null,
    qty: 1,
    loading: true
  },

  onLoad(query) {
    const id = query.id;
    this.setData({ id });
    this.loadProduct(id);
  },

  // 查询单个商品（直接用云数据库基础 API）
  loadProduct(id) {
    this.setData({ loading: true });
    const db = wx.cloud.database();
    db.collection('products').doc(id).get().then(res => {
      const p = res.data;
      if (!p) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const priceText = util.formatMoney(p.price);
      this.setData({ product: Object.assign({}, p, { priceText }), loading: false });
    }).catch(err => {
      console.error('加载商品失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 数量减少
  onMinus() {
    if (this.data.qty <= 1) return;
    this.setData({ qty: this.data.qty - 1 });
  },

  // 数量增加（不超过库存）
  onPlus() {
    const stock = this.data.product ? this.data.product.stock : 0;
    if (this.data.qty >= stock) {
      wx.showToast({ title: '库存不足', icon: 'none' });
      return;
    }
    this.setData({ qty: this.data.qty + 1 });
  },

  // 输入数量
  onQtyInput(e) {
    let v = parseInt(e.detail.value) || 1;
    const stock = this.data.product ? this.data.product.stock : 0;
    if (v < 1) v = 1;
    if (stock > 0 && v > stock) v = stock;
    this.setData({ qty: v });
  },

  // 加入购物车（同商品 qty 累加，不超过库存）
  onAddCart() {
    const p = this.data.product;
    if (!p) return;
    if (p.stock <= 0) {
      wx.showToast({ title: '已售罄', icon: 'none' });
      return;
    }
    const cart = app.globalData.cart;
    const exist = cart.find(c => c.productId === p._id);
    if (exist) {
      exist.qty = Math.min(exist.qty + this.data.qty, p.stock);
    } else {
      cart.push({
        productId: p._id,
        name: p.name,
        category: p.category,
        image: p.image || '',
        spec: p.spec || '',
        price: p.price,
        unit: p.unit,
        qty: this.data.qty
      });
    }
    app.saveCart();
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  // 立即购买：跳结算页（buynow 模式）
  onBuyNow() {
    const p = this.data.product;
    if (!p) return;
    if (p.stock <= 0) {
      wx.showToast({ title: '已售罄', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/shop/checkout/checkout?from=buynow&productId=' + p._id + '&qty=' + this.data.qty
    });
  }
});
