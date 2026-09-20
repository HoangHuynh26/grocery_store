import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { LogOut, User, Bell, ShoppingBag, Bot, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({ onOpenQrScanner }) {
  const { user, logout, isSuperAdmin } = useAuth();
  const { realtimeNotification, clearNotification } = useSocket();

  return (
    <header style={{
      height: 'var(--header-height)',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }} className="app-navbar">
      {/* Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0
          }}>
            <ShoppingBag size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              GROCERY <span style={{ color: 'var(--primary)' }}>POS</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1, display: 'none' }} className="show-desktop">
              Tạp Hóa Thông Minh
            </div>
          </div>
        </Link>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Quick Link to AI Assistant */}
        <Link
          to="/ai-assistant"
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '12px', flexShrink: 0 }}
          title="Trợ Lý AI Doanh Nghiệp"
        >
          <Bot size={15} color="var(--primary)" />
          <span style={{ display: 'none' }} className="show-desktop">Trợ Lý AI</span>
        </Link>

        {/* Realtime Alert Indicator */}
        {realtimeNotification && (
          <div
            onClick={clearNotification}
            className="navbar-alert"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: realtimeNotification.type === 'warning' ? 'var(--warning-bg)' : 'var(--primary-light)',
              border: `1px solid ${realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)'}`,
              color: realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title="Bấm để ẩn thông báo"
          >
            <Bell size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{realtimeNotification.message}</span>
          </div>
        )}

        {/* User Info & Role Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '6px', borderLeft: '1px solid var(--border-color)' }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            flexShrink: 0
          }}>
            <User size={15} />
          </div>
          <div style={{ display: 'none' }} className="show-desktop">
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{user?.fullName || user?.username}</div>
            <div style={{ fontSize: '11px', color: isSuperAdmin ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              {isSuperAdmin && <ShieldCheck size={12} />}
              {user?.role}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="btn btn-secondary btn-icon"
          title="Đăng xuất"
          style={{ width: '32px', height: '32px', flexShrink: 0 }}
        >
          <LogOut size={15} />
        </button>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .show-desktop { display: block !important; }
        }
        @media (max-width: 640px) {
          .app-navbar { padding: 0 10px !important; }
          .navbar-alert { max-width: 90px !important; }
        }
      `}</style>
    </header>
  );
}
