// app.js
App({
  globalData: {
    openid: '',
    envId: 'cloud1-d5gxuo4anea6691aa',
    userInfo: null,
    isBoss: false,
    roleReady: false,
    // ===== 老板身份验证 =====
    // 方式1（推荐）：密码解锁。在顾客端「我的」页长按 openid 一栏弹出密码框，密码正确即可进入老板后台。
    // 方式2：openid 白名单。把你的 openid 填到 bossOpenids 数组里（同一个 AppID 下 openid 稳定不变）。
    bossOpenids: [
      // 'oh1db3cQTLkVdpdAAjedGd54GKY'
    ],
    bossPassword: '816919',  // 老板密码
    // 顾客端购物车（本地缓存，key: cart）
    cart: []
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
    this.loadCart();
    this.login();
  },

  // 静默登录，获取 openid 并判定角色
  login() {
    if (this.globalData.openid) {
      this.resolveRole();
      return Promise.resolve(this.globalData.openid);
    }
    return wx.cloud.callFunction({
      name: 'login',
      data: {}
    }).then(res => {
      this.globalData.openid = res.result.openid;
      this.resolveRole();
      return res.result.openid;
    }).catch(err => {
      console.error('登录失败', err);
      this.globalData.roleReady = true;
    });
  },

  // 判定是否老板
  resolveRole() {
    const openidMatched = this.globalData.bossOpenids.indexOf(this.globalData.openid) >= 0;
    const passwordUnlocked = wx.getStorageSync('bossUnlocked') === true;
    const isBoss = openidMatched || passwordUnlocked;
    this.globalData.isBoss = isBoss;
    this.globalData.roleReady = true;
    if (this._roleCallbacks) {
      this._roleCallbacks.forEach(fn => fn(isBoss));
      this._roleCallbacks = null;
    }
  },

  // 密码解锁（成功后本地持久化，下次自动生效）
  unlockByPassword(password) {
    const pwd = this.globalData.bossPassword;
    if (password === pwd) {
      wx.setStorageSync('bossUnlocked', true);
      this.globalData.isBoss = true;
      return true;
    }
    return false;
  },

  // 退出老板身份（清除本地解锁标记）
  lockBoss() {
    wx.removeStorageSync('bossUnlocked');
    this.globalData.isBoss = false;
  },

  // 页面可注册回调，在角色判定完成时触发（若已完成则立即触发）
  onRoleReady(cb) {
    if (this.globalData.roleReady) {
      cb(this.globalData.isBoss);
    } else {
      this._roleCallbacks = this._roleCallbacks || [];
      this._roleCallbacks.push(cb);
    }
  },

  // 老板跳转到记账后台首页
  gotoBossHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 老板临时切换到顾客商城（不退出老板身份，仅跳过自动跳回）
  gotoShopHome() {
    this.globalData.bossWantShop = true;
    wx.reLaunch({ url: '/pages/shop/home/home' });
  },

  // ===== 购物车（本地） =====
  loadCart() {
    try {
      const cart = wx.getStorageSync('cart');
      this.globalData.cart = Array.isArray(cart) ? cart : [];
    } catch (e) {
      this.globalData.cart = [];
    }
  },

  saveCart() {
    try {
      wx.setStorageSync('cart', this.globalData.cart);
    } catch (e) {}
  }
});
