// pages/shop/paySuccess/paySuccess.js
// 支付成功页：仅展示成功提示，不显示物流状态等复杂信息
Page({
  data: {},

  // 回到首页
  goHome() {
    wx.switchTab({ url: '/pages/shop/home/home' });
  },

  // 查看订单列表
  goOrders() {
    wx.switchTab({ url: '/pages/shop/orders/orders' });
  },

  // 联系商家
  callBoss() {
    wx.makePhoneCall({ phoneNumber: '13659270717' });
  }
});
