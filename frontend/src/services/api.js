import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    } else if (error.response?.status === 500) {
      console.error('Server error');
    } else if (error.response?.status === 404) {
      console.error('Resource not found');
    }
    return Promise.reject(error);
  }
);

// Chat API endpoints
export const chatAPI = {
  getRoomMessages: (roomId, page = 1, limit = 50) =>
    api.get(`/api/chat/rooms/${roomId}/messages`, {
      params: { page, limit }
    }),

  getRoomStats: (roomId) =>
    api.get(`/api/chat/rooms/${roomId}/stats`),

  deleteRoomMessages: (roomId) =>
    api.delete(`/api/chat/rooms/${roomId}/messages`),
};

// Document API endpoints
export const documentAPI = {
  upload: (formData) =>
    api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 60000 // 60 seconds for uploads
    }),

  getAll: () =>
    api.get('/api/documents'),

  getById: (id) =>
    api.get(`/api/documents/${id}`),

  delete: (id) =>
    api.delete(`/api/documents/${id}`),

  getStatus: (id) =>
    api.get(`/api/documents/${id}/status`),
};

export default api;
