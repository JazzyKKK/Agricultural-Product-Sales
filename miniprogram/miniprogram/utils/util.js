// utils/util.js 通用工具函数

// 金额格式化：分 -> 元，保留2位
const formatMoney = (fen) => {
  if (fen === null || fen === undefined || isNaN(fen)) return '0.00';
  return (Number(fen) / 100).toFixed(2);
};

// 元转分（输入框金额字符串 -> 分，避免浮点误差）
const yuanToFen = (yuan) => {
  if (!yuan && yuan !== 0) return 0;
  const num = parseFloat(yuan);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

// 日期格式化
const formatTime = (date, fmt = 'YYYY-MM-DD HH:mm') => {
  if (!date) return '';
  if (typeof date === 'number') date = new Date(date);
  if (typeof date === 'object' && date instanceof Date === false) {
    // 兼容云数据库 Date 对象
    date = new Date(date);
  }
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const map = {
    YYYY: date.getFullYear(),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds())
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => map[m]);
};

// 今天 00:00:00 的时间戳
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// 本月1号 00:00:00 的时间戳
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// 获取某天的起始与结束时间戳
const dayRange = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 - 1 };
};

// 生成订单号：SR + yyyyMMddHHmmss + 4位随机
const genOrderNo = () => {
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const t = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const r = Math.floor(1000 + Math.random() * 9000);
  return `SR${t}${r}`;
};

// 最近 N 天日期数组（用于统计图表）
const recentDays = (n) => {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    arr.push({
      ts: d.getTime(),
      label: `${d.getMonth() + 1}/${d.getDate()}`
    });
  }
  return arr;
};

// 防抖
const debounce = (fn, wait = 300) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
};

module.exports = {
  formatMoney,
  yuanToFen,
  formatTime,
  todayStart,
  monthStart,
  dayRange,
  genOrderNo,
  recentDays,
  debounce
};
