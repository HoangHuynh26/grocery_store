import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [realtimeNotification, setRealtimeNotification] = useState(null);
  const [lastStockUpdate, setLastStockUpdate] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Determine socket endpoint: direct URL from env (Render backend URL) or relative path
    const getSocketEndpoint = () => {
      if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL.trim().replace(/\/+$/, '');
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      }

      // Khi chạy local, proxy qua '/' của Vite
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
        if (isLocalhost) {
          return '/';
        }
      }

      // Khi chạy public, kết nối trực tiếp gateway Render
      return 'https://grocery-pos-backend.onrender.com';
    };

    const socketEndpoint = getSocketEndpoint();

    const newSocket = io(socketEndpoint, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to realtime gateway at', socketEndpoint);
    });

    // Handle incoming events
    newSocket.on('stock:updated', (data) => {
      setLastStockUpdate({ timestamp: Date.now(), data });
    });

    newSocket.on('invoice:created', (invoice) => {
      setRealtimeNotification({
        id: Date.now(),
        type: 'invoice',
        message: `Hóa đơn mới: ${invoice.invoice_number} (${new Intl.NumberFormat('vi-VN').format(invoice.total_amount)} đ)`
      });
    });

    newSocket.on('stock:low_alert', (product) => {
      setRealtimeNotification({
        id: Date.now(),
        type: 'warning',
        message: `Cảnh báo: Sản phẩm "${product.name}" sắp hết hàng (còn ${product.currentStock})!`
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  const clearNotification = () => setRealtimeNotification(null);

  const value = {
    socket,
    realtimeNotification,
    lastStockUpdate,
    clearNotification
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
