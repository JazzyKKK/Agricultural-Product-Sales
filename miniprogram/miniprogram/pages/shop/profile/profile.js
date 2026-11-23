// pages/shop/profile/profile.js 我的
const app = getApp();

Page({
  data: {
    openidMasked: '未登录',
    isBoss: false
  },

  onShow() {
    this.refreshUser();
  },

  refreshUser() {
    const openid = app.globalData.openid;
    let masked = '未登录';
    if (openid) {
      // 脱敏：只显示后4位
      if (openid.length > 4) {
        masked = '****' + openid.slice(-4);
      } else {
        masked = openid;
      }
    }
    this.setData({ openidMasked: masked, isBoss: !!app.globalData.isBoss });
  },

  // 我的订单
  goOrders() {
    wx.switchTab({ url: '/pages/shop/orders/orders' });
  },

  // 购物车
  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' });
  },

  // 联系商家
  onContact() {
    // 占位号码，老板请替换为真实客服电话
    wx.makePhoneCall({ phoneNumber: '13659270717' });
  },

  // 关于我们
  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: '阳光玫瑰葡萄园，专注现摘太白香印葡萄与手工葡萄酒，从田间到舌尖，自然好味道。',
      showCancel: false
    });
  },

  // 长按 ID 栏 → 弹出密码框解锁老板身份
  onLongPressId() {
    wx.showModal({
      title: '老板身份验证',
      editable: true,
      placeholderText: '请输入老板密码',
      success: (res) => {
        if (res.confirm && res.content) {
          const ok = app.unlockByPassword(res.content.trim());
          if (ok) {
            wx.showToast({ title: '验证成功', icon: 'success' });
            this.setData({ isBoss: true });
            this.refreshUser();
          } else {
            wx.showToast({ title: '密码错误', icon: 'none' });
          }
        }
      }
    });
  },

  // 老板进入记账后台
  goBoss() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 退出老板身份
  logoutBoss() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需重新输入密码才能进入老板后台',
      success: (res) => {
        if (res.confirm) {
          app.lockBoss();
          this.setData({ isBoss: false });
          this.refreshUser();
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  }
});
