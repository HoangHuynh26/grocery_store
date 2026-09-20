import axios from 'axios';

// When deployed on Vercel, can point directly to Render backend URL (e.g. https://grocery-backend.onrender.com/api)
// or use relative '/api' with Vercel rewrites.
const baseURL = import.meta.env.VITE_API_URL || '/api';

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
        const refreshRes = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        if (refreshRes.data?.data?.accessToken) {
          const newToken = refreshRes.data.data.accessToken;
          localStorage.setItem('grocery_access_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        localStorage.removeItem('grocery_access_token');
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
