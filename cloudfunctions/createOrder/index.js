// cloudfunctions/createOrder/index.js
// 云函数：顾客下单 + 调用微信支付 V3 API（纯 Node.js 实现，无第三方依赖）
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const COL_PRODUCT = 'products';
const COL_ORDER = 'orders';

// ============================================================
// 配置加载
// ============================================================
function loadConfig() {
  const configPath = path.join(__dirname, 'wxpay_config.json');
  const keyPath = path.join(__dirname, 'private_key.pem');

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ 配置文件读取成功');
  } catch (e) {
    console.error('❌ 读取 wxpay_config.json 失败:', e.message);
  }

  let privateKey = '';
  try {
    privateKey = fs.readFileSync(keyPath, 'utf8').trim();
    console.log('✅ 私钥文件读取成功，长度:', privateKey.length);
  } catch (e) {
    console.error('❌ 读取 private_key.pem 失败:', e.message);
  }

  return {
    appId: config.appId || '',
    mchid: config.mchid || '',
    merchantSerialNumber: config.merchantSerialNumber || '',
    privateKey: privateKey,
    notifyUrl: config.notifyUrl || 'https://example.com/wxpay/notify'
  };
}

const genOrderNo = () => {
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const t = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const r = Math.floor(1000 + Math.random() * 9000);
  return `SO${t}${r}`;
};

// ============================================================
// 微信支付 V3 签名 & HTTP 请求（纯 Node.js 实现）
// ============================================================

// RSA-SHA256 签名
function rsaSign(privateKey, message) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

// 构造 Authorization 头
function buildAuth(wxPayConfig, method, urlPath, bodyStr, timestamp, nonceStr) {
  // 微信支付 V3 签名串格式（严格按官方文档）：
  // HTTP方法\n请求URL\n请求时间戳\n请求随机串\n请求报文主体\n
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;

  console.log('🔐 签名串:', JSON.stringify(message));
  console.log('🔐 证书序列号:', wxPayConfig.merchantSerialNumber);
  console.log('🔐 商户号:', wxPayConfig.mchid);

  const signature = rsaSign(wxPayConfig.privateKey, message);
  console.log('🔐 签名结果(前50字符):', signature.substring(0, 50));

  return `WECHATPAY2-SHA256-RSA2048 mchid="${wxPayConfig.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${wxPayConfig.merchantSerialNumber}",signature="${signature}"`;
}

// 发送 HTTPS 请求
function httpsPost(hostname, urlPath, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: 443,
      path: urlPath,
      method: 'POST',
      headers: Object.assign({}, headers, {
        'Content-Length': Buffer.byteLength(bodyStr)
      })
    };

    console.log('🌐 HTTPS 请求:', hostname + urlPath);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('🌐 HTTP 状态码:', res.statusCode);
        console.log('🌐 响应头:', JSON.stringify({
          'wechatpay-request-id': res.headers['wechatpay-request-id'],
          'content-type': res.headers['content-type']
        }));
        console.log('🌐 响应体:', data);

        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ HTTPS 请求错误:', e.message);
      reject(e);
    });

    req.write(bodyStr);
    req.end();
  });
}

// 调用微信支付 V3 JSAPI 下单
async function createWxPayOrder(wxPayConfig, orderNo, totalAmount, openid) {
  const urlPath = '/v3/pay/transactions/jsapi';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');

  // 请求体 —— 先序列化成字符串，签名和发送都用同一个字符串
  const bodyObj = {
    appid: wxPayConfig.appId,
    mchid: wxPayConfig.mchid,
    description: `太白香印葡萄订单 ${orderNo}`,
    out_trade_no: orderNo,
    notify_url: wxPayConfig.notifyUrl,
    amount: {
      total: totalAmount,
      currency: 'CNY'
    },
    payer: {
      openid: openid
    }
  };
  const bodyStr = JSON.stringify(bodyObj);

  console.log('📦 请求体:', bodyStr);

  // 构造 Authorization
  const authorization = buildAuth(wxPayConfig, 'POST', urlPath, bodyStr, timestamp, nonceStr);

  // 发送请求
  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const res = await httpsPost('api.mch.weixin.qq.com', urlPath, headers, bodyStr);

  return res;
}

// 生成前端调起支付参数的签名
function buildPaySign(wxPayConfig, prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageStr = `prepay_id=${prepayId}`;

  // 前端调起支付签名串格式：
  // appId\n时间戳\n随机字符串\nprepay_id=xxx\n
  const message = `${wxPayConfig.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  console.log('🔐 前端支付签名串:', JSON.stringify(message));

  const paySign = rsaSign(wxPayConfig.privateKey, message);

  return {
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign
  };
}

// ============================================================
// 云函数主入口
// ============================================================
exports.main = async (event, context) => {
  console.log('=== createOrder 被调用 ===');

  const wxPayConfig = loadConfig();
  console.log('📋 配置检查:', {
    hasAppId: !!wxPayConfig.appId && !wxPayConfig.appId.startsWith('REPLACE_'),
    hasMchid: !!wxPayConfig.mchid && !wxPayConfig.mchid.startsWith('REPLACE_'),
    hasSerialNumber: !!wxPayConfig.merchantSerialNumber && !wxPayConfig.merchantSerialNumber.startsWith('REPLACE_'),
    hasPrivateKey: wxPayConfig.privateKey.length > 100
  });

  let openid = '';
  try {
    const wxContext = await cloud.getWXContext();
    openid = wxContext.OPENID;
  } catch (e) {
    console.error('❌ 获取 openid 失败', e);
  }

  const { items, customerName, phone, address, remark } = event || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { code: 'FAIL', msg: '商品不能为空' };
  }
  if (!openid) {
    return { code: 'FAIL', msg: '未获取到用户身份' };
  }

  try {
    // 1. 核价
    const productIds = items.map(it => it.productId);
    const productRes = await db.collection(COL_PRODUCT).where({ _id: _.in(productIds) }).get();
    const productMap = {};
    productRes.data.forEach(p => { productMap[p._id] = p; });

    const orderItems = [];
    let totalAmount = 0;
    for (const it of items) {
      const p = productMap[it.productId];
      if (!p) return { code: 'FAIL', msg: `商品不存在：${it.productId}` };
      if (p.onSale === false) return { code: 'FAIL', msg: `${p.name} 已下架` };
      const qty = Number(it.qty);
      if (!qty || qty <= 0) return { code: 'FAIL', msg: `${p.name} 数量无效` };
      if (p.stock !== undefined && p.stock !== null && p.stock < qty) {
        return { code: 'FAIL', msg: `${p.name} 库存不足（剩 ${p.stock} ${p.unit || '件'}）` };
      }
      const amount = Math.round(p.price * qty);
      totalAmount += amount;
      orderItems.push({
        productId: p._id,
        name: p.name,
        category: p.category,
        spec: p.spec || '',
        image: p.image || '',
        price: p.price,
        qty,
        amount
      });
    }
    console.log('✅ 核价完成，totalAmount=', totalAmount);

    if (totalAmount <= 0) {
      return { code: 'FAIL', msg: '订单金额异常' };
    }

    // 2. 创建订单
    const orderNo = genOrderNo();
    const orderData = {
      orderNo,
      openid,
      customerName: (customerName || '').trim(),
      phone: (phone || '').trim(),
      address: (address || '').trim(),
      items: orderItems,
      totalAmount,
      payStatus: 'unpaid',
      status: 'pending',
      payMethod: 'wxpay',
      remark: (remark || '').trim(),
      createTime: db.serverDate()
    };
    const addRes = await db.collection(COL_ORDER).add({ data: orderData });
    const orderId = addRes._id;
    console.log('✅ 订单创建成功，orderId=', orderId, 'orderNo=', orderNo);

    // 3. 扣库存
    const stockTasks = orderItems.map(it =>
      db.collection(COL_PRODUCT).doc(it.productId).update({
        data: { stock: _.inc(-it.qty) }
      })
    );
    await Promise.all(stockTasks).catch(e => console.error('⚠️ 预扣库存异常', e));

    // 4. 调用微信支付 V3 JSAPI 下单
    let payment = null;
    let payError = null;

    const configValid = wxPayConfig.appId && !wxPayConfig.appId.startsWith('REPLACE_')
      && wxPayConfig.mchid && !wxPayConfig.mchid.startsWith('REPLACE_')
      && wxPayConfig.merchantSerialNumber && !wxPayConfig.merchantSerialNumber.startsWith('REPLACE_')
      && wxPayConfig.privateKey.length > 100;

    if (!configValid) {
      payError = '支付配置未完成';
      console.warn('⚠️ 支付配置未完成，跳过支付单生成');
    } else {
      try {
        console.log('🚀 调用微信支付 V3 JSAPI 下单...');
        const result = await createWxPayOrder(wxPayConfig, orderNo, totalAmount, openid);

        console.log('📦 下单返回状态:', result.status);
        console.log('📦 下单返回数据:', JSON.stringify(result.data));

        if (result.status === 200 && result.data.prepay_id) {
          // 生成前端调起支付参数
          payment = buildPaySign(wxPayConfig, result.data.prepay_id);
          console.log('✅ 支付单生成成功！prepay_id=', result.data.prepay_id);
        } else if (result.data && result.data.message) {
          payError = result.data.message + (result.data.code ? ` (错误码: ${result.data.code})` : '');
          console.error('❌ 微信支付返回错误:', JSON.stringify(result.data));
        } else {
          payError = '支付下单失败（HTTP ' + result.status + '）';
          console.error('❌ 未知错误，完整响应:', JSON.stringify(result));
        }
      } catch (payErr) {
        console.error('❌ 微信支付调用异常:', payErr);
        payError = payErr?.message || payErr?.errMsg || String(payErr);
      }
    }

    console.log('=== createOrder 完成 ===', {
      orderId, orderNo, totalAmount,
      hasPayment: !!payment, payError: payError || null
    });

    return {
      code: 'OK',
      orderId, orderNo, totalAmount,
      payment, payError
    };
  } catch (e) {
    console.error('❌ createOrder 顶层异常:', e);
    return { code: 'FAIL', msg: '下单失败：' + (e.errMsg || e.message || '未知错误') };
  }
};
