// custom-tab-bar/index.js  顾客端底部导航
const app = getApp();

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/shop/home/home',     text: '商城', icon: '🏠' },
      { pagePath: '/pages/shop/category/category', text: '分类', icon: '☰' },
      { pagePath: '/pages/shop/orders/orders', text: '订单', icon: '📜' },
      { pagePath: '/pages/shop/profile/profile', text: '我的', icon: '☺' }
    ]
  },

  pageLifetimes: {
    show() {
      // 同步当前选中项
      const pages = getCurrentPages();
      const route = '/' + pages[pages.length - 1].route;
      const idx = this.data.list.findIndex(t => t.pagePath === route);
      if (idx >= 0) this.setData({ selected: idx });
    }
  },

  methods: {
    onTap(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      wx.switchTab({ url: item.pagePath });
    }
  }
});
