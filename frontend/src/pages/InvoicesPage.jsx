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
  AlertCircle
} from 'lucide-react';
import Modal from '../components/common/Modal';

export default function InvoicesPage() {
  const { isSuperAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(true);

  // View Details Modal
  const [viewInvoice, setViewInvoice] = useState(null);

  // Super Admin Adjust Invoice Modal
  const [adjustInvoice, setAdjustInvoice] = useState(null);
  const [adjustments, setAdjustments] = useState([]); // [{ itemId, quantity }]
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);
      params.append('limit', '50');

      const res = await api.get(`/invoices?${params.toString()}`);
      setInvoices(res.data?.items || []);
    } catch (err) {
      console.error('Load invoices error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, paymentMethod]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openViewModal = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      setViewInvoice(res.data);
    } catch (e) {
      alert('Không thể tải chi tiết hóa đơn.');
    }
  };

  const openAdjustModal = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      const inv = res.data;
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
        itemAdjustments: adjustments.map(a => ({ itemId: a.itemId, newQuantity: parseInt(a.newQuantity, 10) })),
        reason: adjustReason
      });
      setAdjustInvoice(null);
      loadInvoices();
    } catch (err) {
      setAdjustError(err.message || 'Lỗi khi lưu điều chỉnh hóa đơn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Hóa Đơn Bán Hàng</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Hồ sơ tài chính bán lẻ bất biến & chứng từ kiểm toán
          </p>
        </div>

        <button
          onClick={loadInvoices}
          className="btn btn-secondary btn-icon"
          title="Làm mới"
          style={{ width: '38px', height: '38px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
        <div className="filter-bar-responsive">
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo số hóa đơn hoặc tên nhân viên..."
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
            <option value="">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="TRANSFER">Chuyển khoản</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-responsive">
        <table className="table table-wide">
          <thead>
            <tr>
              <th>Số Hóa Đơn</th>
              <th>Thời Gian</th>
              <th>Thu Ngân</th>
              <th>Số Món</th>
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
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>
                    {inv.invoice_number}
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {formatDateTime(inv.created_at)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {inv.created_by_name || 'Admin'}
                  </td>
                  <td>
                    {inv.items_count} món ({inv.total_units_sold} đơn vị)
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency(inv.total_amount)}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {inv.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${inv.status === 'COMPLETED' ? 'badge-success' : (inv.status === 'ADJUSTED' ? 'badge-warning' : 'badge-danger')}`}>
                      {inv.status === 'COMPLETED' ? 'Thành công' : (inv.status === 'ADJUSTED' ? 'Đã điều chỉnh' : 'Đã hủy')}
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

      {/* Invoice Details Modal */}
      {viewInvoice && (
        <Modal
          isOpen={!!viewInvoice}
          onClose={() => setViewInvoice(null)}
          title={`Chi Tiết Hóa Đơn: ${viewInvoice.invoice_number}`}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Meta header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'var(--bg-card-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px'
            }}>
              <div>Thời gian: <strong>{formatDateTime(viewInvoice.created_at)}</strong></div>
              <div>Thu ngân: <strong>{viewInvoice.created_by_name}</strong></div>
              <div>Phương thức: <strong>{viewInvoice.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</strong></div>
              <div>Trạng thái: <strong>{viewInvoice.status}</strong></div>
            </div>

            {/* Items list */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Danh Sách Hàng Hóa:</div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>SL</th>
                      <th>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.product_code}</div>
                        </td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{formatCurrency(item.unit_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Summary */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'flex-end',
              paddingTop: '8px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>
                Tổng cộng: <span style={{ color: 'var(--primary)' }}>{formatCurrency(viewInvoice.total_amount)}</span>
              </div>
              {viewInvoice.payment_method === 'CASH' && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Khách đưa: {formatCurrency(viewInvoice.amount_paid)} • Tiền thối: {formatCurrency(viewInvoice.change_amount)}
                </div>
              )}
            </div>

            {/* Audit Trail for this invoice if adjusted */}
            {viewInvoice.audit_logs && viewInvoice.audit_logs.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--warning)', marginBottom: '8px' }}>
                  <History size={14} /> Lịch Sử Điều Chỉnh Hóa Đơn (Audit Log)
                </div>
                {viewInvoice.audit_logs.map((log) => (
                  <div key={log.id} style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-card-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    marginBottom: '6px'
                  }}>
                    <div>{formatDateTime(log.created_at)} - Người sửa: <strong>{log.actor_name || 'Super Admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Lý do: {log.reason}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>In Hóa Đơn</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setViewInvoice(null)}
              >
                Đóng
              </button>
            </div>
          </div>
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
