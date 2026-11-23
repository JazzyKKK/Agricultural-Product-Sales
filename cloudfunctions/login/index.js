// cloudfunctions/login/index.js
// 云函数：获取调用者 openid，并判定是否为老板
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// ===== 老板 openid 白名单（与 app.js 保持一致）=====
// 建议在此处维护，云端判定更安全。填入你本人的 openid。
const BOSS_OPENIDS = [
  'your-openid-here'
];

exports.main = async (event, context) => {
  const wxContext = await cloud.getWXContext();
  const openid = wxContext.OPENID;
  return {
    openid,
    isBoss: BOSS_OPENIDS.indexOf(openid) >= 0,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || ''
  };
};
