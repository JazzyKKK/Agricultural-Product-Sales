// pages/index/index.js 工作台首页
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

Page({
  data: {
    todayAmount: '0.00',
    todayOrders: 0,
    monthAmount: '0.00',
    monthOrders: 0,
    recentSales: [],
    pendingOrders: 0,   // 顾客线上待发货订单数
    loading: true
  },

  onShow() {
    this.loadDashboard();
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  },

  async loadDashboard() {
    this.setData({ loading: true });
    try {
      const tStart = util.todayStart();
      const mStart = util.monthStart();
      const now = Date.now();

      const [todayStat, monthStat, recent, pending] = await Promise.all([
        dbApi.statByRange(tStart, now),
        dbApi.statByRange(mStart, now),
        dbApi.listSales({ page: 1, pageSize: 5 }),
        dbApi.listAllOrders({ status: 'paid', page: 1, pageSize: 100 }).catch(() => [])
      ]);

      const recentSales = recent.map(s => ({
        ...s,
        amountText: util.formatMoney(s.totalAmount),
        timeText: util.formatTime(s.saleDate, 'MM-DD HH:mm')
      }));

      this.setData({
        todayAmount: util.formatMoney(todayStat.totalAmount),
        todayOrders: todayStat.totalOrders,
        monthAmount: util.formatMoney(monthStat.totalAmount),
        monthOrders: monthStat.totalOrders,
        recentSales,
        pendingOrders: pending.length,
        loading: false
      });
    } catch (e) {
      console.error('加载工作台失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请检查云环境', icon: 'none' });
    }
  },

  goNewSale() {
    wx.navigateTo({ url: '/pages/sale/sale' });
  },

  goSaleList() {
    wx.navigateTo({ url: '/pages/saleList/saleList' });
  },

  goCustomer() {
    wx.reLaunch({ url: '/pages/customer/customer' });
  },

  goProduct() {
    wx.navigateTo({ url: '/pages/product/product' });
  },

  goStats() {
    wx.reLaunch({ url: '/pages/stats/stats' });
  },

  goShopOrder() {
    wx.navigateTo({ url: '/pages/shopOrder/shopOrder' });
  },

  callCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  }
});
