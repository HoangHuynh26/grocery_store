import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CartProvider } from './contexts/CartContext';

import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import MobileBottomNav from './components/common/MobileBottomNav';

import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoryPage from './pages/InventoryPage';
import InvoicesPage from './pages/InvoicesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AiAssistantPage from './pages/AiAssistantPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AdminsPage from './pages/AdminsPage';

// Protected Route Wrapper
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-muted)'
      }}>
        Đang khởi động hệ thống POS...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar />
          <main className="main-content">
            <Outlet />
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </div>
  );
}

// Super Admin Only Route Wrapper
function SuperAdminRoute({ children }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Authenticated Routes */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Navigate to="/pos" replace />} />
                <Route path="/pos" element={<PosPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/ai-assistant" element={<AiAssistantPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />

                {/* Super Admin Restricted */}
                <Route
                  path="/admins"
                  element={
                    <SuperAdminRoute>
                      <AdminsPage />
                    </SuperAdminRoute>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
