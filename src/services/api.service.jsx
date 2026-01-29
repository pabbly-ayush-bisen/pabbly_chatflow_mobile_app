import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG, getCurrentEnv } from '../config/app.config';

// Get environment config
const envConfig = getCurrentEnv();

// Create axios instance
const apiClient = axios.create({
  baseURL: envConfig.apiUrl,
  timeout: APP_CONFIG.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Error:('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear storage and redirect to login
      await AsyncStorage.removeItem(APP_CONFIG.tokenKey);
      await AsyncStorage.removeItem(APP_CONFIG.userKey);
      // You can add navigation logic here
    }
    return Promise.reject(error);
  }
);

// API Service
export const apiService = {
  // Auth
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: () => apiClient.post('/auth/logout'),

  // User
  getProfile: () => apiClient.get('/user/profile'),
  updateProfile: (data) => apiClient.put('/user/profile', data),

  // Chats
  getChats: (params) => apiClient.get('/chats', { params }),
  getChatById: (id) => apiClient.get(`/chats/${id}`),
  sendMessage: (chatId, message) => apiClient.post(`/chats/${chatId}/messages`, message),

  // Flows
  getFlows: (params) => apiClient.get('/flows', { params }),
  getFlowById: (id) => apiClient.get(`/flows/${id}`),
  createFlow: (data) => apiClient.post('/flows', data),
  updateFlow: (id, data) => apiClient.put(`/flows/${id}`, data),
  deleteFlow: (id) => apiClient.delete(`/flows/${id}`),

  // Contacts
  getContacts: (params) => apiClient.get('/contacts', { params }),
  getContactById: (id) => apiClient.get(`/contacts/${id}`),
  createContact: (data) => apiClient.post('/contacts', data),
  updateContact: (id, data) => apiClient.put(`/contacts/${id}`, data),
  deleteContact: (id) => apiClient.delete(`/contacts/${id}`),

  // Generic methods
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
};

export default apiService;
