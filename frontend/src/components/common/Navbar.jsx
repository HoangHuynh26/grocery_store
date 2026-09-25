import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { LogOut, User, Bell, ShoppingBag, Bot, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ onOpenQrScanner }) {
  const { user, logout, isSuperAdmin, clientLocation } = useAuth();
  const { realtimeNotification, clearNotification } = useSocket();
  const location = useLocation();
  const isAiPage = location.pathname === '/ai-assistant';

  return (
    <header className="app-navbar apple-liquid-navbar">
      {/* Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
          <div className="apple-brand-icon">
            <ShoppingBag size={18} strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.025em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                GROCERY
              </span>
              <span className="apple-pos-pill">POS</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.2, fontWeight: 500, display: 'none' }} className="show-desktop">
              Tạp Hóa Thông Minh
            </div>
          </div>
        </Link>
      </div>

      {/* Right controls */}
      <div className="navbar-right-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Quick Link to AI Assistant */}
        {!isAiPage && (
          <Link
            to="/ai-assistant"
            className="apple-glass-button"
            title="Trợ Lý AI Doanh Nghiệp"
          >
            <Bot size={15} color="var(--primary)" />
            <span style={{ display: 'none', fontWeight: 600 }} className="show-desktop">Trợ Lý AI</span>
          </Link>
        )}

        {/* Realtime Alert Indicator */}
        {realtimeNotification && (
          <div
            onClick={clearNotification}
            className="navbar-alert apple-alert-pill"
            style={{
              backgroundColor: realtimeNotification.type === 'warning' ? 'var(--warning-bg)' : 'var(--primary-light)',
              border: `1px solid ${realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)'}`,
              color: realtimeNotification.type === 'warning' ? 'var(--warning)' : 'var(--primary)'
            }}
            title={`Thông báo: ${realtimeNotification.message}\n(Bấm để đóng)`}
          >
            <Bell size={13} className="alert-bell-icon" style={{ flexShrink: 0 }} />
            <span className="show-desktop" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
              {realtimeNotification.message}
            </span>
            <span className="mobile-alert-dot hide-desktop" />
          </div>
        )}

        {/* Client IP & Location pill */}
        {clientLocation && (
          <div
            className="apple-liquid-ip-pill"
            title={`Địa chỉ IP kết nối: ${clientLocation.ip}\nTrạng thái: Hoạt động trực tuyến (Sẵn sàng mở cho mọi mạng: Internet, 4G/5G, WiFi & Cục bộ)\nVị trí nhận diện: ${clientLocation.locationText || 'Trực tuyến'}`}
          >
            <span className="apple-pulse-dot" />
            <span style={{ fontSize: '13px' }}>{clientLocation.flag || '🌐'}</span>
            <span className="show-desktop" style={{ fontWeight: 650, color: 'var(--primary)' }}>
              {clientLocation.city ? clientLocation.city : 'Online (Mọi mạng)'}
            </span>
            <span className="hide-desktop" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '11px' }}>
              Online
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500 }} className="show-desktop">
              ({clientLocation.ip})
            </span>
          </div>
        )}

        {/* User Info & Role Badge */}
        <div 
          className="apple-liquid-user-pill"
          title={`${user?.fullName || user?.username} (${user?.role})`}
        >
          <div className="apple-user-avatar">
            <User size={15} strokeWidth={2.2} />
          </div>
          <div style={{ display: 'none' }} className="show-desktop">
            <div style={{ fontSize: '13px', fontWeight: 650, lineHeight: 1.2, color: 'var(--text-primary)' }}>
              {user?.fullName || user?.username}
            </div>
            <div style={{ fontSize: '11px', color: isSuperAdmin ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              {isSuperAdmin && <ShieldCheck size={12} strokeWidth={2.5} />}
              {user?.role}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="apple-liquid-logout-btn"
          title="Đăng xuất"
        >
          <LogOut size={15} strokeWidth={2.2} />
        </button>
      </div>

      <style>{`
        .apple-liquid-navbar {
          height: var(--header-height);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.74) 100%);
          backdrop-filter: blur(32px) saturate(210%);
          -webkit-backdrop-filter: blur(32px) saturate(210%);
          border-bottom: 1px solid rgba(226, 232, 240, 0.75);
          box-shadow: 
            inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.95),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.4),
            0 8px 28px -4px rgba(15, 23, 42, 0.04),
            0 1px 3px 0 rgba(15, 23, 42, 0.02);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .apple-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 6px 16px -2px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.25);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .apple-brand-icon:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 20px -2px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .apple-pos-pill {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.02em;
          border: 1px solid rgba(16, 185, 129, 0.25);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .apple-glass-button {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          font-size: 13px;
          color: var(--text-primary);
          text-decoration: none;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(15, 23, 42, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
        }
        .apple-glass-button:hover {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(16, 185, 129, 0.4);
          color: var(--primary);
          box-shadow: inset 0 1px 0 0 #fff, 0 4px 14px rgba(16, 185, 129, 0.15);
          transform: translateY(-1px);
        }

        .apple-liquid-ip-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 13px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%);
          border: 1px solid rgba(16, 185, 129, 0.28);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.9), 0 2px 8px rgba(16, 185, 129, 0.06);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          font-size: 12px;
          color: var(--text-primary);
          user-select: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-liquid-ip-pill:hover {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.08) 100%);
          border-color: rgba(16, 185, 129, 0.45);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(16, 185, 129, 0.12);
          transform: translateY(-1px);
        }

        .apple-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
          animation: applePulse 2s infinite;
        }
        @keyframes applePulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .apple-liquid-user-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 14px 5px 6px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(15, 23, 42, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-liquid-user-pill:hover {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(203, 213, 225, 0.95);
          box-shadow: inset 0 1px 0 0 #fff, 0 4px 14px rgba(15, 23, 42, 0.06);
        }

        .apple-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          border: 1px solid rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
        }

        .apple-liquid-logout-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.95), 0 2px 6px rgba(15, 23, 42, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
        }
        .apple-liquid-logout-btn:hover {
          background: rgba(254, 242, 242, 0.9);
          border-color: rgba(252, 165, 165, 0.9);
          color: var(--danger);
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 0 #fff, 0 4px 14px rgba(220, 38, 38, 0.15);
        }

        .apple-alert-pill {
          padding: 6px 12px;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 8px rgba(15, 23, 42, 0.04);
          transition: all 0.2s ease;
        }
        .apple-alert-pill:hover {
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 #fff, 0 4px 12px rgba(15, 23, 42, 0.08);
        }

        .mobile-alert-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--warning);
          box-shadow: 0 0 6px var(--warning);
          animation: applePulse 1.5s infinite;
        }

        @media (min-width: 768px) {
          .show-desktop { display: block !important; }
          .hide-desktop { display: none !important; }
        }
        @media (max-width: 767px) {
          .show-desktop { display: none !important; }
          .hide-desktop { display: inline-flex !important; }
        }
        @media (max-width: 640px) {
          .apple-liquid-navbar { 
            padding: 0 10px !important; 
            height: var(--header-height) !important;
            overflow-x: hidden !important;
          }
          .navbar-right-controls {
            gap: 6px !important;
          }
          .apple-alert-pill { 
            padding: 5px 8px !important; 
            max-width: 36px !important;
            justify-content: center;
          }
          .apple-liquid-user-pill { 
            padding: 2px !important; 
            border: 1px solid rgba(226, 232, 240, 0.7);
            background: rgba(255, 255, 255, 0.85);
          }
          .apple-user-avatar {
            width: 30px !important;
            height: 30px !important;
          }
          .apple-liquid-ip-pill { 
            padding: 4px 8px !important; 
            gap: 4px !important;
          }
          .apple-liquid-logout-btn {
            width: 30px !important;
            height: 30px !important;
          }
          .apple-glass-button {
            padding: 6px !important;
            width: 30px !important;
            height: 30px !important;
            justify-content: center;
          }
          .apple-brand-icon {
            width: 32px !important;
            height: 32px !important;
            border-radius: 9px !important;
          }
        }
      `}</style>
    </header>
  );
}
