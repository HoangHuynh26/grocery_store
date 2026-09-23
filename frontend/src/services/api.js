import axios from 'axios';

// Clean & normalize API URL: handles https://domain.onrender.com, https://domain.onrender.com/api, trailing slashes, or relative /api
function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
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
