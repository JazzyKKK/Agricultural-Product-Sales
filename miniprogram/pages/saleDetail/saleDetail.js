// pages/saleDetail/saleDetail.js 销售详情
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

const PAY_LABELS = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡'
};

Page({
  data: {
    id: '',
    sale: null,
    amountText: '0.00',
    timeText: '',
    payLabel: ''
  },

  onLoad(query) {
    this.setData({ id: query.id });
    this.loadSale();
  },

  async loadSale() {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const sale = await dbApi.getSale(this.data.id);
      if (!sale) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        return;
      }
      const items = (sale.items || []).map(it => ({
        ...it,
        priceText: util.formatMoney(it.price),
        amountText: util.formatMoney(it.amount)
      }));
      this.setData({
        sale: { ...sale, items },
        amountText: util.formatMoney(sale.totalAmount),
        timeText: util.formatTime(sale.saleDate, 'YYYY-MM-DD HH:mm'),
        payLabel: PAY_LABELS[sale.payMethod] || sale.payMethod || '现金'
      });
    } catch (e) {
      console.error('加载销售详情失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goCustomer() {
    if (this.data.sale && this.data.sale.customerId) {
      wx.navigateTo({
        url: `/pages/customerDetail/customerDetail?id=${this.data.sale.customerId}`
      });
    }
  },

  onDelete() {
    const sale = this.data.sale;
    if (!sale) return;
    wx.showModal({
      title: '确认删除',
      content: `删除订单 ${sale.orderNo}？此操作将回减客户汇总且不可恢复。`,
      confirmColor: '#E64340',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        // removeSale 传入完整 sale 对象，内部会回减客户汇总
        dbApi.removeSale(sale).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }).catch(err => {
          wx.hideLoading();
          console.error('删除失败', err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  }
});
