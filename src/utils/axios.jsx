import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

const API_URL = APP_CONFIG.apiUrl;

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      // Add auth token
      const token = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add settingId header for non-auth endpoints
      const url = config.url || '';
      const excludedUrls = [
        endpoints.auth.signIn,
        endpoints.auth.signUp,
        endpoints.auth.session,
        endpoints.dashboard.accesssettingId,
      ];

      if (!excludedUrls.includes(url)) {
        const settingId = await AsyncStorage.getItem('settingId');
        if (settingId) {
          config.headers.settingId = settingId;
        }
      }
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 400) {
      // Clear storage on unauthorized
      await AsyncStorage.removeItem(APP_CONFIG.tokenKey);
      await AsyncStorage.removeItem(APP_CONFIG.userKey);
      await AsyncStorage.removeItem('settingId');
      // Navigation will be handled by the app
    }
    return Promise.reject(error);
  }
);

/**
 * Main API call function
 * Compatible with frontend patterns - handles both GET params and POST data
 * Returns response in same format as frontend: { status, data, statusCode, ... }
 */
export async function callApi(url, method, data = {}, customHeaders = {}) {
  if (!url) {
    console.error(`[API] URL is undefined or null: ${url}`);
    return {
      status: 'error',
      data: null,
      statusCode: 400,
      success: false,
      error: 'URL is required',
    };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    // Normalize method to uppercase
    const normalizedMethod = method.toUpperCase();

    const config = {
      method: normalizedMethod,
      url,
      headers,
      data: normalizedMethod !== 'GET' ? data : undefined,
      params: normalizedMethod === 'GET' ? data : undefined,
    };

    // Debug logging
    console.log('[API Request]', {
      fullUrl: `${API_URL}/${url}`,
      method: normalizedMethod,
      data: normalizedMethod !== 'GET' ? data : undefined,
      params: normalizedMethod === 'GET' ? data : undefined,
    });

    const response = await axiosInstance(config);

    // Debug logging
    console.log('[API Response]', {
      url,
      status: response.status,
      data: response.data,
    });

    // Return in frontend-compatible format
    // Frontend expects: { status: 'success', data: {...}, statusCode }
    // API response structure: { data: { data: {...}, message, status }, status: 200 }
    // We want to return: { status, data: <actual data>, statusCode }
    return {
      status: response.data?.status || 'success',
      data: response.data?.data,  // Extract the nested data
      message: response.data?.message,
      statusCode: response.status,
      success: true,
    };
  } catch (error) {
    // Enhanced error logging
    console.error('[API Error]', {
      url: `${API_URL}/${url}`,
      method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    });

    // Handle specific error cases like frontend
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;

    return {
      status: 'error',
      data: error.response?.data || { status: 'error', message: errorMessage },
      statusCode,
      success: false,
      error: errorMessage,
      message: errorMessage,
    };
  }
}

/**
 * FormData API call function
 */
export async function callFormDataApi(url, method, formData) {
  try {
    const response = await axiosInstance({
      method,
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        Accept: 'application/json',
      },
    });
    return { data: response.data, success: true };
  } catch (error) {
    console.error('FormData API Error:', error);
    return {
      data: error.response?.data || null,
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

// API Endpoints
export const endpoints = {
  auth: {
    signIn: 'auth/signin',
    signUp: 'auth/signup',
    logout: 'auth/logout',
    session: 'auth/verify-session',
    teamMemberLogin: 'teammember/access/inbox',
    teamMemberLogout: 'teammember/logout',
  },
  dashboard: {
    createWANumber: 'dashboard/whatsapp-number',
    getWANumber: 'dashboard/whatsapp-number',
    getDashboardStats: 'dashboard/stats',
    removeWANumber: 'dashboard/whatsapp-number',
    accesssettingId: 'settings/access/business-account',
    updateAccountStatus: 'settings',
    getFolders: 'folders',
    createFolder: 'folders',
    deleteFolder: 'folders',
    renameFolder: 'folders',
    moveItems: 'folders/move-items',
    syncWhatsAppBusinessInfo: 'dashboard/whatsapp-number/sync',
  },
  inbox: {
    root: 'chats',
    getChats: 'chats',
    getConversation: 'chats/fetchConversation',
    updateChat: 'chats/chat',
    deleteChat: 'chats/chat',
    sendMessage: 'chats/send-message',
    replyMessage: 'chats/reply-message',
    fetchByContacts: 'chats/by-contacts',
  },
  contacts: {
    getContactList: 'contacts/list',
    getActiveContactsByLists: 'contacts/list/active-contacts',
    getContactStats: 'contacts/stats',
    getContacts: 'contacts',
    createList: 'contacts/list',
    deleteList: 'contacts/list/',
    deleteContacts: 'contacts',
    updateContact: 'contacts/',
    exportContacts: 'contacts/export',
    createContact: 'contacts',
    updateList: 'contacts/list/',
    gotoChat: 'contacts/goto-chat',
  },
  template: {
    createTemplate: 'templates',
    fetchAllTemplates: 'templates',
    fetchTemplateStats: 'templates/stats',
    syncTemplates: 'templates/sync',
    deleteTemplate: 'templates',
    fetchTemplateById: 'templates',
  },
  broadcast: {
    getBroadcasts: 'broadcasts',
    createBroadcast: 'broadcasts',
    deleteBroadcast: 'broadcasts/',
    fetchBroadcastStats: 'broadcasts/stats',
    testBroadcast: 'broadcasts/test',
    resendBroadcast: 'broadcasts/resend',
    exportBroadcastStats: 'broadcasts/stats/export',
  },
  assistants: {
    getAssistant: 'aiassistants',
    createAssistant: 'aiassistants',
    updateAssistant: 'aiassistants',
    getAssistants: 'aiassistants',
    toggleStatus: 'aiassistants/toggle-status',
    renameAssistant: 'aiassistants/rename',
    deleteAssistant: 'aiassistants',
    getAssistantStats: 'aiassistants/stats',
  },
  settings: {
    getSettings: 'settings',
    updateSettings: 'settings',
    deleteSettings: 'settings',
    generateApiToken: 'settings/generate-api-token',
    testWebhook: 'settings/test-webhook',
    getWebhooks: 'settings/webhooks',
    getActivityLogs: 'settings/activity-logs',
    toggleAiAutoReply: 'settings/toggle-ai-auto-reply',
  },
  teamMember: {
    getTeamMemberStats: 'teammember/stats',
    addTeamMember: 'teammember',
    removeTeamMember: 'teammember',
    WANumberAccess: 'teammember/whatsapp-number/access',
  },
  file: {
    uploadFile: 'files',
    removeFile: 'files',
  },
  flows: {
    createFlow: 'flows',
    getAllFlows: 'flows',
    updateFlow: 'flows',
    getFlow: 'flows',
    getFlowsWithPagination: 'flows',
    getFlowStats: 'flows/stats',
    deleteFlow: 'flows/',
    cloneFlow: 'flows/clone',
    apiNodeTest: 'flows/api-node/test',
    updateFlowStatus: 'flows',
    updateMultipleFlowStatus: 'flows/statuses/bulk',
    getFlowHistory: 'flows/history',
    copyFlow: 'flows/copy',
  },
  mediaLibrary: {
    getMedia: 'media',
    getMediaCounts: 'media/counts',
    uploadMedia: 'media',
    deleteMedia: 'media',
    toggleFavourite: 'media/toggle-favorite',
    getMediaByType: 'media',
  },
  catalog: {
    getCatalogs: 'catalogs',
    syncCatalogsFromMeta: 'catalogs/sync/business',
    syncProductsFromMeta: 'catalogs/sync',
    getProductsByCatalogId: 'catalogs',
    setCatalogId: 'catalogs',
    deleteProduct: 'catalogs',
    disconnectCatalogs: 'catalogs/disconnect',
  },
};

export const httpMethods = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  // Lowercase versions for compatibility with frontend patterns
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
};

export default axiosInstance;
