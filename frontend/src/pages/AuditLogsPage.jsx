import React, { useState, useEffect, useCallback } from 'react';
import { formatDateTime } from '../utils/formatters';
import api from '../services/api';
import { History, Search, RefreshCw, Eye, ShieldCheck, Filter } from 'lucide-react';
import Modal from '../components/common/Modal';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entityType', entityFilter);
      params.append('limit', '50');

      const res = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(res.data?.items || []);
    } catch (err) {
      console.error('Load audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px' }}>Nhật Ký Kiểm Toán (Audit Log)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Theo dõi vết mọi thao tác nhạy cảm, người thực hiện và dữ liệu trước/sau thay đổi
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="btn btn-secondary btn-icon"
          title="Làm mới"
          style={{ width: '38px', height: '38px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '180px' }}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">Tất cả hành động</option>
            <option value="LOGIN">Đăng nhập (LOGIN)</option>
            <option value="CREATE_INVOICE">Tạo hóa đơn (CREATE_INVOICE)</option>
            <option value="UPDATE_INVOICE">Sửa hóa đơn (UPDATE_INVOICE)</option>
            <option value="CREATE_PRODUCT">Tạo sản phẩm (CREATE_PRODUCT)</option>
            <option value="UPDATE_PRODUCT">Sửa sản phẩm (UPDATE_PRODUCT)</option>
            <option value="DELETE_PRODUCT">Xóa sản phẩm (DELETE_PRODUCT)</option>
            <option value="IMPORT_STOCK">Nhập hàng (IMPORT_STOCK)</option>
            <option value="ADJUST_STOCK">Kiểm kê kho (ADJUST_STOCK)</option>
          </select>

          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '160px' }}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="">Tất cả thực thể</option>
            <option value="INVOICE">Hóa đơn (INVOICE)</option>
            <option value="PRODUCT">Sản phẩm (PRODUCT)</option>
            <option value="INVENTORY">Kho hàng (INVENTORY)</option>
            <option value="USER">Người dùng (USER)</option>
            <option value="CATEGORY">Danh mục (CATEGORY)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Thời Gian</th>
              <th>Người Thực Hiện</th>
              <th>Hành Động</th>
              <th>Thực Thể</th>
              <th>Mã ID</th>
              <th>Lý Do / Mô Tả</th>
              <th style={{ textAlign: 'right' }}>Chi Tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Đang tải nhật ký kiểm toán...</div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Chưa có bản ghi kiểm toán nào.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.user_full_name || 'Hệ thống'}</div>
                    {log.user_username && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{log.user_username} ({log.user_role})</div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">{log.action}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{log.entity_type}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.entity_id?.substring(0, 8)}...
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {log.reason || '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setSelectedLog(log)}
                      title="Xem dữ liệu trước & sau"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Chi Tiết Vết Kiểm Toán: ${selectedLog.action}`}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'var(--bg-card-secondary)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>Thời gian: <strong>{formatDateTime(selectedLog.created_at)}</strong></div>
              <div>Người thực hiện: <strong>{selectedLog.user_full_name} (@{selectedLog.user_username})</strong></div>
              <div>Thực thể: <strong>{selectedLog.entity_type} (ID: {selectedLog.entity_id})</strong></div>
              <div>Địa chỉ IP: <strong>{selectedLog.ip_address || '127.0.0.1'}</strong></div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Lý do thao tác:</div>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card-secondary)', borderRadius: 'var(--radius-sm)' }}>
                {selectedLog.reason || 'Không có ghi chú'}
              </div>
            </div>

            {selectedLog.old_values && (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>
                  Giá trị cũ (Before / Old Values):
                </div>
                <pre style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: '4px' }}>
                  Giá trị mới (After / New Values):
                </div>
                <pre style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedLog(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
