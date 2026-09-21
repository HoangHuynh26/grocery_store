import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Boxes, FileText, Menu, X, Bot, History, Package, Tags, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileBottomNav() {
  const { isSuperAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Drawer for More items */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(28px) saturate(190%)',
              WebkitBackdropFilter: 'blur(28px) saturate(190%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.9)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '20px 16px calc(24px + env(safe-area-inset-bottom, 0px)) 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.12)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Menu Chức Năng</div>
              <button
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <NavLink
                to="/products"
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px' }}
              >
                <Package size={18} color="var(--primary)" />
                <span>Sản Phẩm</span>
              </NavLink>

              <NavLink
                to="/categories"
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px' }}
              >
                <Tags size={18} color="var(--primary)" />
                <span>Danh Mục</span>
              </NavLink>

              <NavLink
                to="/ai-assistant"
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px' }}
              >
                <Bot size={18} color="var(--primary)" />
                <span>Trợ Lý AI</span>
              </NavLink>

              <NavLink
                to="/audit-logs"
                onClick={() => setMenuOpen(false)}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px' }}
              >
                <History size={18} color="var(--primary)" />
                <span>Audit Log</span>
              </NavLink>

              {isSuperAdmin && (
                <NavLink
                  to="/admins"
                  onClick={() => setMenuOpen(false)}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '12px', gridColumn: 'span 2' }}
                >
                  <Users size={18} color="var(--primary)" />
                  <span>Quản Lý Quản Trị Viên (Admins)</span>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apple Liquid Glass Main Bottom Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        borderTop: '1px solid rgba(226, 232, 240, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 800,
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom, 0px)) 8px',
        boxShadow: '0 -4px 24px rgba(15, 23, 42, 0.07), 0 -1px 2px rgba(15, 23, 42, 0.04)'
      }} className="mobile-bottom-nav">
        <NavLink
          to="/pos"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: isActive ? 700 : 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            padding: '4px 2px',
            borderRadius: '12px',
            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.09)' : 'transparent',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          })}
        >
          <ShoppingCart size={21} strokeWidth={2.2} />
          <span>POS</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: isActive ? 700 : 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            padding: '4px 2px',
            borderRadius: '12px',
            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.09)' : 'transparent',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          })}
        >
          <LayoutDashboard size={21} strokeWidth={2.2} />
          <span>Tổng quan</span>
        </NavLink>

        <NavLink
          to="/inventory"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: isActive ? 700 : 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            padding: '4px 2px',
            borderRadius: '12px',
            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.09)' : 'transparent',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          })}
        >
          <Boxes size={21} strokeWidth={2.2} />
          <span>Kho</span>
        </NavLink>

        <NavLink
          to="/invoices"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: isActive ? 700 : 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            padding: '4px 2px',
            borderRadius: '12px',
            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.09)' : 'transparent',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          })}
        >
          <FileText size={21} strokeWidth={2.2} />
          <span>Hóa đơn</span>
        </NavLink>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: menuOpen ? 'rgba(5, 150, 105, 0.09)' : 'none',
            border: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: menuOpen ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            padding: '4px 2px',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Menu size={21} strokeWidth={2.2} />
          <span>Thêm</span>
        </button>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
