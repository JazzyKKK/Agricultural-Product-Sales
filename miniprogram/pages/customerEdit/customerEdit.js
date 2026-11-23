// pages/customerEdit/customerEdit.js 新增/编辑客户
const dbApi = require('../../utils/db.js');
const app = getApp();

Page({
  data: {
    id: '',
    isEdit: false,
    name: '',
    phone: '',
    remark: '',
    submitting: false,
    loading: false
  },

  onLoad(query) {
    // 从销售页跳来新增：保存后需把客户回传给销售页自动选中
    if (query.from === 'sale') {
      this._fromSale = true;
    }
    if (query.id) {
      // 编辑模式：回填客户信息
      this.setData({ id: query.id, isEdit: true, loading: true });
      wx.setNavigationBarTitle({ title: '编辑客户' });
      this.loadCustomer(query.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增客户' });
    }
  },

  async loadCustomer(id) {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const c = await dbApi.getCustomer(id);
      this.setData({
        name: c.name || '',
        phone: c.phone || '',
        remark: c.remark || '',
        loading: false
      });
    } catch (e) {
      console.error('加载客户失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async save() {
    if (this.data.submitting) return; // 防重复提交
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写客户姓名', icon: 'none' });
      return;
    }
    const data = {
      name,
      phone: (this.data.phone || '').trim(),
      remark: (this.data.remark || '').trim()
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      let customerId = this.data.id;
      if (this.data.isEdit) {
        await dbApi.updateCustomer(this.data.id, data);
      } else {
        customerId = await dbApi.addCustomer(data);
      }
      wx.hideLoading();

      // 从销售页跳来：把新客户信息写入 globalData，销售页 onShow 会读取并自动选中
      if (this._fromSale) {
        app.globalData._pendingCustomer = {
          _id: customerId,
          name: data.name,
          phone: data.phone
        };
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      console.error('保存客户失败', e);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  // 删除客户档案（仅删客户，不删历史销售单）
  removeCustomer() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除客户',
      content: '确定删除该客户档案吗？历史销售单将保留，仅删除客户信息。',
      confirmColor: '#E64340',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        dbApi.removeCustomer(this.data.id).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }).catch((err) => {
          console.error('删除客户失败', err);
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  }
});
