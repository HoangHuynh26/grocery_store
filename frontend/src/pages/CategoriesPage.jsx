import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Tags, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [disablingCategory, setDisablingCategory] = useState(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories?all=true');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Load categories error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', slug: '', description: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Tên danh mục là bắt buộc.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
      } else {
        await api.post('/categories', formData);
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu danh mục.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisableConfirm = async () => {
    if (!disablingCategory) return;
    try {
      await api.delete(`/categories/${disablingCategory.id}`);
      setDisablingCategory(null);
      loadCategories();
    } catch (err) {
      alert(err.message || 'Không thể vô hiệu hóa danh mục.');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Danh Mục</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Phân loại hàng hóa trong cửa hàng (Nước uống, Mì gói, Sữa, Đồ pha chế...)
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          <span>Thêm Danh Mục</span>
        </button>
      </div>

      {/* Categories Table */}
      <div className="table-responsive">
        <table className="table table-compact">
          <thead>
            <tr>
              <th>Tên Danh Mục</th>
              <th>Mã Slug</th>
              <th>Mô Tả</th>
              <th>Số Sản Phẩm Đang Bán</th>
              <th>Trạng Thái</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Đang tải danh mục...</div>
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Chưa có danh mục nào.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {cat.name}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {cat.slug}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {cat.description || '-'}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {cat.active_products_count || 0} sản phẩm
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${cat.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {cat.is_active ? 'Đang hoạt động' : 'Tạm ngưng'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => openEditModal(cat)}
                        title="Sửa"
                      >
                        <Edit2 size={14} />
                      </button>
                      {cat.is_active && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                          onClick={() => setDisablingCategory(cat)}
                          title="Tạm ngưng sử dụng"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Chỉnh Sửa Danh Mục' : 'Thêm Danh Mục Mới'}
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tên danh mục *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Nước giải khát"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mã Slug (Tùy chọn)</label>
            <input
              type="text"
              className="form-control"
              placeholder="nuoc-giai-khat (tự sinh nếu để trống)"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Ghi chú về nhóm mặt hàng..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : (editingCategory ? 'Cập Nhật' : 'Tạo Mới')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Disable Category Confirmation */}
      <ConfirmDialog
        isOpen={!!disablingCategory}
        onClose={() => setDisablingCategory(null)}
        onConfirm={handleDisableConfirm}
        title="Tạm Ngưng Danh Mục"
        message={`Bạn có chắc muốn tạm ngưng danh mục "${disablingCategory?.name}"? Hệ thống sẽ ngăn chặn thao tác nếu vẫn còn sản phẩm đang hoạt động trong danh mục này.`}
        isDangerous={true}
        confirmText="Tạm ngưng"
      />
    </div>
  );
}
