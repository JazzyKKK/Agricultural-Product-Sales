// pages/customerDetail/customerDetail.js 客户详情
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

// 支付方式中文名映射
const PAY_LABEL = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡'
};

Page({
  data: {
    id: '',
    customer: null,
    sales: [],
    amountText: '0.00',
    loading: true
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id });
    }
  },

  onShow() {
    // 编辑返回后刷新
    if (this.data.id) this.loadAll();
  },

  // 并行加载客户信息与消费记录
  async loadAll() {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const [customer, sales] = await Promise.all([
        dbApi.getCustomer(this.data.id),
        dbApi.listSales({ customerId: this.data.id, page: 1, pageSize: 100 })
      ]);
      const rows = (sales || []).map(s => ({
        ...s,
        timeText: util.formatTime(s.saleDate, 'YYYY-MM-DD HH:mm'),
        amountText: util.formatMoney(s.totalAmount),
        qtyText: (s.items || []).length,
        payLabel: PAY_LABEL[s.payMethod] || s.payMethod || '现金'
      }));
      this.setData({
        customer,
        sales: rows,
        amountText: util.formatMoney(customer.totalAmount || 0),
        loading: false
      });
    } catch (e) {
      console.error('加载客户详情失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  callCustomer() {
    const phone = this.data.customer && this.data.customer.phone;
    if (!phone) {
      wx.showToast({ title: '未填写手机号', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/customerEdit/customerEdit?id=' + this.data.id });
  },

  goSaleDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/saleDetail/saleDetail?id=' + id });
  }
});
