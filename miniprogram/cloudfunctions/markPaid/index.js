// cloudfunctions/markPaid/index.js
// 云函数：支付成功后标记订单为已支付（管理员权限，绕过前端安全规则）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COL_ORDER = 'orders';

exports.main = async (event, context) => {
  const { orderId } = event;
  if (!orderId) {
    return { code: 'FAIL', msg: '缺少订单ID' };
  }

  // 获取当前用户 openid（安全校验）
  const wxContext = await cloud.getWXContext();
  const openid = wxContext.OPENID;
  console.log('[markPaid] 调用者 openid=', openid, 'orderId=', orderId);

  try {
    // 查询订单
    const orderRes = await db.collection(COL_ORDER).doc(orderId).get();
    const order = orderRes.data;
    if (!order) {
      console.error('[markPaid] 订单不存在:', orderId);
      return { code: 'FAIL', msg: '订单不存在' };
    }

    // 安全校验：确认订单属于当前用户
    if (order.openid !== openid) {
      console.error('[markPaid] 无权操作: 订单 openid=', order.openid, '当前用户=', openid);
      return { code: 'FAIL', msg: '无权操作此订单' };
    }

    // 已经是已支付状态，避免重复更新
    if (order.status === 'paid' || order.status === 'shipped' || order.status === 'done') {
      console.log('[markPaid] 订单已是已支付状态，跳过更新');
      return { code: 'OK', msg: '订单已支付', status: order.status };
    }

    // 管理员权限更新订单状态
    await db.collection(COL_ORDER).doc(orderId).update({
      data: {
        status: 'paid',
        payStatus: 'paid',
        payTime: db.serverDate()
      }
    });

    console.log('[markPaid] 订单状态已更新为 paid:', orderId);
    return { code: 'OK', msg: '订单已标记为已支付', status: 'paid' };
  } catch (err) {
    console.error('[markPaid] 更新失败:', err);
    return { code: 'FAIL', msg: '更新失败: ' + (err.message || JSON.stringify(err)) };
  }
};
