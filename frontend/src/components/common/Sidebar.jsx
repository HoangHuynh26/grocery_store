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
      backgroundColor: 'rgba(255, 255, 255, 0.88)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid rgba(226, 232, 240, 0.85)',
      display: 'none',
      flexDirection: 'column',
      minHeight: 'calc(100vh - var(--header-height))',
      padding: '20px 12px'
    }} className="desktop-sidebar">
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                color: isActive
                  ? (item.highlight ? '#ffffff' : 'var(--primary)')
                  : 'var(--text-secondary)',
                backgroundColor: isActive
                  ? (item.highlight ? 'var(--primary)' : 'var(--primary-light)')
                  : 'transparent',
                boxShadow: isActive && item.highlight ? '0 4px 14px rgba(5, 150, 105, 0.28)' : 'none',
                borderLeft: isActive && !item.highlight ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
              })}
            >
              <Icon size={18} color={item.highlight ? (undefined) : undefined} />
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
