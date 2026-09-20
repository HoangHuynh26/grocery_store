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
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '75vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>Menu Chức Năng</div>
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

      {/* Main Bottom Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--mobile-nav-height)',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 800,
        padding: '0 8px',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.4)'
      }} className="mobile-bottom-nav">
        <NavLink
          to="/pos"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%'
          })}
        >
          <ShoppingCart size={20} />
          <span>POS</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%'
          })}
        >
          <LayoutDashboard size={20} />
          <span>Tổng quan</span>
        </NavLink>

        <NavLink
          to="/inventory"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%'
          })}
        >
          <Boxes size={20} />
          <span>Kho</span>
        </NavLink>

        <NavLink
          to="/invoices"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%'
          })}
        >
          <FileText size={20} />
          <span>Hóa đơn</span>
        </NavLink>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            fontSize: '11px',
            fontWeight: 600,
            color: menuOpen ? 'var(--primary)' : 'var(--text-muted)',
            flex: 1,
            height: '100%',
            cursor: 'pointer'
          }}
        >
          <Menu size={20} />
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
