import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(identifier, password);
      navigate('/pos');
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userType) => {
    if (userType === 'admin') {
      setIdentifier('admin');
      setPassword('Admin@123456');
    } else {
      setIdentifier('nhanvien1');
      setPassword('Staff@123456');
    }
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: 'var(--bg-main)'
    }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '32px 24px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
          }}>
            <ShoppingBag size={30} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>GROCERY STORE POS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            Hệ thống quản lý bán hàng & kho tạp hóa đa người dùng
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '20px',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tên đăng nhập hoặc Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                placeholder="admin hoặc email..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
              <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Đang xác thực...' : (
              <>
                <span>ĐĂNG NHẬP</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Login Buttons */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
            Tài khoản mẫu dùng thử:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fillCredentials('admin')}
              style={{ fontSize: '12px', padding: '8px' }}
            >
              <ShieldCheck size={14} color="var(--primary)" />
              <span>Super Admin</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fillCredentials('staff')}
              style={{ fontSize: '12px', padding: '8px' }}
            >
              <User size={14} />
              <span>Nhân viên</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
