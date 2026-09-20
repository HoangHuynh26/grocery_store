import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import {
  Package,
  Plus,
  Search,
  QrCode,
  Edit2,
  Trash2,
  Printer,
  AlertTriangle,
  RefreshCw,
  Check
} from 'lucide-react';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [qrModalProduct, setQrModalProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    productCode: '',
    name: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
    minimumStock: '5',
    unit: 'cái',
    hasQr: true,
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCat) params.append('categoryId', selectedCat);
      if (lowStockOnly) params.append('lowStock', 'true');
      params.append('limit', '100');

      const [prodRes, catRes] = await Promise.all([
        api.get(`/products?${params.toString()}`),
        api.get('/categories')
      ]);
      setProducts(prodRes.data?.items || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Load products error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCat, lowStockOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      productCode: '',
      name: '',
      categoryId: categories[0]?.id || '',
      costPrice: '',
      sellingPrice: '',
      stockQuantity: '0',
      minimumStock: '5',
      unit: 'cái',
      hasQr: true,
      description: ''
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      productCode: product.product_code,
      name: product.name,
      categoryId: product.category_id || '',
      costPrice: String(product.cost_price),
      sellingPrice: String(product.selling_price),
      stockQuantity: String(product.stock_quantity),
      minimumStock: String(product.minimum_stock),
      unit: product.unit,
      hasQr: product.has_qr,
      description: product.description || ''
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productCode || !formData.name || !formData.sellingPrice) {
      setFormError('Vui lòng điền mã sản phẩm, tên và giá bán.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      if (editingProduct) {
        // Update product
        await api.put(`/products/${editingProduct.id}`, {
          product_code: formData.productCode,
          name: formData.name,
          category_id: formData.categoryId || null,
          cost_price: parseFloat(formData.costPrice || 0),
          selling_price: parseFloat(formData.sellingPrice || 0),
          minimum_stock: parseInt(formData.minimumStock || 5, 10),
          unit: formData.unit,
          has_qr: formData.hasQr,
          description: formData.description
        });
      } else {
        // Create product
        await api.post('/products', {
          productCode: formData.productCode,
          name: formData.name,
          categoryId: formData.categoryId || null,
          costPrice: parseFloat(formData.costPrice || 0),
          sellingPrice: parseFloat(formData.sellingPrice || 0),
          stockQuantity: parseInt(formData.stockQuantity || 0, 10),
          minimumStock: parseInt(formData.minimumStock || 5, 10),
          unit: formData.unit,
          hasQr: formData.hasQr,
          description: formData.description
        });
      }

      setIsFormModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Lỗi lưu thông tin sản phẩm.');
    } finally {
      setSubmitting(false);
    }
  };

  const openQrModal = async (product) => {
    try {
      const res = await api.get(`/products/${product.id}`);
      setQrModalProduct(res.data);
    } catch (e) {
      console.error('Fetch QR code error:', e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      await api.delete(`/products/${deletingProduct.id}`);
      setDeletingProduct(null);
      loadData();
    } catch (err) {
      alert(err.message || 'Không thể xóa sản phẩm.');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Sản Phẩm</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Danh sách hàng hóa, mã vạch QR và thiết lập giá bán
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
          style={{ padding: '10px 18px' }}
        >
          <Plus size={18} />
          <span>Thêm Sản Phẩm Mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo tên, mã sản phẩm hoặc mã QR..."
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
          </div>

          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '160px' }}
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
            />
            <span>Chỉ xem hàng sắp hết</span>
          </label>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên Sản Phẩm</th>
              <th>Danh Mục</th>
              <th>Giá Vốn</th>
              <th>Giá Bán</th>
              <th>Tồn Kho</th>
              <th>Mã QR</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Đang tải danh sách sản phẩm...</div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy sản phẩm nào.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLow = p.stock_quantity <= p.minimum_stock;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>
                      {p.product_code}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.description}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {p.category_name || '-'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(p.cost_price)}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(p.selling_price)}
                    </td>
                    <td>
                      <span className={`badge ${p.stock_quantity <= 0 ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-success')}`}>
                        {p.stock_quantity} {p.unit}
                      </span>
                    </td>
                    <td>
                      {p.has_qr ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => openQrModal(p)}
                        >
                          <QrCode size={13} color="var(--primary)" />
                          <span>Xem QR</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Không có QR</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => openEditModal(p)}
                          title="Sửa sản phẩm"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                          onClick={() => setDeletingProduct(p)}
                          title="Ngưng kinh doanh"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
        maxWidth="600px"
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px'
            }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mã sản phẩm *</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: NUOC-COCA-330"
                value={formData.productCode}
                onChange={(e) => setFormData({ ...formData, productCode: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên sản phẩm *</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Coca Cola lon 330ml"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Danh mục</label>
              <select
                className="form-control"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Chọn danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Đơn vị tính</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: lon, chai, gói, ly, kg..."
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Giá vốn (VNĐ)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="0"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Giá bán lẻ (VNĐ) *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="0"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {!editingProduct && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số lượng tồn kho ban đầu</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="0"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mức tồn kho tối thiểu (Cảnh báo)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="5"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
              />
            </div>
          </div>

          {/* QR Code Options */}
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--bg-card-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              TÙY CHỌN MÃ QR
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="hasQr"
                  checked={formData.hasQr === true}
                  onChange={() => setFormData({ ...formData, hasQr: true })}
                />
                <span>Tự động tạo mã QR (Dành cho sản phẩm đóng gói)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="hasQr"
                  checked={formData.hasQr === false}
                  onChange={() => setFormData({ ...formData, hasQr: false })}
                />
                <span>Không tạo QR (Nước mía, nước cam, đồ chế biến)</span>
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mô tả / Ghi chú</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Thông tin thêm..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsFormModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : (editingProduct ? 'Cập Nhật' : 'Tạo Sản Phẩm')}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Display & Print Modal */}
      {qrModalProduct && (
        <Modal
          isOpen={!!qrModalProduct}
          onClose={() => setQrModalProduct(null)}
          title={`Mã QR: ${qrModalProduct.name}`}
          maxWidth="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            {qrModalProduct.qr_image_data_url ? (
              <div style={{
                padding: '16px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <img
                  src={qrModalProduct.qr_image_data_url}
                  alt={qrModalProduct.name}
                  style={{ width: '220px', height: '220px', display: 'block' }}
                />
              </div>
            ) : (
              <div>Đang tải mã QR...</div>
            )}

            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{qrModalProduct.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Mã SP: {qrModalProduct.product_code}</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {formatCurrency(qrModalProduct.selling_price)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>In Tem Mã</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setQrModalProduct(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Soft Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteConfirm}
        title="Ngưng Kinh Doanh Sản Phẩm"
        message={`Bạn có chắc muốn chuyển sản phẩm "${deletingProduct?.name}" sang trạng thái ngưng kinh doanh? Các hóa đơn cũ vẫn sẽ giữ nguyên tham chiếu.`}
        isDangerous={true}
        confirmText="Ngưng kinh doanh"
      />
    </div>
  );
}
