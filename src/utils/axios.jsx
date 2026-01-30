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
    const requestId = Math.random().toString(36).substring(7);
    config._requestId = requestId;
    config._startTime = Date.now();

    console.log('----------------------------------------');
    console.log(`[Axios] REQUEST [${requestId}]`);
    console.log(`[Axios] Timestamp: ${new Date().toISOString()}`);
    console.log(`[Axios] Method: ${config.method?.toUpperCase()}`);
    console.log(`[Axios] URL: ${config.baseURL}/${config.url}`);
    console.log(`[Axios] Full URL: ${config.baseURL}/${config.url}`);

    try {
      // Add auth token
      const token = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`[Axios] Auth Token: ${token.substring(0, 30)}...`);
      } else {
        console.log(`[Axios] Auth Token: NONE`);
      }

      // Add settingId header for non-auth endpoints
      const url = config.url || '';
      const excludedUrls = [
        endpoints.auth.signIn,
        endpoints.auth.signUp,
        endpoints.auth.session,
        endpoints.auth.tokenAuth,
        endpoints.dashboard.accesssettingId,
      ];

      if (!excludedUrls.includes(url)) {
        const settingId = await AsyncStorage.getItem('settingId');
        if (settingId) {
          config.headers.settingId = settingId;
          console.log(`[Axios] Setting ID: ${settingId}`);
        }
      }
    } catch (error) {
      console.log(`[Axios] Error in request interceptor: ${error.message}`);
    }

    if (config.data) {
      console.log(`[Axios] Request Body:`, JSON.stringify(config.data, null, 2));
    }
    if (config.params) {
      console.log(`[Axios] Request Params:`, JSON.stringify(config.params, null, 2));
    }
    console.log('----------------------------------------');

    return config;
  },
  (error) => {
    console.log(`[Axios] REQUEST ERROR: ${error.message}`);
    return Promise.reject(error);
  }
);

// Response interceptor
// IMPORTANT: Only clear session on explicit 401 Unauthorized with session-related messages
// Do NOT clear on 400 errors or network errors - this would log out users incorrectly
axiosInstance.interceptors.response.use(
  (response) => {
    const requestId = response.config?._requestId || 'unknown';
    const duration = response.config?._startTime ? Date.now() - response.config._startTime : 0;

    console.log('----------------------------------------');
    console.log(`[Axios] RESPONSE SUCCESS [${requestId}]`);
    console.log(`[Axios] Timestamp: ${new Date().toISOString()}`);
    console.log(`[Axios] Duration: ${duration}ms`);
    console.log(`[Axios] Status: ${response.status} ${response.statusText}`);
    console.log(`[Axios] URL: ${response.config?.url}`);
    console.log(`[Axios] Response Data:`, JSON.stringify(response.data, null, 2));
    console.log('----------------------------------------');

    return response;
  },
  async (error) => {
    const requestId = error.config?._requestId || 'unknown';
    const duration = error.config?._startTime ? Date.now() - error.config._startTime : 0;
    const status = error.response?.status;

    console.log('========================================');
    console.log(`[Axios] RESPONSE ERROR [${requestId}]`);
    console.log('========================================');
    console.log(`[Axios] Timestamp: ${new Date().toISOString()}`);
    console.log(`[Axios] Duration: ${duration}ms`);
    console.log(`[Axios] URL: ${error.config?.url}`);
    console.log(`[Axios] Method: ${error.config?.method?.toUpperCase()}`);
    console.log(`[Axios] Status: ${status || 'NO RESPONSE'}`);
    console.log(`[Axios] Status Text: ${error.response?.statusText || 'N/A'}`);
    console.log(`[Axios] Error Message: ${error.message}`);
    console.log(`[Axios] Error Code: ${error.code}`);
    console.log(`[Axios] Response Data:`, JSON.stringify(error.response?.data, null, 2));
    console.log('========================================');

    // Only handle 401 Unauthorized - this means the session might be invalid
    if (status === 401) {
      const errorMessage = (error.response?.data?.message || '').toLowerCase();

      // Check if this is a genuine session invalidation
      // (not just a permission error on a specific resource)
      const sessionInvalidKeywords = ['session', 'token', 'unauthorized', 'authentication', 'login', 'expired'];
      const isSessionInvalid = sessionInvalidKeywords.some((keyword) => errorMessage.includes(keyword));

      if (isSessionInvalid) {
        console.log(`[Axios] Session invalidated by server: ${error.response?.data?.message}`);
        console.log(`[Axios] Clearing auth storage...`);
        // Clear storage only for genuine session invalidation
        await AsyncStorage.removeItem(APP_CONFIG.tokenKey);
        await AsyncStorage.removeItem(APP_CONFIG.userKey);
        await AsyncStorage.removeItem('settingId');
        await AsyncStorage.removeItem('@pabbly_chatflow_settingId');
        console.log(`[Axios] Auth storage cleared`);
      } else {
        console.log(`[Axios] 401 error but not session related: ${error.response?.data?.message}`);
      }
    }
    // Note: 400 errors are NOT session related - don't clear storage
    // Network errors (no response) should NOT logout the user - they might be offline

    return Promise.reject(error);
  }
);

/**
 * Main API call function
 * Compatible with frontend patterns - handles both GET params and POST data
 * Returns response in same format as frontend: { status, data, statusCode, ... }
 */
export async function callApi(url, method, data = {}, customHeaders = {}) {
  const callId = Math.random().toString(36).substring(7);

  console.log('========================================');
  console.log(`[callApi] API CALL INITIATED [${callId}]`);
  console.log('========================================');
  console.log(`[callApi] Timestamp: ${new Date().toISOString()}`);
  console.log(`[callApi] URL: ${url}`);
  console.log(`[callApi] Full URL: ${API_URL}/${url}`);
  console.log(`[callApi] Method: ${method}`);
  console.log(`[callApi] Data:`, JSON.stringify(data, null, 2));
  console.log(`[callApi] Custom Headers:`, JSON.stringify(customHeaders, null, 2));

  if (!url) {
    console.log(`[callApi] ERROR: URL is undefined or null`);
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

    console.log(`[callApi] Sending ${normalizedMethod} request to ${url}...`);

    const response = await axiosInstance(config);

    // Return in frontend-compatible format
    // Frontend expects: { status: 'success', data: {...}, statusCode }
    // API response structure varies:
    //   - Some endpoints: { status, data: { ... }, message }
    //   - Some endpoints: { status, assistants: [...], pagination: {...} }
    //   - Some endpoints: { status, chats: [...], hasMoreChats: boolean }
    // We return both nested data AND top-level fields to handle all cases
    const responseBody = response.data || {};
    const result = {
      status: responseBody.status || 'success',
      data: responseBody.data,  // Nested data if present
      // Also spread top-level fields for endpoints that don't nest in 'data'
      assistants: responseBody.assistants,
      pagination: responseBody.pagination,
      message: responseBody.message,
      // Chat list endpoints return chats at top level
      chats: responseBody.chats,
      hasMoreChats: responseBody.hasMoreChats,
      statusCode: response.status,
      success: true,
      // Include raw response for debugging
      _raw: responseBody,
    };

    console.log(`[callApi] SUCCESS [${callId}]`);
    console.log(`[callApi] Status Code: ${response.status}`);
    console.log(`[callApi] Response Status: ${result.status}`);
    console.log('========================================');

    return result;
  } catch (error) {
    // Handle specific error cases like frontend
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;

    console.log(`[callApi] ERROR [${callId}]`);
    console.log(`[callApi] Error Status: ${statusCode}`);
    console.log(`[callApi] Error Message: ${errorMessage}`);
    console.log('========================================');

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
    // Error:('FormData API Error:', error);
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
    tokenAuth: 'auth/tauth', // Pabbly Accounts JWT token authentication
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
    toggleAiAssistant: 'aiassistants/toggle-chat-assistant',
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
