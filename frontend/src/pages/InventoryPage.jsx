import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { generateProductCodeFromName, generateAlternativeCode } from '../utils/codeGenerator';
import api from '../services/api';
import {
  Boxes,
  ArrowDownToLine,
  Sliders,
  History,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Check
} from 'lucide-react';
import Modal from '../components/common/Modal';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('status'); // 'status' or 'history'
  const [inventoryData, setInventoryData] = useState({ items: [], summary: {} });
  const [historyItems, setHistoryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Import Modal State & Modes
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState('existing'); // 'existing' | 'new_ai'
  const [importForm, setImportForm] = useState({
    productId: '',
    quantity: '',
    costPrice: '',
    reason: 'Nhập hàng mới bổ sung'
  });

  // New Product AI Import Form State
  const [newImportForm, setNewImportForm] = useState({
    name: '',
    productCode: '',
    categoryId: '',
    unit: 'cái',
    quantity: '',
    costPrice: '',
    sellingPrice: '',
    minimumStock: '5',
    reason: 'Nhập mặt hàng mới qua AI'
  });

  const [aiClassifying, setAiClassifying] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [codeCheckLoading, setCodeCheckLoading] = useState(false);
  const [codeCheckResult, setCodeCheckResult] = useState(null);
  const [autoCodeEnabled, setAutoCodeEnabled] = useState(true);
  const checkCodeDebounceRef = useRef(null);
  const classifyDebounceRef = useRef(null);
  const [notification, setNotification] = useState(null);

  // Adjust Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    newQuantity: '',
    type: 'ADJUSTMENT',
    reason: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Load categories error:', err);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/inventory?search=${encodeURIComponent(search)}&lowStock=${lowStockOnly}&limit=100`);
      setInventoryData(res.data || { items: [], summary: {} });
    } catch (err) {
      console.error('Load inventory error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, lowStockOnly]);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/transactions?limit=50');
      setHistoryItems(res.data?.items || []);
    } catch (err) {
      console.error('Load history error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (activeTab === 'status') {
      loadInventory();
    } else {
      loadHistory();
    }
  }, [activeTab, loadInventory, loadHistory]);

  const verifyImportCode = useCallback(async (codeToTest) => {
    if (!codeToTest || !codeToTest.trim()) {
      setCodeCheckResult(null);
      return;
    }
    try {
      setCodeCheckLoading(true);
      const res = await api.get(`/products/check-code?code=${encodeURIComponent(codeToTest.trim())}`);
      if (res.data?.data) {
        setCodeCheckResult(res.data.data);
      }
    } catch (e) {
      console.warn('Check code failed:', e.message);
    } finally {
      setCodeCheckLoading(false);
    }
  }, []);

  const handleAiClassifyInInventory = async (nameToClassify) => {
    const target = (nameToClassify || newImportForm.name || '').trim();
    if (!target) return;
    try {
      setAiClassifying(true);
      const res = await api.post('/ai/classify-product', { name: target });
      if (res.data?.data) {
        const data = res.data.data;
        setAiResult(data);
        setNewImportForm(prev => ({
          ...prev,
          categoryId: data.categoryId || prev.categoryId,
          unit: (!prev.unit || prev.unit === 'cái') ? (data.suggestedUnit || 'cái') : prev.unit
        }));
      }
    } catch (e) {
      console.warn('AI classification failed:', e.message);
    } finally {
      setAiClassifying(false);
    }
  };

  const handleNewImportNameChange = (newName) => {
    setNewImportForm(prev => {
      const updated = { ...prev, name: newName };
      if (autoCodeEnabled || !prev.productCode) {
        const generated = generateProductCodeFromName(newName);
        updated.productCode = generated;
        if (checkCodeDebounceRef.current) clearTimeout(checkCodeDebounceRef.current);
        checkCodeDebounceRef.current = setTimeout(() => {
          verifyImportCode(generated);
        }, 300);
      }
      return updated;
    });

    if (classifyDebounceRef.current) clearTimeout(classifyDebounceRef.current);
    if (newName.trim().length >= 3) {
      classifyDebounceRef.current = setTimeout(() => {
        handleAiClassifyInInventory(newName);
      }, 600);
    }
  };

  const handleProductCodeChange = (newCode) => {
    const uppercaseCode = newCode.toUpperCase();
    setNewImportForm(prev => ({ ...prev, productCode: uppercaseCode }));
    setAutoCodeEnabled(false);
    if (checkCodeDebounceRef.current) clearTimeout(checkCodeDebounceRef.current);
    checkCodeDebounceRef.current = setTimeout(() => {
      verifyImportCode(uppercaseCode);
    }, 300);
  };

  const handleGenerateCodeClick = () => {
    const generated = generateProductCodeFromName(newImportForm.name || 'SAN-PHAM');
    setNewImportForm(prev => ({ ...prev, productCode: generated }));
    setAutoCodeEnabled(true);
    verifyImportCode(generated);
  };

  const handleFixImportDuplicateCode = () => {
    const altCode = generateAlternativeCode(newImportForm.productCode);
    setNewImportForm(prev => ({ ...prev, productCode: altCode }));
    verifyImportCode(altCode);
  };

  const openImportModal = (product = null, mode = 'existing') => {
    if (product) {
      setImportMode('existing');
      setImportForm({
        productId: product.id,
        quantity: '',
        costPrice: product.cost_price ? String(product.cost_price) : '',
        reason: 'Nhập hàng mới bổ sung'
      });
    } else {
      setImportMode(mode);
      setImportForm({
        productId: inventoryData.items[0]?.id || '',
        quantity: '',
        costPrice: inventoryData.items[0] ? String(inventoryData.items[0].cost_price || '') : '',
        reason: 'Nhập hàng mới bổ sung'
      });
    }
    setNewImportForm({
      name: '',
      productCode: '',
      categoryId: categories[0]?.id || '',
      unit: 'cái',
      quantity: '',
      costPrice: '',
      sellingPrice: '',
      minimumStock: '5',
      reason: 'Nhập mặt hàng mới qua AI'
    });
    setAiResult(null);
    setCodeCheckResult(null);
    setAutoCodeEnabled(true);
    setFormError('');
    setIsImportModalOpen(true);
  };

  const openAdjustModal = (product = null) => {
    setAdjustForm({
      productId: product?.id || inventoryData.items[0]?.id || '',
      newQuantity: product ? String(product.current_stock) : '',
      type: 'ADJUSTMENT',
      reason: ''
    });
    setFormError('');
    setIsAdjustModalOpen(true);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importForm.productId || !importForm.quantity) {
      setFormError('Vui lòng chọn sản phẩm và nhập số lượng.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await api.post('/inventory/import', {
        productId: importForm.productId,
        quantity: parseInt(importForm.quantity, 10),
        costPrice: importForm.costPrice ? parseFloat(importForm.costPrice) : undefined,
        reason: importForm.reason
      });
      setIsImportModalOpen(false);
      setNotification({
        type: 'success',
        message: 'Nhập hàng vào kho thành công!'
      });
      setTimeout(() => setNotification(null), 5000);
      loadInventory();
    } catch (err) {
      setFormError(err.message || 'Lỗi nhập hàng vào kho.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewImportSubmit = async (e) => {
    e.preventDefault();
    if (!newImportForm.name || !newImportForm.quantity) {
      setFormError('Vui lòng nhập tên sản phẩm và số lượng cần nhập.');
      return;
    }
    if (codeCheckResult && !codeCheckResult.available) {
      setFormError('Mã sản phẩm đã tồn tại. Vui lòng bấm "Đổi mã" hoặc nhập mã khác.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const res = await api.post('/inventory/import-new', {
        name: newImportForm.name,
        productCode: newImportForm.productCode,
        categoryId: newImportForm.categoryId || undefined,
        unit: newImportForm.unit,
        quantity: parseInt(newImportForm.quantity, 10),
        costPrice: newImportForm.costPrice ? parseFloat(newImportForm.costPrice) : 0,
        sellingPrice: newImportForm.sellingPrice ? parseFloat(newImportForm.sellingPrice) : undefined,
        minimumStock: newImportForm.minimumStock ? parseInt(newImportForm.minimumStock, 10) : 5,
        reason: newImportForm.reason
      });

      setIsImportModalOpen(false);
      setNotification({
        type: 'success',
        message: `✨ Đã nhập thành công ${res.data?.data?.product?.name} (${res.data?.data?.product?.stockQuantity} ${res.data?.data?.product?.unit}) vào kho!`
      });
      setTimeout(() => setNotification(null), 5000);
      loadInventory();
    } catch (err) {
      setFormError(err.message || 'Lỗi nhập hàng mới với AI.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustForm.productId || adjustForm.newQuantity === '' || !adjustForm.reason) {
      setFormError('Vui lòng nhập đầy đủ thông tin và lý do điều chỉnh.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await api.post('/inventory/adjust', {
        productId: adjustForm.productId,
        newQuantity: parseInt(adjustForm.newQuantity, 10),
        type: adjustForm.type,
        reason: adjustForm.reason
      });
      setIsAdjustModalOpen(false);
      loadInventory();
    } catch (err) {
      setFormError(err.message || 'Lỗi điều chỉnh kho.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Kho Hàng</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Kiểm soát tồn kho thực tế, nhập hàng và lịch sử biến động chi tiết
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openAdjustModal()}
            style={{ flex: '1 1 120px' }}
          >
            <Sliders size={16} />
            <span>Kiểm Kê Kho</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openImportModal(null, 'existing')}
            style={{ flex: '1 1 130px' }}
          >
            <ArrowDownToLine size={16} />
            <span>Nhập Hàng Có Sẵn</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openImportModal(null, 'new_ai')}
            style={{
              flex: '1 1 150px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={16} />
            <span>Nhập Hàng Mới AI</span>
          </button>
        </div>
      </div>

      {notification && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--primary)',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <CheckCircle2 size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tổng Mặt Hàng</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {inventoryData.summary?.totalProducts || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tổng Số Lượng Tồn</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            {new Intl.NumberFormat('vi-VN').format(inventoryData.summary?.totalStockUnits || 0)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Giá Trị Tồn Kho (Giá Vốn)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatCurrency(inventoryData.summary?.totalInventoryCostValue)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mặt Hàng Sắp Hết</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: inventoryData.summary?.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: '4px' }}>
            {inventoryData.summary?.lowStockCount || 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'status' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('status')}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          <Boxes size={16} />
          <span>Trạng Thái Tồn Kho</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('history')}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          <History size={16} />
          <span>Lịch Sử Biến Động Kho</span>
        </button>
      </div>

      {/* Tab 1: Current Stock */}
      {activeTab === 'status' && (
        <>
          <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tìm theo tên hoặc mã sản phẩm..."
                  style={{ paddingLeft: '36px' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span>Chỉ hiện cảnh báo sắp hết ({inventoryData.summary?.lowStockCount || 0})</span>
              </label>
            </div>
          </div>

            <div className="table-responsive">
            <table className="table table-wide">
              <thead>
                <tr>
                  <th className="hide-mobile">Mã SP</th>
                  <th>Tên Sản Phẩm</th>
                  <th className="hide-mobile">Danh Mục</th>
                  <th>Tồn Kho</th>
                  <th className="hide-mobile">Tối Thiểu</th>
                  <th className="hide-mobile">Đã Bán</th>
                  <th>Giá Trị Tồn</th>
                  <th style={{ textAlign: 'right' }}>Thao Tác Nhanh</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                      <div>Đang tải dữ liệu kho...</div>
                    </td>
                  </tr>
                ) : inventoryData.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Không có sản phẩm nào.
                    </td>
                  </tr>
                ) : (
                  inventoryData.items.map((item) => (
                    <tr key={item.id}>
                      <td className="hide-mobile" style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        {item.product_code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div className="show-mobile-only" style={{ fontSize: '11px', color: 'var(--primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {item.product_code} {item.category_name ? `• ${item.category_name}` : ''}
                        </div>
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--text-secondary)' }}>
                        {item.category_name || '-'}
                      </td>
                      <td>
                        <span className={`badge ${item.is_low_stock ? 'badge-warning' : 'badge-success'}`}>
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--text-muted)' }}>
                        {item.minimum_stock} {item.unit}
                      </td>
                      <td className="hide-mobile">
                        {item.total_sold} {item.unit}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.stock_value)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openImportModal(item)}
                          >
                            <ArrowDownToLine size={13} color="var(--primary)" />
                            <span>Nhập</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openAdjustModal(item)}
                          >
                            <Sliders size={13} />
                            <span>Kiểm kê</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 2: Inventory Transactions History */}
      {activeTab === 'history' && (
        <div className="table-responsive">
          <table className="table table-wide">
            <thead>
              <tr>
                <th>Thời Gian</th>
                <th>Sản Phẩm</th>
                <th>Loại Thao Tác</th>
                <th>Trước</th>
                <th>Biến Động</th>
                <th>Sau</th>
                <th>Người Thực Hiện</th>
                <th>Lý Do / Chứng Từ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                    <div>Đang tải lịch sử kho...</div>
                  </td>
                </tr>
              ) : historyItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Chưa có giao dịch kho nào.
                  </td>
                </tr>
              ) : (
                historyItems.map((tx) => {
                  const isPositive = tx.quantity_change > 0;
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tx.product_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.product_code}</div>
                      </td>
                      <td>
                        <span className={`badge ${tx.transaction_type === 'IMPORT' ? 'badge-info' : (tx.transaction_type === 'SALE' ? 'badge-success' : 'badge-warning')}`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td>{tx.quantity_before}</td>
                      <td style={{ fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                        {isPositive ? `+${tx.quantity_change}` : tx.quantity_change} {tx.product_unit}
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.quantity_after}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {tx.user_full_name || 'Hệ thống'}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tx.reason || tx.reference_id || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Goods Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={importMode === 'new_ai' ? '✨ Nhập Mặt Hàng Mới (Phân Loại AI)' : 'Nhập Thêm Hàng Vào Kho (Sản Phẩm Có Sẵn)'}
        maxWidth="560px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Mode Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            gap: '4px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={() => { setImportMode('existing'); setFormError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: importMode === 'existing' ? 700 : 500,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: importMode === 'existing' ? 'var(--card-bg)' : 'transparent',
                color: importMode === 'existing' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: importMode === 'existing' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Boxes size={15} />
              <span>Sản phẩm có sẵn</span>
            </button>
            <button
              type="button"
              onClick={() => { setImportMode('new_ai'); setFormError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: importMode === 'new_ai' ? 700 : 500,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: importMode === 'new_ai' ? 'var(--primary)' : 'transparent',
                color: importMode === 'new_ai' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: importMode === 'new_ai' ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Sparkles size={15} />
              <span>Mặt hàng mới (AI Phân Loại)</span>
            </button>
          </div>

          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          {/* MODE 1: Existing Product Import Form */}
          {importMode === 'existing' && (
            <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chọn sản phẩm có sẵn *</label>
                <select
                  className="form-control"
                  value={importForm.productId}
                  onChange={(e) => {
                    const selected = inventoryData.items.find(p => p.id === e.target.value);
                    setImportForm({
                      ...importForm,
                      productId: e.target.value,
                      costPrice: selected?.cost_price ? String(selected.cost_price) : importForm.costPrice
                    });
                  }}
                  required
                >
                  {inventoryData.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_code}) - Hiện còn {p.current_stock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Số lượng nhập thêm *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    placeholder="VD: 50"
                    value={importForm.quantity}
                    onChange={(e) => setImportForm({ ...importForm, quantity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Giá vốn nhập (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="Giá vốn..."
                    value={importForm.costPrice}
                    onChange={(e) => setImportForm({ ...importForm, costPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ghi chú / Lý do</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Nhập thêm hàng bổ sung đợt 2..."
                  value={importForm.reason}
                  onChange={(e) => setImportForm({ ...importForm, reason: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Xác Nhận Nhập Kho'}
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: New Product with AI Classification Import Form */}
          {importMode === 'new_ai' && (
            <form onSubmit={handleNewImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Product Name & AI Classify Button */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Tên mặt hàng mới *</label>
                  <button
                    type="button"
                    onClick={() => handleAiClassifyInInventory()}
                    disabled={aiClassifying || !newImportForm.name}
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '11px', height: '22px', gap: '4px', border: '1px solid var(--primary-light)' }}
                    title="Dùng AI nhận diện danh mục và gợi ý mã SKU"
                  >
                    <Sparkles size={12} color="var(--primary)" />
                    <span>{aiClassifying ? 'AI đang phân tích...' : '✨ AI Phân Loại'}</span>
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Trà Ô Long Tea+ Plus 455ml, Mì Omachi sườn hầm..."
                    value={newImportForm.name}
                    onChange={(e) => handleNewImportNameChange(e.target.value)}
                    required
                  />
                  {aiClassifying && (
                    <div style={{ position: 'absolute', right: '10px', top: '12px' }}>
                      <RefreshCw size={15} className="spin" color="var(--primary)" />
                    </div>
                  )}
                </div>
              </div>

              {/* AI Insights & Reasoning Banner */}
              {aiResult && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={14} /> AI Phân Loại: {aiResult.categoryName}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                      Độ tin cậy: {Math.round(aiResult.confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {aiResult.reason}
                  </div>
                </div>
              )}

              {/* Category selection and Unit */}
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Danh mục sản phẩm</label>
                  <select
                    className="form-control"
                    value={newImportForm.categoryId}
                    onChange={(e) => setNewImportForm({ ...newImportForm, categoryId: e.target.value })}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Đơn vị tính</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: lon, chai, gói, lốc..."
                    value={newImportForm.unit}
                    onChange={(e) => setNewImportForm({ ...newImportForm, unit: e.target.value })}
                  />
                </div>
              </div>

              {/* SKU Code & Validation */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Mã sản phẩm (SKU) *</label>
                  <button
                    type="button"
                    onClick={handleGenerateCodeClick}
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '11px', height: '22px', gap: '4px' }}
                    title="Tự sinh mã từ tên"
                  >
                    <Sparkles size={12} color="var(--primary)" />
                    <span>Tự sinh mã</span>
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
                    placeholder="VD: TRA-O-LONG-455ML"
                    value={newImportForm.productCode}
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
                      onClick={handleFixImportDuplicateCode}
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

              {/* Quantity & Cost Price */}
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Số lượng nhập hàng *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    placeholder="VD: 50"
                    value={newImportForm.quantity}
                    onChange={(e) => setNewImportForm({ ...newImportForm, quantity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Giá vốn nhập (VNĐ) *</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="VD: 10000"
                    value={newImportForm.costPrice}
                    onChange={(e) => {
                      const cp = e.target.value;
                      setNewImportForm(prev => ({
                        ...prev,
                        costPrice: cp,
                        sellingPrice: prev.sellingPrice || (cp ? String(Math.round(parseFloat(cp) * 1.25)) : '')
                      }));
                    }}
                    required
                  />
                </div>
              </div>

              {/* Selling Price & Minimum Stock */}
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Giá bán dự kiến (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="Tự tính: Vốn + 25%"
                    value={newImportForm.sellingPrice}
                    onChange={(e) => setNewImportForm({ ...newImportForm, sellingPrice: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cảnh báo tồn tối thiểu</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={newImportForm.minimumStock}
                    onChange={(e) => setNewImportForm({ ...newImportForm, minimumStock: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ghi chú / Nguồn hàng</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Nhập đại lý cấp 1, date mới..."
                  value={newImportForm.reason}
                  onChange={(e) => setNewImportForm({ ...newImportForm, reason: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ gap: '6px' }}>
                  <Sparkles size={15} />
                  <span>{submitting ? 'Đang nhập hàng...' : 'Xác Nhận Nhập Hàng AI'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Adjust Goods Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Điều Chỉnh Số Lượng Tồn Kho (ADJUSTMENT)"
        maxWidth="500px"
      >
        <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Chọn sản phẩm cần kiểm kê *</label>
            <select
              className="form-control"
              value={adjustForm.productId}
              onChange={(e) => {
                const prod = inventoryData.items.find(p => p.id === e.target.value);
                setAdjustForm({
                  ...adjustForm,
                  productId: e.target.value,
                  newQuantity: prod ? String(prod.current_stock) : ''
                });
              }}
              required
            >
              {inventoryData.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.product_code}) - Hiện có: {p.current_stock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số lượng thực tế mới *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="Số lượng thực đếm..."
                value={adjustForm.newQuantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phân loại lý do</label>
              <select
                className="form-control"
                value={adjustForm.type}
                onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
              >
                <option value="ADJUSTMENT">Kiểm kê định kỳ</option>
                <option value="DAMAGE">Hao hụt / Hư hỏng</option>
                <option value="RETURN">Khách trả hàng</option>
                <option value="CORRECTION">Sửa sai sót số liệu</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Lý do điều chỉnh (Bắt buộc) *</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="VD: Kiểm đếm cuối tuần bị vỡ 2 lon..."
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
