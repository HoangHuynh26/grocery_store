import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  FileText,
  TrendingUp,
  Bot,
  History,
  Users,
  Tags
} from 'lucide-react';

export default function Sidebar() {
  const { isSuperAdmin } = useAuth();

  const navItems = [
    { to: '/pos', label: 'POS Bán Hàng', icon: ShoppingCart, highlight: true },
    { to: '/dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
    { to: '/products', label: 'Quản Lý Sản Phẩm', icon: Package },
    { to: '/categories', label: 'Danh Mục Hàng', icon: Tags },
    { to: '/inventory', label: 'Quản Lý Tồn Kho', icon: Boxes },
    { to: '/invoices', label: 'Quản Lý Hóa Đơn', icon: FileText },
    { to: '/analytics', label: 'Báo Cáo Doanh Thu', icon: TrendingUp },
    { to: '/ai-assistant', label: 'Trợ Lý AI Chat', icon: Bot },
    { to: '/audit-logs', label: 'Nhật Ký Hoạt Động', icon: History },
  ];

  if (isSuperAdmin) {
    navItems.push({ to: '/admins', label: 'Quản Trị Viên', icon: Users });
  }

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      backgroundColor: 'var(--bg-card)',
      borderRight: '1px solid var(--border-color)',
      display: 'none',
      flexDirection: 'column',
      minHeight: 'calc(100vh - var(--header-height))',
      padding: '20px 12px'
    }} className="desktop-sidebar">
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: isActive
                  ? (item.highlight ? 'var(--primary)' : 'var(--bg-card-secondary)')
                  : 'transparent',
                borderLeft: isActive && !item.highlight ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.15s ease'
              })}
            >
              <Icon size={18} color={item.highlight ? '#10b981' : undefined} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 1024px) {
          .desktop-sidebar { display: flex !important; }
        }
      `}</style>
    </aside>
  );
}
