// pages/product/product.js 商品目录
const dbApi = require('../../utils/db.js');
const util = require('../../utils/util.js');

Page({
  data: {
    cats: ['全部', '葡萄', '葡萄酒'],
    category: '全部',
    list: [],
    filteredList: [],
    loading: false,
    showForm: false,
    saving: false,
    uploading: false,        // 图片上传中
    editingId: '',
    form: {
      name: '',
      category: '葡萄',
      spec: '',
      price: '',
      unit: '斤',
      image: '',              // 商品图 fileID
      stock: 0,               // 库存数量
      onSale: true,           // 是否上架
      description: ''         // 商品详情介绍
    }
  },

  onShow() {
    this.loadProducts();
  },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const list = await dbApi.listProducts();
      const mapped = list.map(p => ({
        ...p,
        priceText: util.formatMoney(p.price),
        stockText: (p.stock === undefined || p.stock === null) ? 0 : Number(p.stock)
      }));
      this.setData({ list: mapped }, () => this.applyFilter());
    } catch (e) {
      console.error('加载商品失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchCat(e) {
    this.setData({ category: e.currentTarget.dataset.cat });
    this.applyFilter();
  },

  // 本地按分类过滤已加载列表
  applyFilter() {
    const cat = this.data.category;
    const filtered = cat === '全部'
      ? this.data.list
      : this.data.list.filter(p => p.category === cat);
    this.setData({ filteredList: filtered });
  },

  openAdd() {
    this.setData({
      showForm: true,
      editingId: '',
      form: {
        name: '',
        category: '葡萄',
        spec: '',
        price: '',
        unit: '斤',
        image: '',           // 新增默认空图
        stock: 0,             // 新增默认 0
        onSale: true,         // 新增默认上架
        description: ''
      }
    });
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.list.find(x => x._id === id);
    if (!p) return;
    this.setData({
      showForm: true,
      editingId: id,
      form: {
        name: p.name,
        category: p.category,
        spec: p.spec || '',
        price: util.formatMoney(p.price),
        unit: p.unit || (p.category === '葡萄酒' ? '瓶' : '斤'),
        image: p.image || '',
        stock: (p.stock === undefined || p.stock === null) ? 0 : Number(p.stock),
        onSale: p.onSale !== false,
        description: p.description || ''
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onSpecInput(e) {
    this.setData({ 'form.spec': e.detail.value });
  },

  onPriceInput(e) {
    this.setData({ 'form.price': e.detail.value });
  },

  onUnitInput(e) {
    this.setData({ 'form.unit': e.detail.value });
  },

  onStockInput(e) {
    // 库存为数量，直接转 Number
    this.setData({ 'form.stock': Number(e.detail.value) || 0 });
  },

  onDescInput(e) {
    this.setData({ 'form.description': e.detail.value });
  },

  // 上架开关切换
  onSaleChange(e) {
    this.setData({ 'form.onSale': !!e.detail.value });
  },

  // 选择商品图片并上传到云存储
  async chooseImage() {
    try {
      const choose = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });
      const tempFile = choose.tempFiles && choose.tempFiles[0];
      if (!tempFile) return;
      const tempPath = tempFile.tempFilePath;
      // 先用本地临时路径预览，提升体验
      this.setData({ 'form.image': tempPath, uploading: true });
      wx.showLoading({ title: '上传中...', mask: true });
      const fileID = await dbApi.uploadProductImage(tempPath);
      this.setData({ 'form.image': fileID });
    } catch (e) {
      console.error('图片上传失败', e);
      wx.showToast({ title: '上传失败', icon: 'none' });
      // 失败回退清空，避免保存了一个本地临时路径
      this.setData({ 'form.image': '' });
    } finally {
      this.setData({ uploading: false });
      wx.hideLoading();
    }
  },

  // 清除已选图片
  clearImage() {
    this.setData({ 'form.image': '' });
  },

  pickCat(e) {
    const cat = e.currentTarget.dataset.cat;
    const patch = { 'form.category': cat };
    // 切换分类时建议默认单位（仅当单位为空或为另一分类的默认值时）
    const cur = this.data.form.unit;
    const suggest = cat === '葡萄酒' ? '瓶' : '斤';
    const otherSuggest = cat === '葡萄酒' ? '斤' : '瓶';
    if (!cur || cur === otherSuggest) {
      patch['form.unit'] = suggest;
    }
    this.setData(patch);
  },

  async onSave() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写商品名称', icon: 'none' });
      return;
    }
    const price = util.yuanToFen(f.price);
    if (price <= 0) {
      wx.showToast({ title: '请填写正确的单价', icon: 'none' });
      return;
    }
    // 上传中不允许保存
    if (this.data.uploading) {
      wx.showToast({ title: '图片上传中，请稍候', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const payload = {
      name: f.name.trim(),
      category: f.category,
      spec: f.spec.trim(),
      price, // 元转分
      unit: f.unit.trim() || (f.category === '葡萄酒' ? '瓶' : '斤'),
      image: f.image || '',                 // 商品图 fileID
      stock: Number(f.stock) || 0,          // 库存数量（非金额）
      onSale: !!f.onSale,                   // 是否上架
      description: f.description.trim()     // 商品详情
    };
    try {
      if (this.data.editingId) {
        await dbApi.updateProduct(this.data.editingId, payload);
      } else {
        await dbApi.addProduct(payload);
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ showForm: false, saving: false });
      this.loadProducts();
    } catch (e) {
      console.error('保存商品失败', e);
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  // 列表项快捷上下架
  onToggleSale(e) {
    const id = e.currentTarget.dataset.id;
    const onSale = e.currentTarget.dataset.onsale;
    const next = !onSale;
    dbApi.toggleProductOnSale(id, next).then(() => {
      wx.showToast({ title: next ? '已上架' : '已下架', icon: 'success' });
      this.loadProducts();
    }).catch(err => {
      console.error('上下架失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.list.find(x => x._id === id);
    if (!p) return;
    wx.showModal({
      title: '确认删除',
      content: `删除商品「${p.name}」？`,
      confirmColor: '#E64340',
      success: (res) => {
        if (!res.confirm) return;
        dbApi.removeProduct(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadProducts();
        }).catch(err => {
          console.error('删除失败', err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  }
});
