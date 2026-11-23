// pages/shop/profile/profile.js 我的
const app = getApp();

Page({
  data: {
    openidMasked: '未登录',
    isBoss: false,
    qrcodeUrl: ''
  },

  onShow() {
    this.refreshUser();
  },

  // 转发给好友
  onShareAppMessage() {
    return {
      title: '太白香印葡萄 · 产地直发，自然成熟',
      path: '/pages/shop/home/home',
      imageUrl: '/images/grape-banner-real.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '太白香印葡萄 · 产地直发，自然成熟',
      query: '',
      imageUrl: '/images/grape-banner-real.jpg'
    };
  },

  // 生成小程序码
  onGenQrcode() {
    if (this.data.qrcodeUrl) return;
    wx.showLoading({ title: '生成中...', mask: true });
    wx.cloud.callFunction({
      name: 'getMiniCode',
      data: {
        scene: 'home',
        page: 'pages/shop/home/home'
      }
    }).then(res => {
      wx.hideLoading();
      const result = res && res.result;
      if (result && result.code === 'OK' && result.fileID) {
        this.setData({ qrcodeUrl: result.fileID });
      } else {
        wx.showToast({ title: (result && result.msg) || '生成失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('生成二维码失败', err);
      wx.hideLoading();
      wx.showToast({ title: '生成失败', icon: 'none' });
    });
  },

  // 关闭二维码弹窗
  onCloseQrcode() {
    this.setData({ qrcodeUrl: '' });
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
      content: '阳光玫瑰葡萄园，专注现摘太白香印葡萄，从田间到舌尖，自然好味道。',
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
