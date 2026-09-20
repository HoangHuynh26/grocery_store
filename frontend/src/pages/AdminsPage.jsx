import React, { useState, useEffect, useCallback } from 'react';
import { formatDateTime } from '../utils/formatters';
import api from '../services/api';
import { Users, Plus, ShieldCheck, UserCheck, Lock, RefreshCw, KeyRound } from 'lucide-react';
import Modal from '../components/common/Modal';

export default function AdminsPage() {
  const [users, setUsers] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'ADMIN'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, logsRes] = await Promise.all([
        api.get('/users?limit=50'),
        api.get('/users/login-logs/history')
      ]);
      setUsers(usersRes.data?.items || []);
      setLoginLogs(logsRes.data || []);
    } catch (err) {
      console.error('Load admins data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password || !formData.fullName) {
      setError('Vui lòng điền đầy đủ các trường thông tin bắt buộc.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await api.post('/users', formData);
      setIsModalOpen(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'ADMIN'
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await api.put(`/users/${user.id}`, {
        isActive: !user.is_active
      });
      loadData();
    } catch (err) {
      alert(err.message || 'Không thể cập nhật trạng thái người dùng.');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '22px' }}>Quản Lý Quản Trị Viên & Nhân Viên</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Phân quyền tài khoản (Super Admin / Admin / Staff) và kiểm tra lịch sử đăng nhập
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          <span>Thêm Tài Khoản Mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          <Users size={16} />
          <span>Danh Sách Người Dùng</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'logins' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('logins')}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          <KeyRound size={16} />
          <span>Lịch Sử Đăng Nhập</span>
        </button>
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="table-responsive">
          <table className="table table-wide">
            <thead>
              <tr>
                <th>Họ & Tên</th>
                <th className="hide-mobile">Tên Đăng Nhập</th>
                <th className="hide-mobile">Email</th>
                <th className="hide-mobile">Số Điện Thoại</th>
                <th>Vai Trò</th>
                <th>Trạng Thái</th>
                <th style={{ textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                    <div>Đang tải danh sách tài khoản...</div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Chưa có tài khoản nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                      <div className="show-mobile-only" style={{ fontSize: '11px', color: 'var(--primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                        @{u.username} • {u.email}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>@{u.username}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-muted)' }}>{u.phone || '-'}</td>
                    <td>
                      <span className={`badge ${u.role === 'SUPER_ADMIN' ? 'badge-primary' : (u.role === 'ADMIN' ? 'badge-info' : 'badge-secondary')}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active ? 'Khóa' : 'Mở khóa'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Login Logs */}
      {activeTab === 'logins' && (
        <div className="table-responsive">
          <table className="table table-wide">
            <thead>
              <tr>
                <th>Thời Gian</th>
                <th>Tên Đăng Nhập</th>
                <th>Người Dùng</th>
                <th>Địa Chỉ IP</th>
                <th>Trạng Thái</th>
                <th>Ghi Chú</th>
              </tr>
            </thead>
            <tbody>
              {loginLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {log.username}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {log.full_name || '-'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.ip_address || '127.0.0.1'}
                  </td>
                  <td>
                    <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                      {log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--danger)' }}>
                    {log.failure_reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm Tài Khoản Quản Trị / Bán Hàng"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên đăng nhập *</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: nhanvien2"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-control"
                placeholder="VD: nv2@grocerystore.vn"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Họ và tên *</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Trần Thị B"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mật khẩu ban đầu *</label>
              <input
                type="password"
                className="form-control"
                placeholder="Tối thiểu 6 ký tự"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số điện thoại</label>
              <input
                type="tel"
                className="form-control"
                placeholder="09..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Phân quyền vai trò (Role) *</label>
            <select
              className="form-control"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="ADMIN">ADMIN (Bán hàng, quản lý sản phẩm & nhập kho)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Toàn quyền quản trị hệ thống)</option>
              <option value="STAFF">STAFF (Chỉ bán hàng tại quầy)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
