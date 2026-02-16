import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { sessionManager } from '../../services/SessionManager';
import { cacheManager } from '../../database/CacheManager';
import { APP_CONFIG } from '../../config/app.config';
import {
  setOneSignalExternalUserId,
  removeOneSignalExternalUserId,
  getOneSignalPlayerId,
  removePlayerIdFromBackend,
} from '../../services/oneSignalService';
import { clearAllNotifications } from '../../services/notificationService';
// ============================================================================
// ASYNC THUNKS - Pabbly Accounts Authentication
// ============================================================================

/**
 * Login User via Pabbly Accounts - Pure API-based authentication
 * Flow:
 * 1. GET login page to obtain CSRF token and initial cookies
 * 2. POST to /backend/login with email/password and CSRF token
 * 3. POST to /backend/access with project=pcf to get JWT token
 * 4. Use that token to authenticate with ChatFlow via tauth endpoint
 * 5. Store session
 */
export const signIn = createAsyncThunk(
  'user/signIn',
  async (credentials, { rejectWithValue }) => {
    try {
      // Browser-like User-Agent for compatibility
      const userAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

      // Store cookies manually since React Native doesn't handle them automatically
      let sessionCookies = '';
      let csrfToken = '';

      // Step 1: Visit login page to get initial cookies and CSRF token
      try {
        const loginPageResponse = await axios.get(`${APP_CONFIG.pabblyAccountsUrl}/login`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': userAgent,
          },
          timeout: APP_CONFIG.apiTimeout,
        });

        // Extract cookies from response
        const pageCookies = loginPageResponse.headers['set-cookie'];
        if (pageCookies) {
          if (Array.isArray(pageCookies)) {
            sessionCookies = pageCookies.map(c => c.split(';')[0]).join('; ');
          } else {
            sessionCookies = pageCookies.split(';')[0];
          }
        }

        // Try to extract CSRF token from HTML
        const html = typeof loginPageResponse.data === 'string' ? loginPageResponse.data : '';
        const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/i) ||
                         html.match(/name="csrf_token"\s+value="([^"]+)"/i) ||
                         html.match(/name="csrf"\s+value="([^"]+)"/i) ||
                         html.match(/"csrfToken":\s*"([^"]+)"/i) ||
                         html.match(/_token['"]\s*:\s*['"]([^'"]+)['"]/i);

        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        }
      } catch (pageError) {
        // Continue without initial cookies
      }

      // Step 2: Login to Pabbly Accounts
      // Build form data with CSRF token if available
      const formData = new URLSearchParams();
      formData.append('email', credentials.email);
      formData.append('password', credentials.password);
      formData.append('project', APP_CONFIG.pabblyProject);
      if (csrfToken) {
        formData.append('_token', csrfToken);
      }

      let loginResponse;
      let pabblyToken = null;

      try {
        loginResponse = await axios.post(
          `${APP_CONFIG.pabblyAccountsBackendUrl}/login`,
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json, text/html, */*',
              'User-Agent': userAgent,
              'Origin': APP_CONFIG.pabblyAccountsUrl,
              'Referer': `${APP_CONFIG.pabblyAccountsUrl}/login`,
              'Cookie': sessionCookies,
            },
            timeout: APP_CONFIG.apiTimeout,
            maxRedirects: 5,
            validateStatus: () => true,
          }
        );

        // Update cookies from login response
        const loginCookies = loginResponse.headers['set-cookie'];
        if (loginCookies) {
          const newCookies = Array.isArray(loginCookies)
            ? loginCookies.map(c => c.split(';')[0]).join('; ')
            : loginCookies.split(';')[0];
          sessionCookies = sessionCookies ? `${sessionCookies}; ${newCookies}` : newCookies;
        }

        // Check if response is JSON
        if (typeof loginResponse.data === 'object' && loginResponse.data !== null) {
          // Check for login errors
          if (loginResponse.data?.status === 'error') {
            return rejectWithValue(loginResponse.data?.message || 'Invalid email or password');
          }

          // Try to get token directly from login response
          pabblyToken = loginResponse.data?.data?.token ||
                        loginResponse.data?.token ||
                        loginResponse.data?.jwt ||
                        loginResponse.data?.data?.jwt ||
                        loginResponse.data?.accessToken;
        } else if (typeof loginResponse.data === 'string') {
          // Response is HTML - check if login was successful by looking for success indicators
          const htmlResponse = loginResponse.data;

          // Check for error messages in HTML
          if (htmlResponse.includes('Invalid credentials') ||
              htmlResponse.includes('invalid email') ||
              htmlResponse.includes('invalid password') ||
              htmlResponse.includes('Login failed')) {
            return rejectWithValue('Invalid email or password');
          }
        }
      } catch (loginError) {
        // Check if it's a redirect (which might indicate success)
        if (loginError.response?.status === 302 || loginError.response?.status === 303) {
          // Update cookies from error response
          const errorCookies = loginError.response?.headers?.['set-cookie'];
          if (errorCookies) {
            const newCookies = Array.isArray(errorCookies)
              ? errorCookies.map(c => c.split(';')[0]).join('; ')
              : errorCookies.split(';')[0];
            sessionCookies = sessionCookies ? `${sessionCookies}; ${newCookies}` : newCookies;
          }
        } else {
          return rejectWithValue('Login failed. Please check your credentials.');
        }
      }

      // Step 3: Get access token for the project (pcf)
      if (!pabblyToken) {
        try {
          const accessResponse = await axios.post(
            `${APP_CONFIG.pabblyAccountsBackendUrl}/access`,
            { project: APP_CONFIG.pabblyProject },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/html, */*',
                'User-Agent': userAgent,
                'Origin': APP_CONFIG.pabblyAccountsUrl,
                'Referer': `${APP_CONFIG.pabblyAccountsUrl}/dashboard`,
                'Cookie': sessionCookies,
              },
              timeout: APP_CONFIG.apiTimeout,
              maxRedirects: 0,
              validateStatus: () => true,
            }
          );

          if (typeof accessResponse.data === 'object') {
            pabblyToken = accessResponse.data?.data?.token ||
                          accessResponse.data?.token ||
                          accessResponse.data?.jwt ||
                          accessResponse.data?.data?.jwt;

            // Check for redirect URL with token
            if (!pabblyToken) {
              const redirectUrl = accessResponse.data?.redirect ||
                                 accessResponse.data?.redirectUrl ||
                                 accessResponse.data?.data?.redirect ||
                                 accessResponse.data?.data?.redirectUrl;

              if (redirectUrl && redirectUrl.includes('token=')) {
                const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
                pabblyToken = urlParams.get('token');
              }
            }
          }

          // Check Location header for redirect with token
          const locationHeader = accessResponse.headers?.location;
          if (!pabblyToken && locationHeader && locationHeader.includes('token=')) {
            const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
            pabblyToken = urlParams.get('token');
          }
        } catch (accessError) {
          // Check for redirect with token
          if (accessError.response?.status === 302 || accessError.response?.status === 303) {
            const locationHeader = accessError.response?.headers?.location;
            if (locationHeader && locationHeader.includes('token=')) {
              const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
              pabblyToken = urlParams.get('token');
            }
          }
        }
      }

      // Step 4: Try GET request to /access with project parameter
      if (!pabblyToken) {
        try {
          const getAccessResponse = await axios.get(
            `${APP_CONFIG.pabblyAccountsBackendUrl}/access?project=${APP_CONFIG.pabblyProject}`,
            {
              headers: {
                'Accept': 'application/json, text/html, */*',
                'User-Agent': userAgent,
                'Cookie': sessionCookies,
              },
              timeout: APP_CONFIG.apiTimeout,
              maxRedirects: 0,
              validateStatus: () => true,
            }
          );

          if (typeof getAccessResponse.data === 'object') {
            pabblyToken = getAccessResponse.data?.data?.token ||
                          getAccessResponse.data?.token ||
                          getAccessResponse.data?.jwt;
          }

          // Check Location header for redirect with token
          const locationHeader = getAccessResponse.headers?.location;
          if (!pabblyToken && locationHeader && locationHeader.includes('token=')) {
            const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
            pabblyToken = urlParams.get('token');
          }
        } catch (getAccessError) {
          if (getAccessError.response?.status === 302 || getAccessError.response?.status === 303) {
            const locationHeader = getAccessError.response?.headers?.location;
            if (locationHeader && locationHeader.includes('token=')) {
              const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
              pabblyToken = urlParams.get('token');
            }
          }
        }
      }

      // Step 5: Try verify-session endpoint
      if (!pabblyToken) {
        try {
          const verifyResponse = await axios.get(
            `${APP_CONFIG.pabblyAccountsBackendUrl}/verify/session`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': userAgent,
                'Cookie': sessionCookies,
              },
              timeout: APP_CONFIG.apiTimeout,
            }
          );

          pabblyToken = verifyResponse.data?.data?.token ||
                        verifyResponse.data?.token ||
                        verifyResponse.data?.jwt;
        } catch (verifyError) {
          // Continue without token
        }
      }

      if (!pabblyToken) {
        return rejectWithValue('Authentication failed. The Pabbly Accounts API may require browser-based login. Please contact support if this issue persists.');
      }

      // Step 6: Use Pabbly token to authenticate with ChatFlow via tauth endpoint
      const tauthUrl = `${endpoints.auth.tokenAuth}?token=${encodeURIComponent(pabblyToken)}&s=${APP_CONFIG.pabblyProject}`;

      const chatflowResponse = await callApi(tauthUrl, httpMethods.GET);

      if (chatflowResponse.status !== 'success' && chatflowResponse.data?.status === 'error') {
        return rejectWithValue(chatflowResponse.data?.message || chatflowResponse.message || 'ChatFlow authentication failed');
      }

      // Extract token and user data from ChatFlow response
      const rawResponse = chatflowResponse._raw || {};
      const nestedData = rawResponse.data || chatflowResponse.data || {};

      // Determine correct token path
      let token;
      if (typeof chatflowResponse.data === 'string' && chatflowResponse.data.startsWith('eyJ')) {
        token = chatflowResponse.data;
      } else if (typeof nestedData === 'string' && nestedData.startsWith('eyJ')) {
        token = nestedData;
      } else {
        token = chatflowResponse.data?.token || rawResponse.token || nestedData?.token;
      }

      const user = chatflowResponse.data?.user || rawResponse.user || (typeof nestedData === 'object' ? nestedData?.user : null);
      const settingId = user?.settingId || rawResponse.settingId || (typeof nestedData === 'object' ? nestedData?.settingId : null);
      const tokenExpiresAt = chatflowResponse.data?.tokenExpiresAt || rawResponse.tokenExpiresAt || (typeof nestedData === 'object' ? nestedData?.tokenExpiresAt : null);

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token,
        user,
        settingId,
        tokenExpiresAt,
      });

      return chatflowResponse;
    } catch (error) {
      // Handle axios errors from Pabbly Accounts API
      if (error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      if (error.response?.status === 404) {
        return rejectWithValue(`API endpoint not found (404). URL: ${error.config?.url}`);
      }
      if (error.response?.status === 401) {
        return rejectWithValue('Invalid email or password');
      }
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

/**
 * Direct Sign In - Same as web app's signInWithPassword
 * Uses the direct auth/signin endpoint instead of Pabbly Accounts OAuth
 * Flow:
 * 1. POST to /api/auth/signin with email/password
 * 2. Get accessToken
 * 3. Store session
 * 4. Call checkSession to get user data
 */
export const signInDirect = createAsyncThunk(
  'user/signInDirect',
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    try {
      // Direct API call to auth/signin endpoint (same as web app)
      const response = await callApi(endpoints.auth.signIn, httpMethods.POST, { email, password });

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Invalid email or password');
      }

      // Try multiple possible token locations
      // API returns token directly in response.data as a string (JWT)
      let accessToken = null;

      // Check if response.data is the token itself (string starting with 'eyJ')
      if (typeof response.data === 'string' && response.data.startsWith('eyJ')) {
        accessToken = response.data;
      } else {
        // Try other possible locations
        accessToken = response.data?.accessToken ||
                      response.accessToken ||
                      response.data?.token ||
                      response.token ||
                      response.data?.jwt ||
                      response.jwt;
      }

      if (!accessToken) {
        return rejectWithValue('Access token not found in response');
      }

      // Store the token
      try {
        await AsyncStorage.setItem(APP_CONFIG.tokenKey, accessToken);
      } catch (storageError) {
        return rejectWithValue('Failed to store token: ' + (storageError.message || 'Unknown error'));
      }

      // Create session
      try {
        await sessionManager.createSession({
          token: accessToken,
          user: null, // Will be fetched by checkSession
        });
      } catch (sessionError) {
        return rejectWithValue('Failed to create session: ' + (sessionError.message || 'Unknown error'));
      }

      // Call checkSession to get user data
      try {
        await dispatch(checkSession()).unwrap();
      } catch (checkSessionError) {
        // Session check failed, but we still have token - continue anyway
      }

      return { status: 'success', accessToken };
    } catch (error) {
      if (error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      if (error.response?.status === 401) {
        return rejectWithValue('Invalid email or password');
      }
      return rejectWithValue(error.message || 'Login failed. Please try again.');
    }
  }
);

/**
 * Google Sign In via Pabbly Accounts
 * Flow:
 * 1. Get Google ID token from native Google Sign-In
 * 2. Send Google token to Pabbly Accounts for verification
 * 3. Get Pabbly JWT token
 * 4. Use that token to authenticate with ChatFlow via tauth endpoint
 * 5. Store session
 */
export const googleSignIn = createAsyncThunk(
  'user/googleSignIn',
  async ({ googleToken, accessToken }, { rejectWithValue }) => {
    try {
      // Send Google token to Pabbly Accounts for verification
      const pabblyGoogleAuthUrl = `${APP_CONFIG.pabblyAccountsBackendUrl}/google/verify`;

      const pabblyAuthResponse = await axios.post(
        pabblyGoogleAuthUrl,
        {
          token: googleToken,
          idToken: googleToken,
          accessToken: accessToken,
          project: APP_CONFIG.pabblyProject,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: APP_CONFIG.apiTimeout,
        }
      );

      // Check if Pabbly Accounts authentication was successful
      if (pabblyAuthResponse.data?.status === 'error') {
        return rejectWithValue(pabblyAuthResponse.data?.message || 'Google authentication failed');
      }

      // Extract the JWT token from Pabbly Accounts response
      const pabblyToken = pabblyAuthResponse.data?.data?.token ||
                          pabblyAuthResponse.data?.token ||
                          pabblyAuthResponse.data?.data?.jwt ||
                          pabblyAuthResponse.data?.jwt ||
                          (typeof pabblyAuthResponse.data?.data === 'string' ? pabblyAuthResponse.data?.data : null);

      if (!pabblyToken) {
        return rejectWithValue('Failed to get authentication token from Pabbly Accounts');
      }

      // Step 2: Use Pabbly token to authenticate with ChatFlow via tauth endpoint
      const tauthUrl = `${endpoints.auth.tokenAuth}?token=${encodeURIComponent(pabblyToken)}&s=${APP_CONFIG.pabblyProject}`;

      const chatflowResponse = await callApi(tauthUrl, httpMethods.GET);

      if (chatflowResponse.status !== 'success' && chatflowResponse.data?.status === 'error') {
        return rejectWithValue(chatflowResponse.data?.message || chatflowResponse.message || 'ChatFlow authentication failed');
      }

      // Extract token and user data from ChatFlow response
      const rawResponse = chatflowResponse._raw || {};
      const nestedData = rawResponse.data || chatflowResponse.data || {};

      let token;
      if (typeof chatflowResponse.data === 'string' && chatflowResponse.data.startsWith('eyJ')) {
        token = chatflowResponse.data;
      } else if (typeof nestedData === 'string' && nestedData.startsWith('eyJ')) {
        token = nestedData;
      } else {
        token = chatflowResponse.data?.token || rawResponse.token || nestedData?.token;
      }

      const user = chatflowResponse.data?.user || rawResponse.user || (typeof nestedData === 'object' ? nestedData?.user : null);
      const settingId = user?.settingId || rawResponse.settingId || (typeof nestedData === 'object' ? nestedData?.settingId : null);
      const tokenExpiresAt = chatflowResponse.data?.tokenExpiresAt || rawResponse.tokenExpiresAt || (typeof nestedData === 'object' ? nestedData?.tokenExpiresAt : null);

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token,
        user,
        settingId,
        tokenExpiresAt,
      });

      return chatflowResponse;
    } catch (error) {
      if (error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      if (error.response?.status === 404) {
        return rejectWithValue(`Google auth endpoint not found. Please check the API configuration.`);
      }
      return rejectWithValue(error.message || 'Google sign in failed');
    }
  }
);

/**
 * Check Session - Same as web app's checkSession thunk
 * This is the main session verification that returns user data and settingId
 */
export const checkSession = createAsyncThunk(
  'user/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const url = endpoints.auth.session;
      const response = await callApi(url, httpMethods.GET);

      if (response?.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || 'Session verification failed');
      }

      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Logout - Same as web app's logout thunk
 * Uses SessionManager to destroy session and clears all cached data
 */
export const logout = createAsyncThunk(
  'user/logout',
  async (_, { rejectWithValue }) => {
    try {
      // Remove OneSignal player ID before logout (non-blocking)
      try {
        const playerId = await getOneSignalPlayerId();
        if (playerId) {
          await removePlayerIdFromBackend(playerId);
        }
        removeOneSignalExternalUserId();
      } catch (oneSignalError) {
        // Ignore OneSignal errors during logout
      }

      const url = endpoints.auth.logout;
      const response = await callApi(url, httpMethods.GET);

      if (response?.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || 'Logout failed');
      }

      // Use SessionManager to destroy session (clears all auth storage)
      await sessionManager.destroySession();

      // Clear cached data (chats, messages, etc.)
      try {
        await cacheManager.clearAllCache();
      } catch (cacheError) {
        // Ignore cache clear errors
      }

      // Clear all notifications to prevent stale notification data on next login
      try {
        await clearAllNotifications();
      } catch (notificationError) {
        // Ignore notification clear errors
      }

      return response;
    } catch (error) {
      // Still destroy session even on API error
      await sessionManager.destroySession();

      // Still try to clear cache
      try {
        await cacheManager.clearAllCache();
      } catch (cacheError) {
        // Ignore cache clear errors
      }

      // Still try to clear notifications
      try {
        await clearAllNotifications();
      } catch (notificationError) {
        // Ignore notification clear errors
      }

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Token Authentication - Validates JWT token from Pabbly Accounts
 * This is used for Pabbly Accounts OAuth-style login
 * Flow: User logs in via accounts.pabbly.com → redirects with JWT token → we validate here
 */
export const tokenAuth = createAsyncThunk(
  'user/tokenAuth',
  async ({ token, project, paymentLink }, { rejectWithValue }) => {
    try {
      // Call the tauth endpoint with the token from Pabbly Accounts
      const url = `${endpoints.auth.tokenAuth}?token=${encodeURIComponent(token)}&s=${encodeURIComponent(project || 'pcf')}${paymentLink ? `&pl=${encodeURIComponent(paymentLink)}` : ''}`;

      const response = await callApi(url, httpMethods.GET);

      if (response.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || response.message || 'Token authentication failed');
      }

      // Extract token and user data from response
      const rawResponse = response._raw || {};
      const nestedData = rawResponse.data || response.data || {};

      // Determine correct token path
      let authToken;
      if (typeof response.data === 'string' && response.data.startsWith('eyJ')) {
        authToken = response.data;
      } else if (typeof nestedData === 'string' && nestedData.startsWith('eyJ')) {
        authToken = nestedData;
      } else {
        authToken = response.data?.token || rawResponse.token || nestedData?.token;
      }

      const user = response.data?.user || rawResponse.user || (typeof nestedData === 'object' ? nestedData?.user : null);
      const settingId = user?.settingId || rawResponse.settingId || (typeof nestedData === 'object' ? nestedData?.settingId : null);
      const tokenExpiresAt = response.data?.tokenExpiresAt || rawResponse.tokenExpiresAt || (typeof nestedData === 'object' ? nestedData?.tokenExpiresAt : null);

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token: authToken,
        user,
        settingId,
        tokenExpiresAt,
      });

      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Login Via Team Member Account - Same as web app's loginViaTeammemberAccount thunk
 * Used when a team member accesses an inbox they have permission for
 */
export const loginViaTeammemberAccount = createAsyncThunk(
  'user/loginViaTeammemberAccount',
  async (bodyData, { rejectWithValue }) => {
    try {
      const url = endpoints.auth.teamMemberLogin;
      const response = await callApi(url, httpMethods.POST, bodyData);

      if (response.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || 'Team member login failed');
      }

      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Logout From Team Member - Same as web app's logoutFromTeammember thunk
 */
export const logoutFromTeammember = createAsyncThunk(
  'user/logoutFromTeammember',
  async (_, { rejectWithValue }) => {
    try {
      const url = endpoints.auth.teamMemberLogout;
      const response = await callApi(url, httpMethods.GET);

      if (response.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || 'Team member logout failed');
      }

      // Clear cached data to prevent stale team member data persisting
      try {
        await cacheManager.clearAllCache();
      } catch (cacheError) {
        // Ignore cache clear errors
      }

      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Access Business Account - Same as web app's accesssettingId thunk
 * This is called when user clicks "Access Inbox" on a WhatsApp number
 */
export const accessBusinessAccount = createAsyncThunk(
  'user/accessBusinessAccount',
  async (whatsappNumberId, { rejectWithValue }) => {
    try {
      // Web app uses GET with ID in URL path: settings/access/business-account/{id}
      const url = `${endpoints.dashboard.accesssettingId}/${whatsappNumberId}`;
      const response = await callApi(url, httpMethods.GET);

      if (response.status === 'error' || response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || response.message || 'Failed to access business account');
      }

      // Store selectedFolderId like web app does (from result.data._id)
      if (response.data?._id) {
        await AsyncStorage.setItem('selectedFolderId', response.data._id);
      }

      // Return both the response and the whatsappNumberId for the reducer
      return { ...response, whatsappNumberId };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// ============================================================================
// INITIAL STATE - Same as Web App
// ============================================================================
const initialState = {
  checkSessionStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  user: null,
  authenticated: false,
  settingId: null,
  tokenExpiresAt: null,
  isTokenExpiredDialogOpen: false,
  tokenExpiredManuallyClosed: false,
  teamMemberStatus: { loggedIn: false, name: '', email: '', role: '' },
  activeWaNumber: 'Not Found',
  // Mobile-specific state
  loading: false,
  error: null,
};

// ============================================================================
// SLICE
// ============================================================================
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.authenticated = !!action.payload;
    },
    setSettingId: (state, action) => {
      state.settingId = action.payload;
    },
    setTeamMemberStatus: (state, action) => {
      state.teamMemberStatus = action.payload || { loggedIn: false, name: '', email: '', role: '' };
    },
    setTokenExpiredDialogOpen: (state, action) => {
      state.isTokenExpiredDialogOpen = action.payload;
      if (!action.payload) {
        state.tokenExpiredManuallyClosed = true;
      }
    },
    resetManualCloseOnNavigation: (state) => {
      state.tokenExpiredManuallyClosed = false;
    },
    reopenTokenExpiredDialog: (state) => {
      state.isTokenExpiredDialogOpen = true;
      state.tokenExpiredManuallyClosed = false;
    },
    setTokenExpiresAt: (state, action) => {
      state.tokenExpiresAt = action.payload;
      state.isTokenExpiredDialogOpen = false;
      state.tokenExpiredManuallyClosed = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ========================================================================
    // Sign In / Login - Same as web app's loginUser
    // ========================================================================
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // Web app sets shouldCheckSession in localStorage, then calls checkSession
        // The actual user/auth state is set in checkSession.fulfilled
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.authenticated = false;
      });

    // ========================================================================
    // Sign In Direct - Direct API login
    // ========================================================================
    builder
      .addCase(signInDirect.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInDirect.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // The actual user/auth state is set in checkSession.fulfilled
      })
      .addCase(signInDirect.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.authenticated = false;
      });

    // ========================================================================
    // Google Sign In - Native Google OAuth
    // ========================================================================
    builder
      .addCase(googleSignIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleSignIn.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // The actual user/auth state is set in checkSession.fulfilled
      })
      .addCase(googleSignIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.authenticated = false;
      });

    // ========================================================================
    // Token Authentication - Pabbly Accounts OAuth-style login
    // ========================================================================
    builder
      .addCase(tokenAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(tokenAuth.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // The actual user/auth state is set in checkSession.fulfilled
        // (similar to signIn flow)
      })
      .addCase(tokenAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.authenticated = false;
      });

    // ========================================================================
    // Check Session - Same as web app's checkSession
    // This is where the main auth state is set
    // ========================================================================
    builder
      .addCase(checkSession.pending, (state) => {
        state.checkSessionStatus = 'loading';
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.checkSessionStatus = 'succeeded';
        state.user = action.payload?.data?.user;

        // Store user in AsyncStorage for session persistence
        const userData = action.payload?.data?.user;
        if (userData) {
          // IMPORTANT: If we have valid user data from checkSession but no token was stored,
          // create a session marker so the app knows user is logged in on restart.
          // The actual session is cookie-based, but we need something in AsyncStorage.
          sessionManager.createSession({
            token: 'session_cookie_auth', // Marker to indicate cookie-based session
            user: userData,
            settingId: userData.settingId,
            tokenExpiresAt: action.payload?.data?.tokenExpiresAt,
          }).catch(() => {
            // Session error (non-blocking)
          });
        }

        // Set settingId and other data if user has a settingId
        const userSettingId = action.payload?.data?.user?.settingId;
        if (userSettingId) {
          state.settingId = userSettingId;

          // Store settingId in AsyncStorage (done async, can't await here)
          // Store under both keys for compatibility with socketService
          AsyncStorage.setItem('settingId', userSettingId);
          AsyncStorage.setItem('@pabbly_chatflow_settingId', userSettingId);

          // Store timezone
          if (action.payload?.data?.timeZone) {
            AsyncStorage.setItem('timezone', action.payload?.data?.timeZone);
          }

          // Handle token expiry
          const newTokenExpiresAt = action.payload?.data?.tokenExpiresAt;
          if (newTokenExpiresAt) {
            state.tokenExpiresAt = newTokenExpiresAt;
            AsyncStorage.setItem('tokenExpiresAt', String(newTokenExpiresAt));
            state.isTokenExpiredDialogOpen = false;
            state.tokenExpiredManuallyClosed = false;
          }

          // Set active WhatsApp number
          state.activeWaNumber = action.payload?.data?.activeWaNumber || 'Not Found';
        } else {
          // No settingId - clear related state
          state.tokenExpiresAt = null;
          AsyncStorage.removeItem('settingId');
          AsyncStorage.removeItem('@pabbly_chatflow_settingId');
          AsyncStorage.removeItem('tokenExpiresAt');
        }

        // Handle team member status - Same as web app
        if (action.payload?.data?.teamMemberStatus) {
          const { teamMemberStatus } = action.payload.data;
          if (teamMemberStatus.loggedIn) {
            state.teamMemberStatus = {
              name: teamMemberStatus.name,
              email: teamMemberStatus.email,
              loggedIn: true,
              role: teamMemberStatus.role,
            };
            // Persist team member status to AsyncStorage for app restart
            sessionManager.saveTeamMemberStatus(state.teamMemberStatus);
          } else {
            state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
            // Clear persisted team member status
            sessionManager.clearTeamMemberStatus();
          }
        }

        // Set authenticated if success
        if (action.payload.status === 'success') {
          state.authenticated = true;

          // Register OneSignal player ID after successful authentication
          const userObj = action.payload?.data?.user;
          const userSettingId = userObj?.settingId;
          // Use settingId as external user ID - it's unique per workspace
          // and ideal for targeting push notifications to specific workspaces
          const userId = userObj?._id || userObj?.id || userObj?.userId || userSettingId;

          if (userId && userSettingId) {
            // Non-blocking call to register device for push notifications
            setOneSignalExternalUserId(userId, userSettingId);
          }
        }

        // Check token expiry - Same as web app
        const currentTime = Date.now();
        if (state.tokenExpiresAt && currentTime >= state.tokenExpiresAt * 1000) {
          if (!state.isTokenExpiredDialogOpen && !state.tokenExpiredManuallyClosed) {
            state.isTokenExpiredDialogOpen = true;
          }
        }
      })
      .addCase(checkSession.rejected, (state) => {
        state.checkSessionStatus = 'failed';
        state.authenticated = false;
        state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
        state.user = null;
        state.settingId = null;
        // Clear storage
        AsyncStorage.removeItem('settingId');
        AsyncStorage.removeItem('@pabbly_chatflow_settingId');
        AsyncStorage.removeItem('shouldCheckSession');
      });

    // ========================================================================
    // Logout - Same as web app
    // ========================================================================
    builder
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.authenticated = false;
        state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
        state.user = null;
        state.settingId = null;
        state.tokenExpiresAt = null;
        state.isTokenExpiredDialogOpen = false;
        state.tokenExpiredManuallyClosed = false;
        state.activeWaNumber = 'Not Found';
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Still reset state on error (storage already cleared in thunk)
        state.loading = false;
        state.authenticated = false;
        state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
        state.user = null;
        state.settingId = null;
        state.tokenExpiresAt = null;
        state.isTokenExpiredDialogOpen = false;
        state.tokenExpiredManuallyClosed = false;
        state.activeWaNumber = 'Not Found';
      });

    // ========================================================================
    // Login Via Team Member Account
    // ========================================================================
    builder
      .addCase(loginViaTeammemberAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginViaTeammemberAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;

        // Store the settingId from the request payload immediately
        // This ensures file upload and other services have access to it
        // before checkSession is called
        const settingIdFromPayload = action.meta.arg?.settingId;
        if (settingIdFromPayload) {
          state.settingId = settingIdFromPayload;
          // Store under both keys for compatibility with all services
          AsyncStorage.setItem('settingId', settingIdFromPayload);
          AsyncStorage.setItem('@pabbly_chatflow_settingId', settingIdFromPayload);
        }

        // After team member login, checkSession should be called to update full state
      })
      .addCase(loginViaTeammemberAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ========================================================================
    // Logout From Team Member
    // ========================================================================
    builder
      .addCase(logoutFromTeammember.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutFromTeammember.fulfilled, (state) => {
        state.loading = false;
        state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
        // Clear persisted team member status
        sessionManager.clearTeamMemberStatus();
        // After team member logout, checkSession should be called
      })
      .addCase(logoutFromTeammember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ========================================================================
    // Access Business Account - Same as web app's accesssettingId
    // Note: Web app calls router.refresh() which triggers checkSession
    // In mobile, we'll update settingId here but should also call checkSession
    // ========================================================================
    builder
      .addCase(accessBusinessAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(accessBusinessAccount.fulfilled, (state, action) => {
        state.loading = false;
        // Use the whatsappNumberId that was passed to the thunk
        // This is the actual WhatsApp number ID, not the folder ID from response
        const whatsappNumberId = action.payload.whatsappNumberId;
        if (whatsappNumberId) {
          state.settingId = whatsappNumberId;
          // Also store to AsyncStorage for services that need it (file upload, socket, etc.)
          // Store under both keys for compatibility with socketService
          AsyncStorage.setItem('settingId', whatsappNumberId);
          AsyncStorage.setItem('@pabbly_chatflow_settingId', whatsappNumberId);
        }
        state.error = null;
      })
      .addCase(accessBusinessAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setUser,
  setSettingId,
  setTeamMemberStatus,
  setTokenExpiredDialogOpen,
  resetManualCloseOnNavigation,
  reopenTokenExpiredDialog,
  setTokenExpiresAt,
  clearError,
} = userSlice.actions;

export default userSlice.reducer;
