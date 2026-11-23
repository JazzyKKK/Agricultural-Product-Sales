// utils/db.js 云开发数据库访问封装
// 金额一律以「分」存储，避免浮点误差。

let _db = null;
let _command = null;

function getDb() {
  if (!_db) {
    _db = wx.cloud.database();
    _command = _db.command;
  }
  return _db;
}

function getCommand() {
  if (!_command) {
    getDb();
  }
  return _command;
}

const COL = {
  PRODUCT: 'products',
  CUSTOMER: 'customers',
  SALE: 'sales',
  ORDER: 'orders'   // 顾客线上下单（区别于老板线下记账 sales）
};

/* ============ 商品 ============ */

// 商品列表（按分类）
// opts: { category, onSaleOnly }  onSaleOnly=true 只返回已上架商品（顾客端用）
const listProducts = (category, opts) => {
  const where = {};
  if (category) where.category = category;
  if (opts && opts.onSaleOnly) where.onSale = true;
  return getDb().collection(COL.PRODUCT).where(where).orderBy('category', 'asc').orderBy('createTime', 'desc').get()
    .then(res => res.data);
};

const addProduct = (data) => {
  return getDb().collection(COL.PRODUCT).add({
    data: {
      name: data.name,
      category: data.category, // 葡萄 / 葡萄酒
      spec: data.spec || '',
      price: Number(data.price) || 0, // 分
      unit: data.unit || '斤',
      image: data.image || '',          // 商品图 fileID
      description: data.description || '', // 商品详情介绍
      stock: Number(data.stock) || 0,   // 库存
      onSale: data.onSale !== false,    // 是否上架，默认 true
      createTime: getDb().serverDate()
    }
  }).then(res => res._id);
};

const updateProduct = (id, data) => {
  const patch = {
    name: data.name,
    category: data.category,
    spec: data.spec || '',
    price: Number(data.price) || 0,
    unit: data.unit || '斤'
  };
  if (data.image !== undefined) patch.image = data.image;
  if (data.description !== undefined) patch.description = data.description;
  if (data.stock !== undefined) patch.stock = Number(data.stock) || 0;
  if (data.onSale !== undefined) patch.onSale = !!data.onSale;
  return getDb().collection(COL.PRODUCT).doc(id).update({ data: patch });
};

// 切换上架状态（老板端快速上下架）
const toggleProductOnSale = (id, onSale) => {
  return getDb().collection(COL.PRODUCT).doc(id).update({ data: { onSale: !!onSale } });
};

// 上传商品图片到云存储，返回 fileID
const uploadProductImage = (filePath) => {
  const cloudPath = `product/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
  return wx.cloud.uploadFile({ cloudPath, filePath }).then(res => res.fileID);
};

const removeProduct = (id) => {
  return getDb().collection(COL.PRODUCT).doc(id).remove();
};

/* ============ 客户 ============ */

const listCustomers = (keyword) => {
  let q = getDb().collection(COL.CUSTOMER);
  if (keyword) {
    q = q.where(getCommand().or([
      { name: getDb().RegExp({ regexp: keyword, options: 'i' }) },
      { phone: getDb().RegExp({ regexp: keyword, options: 'i' }) }
    ]));
  }
  return q.orderBy('createTime', 'desc').get().then(res => res.data);
};

const getCustomer = (id) => {
  return getDb().collection(COL.CUSTOMER).doc(id).get().then(res => res.data);
};

const addCustomer = (data) => {
  return getDb().collection(COL.CUSTOMER).add({
    data: {
      name: data.name,
      phone: data.phone || '',
      remark: data.remark || '',
      totalAmount: 0,
      totalOrders: 0,
      createTime: getDb().serverDate()
    }
  }).then(res => res._id);
};

const updateCustomer = (id, data) => {
  return getDb().collection(COL.CUSTOMER).doc(id).update({
    data: {
      name: data.name,
      phone: data.phone || '',
      remark: data.remark || ''
    }
  });
};

const removeCustomer = (id) => {
  return getDb().collection(COL.CUSTOMER).doc(id).remove();
};

// 更新客户消费汇总（下单后调用）
const incCustomerStats = (id, amount) => {
  return getDb().collection(COL.CUSTOMER).doc(id).update({
    data: {
      totalAmount: getCommand().inc(amount),
      totalOrders: getCommand().inc(1)
    }
  });
};

/* ============ 销售 ============ */

// 新增销售单
const addSale = (data) => {
  return getDb().collection(COL.SALE).add({
    data: {
      orderNo: data.orderNo,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone || '',
      items: data.items, // [{ productId, name, category, spec, price, qty, amount }]
      totalAmount: Number(data.totalAmount) || 0, // 分
      payMethod: data.payMethod || 'cash',
      remark: data.remark || '',
      saleDate: data.saleDate || getDb().serverDate(),
      createTime: getDb().serverDate()
    }
  }).then(res => res._id);
};

const getSale = (id) => {
  return getDb().collection(COL.SALE).doc(id).get().then(res => res.data);
};

// 销售流水（分页 + 可选筛选）
const listSales = ({ page = 1, pageSize = 20, customerId, startTs, endTs } = {}) => {
  const where = {};
  if (customerId) where.customerId = customerId;
  if (startTs && endTs) where.saleDate = getCommand().gte(new Date(startTs)).and(getCommand().lte(new Date(endTs)));
  else if (startTs) where.saleDate = getCommand().gte(new Date(startTs));
  else if (endTs) where.saleDate = getCommand().lte(new Date(endTs));

  return getDb().collection(COL.SALE)
    .where(where)
    .orderBy('saleDate', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    .then(res => res.data);
};

// 删除销售单（同时回减客户汇总）
const removeSale = (sale) => {
  return getDb().collection(COL.SALE).doc(sale._id).remove().then(() => {
    if (sale.customerId) {
      return getDb().collection(COL.CUSTOMER).doc(sale.customerId).update({
        data: {
          totalAmount: getCommand().inc(-sale.totalAmount),
          totalOrders: getCommand().inc(-1)
        }
      });
    }
  });
};

/* ============ 统计聚合 ============ */

// 区间内销售总额、总单量（客户端聚合）
const statByRange = (startTs, endTs) => {
  return getDb().collection(COL.SALE)
    .where({ saleDate: getCommand().gte(new Date(startTs)).and(getCommand().lte(new Date(endTs))) })
    .field({ totalAmount: true, saleDate: true, items: true })
    .orderBy('saleDate', 'asc')
    .limit(1000)
    .get()
    .then(res => {
      let totalAmount = 0;
      const byDay = {}; // { 'M/D': amount }
      const byProduct = {}; // { name: { qty, amount } }
      res.data.forEach(s => {
        totalAmount += s.totalAmount || 0;
        const d = new Date(s.saleDate);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        byDay[key] = (byDay[key] || 0) + (s.totalAmount || 0);
        (s.items || []).forEach(it => {
          if (!byProduct[it.name]) byProduct[it.name] = { qty: 0, amount: 0, category: it.category };
          byProduct[it.name].qty += Number(it.qty) || 0;
          byProduct[it.name].amount += Number(it.amount) || 0;
        });
      });
      return {
        totalAmount,
        totalOrders: res.data.length,
        byDay,
        byProduct
      };
    });
};

/* ============ 顾客订单（线上购买） ============ */
// 订单数据结构：
// {
//   orderNo, openid(顾客), customerName, phone, address,
//   items: [{ productId, name, category, spec, image, price, qty, amount }],
//   totalAmount(分), payStatus: unpaid/paid/refunded,
//   status: pending(待付款)/paid(已付款待发货)/shipped(已发货)/done(已完成)/closed(已关闭),
//   payMethod: 'wxpay', wxPayment: { transactionId, ... },
//   remark, createTime, payTime, shipTime, doneTime
// }

// 创建订单（由云函数 createOrder 调用以保证价格与库存安全，前端不直接调）
const createOrderRecord = (data) => {
  return getDb().collection(COL.ORDER).add({
    data: {
      orderNo: data.orderNo,
      openid: data.openid,
      customerName: data.customerName || '',
      phone: data.phone || '',
      address: data.address || '',
      items: data.items,
      totalAmount: Number(data.totalAmount) || 0,
      payStatus: 'unpaid',
      status: 'pending',
      payMethod: 'wxpay',
      remark: data.remark || '',
      createTime: getDb().serverDate()
    }
  }).then(res => res._id);
};

// 顾客查自己的订单
const listMyOrders = (openid, status) => {
  const where = { openid };
  if (status) where.status = status;
  return getDb().collection(COL.ORDER).where(where).orderBy('createTime', 'desc').limit(50).get().then(res => res.data);
};

// 老板查所有订单
const listAllOrders = ({ status, page = 1, pageSize = 20 } = {}) => {
  const where = {};
  if (status && status !== 'all') where.status = status;
  return getDb().collection(COL.ORDER)
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    .then(res => res.data);
};

const getOrder = (id) => {
  return getDb().collection(COL.ORDER).doc(id).get()
    .then(res => {
      if (res && res.data) return res.data;
      // doc 查询失败：可能是按 orderNo 来的（微信支付发货管理传的是 out_trade_no）
      return getDb().collection(COL.ORDER).where({ orderNo: id }).get()
        .then(r => (r && r.data && r.data[0]) || null);
    })
    .catch(() => {
      // 兜底：再按 orderNo 查一次
      return getDb().collection(COL.ORDER).where({ orderNo: id }).get()
        .then(r => (r && r.data && r.data[0]) || null);
    });
};

// 老板更新订单状态（发货/完成等）
const updateOrderStatus = (id, status) => {
  const patch = { status };
  if (status === 'shipped') patch.shipTime = getDb().serverDate();
  if (status === 'done') patch.doneTime = getDb().serverDate();
  return getDb().collection(COL.ORDER).doc(id).update({ data: patch });
};

// 支付成功后标记（由 payNotify 云函数调用）
const markOrderPaid = (orderNo, transactionId) => {
  return getDb().collection(COL.ORDER).where({ orderNo }).get().then(res => {
    if (!res.data.length) return null;
    const id = res.data[0]._id;
    return getDb().collection(COL.ORDER).doc(id).update({
      data: {
        payStatus: 'paid',
        status: 'paid',
        transactionId: transactionId || '',
        payTime: getDb().serverDate()
      }
    });
  });
};

module.exports = {
  COL,
  // 商品
  listProducts,
  addProduct,
  updateProduct,
  removeProduct,
  toggleProductOnSale,
  uploadProductImage,
  // 客户
  listCustomers,
  getCustomer,
  addCustomer,
  updateCustomer,
  removeCustomer,
  incCustomerStats,
  // 销售（老板线下记账）
  addSale,
  getSale,
  listSales,
  removeSale,
  // 统计
  statByRange,
  // 顾客订单（线上购买）
  createOrderRecord,
  listMyOrders,
  listAllOrders,
  getOrder,
  updateOrderStatus,
  markOrderPaid
};
