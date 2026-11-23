// pages/shopOrder/shopOrder.js 顾客订单管理（老板端）
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

// 状态展示映射
const STATUS_MAP = {
  pending:  { label: '待付款', cls: 'st-pending' },
  paid:     { label: '待发货', cls: 'st-paid' },
  shipped:  { label: '已发货', cls: 'st-shipped' },
  done:     { label: '已完成', cls: 'st-done' },
  closed:   { label: '已关闭', cls: 'st-closed' }
};

const PAGE_SIZE = 20;

Page({
  data: {
    // 顶部状态筛选 tab：all=全部
    tabs: [
      { key: 'all',     label: '全部' },
      { key: 'pending', label: '待付款' },
      { key: 'paid',    label: '待发货' },
      { key: 'shipped', label: '已发货' },
      { key: 'done',    label: '已完成' }
    ],
    status: 'all',
    list: [],
    page: 1,
    hasMore: true,
    loading: false,
    loadingMore: false
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  // 切换状态 tab
  switchStatus(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.status) return;
    this.setData({ status: key });
    this.refresh();
  },

  // 重置并加载第一页
  refresh() {
    this.setData({ page: 1, hasMore: true, list: [] });
    return this.loadPage(true);
  },

  // 加载一页（first=true 表示第一页，会切换 loading 态）
  async loadPage(first) {
    if (this.data.loading || this.data.loadingMore) return;
    const setLoading = first ? { loading: true } : { loadingMore: true };
    this.setData(setLoading);
    try {
      const res = await dbApi.listAllOrders({
        status: this.data.status,
        page: this.data.page,
        pageSize: PAGE_SIZE
      });
      const rows = (res || []).map(o => this.formatOrder(o));
      const list = first ? rows : this.data.list.concat(rows);
      // 返回不足一页认为没有更多
      const hasMore = rows.length >= PAGE_SIZE;
      this.setData({ list, hasMore, loading: false, loadingMore: false });
    } catch (e) {
      console.error('加载订单失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false, loadingMore: false });
    }
  },

  // 格式化订单数据用于展示
  formatOrder(o) {
    const st = STATUS_MAP[o.status] || { label: o.status || '未知', cls: 'st-pending' };
    return {
      ...o,
      timeText: util.formatTime(o.createTime, 'YYYY-MM-DD HH:mm'),
      amountText: util.formatMoney(o.totalAmount),
      statusLabel: st.label,
      statusCls: st.cls,
      // 商品明细展示行
      itemRows: (o.items || []).map(it => ({
        name: it.name || '',
        qty: it.qty,
        spec: it.spec || ''
      })),
      hasItems: !!(o.items && o.items.length)
    };
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadPage(false);
  },

  // 拨打顾客电话
  callCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({ title: '该订单未填写手机号', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  // 发货（待付款→待发货 不在此操作；这里处理 待发货→已发货）
  async onShip(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({
      title: '确认发货',
      content: '确认已打包发出？订单状态将变更为「已发货」。',
      confirmText: '确认发货',
      confirmColor: '#7BC47F'
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      await dbApi.updateOrderStatus(id, 'shipped');
      wx.hideLoading();
      wx.showToast({ title: '已发货', icon: 'success' });
      this.refresh();
    } catch (err) {
      console.error('发货失败', err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 确认完成（已发货→已完成）
  async onDone(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({
      title: '确认完成',
      content: '确认该订单已完成？',
      confirmText: '确认完成',
      confirmColor: '#7BC47F'
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      await dbApi.updateOrderStatus(id, 'done');
      wx.hideLoading();
      wx.showToast({ title: '已完成', icon: 'success' });
      this.refresh();
    } catch (err) {
      console.error('完成失败', err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 提醒付款（仅提示，不实际操作）
  remindPay() {
    wx.showToast({ title: '请稍后通过微信联系顾客付款', icon: 'none' });
  }
});
