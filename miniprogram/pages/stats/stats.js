// pages/stats/stats.js 数据统计
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

const MAX_BAR_HEIGHT = 240; // 柱子最大高度 rpx

Page({
  data: {
    rangeTabs: [
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: '30d', label: '近30天' },
      { key: 'all', label: '全部' }
    ],
    rangeKey: 'month',
    totalAmountText: '0.00',
    totalOrders: 0,
    avgAmountText: '0.00',
    chart: [],
    rankList: [],
    // 分渠道统计
    onlineAmountText: '0.00',
    offlineAmountText: '0.00',
    onlineCount: 0,
    offlineCount: 0
  },

  onShow() {
    this.loadStats();
  },

  // 计算区间时间范围
  getRange(key) {
    const now = Date.now();
    if (key === 'week') {
      // 当前周一 00:00 到现在
      const d = new Date();
      const daysSinceMon = (d.getDay() + 6) % 7; // 0 表示今天是周一
      d.setDate(d.getDate() - daysSinceMon);
      d.setHours(0, 0, 0, 0);
      return { startTs: d.getTime(), endTs: now };
    }
    if (key === 'month') {
      return { startTs: util.monthStart(), endTs: now };
    }
    if (key === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      return { startTs: d.getTime(), endTs: now };
    }
    return { startTs: 0, endTs: now }; // 全部
  },

  switchRange(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.rangeKey) return;
    this.setData({ rangeKey: key });
    this.loadStats();
  },

  async loadStats() {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const { startTs, endTs } = this.getRange(this.data.rangeKey);
      const stat = await dbApi.statByRange(startTs, endTs);

      // 概览
      const totalAmount = stat.totalAmount || 0;
      const totalOrders = stat.totalOrders || 0;
      const avg = totalOrders ? Math.round(totalAmount / totalOrders) : 0;

      // 近7天柱状图：单独查询最近7天，再按天聚合
      const days = util.recentDays(7);
      const sevenStart = days[0].ts;
      const sevenStat = await dbApi.statByRange(sevenStart, Date.now());
      const byDay = sevenStat.byDay || {};
      const maxAmt = Math.max(0, ...days.map(d => byDay[d.label] || 0));
      const chart = days.map(d => {
        const amt = byDay[d.label] || 0;
        // 高度按最大值比例，最小 8rpx 保证可见；全为0时也保持最小高度并显示0
        const height = maxAmt > 0 ? Math.max(8, Math.round(amt / maxAmt * MAX_BAR_HEIGHT)) : 8;
        return {
          label: d.label,
          yuan: util.formatMoney(amt),
          height
        };
      });

      // 商品销量排行
      const byProduct = stat.byProduct || {};
      let rankArr = Object.keys(byProduct).map(name => {
        const p = byProduct[name];
        const qty = Number(p.qty) || 0;
        return {
          name,
          category: p.category || '葡萄',
          qty,
          qtyText: (qty).toFixed(2).replace(/\.?0+$/, ''),
          amount: Number(p.amount) || 0,
          amountText: util.formatMoney(p.amount || 0),
          unit: '斤'
        };
      });
      rankArr.sort((a, b) => b.amount - a.amount);
      const topRank = rankArr.slice(0, 10);
      const rankMax = topRank.length ? topRank[0].amount : 0;
      topRank.forEach(r => {
        r.percent = rankMax > 0 ? Math.round(r.amount / rankMax * 100) : 0;
      });

      this.setData({
        totalAmountText: util.formatMoney(totalAmount),
        totalOrders,
        avgAmountText: util.formatMoney(avg),
        chart,
        rankList: topRank,
        onlineAmountText: util.formatMoney(stat.byChannel ? stat.byChannel.online : 0),
        offlineAmountText: util.formatMoney(stat.byChannel ? stat.byChannel.offline : 0),
        onlineCount: stat.onlineCount || 0,
        offlineCount: stat.offlineCount || 0
      });
    } catch (e) {
      console.error('加载统计失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
