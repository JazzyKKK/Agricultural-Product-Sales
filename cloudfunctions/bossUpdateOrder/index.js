// cloudfunctions/bossUpdateOrder/index.js
// 云函数：老板更新订单状态（发货/完成/取消）— 管理员权限，绕过安全规则
// 发货时收集快递单号，并自动调用微信支付 V3 发货信息管理 API 上报给微信
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COL_ORDER = 'orders';
const BOSS_PASSWORD = '816919';  // 与前端 app.js 保持一致

// ============================================================
// 微信支付配置加载
// ============================================================
function loadWxPayConfig() {
  const configPath = path.join(__dirname, 'wxpay_config.json');
  const keyPath = path.join(__dirname, 'private_key.pem');

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('❌ 读取 wxpay_config.json 失败:', e.message);
  }

  let privateKey = '';
  try {
    privateKey = fs.readFileSync(keyPath, 'utf8').trim();
  } catch (e) {
    console.error('❌ 读取 private_key.pem 失败:', e.message);
  }

  return {
    appId: config.appId || '',
    mchid: config.mchid || '',
    merchantSerialNumber: config.merchantSerialNumber || '',
    privateKey
  };
}

// RSA-SHA256 签名
function rsaSign(privateKey, message) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

// 构造 Authorization 头
function buildAuth(wxPayConfig, method, urlPath, bodyStr, timestamp, nonceStr) {
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;
  const signature = rsaSign(wxPayConfig.privateKey, message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${wxPayConfig.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${wxPayConfig.merchantSerialNumber}",signature="${signature}"`;
}

// 发送 HTTPS 请求
function httpsPost(hostname, urlPath, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path: urlPath,
      method: 'POST',
      headers: Object.assign({}, headers, {
        'Content-Length': Buffer.byteLength(bodyStr)
      })
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(bodyStr);
    req.end();
  });
}

// 调用微信支付 V3 发货信息管理 API：上传快递信息
// 接口：订单中心发货管理 - 上传发货信息
// 文档：https://pay.weixin.qq.com/docs/merchant/apis/mini-shipment/shipment/add-shipment.html
async function uploadShippingToWx(wxPayConfig, orderNo, openid, waybillType, waybillId) {
  const urlPath = '/v3/merchant/Shipping/add';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');

  const bodyObj = {
    out_trade_no: orderNo,        // 商户订单号（微信支付下单时的 out_trade_no）
    openid: openid,               // 下单用户 openid
    delivery_type: 1,             // 1=快递发货
    waybill_id: waybillId,        // 快递单号
    waybill_type: waybillType,    // 快递公司编码（如 SF=顺丰）
    delivery_mode: 1              // 1=统一发货
  };
  const bodyStr = JSON.stringify(bodyObj);

  const authorization = buildAuth(wxPayConfig, 'POST', urlPath, bodyStr, timestamp, nonceStr);
  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const res = await httpsPost('api.mch.weixin.qq.com', urlPath, headers, bodyStr);
  return res;
}

exports.main = async (event, context) => {
  const { orderId, status, password, shippingCompany, trackingNumber } = event;
  if (!orderId || !status) {
    return { code: 'FAIL', msg: '缺少订单ID或状态' };
  }

  // 安全校验：密码确认是老板
  if (password !== BOSS_PASSWORD) {
    const wxContext = await cloud.getWXContext();
    console.error('[bossUpdateOrder] 无权限: openid=', wxContext.OPENID, '密码错误');
    return { code: 'FAIL', msg: '无权限：仅老板可执行此操作' };
  }

  console.log('[bossUpdateOrder] 老板操作: orderId=', orderId, 'status=', status,
    'shippingCompany=', shippingCompany, 'trackingNumber=', trackingNumber);

  try {
    // 查询订单
    const orderRes = await db.collection(COL_ORDER).doc(orderId).get();
    const order = orderRes.data;
    if (!order) {
      return { code: 'FAIL', msg: '订单不存在' };
    }

    // 删除订单：仅允许删除未付款（pending）的订单，避免误删已支付订单
    if (status === 'delete') {
      if (order.status !== 'pending') {
        return { code: 'FAIL', msg: '仅未付款的订单可删除' };
      }
      await db.collection(COL_ORDER).doc(orderId).remove();
      console.log('[bossUpdateOrder] 订单已删除:', orderId);
      return { code: 'OK', msg: '订单已删除', status: 'delete' };
    }

    // 构造更新数据
    const patch = { status };
    if (status === 'shipped') {
      patch.shipTime = db.serverDate();
      // 发货时保存快递信息
      if (shippingCompany && trackingNumber) {
        patch.shippingCompany = shippingCompany;
        patch.trackingNumber = trackingNumber;
        patch.shippedToWx = false;  // 先标记未上报，上报成功后改为 true
      }
    }
    if (status === 'done') patch.doneTime = db.serverDate();

    await db.collection(COL_ORDER).doc(orderId).update({ data: patch });
    console.log('[bossUpdateOrder] 订单状态已更新:', orderId, '->', status);

    // 如果是发货且有快递单号，上报给微信
    let wxReportOk = false;
    let wxReportMsg = '';
    if (status === 'shipped' && shippingCompany && trackingNumber) {
      const wxPayConfig = loadWxPayConfig();
      const configValid = wxPayConfig.appId && !wxPayConfig.appId.startsWith('REPLACE_')
        && wxPayConfig.mchid && !wxPayConfig.mchid.startsWith('REPLACE_')
        && wxPayConfig.merchantSerialNumber && !wxPayConfig.merchantSerialNumber.startsWith('REPLACE_')
        && wxPayConfig.privateKey.length > 100;

      if (!configValid) {
        wxReportMsg = '支付配置未完成，未上报微信';
        console.warn('[bossUpdateOrder] ', wxReportMsg);
      } else {
        try {
          const res = await uploadShippingToWx(
            wxPayConfig,
            order.orderNo,
            order.openid,
            shippingCompany,
            trackingNumber
          );
          console.log('[bossUpdateOrder] 微信发货上报响应 status=', res.status, 'data=', JSON.stringify(res.data));
          // 成功条件：HTTP 200 或响应里有 order_no/upload_time 等字段（add 接口成功时返回这些）
          if (res.status === 200
              || (res.data && (res.data.order_no || res.data.upload_time))
              || (res.data && res.data.code === 'OK')) {
            wxReportOk = true;
            wxReportMsg = '已上报微信';
            // 标记已上报
            await db.collection(COL_ORDER).doc(orderId).update({
              data: { shippedToWx: true, wxReportTime: db.serverDate(), wxReportResponse: res.data }
            });
          } else {
            // 详细错误信息便于排查
            const errData = res.data || {};
            const errMsg = errData.message || errData.errmsg || errData.error || errData.code || ('HTTP ' + res.status);
            wxReportMsg = '微信上报失败：' + errMsg;
            console.error('[bossUpdateOrder] 微信发货上报失败:', JSON.stringify(res));
            // 把详细响应存到订单上便于排查
            await db.collection(COL_ORDER).doc(orderId).update({
              data: { wxReportError: { status: res.status, data: res.data, time: new Date().toISOString() } }
            });
          }
        } catch (e) {
          wxReportMsg = '微信上报异常：' + (e.message || String(e));
          console.error('[bossUpdateOrder] 微信发货上报异常:', e);
          await db.collection(COL_ORDER).doc(orderId).update({
            data: { wxReportError: { exception: e.message, time: new Date().toISOString() } }
          });
        }
      }
    }

    return {
      code: 'OK',
      msg: wxReportOk ? '发货成功，已上报微信' : (wxReportMsg ? '发货成功（' + wxReportMsg + '）' : '操作成功'),
      status,
      wxReportOk,
      wxReportMsg
    };
  } catch (err) {
    console.error('[bossUpdateOrder] 更新失败:', err);
    return { code: 'FAIL', msg: '更新失败: ' + (err.message || JSON.stringify(err)) };
  }
};
