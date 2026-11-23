// cloudfunctions/payNotify/index.js
// 云函数：微信支付结果回调
// 微信支付平台在支付成功后会调用此云函数（通过 createOrder 中指定的 functionName）。
// 注意：此函数必须返回特定格式，且需在云函数管理后台配置为「支付回调」。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COL_ORDER = 'orders';

exports.main = async (event, context) => {
  console.log('支付回调 event', JSON.stringify(event));

  // event.returnCode / event.resultCode / event.outTradeNo / event.transactionId
  const returnCode = event.returnCode;
  const resultCode = event.resultCode;
  const outTradeNo = event.outTradeNo;       // 即 orderNo
  const transactionId = event.transactionId;

  if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
    // 支付成功：更新订单状态
    try {
      const orderRes = await db.collection(COL_ORDER).where({ orderNo: outTradeNo }).get();
      if (orderRes.data.length) {
        const order = orderRes.data[0];
        if (order.payStatus !== 'paid') {
          await db.collection(COL_ORDER).doc(order._id).update({
            data: {
              payStatus: 'paid',
              status: 'paid',
              transactionId: transactionId || '',
              payTime: db.serverDate()
            }
          });
        }
      }
    } catch (e) {
      console.error('更新订单支付状态失败', e);
    }
  } else {
    // 支付失败：回补库存（可选）
    try {
      const orderRes = await db.collection(COL_ORDER).where({ orderNo: outTradeNo }).get();
      if (orderRes.data.length) {
        const order = orderRes.data[0];
        if (order.payStatus === 'unpaid') {
          const _ = db.command;
          await Promise.all((order.items || []).map(it =>
            db.collection('products').doc(it.productId).update({
              data: { stock: _.inc(it.qty) }
            }).catch(() => {})
          ));
          await db.collection(COL_ORDER).doc(order._id).update({
            data: { status: 'closed', payStatus: 'failed' }
          });
        }
      }
    } catch (e) {
      console.error('回补库存失败', e);
    }
  }

  // 必须返回 success 否则微信会重复通知
  return { errcode: 0, errmsg: 'SUCCESS' };
};
