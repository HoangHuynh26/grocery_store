import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Lock, User, ArrowRight, ShieldCheck, MapPin, Globe, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientIpInfo, setClientIpInfo] = useState(null);
  const [loginSuccessLocation, setLoginSuccessLocation] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Detect client IP and location on load
  useEffect(() => {
    let mounted = true;
    api.get('/auth/client-ip')
      .then(res => {
        const info = res.data || res;
        if (mounted && info && info.ip) {
          setClientIpInfo(info);
        }
      })
      .catch(() => {
        // Fallback for offline/local
        if (mounted) {
          setClientIpInfo({
            ip: '127.0.0.1',
            locationText: 'Nội bộ cửa hàng (Localhost / LAN)',
            city: 'Cửa hàng (LAN)',
            country: 'Việt Nam',
            flag: '🏠',
            isLocal: true
          });
        }
      });
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const loginResult = await login(identifier, password);
      if (loginResult?.clientLocation) {
        setLoginSuccessLocation(loginResult.clientLocation);
      }
      setTimeout(() => {
        navigate('/pos');
      }, 500);
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công.');
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
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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

        {/* IP & Khu vực kết nối */}
        {clientIpInfo && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 14px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <span style={{ fontSize: '14px' }}>{clientIpInfo.flag || '📍'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>IP: {clientIpInfo.ip}</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
              {clientIpInfo.locationText || clientIpInfo.city || 'Khu vực nội bộ'}
            </span>
          </div>
        )}

        {loginSuccessLocation && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle size={20} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Đăng nhập thành công!</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                IP: <strong>{loginSuccessLocation.ip}</strong> ({loginSuccessLocation.locationText || loginSuccessLocation.city})
              </div>
            </div>
          </div>
        )}

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
