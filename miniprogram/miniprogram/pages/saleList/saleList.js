// pages/saleList/saleList.js 销售流水
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
    rangeTabs: [
      { key: 'today', label: '今天' },
      { key: '7d', label: '近7天' },
      { key: '30d', label: '近30天' },
      { key: 'all', label: '全部' }
    ],
    rangeKey: 'today',
    keyword: '',
    list: [],
    filteredList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    loadedOrders: 0,
    loadedAmountText: '0.00'
  },

  onLoad() {
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false);
    }
  },

  // 计算时间范围
  getRange(key) {
    const now = Date.now();
    if (key === 'today') {
      return { startTs: util.todayStart(), endTs: now };
    }
    if (key === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 6); // 含今天共7天
      d.setHours(0, 0, 0, 0);
      return { startTs: d.getTime(), endTs: now };
    }
    if (key === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 29); // 含今天共30天
      d.setHours(0, 0, 0, 0);
      return { startTs: d.getTime(), endTs: now };
    }
    return { startTs: 0, endTs: now }; // 全部
  },

  async loadList(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    try {
      const { startTs, endTs } = this.getRange(this.data.rangeKey);
      const res = await dbApi.listSales({
        page,
        pageSize: this.data.pageSize,
        startTs: startTs || undefined,
        endTs
      });
      const mapped = (res || []).map(s => ({
        ...s,
        customerNameText: s.customerName || '散客',
        timeText: util.formatTime(s.saleDate, 'YYYY-MM-DD HH:mm'),
        amountText: util.formatMoney(s.totalAmount),
        qtyText: (s.items || []).length,
        payLabel: PAY_LABELS[s.payMethod] || s.payMethod || '现金'
      }));
      const list = reset ? mapped : this.data.list.concat(mapped);
      // 本地汇总已加载列表
      let total = 0;
      list.forEach(s => total += s.totalAmount || 0);
      this.setData({
        list,
        page,
        hasMore: mapped.length >= this.data.pageSize,
        loading: false,
        loadedOrders: list.length,
        loadedAmountText: util.formatMoney(total)
      }, () => this.applyFilter());
    } catch (e) {
      console.error('加载销售流水失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  switchRange(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.rangeKey) return;
    this.setData({ rangeKey: key });
    this.loadList(true);
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  // 本地按客户名过滤已加载列表
  applyFilter() {
    const kw = (this.data.keyword || '').trim();
    const filtered = kw
      ? this.data.list.filter(s => (s.customerNameText || '').indexOf(kw) >= 0)
      : this.data.list;
    this.setData({ filteredList: filtered });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/saleDetail/saleDetail?id=${id}` });
  }
});
