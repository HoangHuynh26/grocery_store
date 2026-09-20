import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency } from '../utils/formatters';
import { generateProductCodeFromName, generateAlternativeCode } from '../utils/codeGenerator';
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
  Check,
  Image as ImageIcon,
  Upload,
  Maximize2,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const PRESET_IMAGES = [
  { name: 'Coca Cola', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80' },
  { name: 'Pepsi', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80' },
  { name: 'Nước suối', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80' },
  { name: 'Mì Hảo Hảo', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80' },
  { name: 'Mì Omachi', url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80' },
  { name: 'ChocoPie', url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80' },
  { name: 'Sữa tươi', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80' },
  { name: 'Snack Lay', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80' },
  { name: 'Hạt nêm', url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80' },
  { name: 'Dầu ăn', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80' },
  { name: 'Nước mía', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80' },
  { name: 'Nước cam', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80' }
];

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
  const [previewImageProduct, setPreviewImageProduct] = useState(null);
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
    description: '',
    imageUrl: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Realtime Product Code Uniqueness & Auto-generation State
  const [codeCheckLoading, setCodeCheckLoading] = useState(false);
  const [codeCheckResult, setCodeCheckResult] = useState(null); // { available: boolean, message: string }
  const [autoCodeEnabled, setAutoCodeEnabled] = useState(true);
  const checkCodeDebounceRef = useRef(null);

  const verifyProductCode = useCallback(async (codeToTest, currentProdId = null) => {
    if (!codeToTest || !codeToTest.trim()) {
      setCodeCheckResult(null);
      return;
    }
    try {
      setCodeCheckLoading(true);
      const res = await api.get(`/products/check-code?code=${encodeURIComponent(codeToTest.trim())}&excludeId=${currentProdId || ''}`);
      if (res.data?.data) {
        setCodeCheckResult(res.data.data);
      }
    } catch (e) {
      console.warn('Check code failed:', e.message);
    } finally {
      setCodeCheckLoading(false);
    }
  }, []);

  const handleProductCodeChange = (newCode) => {
    const uppercaseCode = newCode.toUpperCase();
    setFormData(prev => ({ ...prev, productCode: uppercaseCode }));
    setAutoCodeEnabled(false); // User manually modified code

    if (checkCodeDebounceRef.current) {
      clearTimeout(checkCodeDebounceRef.current);
    }
    checkCodeDebounceRef.current = setTimeout(() => {
      verifyProductCode(uppercaseCode, editingProduct?.id);
    }, 300);
  };

  const handleProductNameChange = (newName) => {
    setFormData(prev => {
      const updated = { ...prev, name: newName };
      if (autoCodeEnabled || !prev.productCode) {
        const generated = generateProductCodeFromName(newName);
        updated.productCode = generated;
        if (checkCodeDebounceRef.current) {
          clearTimeout(checkCodeDebounceRef.current);
        }
        checkCodeDebounceRef.current = setTimeout(() => {
          verifyProductCode(generated, editingProduct?.id);
        }, 300);
      }
      return updated;
    });
  };

  const handleGenerateCodeClick = () => {
    const generated = generateProductCodeFromName(formData.name || 'SAN-PHAM');
    setFormData(prev => ({ ...prev, productCode: generated }));
    setAutoCodeEnabled(true);
    verifyProductCode(generated, editingProduct?.id);
  };

  const handleFixDuplicateCode = () => {
    const altCode = generateAlternativeCode(formData.productCode);
    setFormData(prev => ({ ...prev, productCode: altCode }));
    verifyProductCode(altCode, editingProduct?.id);
  };

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
      description: '',
      imageUrl: ''
    });
    setFormError('');
    setCodeCheckResult(null);
    setAutoCodeEnabled(true);
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
      description: product.description || '',
      imageUrl: product.image_url || ''
    });
    setFormError('');
    setCodeCheckResult(null);
    setAutoCodeEnabled(false);
    setIsFormModalOpen(true);
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Dung lượng ảnh tối đa 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData((prev) => ({ ...prev, imageUrl: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productCode || !formData.name || !formData.sellingPrice) {
      setFormError('Vui lòng điền mã sản phẩm, tên và giá bán.');
      return;
    }

    if (codeCheckResult && !codeCheckResult.available) {
      setFormError('Mã sản phẩm đã tồn tại trong hệ thống. Vui lòng đổi mã khác trước khi lưu.');
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
          description: formData.description,
          image_url: formData.imageUrl
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
          description: formData.description,
          imageUrl: formData.imageUrl
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
      <div className="page-header-responsive">
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
      <div className="card" style={{ padding: '14px', marginBottom: '18px' }}>
        <div className="filter-bar-responsive">
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', padding: '6px 0' }}>
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
        <table className="table table-wide">
          <thead>
            <tr>
              <th style={{ width: '68px' }}>Hình Ảnh</th>
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Đang tải danh sách sản phẩm...</div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy sản phẩm nào.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLow = p.stock_quantity <= p.minimum_stock;
                return (
                  <tr key={p.id}>
                    <td style={{ width: '68px', padding: '8px' }}>
                      {p.image_url ? (
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            position: 'relative',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                            transition: 'transform 0.15s ease'
                          }}
                          onClick={() => setPreviewImageProduct(p)}
                          title="Bấm để xem ảnh to rõ ràng"
                        >
                          <img
                            src={p.image_url}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            loading="lazy"
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            borderRadius: '4px',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Maximize2 size={10} color="#ffffff" />
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-card-secondary)',
                            border: '1px dashed var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                          onClick={() => openEditModal(p)}
                          title="Chưa có ảnh, bấm để thêm ảnh"
                        >
                          <Package size={18} opacity={0.4} />
                          <span style={{ fontSize: '9px', marginTop: '2px' }}>+ Ảnh</span>
                        </div>
                      )}
                    </td>
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

          <div className="form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên sản phẩm *</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Coca Cola lon 330ml"
                value={formData.name}
                onChange={(e) => handleProductNameChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Mã sản phẩm *</label>
                <button
                  type="button"
                  onClick={handleGenerateCodeClick}
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '11px', height: '22px', gap: '4px' }}
                  title="Tự động tạo mã dựa trên tên sản phẩm"
                >
                  <Sparkles size={12} color="var(--primary)" />
                  <span>Tự tạo mã</span>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{
                    paddingRight: '36px',
                    borderColor: codeCheckResult
                      ? (codeCheckResult.available ? 'var(--success)' : 'var(--danger)')
                      : undefined
                  }}
                  placeholder="VD: COCA-COLA-LON-330ML"
                  value={formData.productCode}
                  onChange={(e) => handleProductCodeChange(e.target.value)}
                  required
                />
                <div style={{ position: 'absolute', right: '10px', top: '12px' }}>
                  {codeCheckLoading ? (
                    <RefreshCw size={15} className="spin" color="var(--text-muted)" />
                  ) : codeCheckResult ? (
                    codeCheckResult.available ? (
                      <CheckCircle2 size={16} color="var(--success)" title="Mã hợp lệ" />
                    ) : (
                      <AlertCircle size={16} color="var(--danger)" title="Mã đã tồn tại" />
                    )
                  ) : null}
                </div>
              </div>

              {/* Duplicate code alert feedback */}
              {codeCheckResult && !codeCheckResult.available && (
                <div style={{
                  marginTop: '6px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--danger)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{codeCheckResult.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFixDuplicateCode}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px', alignSelf: 'flex-start' }}
                  >
                    + Đổi mã (Thêm đuôi -01, -02)
                  </button>
                </div>
              )}

              {codeCheckResult && codeCheckResult.available && (
                <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={13} /> Mã hợp lệ, có thể sử dụng.
                </div>
              )}
            </div>
          </div>

          <div className="form-grid-2">
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

          <div className="form-grid-2">
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

          <div className="form-grid-2">
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

          {/* Product Image Section */}
          <div style={{
            padding: '14px',
            backgroundColor: 'var(--bg-card-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} color="var(--primary)" />
                <span>Hình ảnh sản phẩm (Rõ nét)</span>
              </label>
              {formData.imageUrl && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--danger)' }}
                  onClick={() => setFormData({ ...formData, imageUrl: '' })}
                >
                  <X size={12} />
                  <span>Gỡ ảnh</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              {/* Live Preview Box */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                border: '2px dashed var(--border-color)',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
              }}>
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Xem trước"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                    <ImageIcon size={22} style={{ opacity: 0.3, margin: '0 auto 4px' }} />
                    <div>Chưa có ảnh</div>
                  </div>
                )}
              </div>

              {/* Image Inputs */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="Dán link ảnh (URL)..."
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    style={{ fontSize: '12px', flex: 1 }}
                  />

                  <label className="btn btn-secondary" style={{ flexShrink: 0, cursor: 'pointer', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={14} />
                    <span>Tải file</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileUpload}
                    />
                  </label>
                </div>

                {/* Quick Pick Presets */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Chọn nhanh ảnh mẫu tạp hóa chuẩn:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="badge"
                        style={{
                          cursor: 'pointer',
                          border: formData.imageUrl === preset.url ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: formData.imageUrl === preset.url ? 'var(--primary-bg)' : 'var(--bg-card)',
                          color: formData.imageUrl === preset.url ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '11px',
                          padding: '3px 8px'
                        }}
                        onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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

      {/* Product Image Lightbox Modal */}
      {previewImageProduct && (
        <Modal
          isOpen={!!previewImageProduct}
          onClose={() => setPreviewImageProduct(null)}
          title={`Hình Ảnh: ${previewImageProduct.name}`}
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '100%',
              height: '320px',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <img
                src={previewImageProduct.image_url}
                alt={previewImageProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ width: '100%', backgroundColor: 'var(--bg-card-secondary)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {previewImageProduct.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mã SP: <b style={{ fontFamily: 'monospace' }}>{previewImageProduct.product_code}</b></span>
                <span style={{ color: 'var(--text-muted)' }}>Đơn vị: <b>{previewImageProduct.unit}</b></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Giá bán: <b style={{ color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(previewImageProduct.selling_price)}</b></span>
                <span style={{ color: 'var(--text-secondary)' }}>Tồn kho: <b>{previewImageProduct.stock_quantity} {previewImageProduct.unit}</b></span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  const p = previewImageProduct;
                  setPreviewImageProduct(null);
                  openEditModal(p);
                }}
              >
                <Edit2 size={15} />
                <span>Sửa thông tin / Đổi ảnh</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setPreviewImageProduct(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

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
