// pages/shop/category/category.js 分类页
const app = getApp();
const dbApi = require('../../../utils/db.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    tabs: [
      { key: '', label: '全部' },
      { key: '葡萄', label: '葡萄' },
      { key: '葡萄酒', label: '葡萄酒' }
    ],
    activeKey: '',
    products: [],
    loading: true
  },

  onShow() {
    // 若首页快捷入口设置了 pendingCategory，则切换并清空
    const pending = app.globalData.pendingCategory;
    if (pending) {
      app.globalData.pendingCategory = null;
      this.setData({ activeKey: pending });
    }
    this.loadProducts();
  },

  // 切换分类
  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeKey) return;
    this.setData({ activeKey: key });
    this.loadProducts();
  },

  // 按分类加载上架商品
  loadProducts() {
    this.setData({ loading: true });
    const cat = this.data.activeKey || null;
    dbApi.listProducts(cat, { onSaleOnly: true }).then(list => {
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
