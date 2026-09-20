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
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <ShoppingBag size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              GROCERY <span style={{ color: 'var(--primary)' }}>POS</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>
              Tạp Hóa Thông Minh
            </div>
          </div>
        </Link>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Quick Link to AI Assistant */}
        <Link
          to="/ai-assistant"
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '13px' }}
          title="Trợ Lý AI Doanh Nghiệp"
        >
          <Bot size={16} color="var(--primary)" />
          <span style={{ display: 'none' }} className="show-desktop">Trợ Lý AI</span>
        </Link>

        {/* Realtime Alert Indicator */}
        {realtimeNotification && (
          <div
            onClick={clearNotification}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: realtimeNotification.type === 'warning' ? 'var(--warning-bg)' : 'var(--primary-light)',
              border: `1px solid ${realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)'}`,
              color: realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title="Bấm để ẩn thông báo"
          >
            <Bell size={14} />
            <span>{realtimeNotification.message}</span>
          </div>
        )}

        {/* User Info & Role Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border-color)' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            <User size={16} />
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
          style={{ width: '36px', height: '36px' }}
        >
          <LogOut size={16} />
        </button>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .show-desktop { display: block !important; }
        }
      `}</style>
    </header>
  );
}
