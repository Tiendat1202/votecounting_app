import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface Session {
  id: number;
  title: string;
  candidates: string[];
  start_at: string;
  end_at: string;
  created_at: string;
  created_by_username?: string;
}

export interface Upload {
  id: number;
  session_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  uploaded_by_username?: string;
}

export interface Stats {
  sessions: {
    total: number;
    active: number;
  };
  uploads: {
    total: number;
    recent: number;
    totalSize: number;
  };
}

// Authentication APIs
export const authAPI = {
  login: async (username: string, password: string, rememberMe: boolean = false) => {
    const response = await api.post('/auth/login', { username, password, rememberMe });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// Session APIs
export const sessionAPI = {
  getSessions: async () => {
    const response = await api.get('/sessions');
    return response.data;
  },

  createSession: async (sessionData: {
    title: string;
    candidates: string[];
    startAt: string;
    endAt: string;
  }) => {
    const response = await api.post('/sessions', sessionData);
    return response.data;
  },
};

// Upload APIs
export const uploadAPI = {
  uploadFile: async (sessionId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/uploads/${sessionId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getUploads: async (sessionId: number) => {
    const response = await api.get(`/uploads/${sessionId}`);
    return response.data;
  },

  deleteUpload: async (sessionId: number, filename: string) => {
    const response = await api.delete(`/uploads/${sessionId}/${filename}`);
    return response.data;
  },

  deleteAllUploads: async (sessionId: number) => {
    const response = await api.delete(`/uploads/${sessionId}`);
    return response.data;
  },
};

// Stats APIs
export const statsAPI = {
  getStats: async () => {
    const response = await api.get('/stats');
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
