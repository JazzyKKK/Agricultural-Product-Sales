// pages/shop/category/category.js 商品列表页
const dbApi = require('../../../utils/db.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    products: [],
    loading: true
  },

  onShow() {
    this.loadProducts();
  },

  // 加载全部上架商品
  loadProducts() {
    this.setData({ loading: true });
    dbApi.listProducts(null, { onSaleOnly: true }).then(list => {
      const products = (list || []).map(p => Object.assign({}, p, {
        priceText: util.formatMoney(p.price)
      }));
      this.setData({ products, loading: false });
    }).catch(() => {
      this.setData({ loading: false, products: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 跳转商品详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id });
  }
});
