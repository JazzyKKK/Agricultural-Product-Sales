// pages/customer/customer.js 客户列表
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

Page({
  data: {
    keyword: '',
    list: [],
    loading: true
  },

  onShow() {
    // 每次进入/返回都刷新，确保看到最新数据
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  // quiet=true 时不切换 loading 态，避免输入时列表抖动
  async loadList(quiet) {
    if (!quiet) this.setData({ loading: true });
    try {
      const list = await dbApi.listCustomers(this.data.keyword);
      // 兼容 totalAmount/totalOrders 字段为空
      const rows = list.map(c => ({
        ...c,
        amountText: util.formatMoney(c.totalAmount || 0),
        totalOrders: c.totalOrders || 0
      }));
      this.setData({ list: rows, loading: false });
    } catch (e) {
      console.error('加载客户列表失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 输入即搜索
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    this.loadList(true);
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/customerEdit/customerEdit' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/customerDetail/customerDetail?id=' + id });
  },

  // 一键拨打电话（catchtap 阻止冒泡到卡片跳转）
  callCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({ title: '该客户未填写手机号', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  }
});
