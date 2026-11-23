// cloudfunctions/getMiniCode/index.js
// 云函数：生成小程序码（无数量限制版本 wxacode.getUnlimited）
// 返回云存储 fileID，前端直接展示并支持长按保存
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { scene = 'home', page = 'pages/shop/home/home' } = event || {};

  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: scene,            // 最大 32 个字符，扫码后可在 onLoad(query.scene) 中拿到
      page: page,              // 必须是已发布小程序中存在的页面
      env_version: 'release',  // 正式版小程序码（开发版用 'develop'，体验版用 'trial'）
      check_path: false,       // 跳过路径检查（未发布时也能生成）
      width: 280               // 二维码宽度（px）
    });

    if (res.errcode) {
      console.error('[getMiniCode] openapi 错误:', res.errcode, res.errmsg);
      return { code: 'FAIL', msg: `${res.errmsg}（错误码 ${res.errcode}）` };
    }

    // res.buffer 是二进制图片数据，存到云存储，方便前端 <image> 标签展示
    const fileName = `minicode/${scene}_${Date.now()}.jpg`;
    const upload = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: res.buffer
    });

    return {
      code: 'OK',
      fileID: upload.fileID
    };
  } catch (err) {
    console.error('[getMiniCode] 异常:', err);
    return {
      code: 'FAIL',
      msg: err.errMsg || err.message || '生成失败'
    };
  }
};
