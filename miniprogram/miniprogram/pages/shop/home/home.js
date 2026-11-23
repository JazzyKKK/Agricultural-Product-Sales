// pages/shop/home/home.js 商城首页
const app = getApp();
const dbApi = require('../../../utils/db.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    keyword: '',
    products: [],      // 全部上架商品（含 priceText）
    filtered: [],      // 搜索过滤后
    loading: true,
    phone: '13659270717'
  },

  onLoad() {
    // 老板主动切换到顾客商城时，跳过自动跳回
    if (app.globalData.bossWantShop) {
      app.globalData.bossWantShop = false;
      this._roleChecked = true;
      this.loadProducts();
      return;
    }
    app.onRoleReady((isBoss) => {
      if (isBoss && !this._roleChecked) {
        this._roleChecked = true;
        wx.reLaunch({ url: '/pages/index/index' });
        return;
      }
      this._roleChecked = true;
    });
    this.loadProducts();
  },

  onShow() {
    // 老板已在 onLoad 处理跳转逻辑，onShow 仅刷新商品
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
      this.applyFilter();
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 输入搜索关键词
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  // 本地搜索过滤
  applyFilter() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) {
      this.setData({ filtered: this.data.products });
      return;
    }
    const filtered = this.data.products.filter(p => (p.name || '').indexOf(kw) >= 0);
    this.setData({ filtered });
  },

  // 跳转分类页（快捷入口可指定分类，经 globalData 暂存传递）
  goCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    if (cat) app.globalData.pendingCategory = cat;
    wx.switchTab({ url: '/pages/shop/category/category' });
  },

  // 跳转商品详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p._id === id);
    if (product && product.stock <= 0) {
      wx.showToast({ title: '已售罄', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id });
  },

  // 跳转购物车
  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' });
  },

  // 联系商家
  onContact() {
    wx.makePhoneCall({ phoneNumber: this.data.phone });
  }
});
