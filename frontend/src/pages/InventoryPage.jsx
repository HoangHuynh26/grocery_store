import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import api from '../services/api';
import {
  Boxes,
  ArrowDownToLine,
  Sliders,
  History,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus
} from 'lucide-react';
import Modal from '../components/common/Modal';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('status'); // 'status' or 'history'
  const [inventoryData, setInventoryData] = useState({ items: [], summary: {} });
  const [historyItems, setHistoryItems] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    productId: '',
    quantity: '',
    costPrice: '',
    reason: 'Nhập hàng mới bổ sung'
  });

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
    if (activeTab === 'status') {
      loadInventory();
    } else {
      loadHistory();
    }
  }, [activeTab, loadInventory, loadHistory]);

  const openImportModal = (product = null) => {
    setImportForm({
      productId: product?.id || inventoryData.items[0]?.id || '',
      quantity: '',
      costPrice: product ? String(product.cost_price) : '',
      reason: 'Nhập hàng mới bổ sung'
    });
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
      loadInventory();
    } catch (err) {
      setFormError(err.message || 'Lỗi nhập hàng vào kho.');
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
            style={{ flex: '1 1 140px' }}
          >
            <Sliders size={16} />
            <span>Điều Chỉnh Kho</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openImportModal()}
            style={{ flex: '1 1 140px' }}
          >
            <ArrowDownToLine size={16} />
            <span>Nhập Thêm Hàng</span>
          </button>
        </div>
      </div>

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
        title="Nhập Thêm Hàng Vào Kho (IMPORT)"
        maxWidth="500px"
      >
        <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Chọn sản phẩm *</label>
            <select
              className="form-control"
              value={importForm.productId}
              onChange={(e) => setImportForm({ ...importForm, productId: e.target.value })}
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
              placeholder="VD: Nhập thêm hàng đợt 2..."
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
