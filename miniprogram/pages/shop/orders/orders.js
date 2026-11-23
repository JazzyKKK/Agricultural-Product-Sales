// pages/shop/orders/orders.js 我的订单
const app = getApp();
const dbApi = require('../../../utils/db.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    tabs: [
      { key: '', label: '全部' },
      { key: 'pending', label: '待付款' },
      { key: 'paid', label: '待发货' },
      { key: 'shipped', label: '已发货' },
      { key: 'done', label: '已完成' }
    ],
    activeKey: '',
    orders: [],
    loading: true,
    statusMap: {
      pending: { label: '待付款', cls: 'status-pending' },
      paid: { label: '待发货', cls: 'status-paid' },
      shipped: { label: '已发货', cls: 'status-shipped' },
      done: { label: '已完成', cls: 'status-done' },
      closed: { label: '已关闭', cls: 'status-closed' }
    }
  },

  onShow() {
    this.loadOrders();
  },

  // 等待 openid 就绪后加载订单
  loadOrders() {
    this.setData({ loading: true });
    const fetch = (openid) => {
      if (!openid) {
        this.setData({ orders: [], loading: false });
        return;
      }
      dbApi.listMyOrders(openid, this.data.activeKey || null).then(list => {
        const orders = (list || []).map(o => this.formatOrder(o));
        this.setData({ orders, loading: false });
      }).catch(() => {
        this.setData({ orders: [], loading: false });
      });
    };

    if (app.globalData.openid) {
      fetch(app.globalData.openid);
    } else {
      // 角色尚未就绪，等待登录拿到 openid
      app.onRoleReady(() => {
        fetch(app.globalData.openid);
      });
    }
  },

  // 格式化订单展示数据
  formatOrder(o) {
    const items = o.items || [];
    let summary = items.map(it => `${it.name}×${it.qty}`).join('，');
    if (items.length > 2) {
      summary = `${items[0].name}×${items[0].qty}，${items[1].name}×${items[1].qty} 等${items.length}件`;
    }
    return Object.assign({}, o, {
      totalText: util.formatMoney(o.totalAmount),
      timeText: util.formatTime(o.createTime),
      summary: summary || '无商品'
    });
  },

  // 切换状态 tab
  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeKey) return;
    this.setData({ activeKey: key });
    this.loadOrders();
  },

  // 跳转订单详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/shop/orderDetail/orderDetail?id=' + id });
  }
});
