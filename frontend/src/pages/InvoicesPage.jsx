import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Printer,
  RefreshCw,
  Sliders,
  History,
  AlertCircle,
  Calendar,
  Clock,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  X,
  Filter
} from 'lucide-react';
import Modal from '../components/common/Modal';

export default function InvoicesPage() {
  const { isSuperAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [shift, setShift] = useState('all');
  const [loading, setLoading] = useState(true);

  // View Details Modal
  const [viewInvoice, setViewInvoice] = useState(null);

  // Super Admin Adjust Invoice Modal
  const [adjustInvoice, setAdjustInvoice] = useState(null);
  const [adjustments, setAdjustments] = useState([]); // [{ itemId, quantity }]
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Helper to apply date presets
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const toLocalDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'today') {
      const today = toLocalDate(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const yd = new Date(now); yd.setDate(yd.getDate() - 1);
      const yesterday = toLocalDate(yd);
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (preset === 'week') {
      const start = new Date(now); start.setDate(start.getDate() - start.getDay() + 1);
      setStartDate(toLocalDate(start));
      setEndDate(toLocalDate(now));
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toLocalDate(start));
      setEndDate(toLocalDate(now));
    } else if (preset === '7days') {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      setStartDate(toLocalDate(start));
      setEndDate(toLocalDate(now));
    } else if (preset === '30days') {
      const start = new Date(now); start.setDate(start.getDate() - 29);
      setStartDate(toLocalDate(start));
      setEndDate(toLocalDate(now));
    }
  };

  // Helper to apply shift / time presets
  const applyShift = (shiftKey) => {
    setShift(shiftKey);
    if (shiftKey === 'all') {
      setStartTime('');
      setEndTime('');
    } else if (shiftKey === 'morning') {
      setStartTime('06:00');
      setEndTime('12:00');
    } else if (shiftKey === 'afternoon') {
      setStartTime('12:00');
      setEndTime('18:00');
    } else if (shiftKey === 'evening') {
      setStartTime('18:00');
      setEndTime('23:59');
    }
  };

  const clearAllFilters = () => {
    setStartDate('');
    setEndDate('');
    setDatePreset('');
    setStartTime('');
    setEndTime('');
    setShift('all');
    setSearch('');
    setPaymentMethod('');
  };

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (startTime) params.append('startTime', startTime);
      if (endTime) params.append('endTime', endTime);
      params.append('limit', '50');

      const res = await api.get(`/invoices?${params.toString()}`);
      const resData = res.data?.data || res.data;
      setInvoices(resData?.items || []);
      setSummary(resData?.summary || null);
    } catch (err) {
      console.error('Load invoices error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, paymentMethod, startDate, endDate, startTime, endTime]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openViewModal = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      setViewInvoice(res.data?.data || res.data);
    } catch (e) {
      alert('Không thể tải chi tiết hóa đơn.');
    }
  };

  const openAdjustModal = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      const inv = res.data?.data || res.data;
      setAdjustInvoice(inv);
      setAdjustments(inv.items.map(i => ({ itemId: i.id, newQuantity: i.quantity, originalQuantity: i.quantity, name: i.product_name })));
      setAdjustReason('');
      setAdjustError('');
    } catch (e) {
      alert('Lỗi tải hóa đơn để điều chỉnh.');
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustReason || adjustReason.trim().length < 5) {
      setAdjustError('Bắt buộc phải nhập lý do điều chỉnh tối thiểu 5 ký tự.');
      return;
    }

    try {
      setSubmitting(true);
      setAdjustError('');
      await api.put(`/invoices/${adjustInvoice.id}/adjust`, {
        itemAdjustments: adjustments.map(a => ({ itemId: a.itemId, quantity: parseInt(a.newQuantity, 10) })),
        reason: adjustReason.trim()
      });
      alert('Điều chỉnh hóa đơn thành công và đã hoàn kho tương ứng.');
      setAdjustInvoice(null);
      loadInvoices();
    } catch (err) {
      setAdjustError(err.response?.data?.error?.message || err.message || 'Lỗi điều chỉnh hóa đơn.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilter = !!(startDate || endDate || startTime || endTime || search || paymentMethod || datePreset);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Đơn Hàng & Hóa Đơn</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Theo dõi, lọc theo thời gian thực và quản lý hồ sơ đơn hàng bán lẻ tại quầy POS
          </p>
        </div>

        <button
          onClick={loadInvoices}
          className="btn btn-secondary btn-icon"
          title="Làm mới dữ liệu"
          style={{ width: '38px', height: '38px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* KPI Summary Cards for Filtered Period */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Card 1: Tổng đơn hàng */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
            <ShoppingBag size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tổng Đơn Hàng</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary ? `${summary.totalOrders} đơn` : `${invoices.length} đơn`}
            </div>
          </div>
        </div>

        {/* Card 2: Doanh Thu Kỳ Này */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Doanh Thu Kỳ Lọc</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>
              {formatCurrency(summary?.totalRevenue ?? invoices.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0))}
            </div>
          </div>
        </div>

        {/* Card 3: Cơ cấu thanh toán */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tiền Mặt / CK</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              💵 {formatCurrency(summary?.cashRevenue ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>
              💳 {formatCurrency(summary?.transferRevenue ?? 0)}
            </div>
          </div>
        </div>

        {/* Card 4: Giá trị trung bình đơn (AOV) */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Giá Trị TB / Đơn</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatCurrency(summary?.averageOrderValue ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Multi-Tier Filter Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Tier 1: Search & Payment Method */}
        <div className="filter-bar-responsive">
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo số đơn hàng, mã HD, tên thu ngân..."
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
          </div>

          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '180px' }}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="">Tất cả phương thức thanh toán</option>
            <option value="CASH">Tiền mặt</option>
            <option value="TRANSFER">Chuyển khoản / QR</option>
          </select>
        </div>

        {/* Tier 2: Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Calendar size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Ngày:</span>
          {[
            { key: 'today', label: 'Hôm nay' },
            { key: 'yesterday', label: 'Hôm qua' },
            { key: '7days', label: '7 ngày qua' },
            { key: 'week', label: 'Tuần này' },
            { key: 'month', label: 'Tháng này' },
            { key: '30days', label: '30 ngày' },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              className={`btn ${datePreset === p.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '20px', height: '28px' }}
              onClick={() => applyDatePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tier 3: Shift / Time-of-Day Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
          <Clock size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Ca Bán Hàng:</span>
          {[
            { key: 'all', label: 'Tất cả giờ' },
            { key: 'morning', label: 'Ca Sáng (06:00 - 12:00)' },
            { key: 'afternoon', label: 'Ca Chiều (12:00 - 18:00)' },
            { key: 'evening', label: 'Ca Tối (18:00 - 23:59)' }
          ].map(s => (
            <button
              key={s.key}
              type="button"
              className={`btn ${shift === s.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '20px', height: '28px' }}
              onClick={() => applyShift(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Tier 4: Custom Date & Time Inputs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          paddingTop: '10px',
          borderTop: '1px dashed var(--border-color)'
        }}>
          {/* Start Date & Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Từ:</label>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', fontSize: '12px', padding: '6px 8px' }}
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
            />
            <input
              type="time"
              className="form-control"
              style={{ width: 'auto', fontSize: '12px', padding: '6px 8px' }}
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setShift('custom'); }}
              title="Giờ bắt đầu"
            />
          </div>

          {/* End Date & Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Đến:</label>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', fontSize: '12px', padding: '6px 8px' }}
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
            />
            <input
              type="time"
              className="form-control"
              style={{ width: 'auto', fontSize: '12px', padding: '6px 8px' }}
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setShift('custom'); }}
              title="Giờ kết thúc"
            />
          </div>

          {/* Active Filter Clear & Indicator */}
          {hasActiveFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, backgroundColor: 'var(--primary-light)', padding: '4px 10px', borderRadius: '12px' }}>
                Đang lọc: {summary?.totalOrders ?? invoices.length} đơn
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '12px', height: '28px', color: 'var(--danger)', gap: '4px' }}
                onClick={clearAllFilters}
                title="Xóa tất cả điều kiện lọc"
              >
                <X size={13} />
                <span>Xóa lọc</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-responsive">
        <table className="table table-wide">
          <thead>
            <tr>
              <th>Số Hóa Đơn</th>
              <th>Thời Gian</th>
              <th className="hide-mobile">Thu Ngân</th>
              <th className="hide-mobile">Số Món</th>
              <th>Tổng Tiền</th>
              <th>Thanh Toán</th>
              <th>Trạng Thái</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Đang tải danh sách hóa đơn...</div>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy hóa đơn nào.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>
                      {inv.invoice_number}
                    </div>
                    <div className="show-mobile-only" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {inv.created_by_name || 'Admin'} • {inv.items_count} món
                    </div>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(inv.created_at)}
                  </td>
                  <td className="hide-mobile" style={{ color: 'var(--text-secondary)' }}>
                    {inv.created_by_name || 'Admin'}
                  </td>
                  <td className="hide-mobile">
                    {inv.items_count} món ({inv.total_units_sold} đơn vị)
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(inv.total_amount)}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {inv.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${inv.status === 'COMPLETED' ? 'badge-success' : (inv.status === 'ADJUSTED' ? 'badge-warning' : 'badge-danger')}`}>
                      {inv.status === 'COMPLETED' ? 'Thành công' : (inv.status === 'ADJUSTED' ? 'Đã sửa' : 'Đã hủy')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => openViewModal(inv.id)}
                        title="Xem chi tiết"
                      >
                        <Eye size={14} />
                      </button>

                      {isSuperAdmin && inv.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          style={{ width: '32px', height: '32px', color: 'var(--warning)' }}
                          onClick={() => openAdjustModal(inv.id)}
                          title="Điều chỉnh hóa đơn (Super Admin)"
                        >
                          <Sliders size={14} />
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

      {/* Invoice Receipt Modal */}
      {viewInvoice && (
        <Modal
          isOpen={!!viewInvoice}
          onClose={() => setViewInvoice(null)}
          title=""
          maxWidth="420px"
        >
          <div className="receipt-paper">
            {/* Receipt Header - Store Brand */}
            <div className="receipt-header">
              <div className="receipt-logo">🛒</div>
              <div className="receipt-store-name">GROCERY STORE</div>
              <div className="receipt-store-sub">Tạp Hóa Thông Minh - Hệ Thống POS</div>
              <div className="receipt-divider-double" />
            </div>

            {/* Invoice Number */}
            <div className="receipt-invoice-number">
              <div className="receipt-label">HÓA ĐƠN BÁN HÀNG</div>
              <div className="receipt-inv-code">{viewInvoice.invoice_number}</div>
            </div>

            <div className="receipt-divider-dashed" />

            {/* Meta Info */}
            <div className="receipt-meta">
              <div className="receipt-meta-row">
                <span>Ngày giờ:</span>
                <span>{formatDateTime(viewInvoice.created_at)}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Thu ngân:</span>
                <span style={{ fontWeight: 600 }}>{viewInvoice.created_by_name}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Thanh toán:</span>
                <span>{viewInvoice.payment_method === 'CASH' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Trạng thái:</span>
                <span className={`receipt-status ${viewInvoice.status === 'COMPLETED' ? 'receipt-status-ok' : viewInvoice.status === 'ADJUSTED' ? 'receipt-status-warn' : 'receipt-status-cancel'}`}>
                  {viewInvoice.status === 'COMPLETED' ? '✓ Hoàn Tất' : viewInvoice.status === 'ADJUSTED' ? '⚙ Đã Sửa' : '✕ Đã Hủy'}
                </span>
              </div>
            </div>

            <div className="receipt-divider-dashed" />

            {/* Items Table */}
            <div className="receipt-items-header">
              <span style={{ flex: 2, textAlign: 'left' }}>Sản phẩm</span>
              <span style={{ flex: 0.6, textAlign: 'center' }}>SL</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Đơn giá</span>
              <span style={{ flex: 1, textAlign: 'right' }}>T.Tiền</span>
            </div>

            <div className="receipt-divider-thin" />

            {viewInvoice.items?.map((item, idx) => (
              <div key={item.id} className="receipt-item-row">
                <div className="receipt-item-name-row">
                  <span className="receipt-item-name">{item.product_name}</span>
                </div>
                <div className="receipt-item-detail-row">
                  <span className="receipt-item-code">{item.product_code}</span>
                  <span style={{ flex: 0.6, textAlign: 'center', fontFamily: 'monospace' }}>{item.quantity} {item.unit}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.unit_price)}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(item.total_price)}</span>
                </div>
                {idx < viewInvoice.items.length - 1 && <div className="receipt-item-sep" />}
              </div>
            ))}

            <div className="receipt-divider-double" />

            {/* Payment Summary */}
            <div className="receipt-summary">
              {viewInvoice.discount_amount > 0 && (
                <>
                  <div className="receipt-summary-row">
                    <span>Tạm tính:</span>
                    <span>{formatCurrency(Number(viewInvoice.total_amount) + Number(viewInvoice.discount_amount))}</span>
                  </div>
                  <div className="receipt-summary-row" style={{ color: 'var(--danger)' }}>
                    <span>Chiết khấu:</span>
                    <span>-{formatCurrency(viewInvoice.discount_amount)}</span>
                  </div>
                </>
              )}
              <div className="receipt-total-row">
                <span>TỔNG CỘNG</span>
                <span className="receipt-total-amount">{formatCurrency(viewInvoice.total_amount)}</span>
              </div>
              {viewInvoice.payment_method === 'CASH' && (
                <>
                  <div className="receipt-summary-row" style={{ marginTop: '6px' }}>
                    <span>Khách đưa:</span>
                    <span>{formatCurrency(viewInvoice.amount_paid)}</span>
                  </div>
                  <div className="receipt-summary-row receipt-change">
                    <span>Tiền thối:</span>
                    <span>{formatCurrency(viewInvoice.change_amount)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="receipt-divider-dashed" />

            {/* Items Count */}
            <div className="receipt-footer-info">
              Tổng số mặt hàng: {viewInvoice.items?.length || 0} &nbsp;|&nbsp; Tổng SL: {viewInvoice.items?.reduce((s, i) => s + i.quantity, 0) || 0} đơn vị
            </div>

            {/* Audit Trail */}
            {viewInvoice.audit_logs && viewInvoice.audit_logs.length > 0 && (
              <>
                <div className="receipt-divider-dashed" />
                <div className="receipt-audit-section">
                  <div className="receipt-audit-title">
                    <History size={12} /> Lịch Sử Điều Chỉnh
                  </div>
                  {viewInvoice.audit_logs.map((log) => (
                    <div key={log.id} className="receipt-audit-entry">
                      <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>{formatDateTime(log.created_at)}</div>
                      <div style={{ fontSize: '11px' }}>Bởi: <strong>{log.actor_name || 'Super Admin'}</strong></div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Lý do: {log.reason}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="receipt-divider-dashed" />

            {/* Thank you footer */}
            <div className="receipt-thank-you">
              <div>✦ Cảm ơn quý khách ✦</div>
              <div className="receipt-come-again">Hẹn gặp lại lần sau!</div>
            </div>

            {/* Tear edge */}
            <div className="receipt-tear-edge" />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px', padding: '0 12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
              style={{ flex: 1 }}
            >
              <Printer size={16} />
              <span>In Hóa Đơn</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setViewInvoice(null)}
              style={{ flex: 1 }}
            >
              Đóng
            </button>
          </div>

          <style>{`
            .receipt-paper {
              background: #fffef8;
              border: 1px solid #e8e4d9;
              border-radius: 4px;
              padding: 24px 20px;
              font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
              font-size: 12px;
              color: #1a1a1a;
              position: relative;
              box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
              overflow: hidden;
            }
            .receipt-paper::before {
              content: '';
              position: absolute;
              top: 0; left: 0; right: 0;
              height: 4px;
              background: repeating-linear-gradient(90deg, var(--primary), var(--primary) 4px, transparent 4px, transparent 8px);
              opacity: 0.6;
            }

            .receipt-header {
              text-align: center;
              padding-top: 8px;
              margin-bottom: 12px;
            }
            .receipt-logo {
              font-size: 32px;
              margin-bottom: 4px;
              line-height: 1;
            }
            .receipt-store-name {
              font-size: 20px;
              font-weight: 900;
              letter-spacing: 3px;
              color: #0f172a;
              font-family: var(--font-family);
            }
            .receipt-store-sub {
              font-size: 10px;
              color: #64748b;
              letter-spacing: 0.5px;
              margin-top: 2px;
              font-family: var(--font-family);
            }

            .receipt-invoice-number {
              text-align: center;
              margin: 8px 0;
            }
            .receipt-label {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 2px;
              color: #334155;
              font-family: var(--font-family);
            }
            .receipt-inv-code {
              font-size: 13px;
              font-weight: 800;
              color: var(--primary);
              letter-spacing: 0.5px;
              margin-top: 3px;
              word-break: break-all;
            }

            .receipt-divider-double {
              border: none;
              height: 3px;
              border-top: 1.5px solid #c8c3b5;
              border-bottom: 1.5px solid #c8c3b5;
              margin: 10px 0;
            }
            .receipt-divider-dashed {
              border: none;
              border-top: 1.5px dashed #d4cfc3;
              margin: 10px 0;
            }
            .receipt-divider-thin {
              border: none;
              border-top: 1px solid #e8e4d9;
              margin: 6px 0;
            }

            .receipt-meta {
              display: flex;
              flex-direction: column;
              gap: 5px;
            }
            .receipt-meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-family: var(--font-family);
            }
            .receipt-meta-row span:first-child {
              color: #64748b;
            }

            .receipt-status {
              font-weight: 700;
              font-size: 11px;
              padding: 1px 8px;
              border-radius: 4px;
            }
            .receipt-status-ok {
              color: #059669;
              background: #ecfdf5;
            }
            .receipt-status-warn {
              color: #d97706;
              background: #fffbeb;
            }
            .receipt-status-cancel {
              color: #dc2626;
              background: #fef2f2;
            }

            .receipt-items-header {
              display: flex;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #334155;
              padding: 4px 0;
              font-family: var(--font-family);
            }

            .receipt-item-row {
              padding: 6px 0;
            }
            .receipt-item-name-row {
              margin-bottom: 2px;
            }
            .receipt-item-name {
              font-weight: 700;
              font-size: 12px;
              font-family: var(--font-family);
              color: #0f172a;
            }
            .receipt-item-detail-row {
              display: flex;
              align-items: center;
              font-size: 11px;
            }
            .receipt-item-code {
              flex: 2;
              font-size: 10px;
              color: #94a3b8;
              letter-spacing: 0.3px;
            }
            .receipt-item-sep {
              border-top: 1px dotted #e2ddd0;
              margin-top: 6px;
            }

            .receipt-summary {
              padding: 6px 0;
            }
            .receipt-summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-family: var(--font-family);
              padding: 2px 0;
            }
            .receipt-total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 14px;
              font-weight: 900;
              padding: 6px 0;
              margin-top: 2px;
              font-family: var(--font-family);
            }
            .receipt-total-amount {
              font-size: 20px;
              color: var(--primary);
              font-weight: 900;
              letter-spacing: -0.5px;
            }
            .receipt-change {
              color: #0284c7;
              font-weight: 600;
            }

            .receipt-footer-info {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              font-family: var(--font-family);
            }

            .receipt-audit-section {
              padding: 4px 0;
            }
            .receipt-audit-title {
              display: flex;
              align-items: center;
              gap: 5px;
              font-size: 11px;
              font-weight: 700;
              color: #d97706;
              margin-bottom: 6px;
              font-family: var(--font-family);
            }
            .receipt-audit-entry {
              padding: 5px 8px;
              background: #fefce8;
              border-radius: 4px;
              margin-bottom: 4px;
              border-left: 3px solid #d97706;
              font-family: var(--font-family);
            }

            .receipt-thank-you {
              text-align: center;
              padding: 8px 0 4px;
              font-family: var(--font-family);
            }
            .receipt-thank-you > div:first-child {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: 1px;
            }
            .receipt-come-again {
              font-size: 11px;
              color: #64748b;
              margin-top: 3px;
              font-style: italic;
            }

            .receipt-tear-edge {
              position: absolute;
              bottom: 0; left: 0; right: 0;
              height: 8px;
              background: linear-gradient(135deg, #fffef8 33.33%, transparent 33.33%, transparent 50%, #fffef8 50%, #fffef8 83.33%, transparent 83.33%);
              background-size: 12px 12px;
              transform: translateY(4px);
            }

            @media print {
              .receipt-paper {
                box-shadow: none;
                border: none;
                padding: 0;
              }
            }
          `}</style>
        </Modal>
      )}

      {/* Super Admin Invoice Adjustment Modal */}
      {adjustInvoice && (
        <Modal
          isOpen={!!adjustInvoice}
          onClose={() => setAdjustInvoice(null)}
          title={`Điều Chỉnh Hóa Đơn: ${adjustInvoice.invoice_number}`}
          maxWidth="560px"
        >
          <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--warning)'
            }}>
              Lưu ý: Mọi thay đổi số lượng sẽ tự động điều chỉnh tồn kho tương ứng và lưu Audit Log bất biến với đầy đủ danh tính và lý do.
            </div>

            {adjustError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
                {adjustError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {adjustments.map((item, idx) => (
                <div key={item.itemId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-card-secondary)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Số lượng ban đầu: {item.originalQuantity}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SL mới:</span>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ width: '70px', padding: '6px', textAlign: 'center' }}
                      value={item.newQuantity}
                      onChange={(e) => {
                        const newQ = e.target.value;
                        setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, newQuantity: newQ } : a));
                      }}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Lý do điều chỉnh (Bắt buộc cho Audit Log) *</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="VD: Khách đổi món trả lại 1 lon..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAdjustInvoice(null)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Đang lưu...' : 'Xác Nhận Sửa Hóa Đơn'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
