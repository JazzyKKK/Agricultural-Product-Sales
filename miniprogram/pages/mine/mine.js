// pages/mine/mine.js 我的
const app = getApp();

Page({
  data: {
    openid: '',
    envId: ''
  },

  onShow() {
    this.setData({
      openid: app.globalData.openid || '',
      envId: app.globalData.envId || ''
    });
  },

  goProduct() {
    wx.navigateTo({ url: '/pages/product/product' });
  },

  goSaleList() {
    wx.navigateTo({ url: '/pages/saleList/saleList' });
  },

  goShopOrder() {
    wx.navigateTo({ url: '/pages/shopOrder/shopOrder' });
  },

  goStats() {
    wx.reLaunch({ url: '/pages/stats/stats' });
  },

  goCustomer() {
    wx.reLaunch({ url: '/pages/customer/customer' });
  },

  // 切换到顾客商城
  goShop() {
    app.gotoShopHome();
  },

  // 云环境提示：不实际修改，仅指引去 app.js 修改
  showEnvTip() {
    wx.showModal({
      title: '云环境 ID',
      content: `当前环境：${this.data.envId || '未配置'}\n\n如需修改，请打开 app.js，编辑 globalData.envId 为你的云开发环境 ID 后重新编译。`,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
