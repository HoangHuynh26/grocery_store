import axios from 'axios';

// Public Cloud Deployment URLs (Hỗ trợ cả Netlify & Vercel)
export const PUBLIC_BACKEND_URL = 'https://grocery-pos-backend.onrender.com';
export const PUBLIC_FRONTEND_URL = 'https://grocery-store-app.vercel.app';
export const PUBLIC_NETLIFY_URL = 'https://grocery-pos-frontend.netlify.app';

// Smart Dual-Mode API URL:
// - Chạy Localhost (localhost/127.0.0.1): tự động dùng '/api' (Vite proxy sang http://localhost:5000)
// - Chạy Public (Netlify, Vercel hoặc cloud): tự động kết nối Backend Render công khai
function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  // Tự động nhận diện môi trường localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    if (isLocalhost) {
      return '/api';
    }
  }

  // Khi chạy trên Vercel hoặc public internet
  return `${PUBLIC_BACKEND_URL}/api`;
}

const baseURL = getBaseUrl();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Request Interceptor: Attach JWT Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('grocery_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Expiration & Error Formatting
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      originalRequest._retry = true;
      try {
        const storedRefreshToken = localStorage.getItem('grocery_refresh_token');
        const refreshRes = await axios.post(`${baseURL}/auth/refresh`, {
          refreshToken: storedRefreshToken
        }, { withCredentials: true });
        if (refreshRes.data?.data?.accessToken) {
          const newToken = refreshRes.data.data.accessToken;
          localStorage.setItem('grocery_access_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        localStorage.removeItem('grocery_access_token');
        localStorage.removeItem('grocery_refresh_token');
        localStorage.removeItem('grocery_user');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }

    const errorPayload = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.'
    };

    return Promise.reject(errorPayload);
  }
);

export default api;
