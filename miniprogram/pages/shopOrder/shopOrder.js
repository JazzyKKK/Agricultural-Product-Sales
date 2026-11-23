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

// 微信支付 V3 发货信息管理 API 支持的快递公司编码
// 完整列表见：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter9_2_1.shtml
const COURIER_LIST = [
  { code: 'SF',    name: '顺丰速运' },
  { code: 'YTO',   name: '圆通速递' },
  { code: 'ZTO',   name: '中通快递' },
  { code: 'STO',   name: '申通快递' },
  { code: 'YD',    name: '韵达快递' },
  { code: 'EMS',   name: '邮政EMS' },
  { code: 'JD',    name: '京东物流' },
  { code: 'DBKD',  name: '德邦快递' },
  { code: 'HTKY',  name: '百世快递' },
  { code: 'ZJS',   name: '宅急送' },
  { code: 'YZPY',  name: '邮政快递包裹' },
  { code: 'OTHER', name: '其他快递' }
];

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
    loadingMore: false,
    // 发货弹窗
    shipDialogVisible: false,
    shipOrderId: '',
    courierIndex: 0,
    courierList: COURIER_LIST,
    trackingNumber: ''
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
    // 快递公司编码 → 中文名
    const courier = COURIER_LIST.find(c => c.code === o.shippingCompany);
    return {
      ...o,
      timeText: util.formatTime(o.createTime, 'YYYY-MM-DD HH:mm'),
      amountText: util.formatMoney(o.totalAmount),
      statusLabel: st.label,
      statusCls: st.cls,
      shippingCompanyName: courier ? courier.name : (o.shippingCompany || ''),
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

  // 点击「发货」→ 弹出快递信息填写表单
  onShip(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      shipDialogVisible: true,
      shipOrderId: id,
      courierIndex: 0,
      trackingNumber: ''
    });
  },

  // 选择快递公司
  onCourierChange(e) {
    this.setData({ courierIndex: Number(e.detail.value) });
  },

  // 输入快递单号
  onTrackingInput(e) {
    this.setData({ trackingNumber: e.detail.value.trim() });
  },

  // 空函数：用于拦截弹窗内部的事件冒泡，防止点击弹窗内容时关闭弹窗
  noop() {},

  // 关闭发货弹窗
  onCloseShipDialog() {
    this.setData({ shipDialogVisible: false, shipOrderId: '', trackingNumber: '' });
  },

  // 确认发货（提交快递信息并上报微信）
  async onConfirmShip() {
    const { shipOrderId, courierIndex, courierList, trackingNumber } = this.data;
    const courier = courierList[courierIndex];

    if (!trackingNumber) {
      wx.showToast({ title: '请填写快递单号', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发货中...', mask: true });
    try {
      const r = await wx.cloud.callFunction({
        name: 'bossUpdateOrder',
        data: {
          orderId: shipOrderId,
          status: 'shipped',
          password: getApp().globalData.bossPassword,
          shippingCompany: courier.code,
          trackingNumber
        }
      });
      if (r.result && r.result.code !== 'OK') throw new Error(r.result.msg);

      const result = r.result;
      wx.hideLoading();
      this.setData({ shipDialogVisible: false, shipOrderId: '', trackingNumber: '' });

      // 根据是否成功上报微信给出不同提示
      if (result.wxReportOk) {
        wx.showToast({ title: '已发货并上报微信', icon: 'success' });
      } else if (result.wxReportMsg) {
        wx.showToast({ title: '已发货（' + result.wxReportMsg + '）', icon: 'none', duration: 3000 });
      } else {
        wx.showToast({ title: '已发货', icon: 'success' });
      }

      // 直接更新本地列表中的该订单，立刻显示快递信息，无需刷新
      const idx = this.data.list.findIndex(o => o._id === shipOrderId);
      if (idx >= 0) {
        const list = this.data.list.slice();
        const o = list[idx];
        list[idx] = this.formatOrder(Object.assign({}, o, {
          status: 'shipped',
          shippingCompany: courier.code,
          trackingNumber,
          shipTime: new Date()
        }));
        this.setData({ list });
      }
    } catch (err) {
      console.error('发货失败', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
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
      const r = await wx.cloud.callFunction({
        name: 'bossUpdateOrder',
        data: { orderId: id, status: 'done', password: getApp().globalData.bossPassword }
      });
      if (r.result && r.result.code !== 'OK') throw new Error(r.result.msg);
      wx.hideLoading();
      wx.showToast({ title: '已完成', icon: 'success' });
      this.refresh();
    } catch (err) {
      console.error('完成失败', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 提醒付款（仅提示，不实际操作）
  remindPay() {
    wx.showToast({ title: '请稍后通过微信联系顾客付款', icon: 'none' });
  },

  // 删除订单（仅未付款的 pending 订单可删）
  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const res = await wx.showModal({
      title: '确认删除',
      content: '此订单未付款，删除后无法恢复。确认删除该订单吗？',
      confirmText: '确认删除',
      confirmColor: '#E74C3C'
    });
    if (!res.confirm) return;

    wx.showLoading({ title: '删除中...', mask: true });
    try {
      const r = await wx.cloud.callFunction({
        name: 'bossUpdateOrder',
        data: { orderId: id, status: 'delete', password: getApp().globalData.bossPassword }
      });
      if (r.result && r.result.code !== 'OK') throw new Error(r.result.msg);
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      // 从本地列表移除该订单
      const list = this.data.list.filter(o => o._id !== id);
      this.setData({ list });
    } catch (err) {
      console.error('删除订单失败', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  }
});
