// components/boss-tab-bar/boss-tab-bar.js  老板端底部导航
Component({
  properties: {
    selected: { type: Number, value: 0 }
  },
  data: {
    list: [
      { pagePath: '/pages/index/index',       text: '工作台', icon: '📊' },
      { pagePath: '/pages/customer/customer', text: '客户',   icon: '☺' },
      { pagePath: '/pages/stats/stats',       text: '统计',   icon: '▣' },
      { pagePath: '/pages/mine/mine',         text: '我的',   icon: '⚙' }
    ]
  },
  methods: {
    onTap(e) {
      const idx = e.currentTarget.dataset.index;
      if (idx === this.data.selected) return;
      const item = this.data.list[idx];
      wx.reLaunch({ url: item.pagePath });
    }
  }
});
