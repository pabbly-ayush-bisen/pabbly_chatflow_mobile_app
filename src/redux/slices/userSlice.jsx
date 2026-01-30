import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { sessionManager } from '../../services/SessionManager';
import { cacheManager } from '../../database/CacheManager';
import { APP_CONFIG } from '../../config/app.config';

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
      console.log('=== SIGN IN DEBUG START ===');
      console.log('[signIn] Email:', credentials.email);
      console.log('[signIn] Project:', APP_CONFIG.pabblyProject);

      // Browser-like User-Agent for compatibility
      const userAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

      // Store cookies manually since React Native doesn't handle them automatically
      let sessionCookies = '';
      let csrfToken = '';

      // Step 1: Visit login page to get initial cookies and CSRF token
      console.log('[signIn] Step 1: Getting initial session from login page...');

      try {
        const loginPageResponse = await axios.get(`${APP_CONFIG.pabblyAccountsUrl}/login`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': userAgent,
          },
          timeout: APP_CONFIG.apiTimeout,
        });

        console.log('[signIn] Login page status:', loginPageResponse.status);

        // Extract cookies from response
        const pageCookies = loginPageResponse.headers['set-cookie'];
        if (pageCookies) {
          if (Array.isArray(pageCookies)) {
            sessionCookies = pageCookies.map(c => c.split(';')[0]).join('; ');
          } else {
            sessionCookies = pageCookies.split(';')[0];
          }
          console.log('[signIn] Initial cookies:', sessionCookies);
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
          console.log('[signIn] CSRF token found:', csrfToken.substring(0, 20) + '...');
        }
      } catch (pageError) {
        console.log('[signIn] Login page fetch error (continuing):', pageError.message);
      }

      // Step 2: Login to Pabbly Accounts
      console.log('[signIn] Step 2: Logging in to Pabbly Accounts...');

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
            validateStatus: () => true, // Accept all status codes
          }
        );

        console.log('[signIn] Login Response Status:', loginResponse.status);
        console.log('[signIn] Login Response Type:', typeof loginResponse.data);

        // Update cookies from login response
        const loginCookies = loginResponse.headers['set-cookie'];
        if (loginCookies) {
          const newCookies = Array.isArray(loginCookies)
            ? loginCookies.map(c => c.split(';')[0]).join('; ')
            : loginCookies.split(';')[0];
          sessionCookies = sessionCookies ? `${sessionCookies}; ${newCookies}` : newCookies;
          console.log('[signIn] Updated cookies:', sessionCookies);
        }

        // Check if response is JSON
        if (typeof loginResponse.data === 'object' && loginResponse.data !== null) {
          console.log('[signIn] Login Response Data:', JSON.stringify(loginResponse.data, null, 2));

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
          console.log('[signIn] Got HTML response, checking for success indicators...');

          // Check for error messages in HTML
          if (htmlResponse.includes('Invalid credentials') ||
              htmlResponse.includes('invalid email') ||
              htmlResponse.includes('invalid password') ||
              htmlResponse.includes('Login failed')) {
            return rejectWithValue('Invalid email or password');
          }

          // If we got redirected to dashboard or got success message, login worked
          if (htmlResponse.includes('dashboard') ||
              htmlResponse.includes('success') ||
              loginResponse.status === 302 ||
              loginResponse.status === 303) {
            console.log('[signIn] Login appears successful, proceeding to get access token...');
          }
        }
      } catch (loginError) {
        console.log('[signIn] Login request error:', loginError.message);

        // Check if it's a redirect (which might indicate success)
        if (loginError.response?.status === 302 || loginError.response?.status === 303) {
          const locationHeader = loginError.response?.headers?.location;
          console.log('[signIn] Redirect location:', locationHeader);

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
        console.log('[signIn] Step 3: Getting access token for project...');

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

          console.log('[signIn] Access Response Status:', accessResponse.status);

          if (typeof accessResponse.data === 'object') {
            console.log('[signIn] Access Response Data:', JSON.stringify(accessResponse.data, null, 2));

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
                console.log('[signIn] Found redirect URL:', redirectUrl);
                const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
                pabblyToken = urlParams.get('token');
              }
            }
          }

          // Check Location header for redirect with token
          const locationHeader = accessResponse.headers?.location;
          if (!pabblyToken && locationHeader && locationHeader.includes('token=')) {
            console.log('[signIn] Location header:', locationHeader);
            const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
            pabblyToken = urlParams.get('token');
          }
        } catch (accessError) {
          console.log('[signIn] Access error:', accessError.message);

          // Check for redirect with token
          if (accessError.response?.status === 302 || accessError.response?.status === 303) {
            const locationHeader = accessError.response?.headers?.location;
            console.log('[signIn] Access redirect location:', locationHeader);
            if (locationHeader && locationHeader.includes('token=')) {
              const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
              pabblyToken = urlParams.get('token');
            }
          }
        }
      }

      // Step 4: Try GET request to /access with project parameter
      if (!pabblyToken) {
        console.log('[signIn] Step 4: Trying GET /access endpoint...');

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

          console.log('[signIn] GET Access Response Status:', getAccessResponse.status);

          if (typeof getAccessResponse.data === 'object') {
            console.log('[signIn] GET Access Response Data:', JSON.stringify(getAccessResponse.data, null, 2));

            pabblyToken = getAccessResponse.data?.data?.token ||
                          getAccessResponse.data?.token ||
                          getAccessResponse.data?.jwt;
          }

          // Check Location header for redirect with token
          const locationHeader = getAccessResponse.headers?.location;
          if (!pabblyToken && locationHeader && locationHeader.includes('token=')) {
            console.log('[signIn] GET Access Location header:', locationHeader);
            const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
            pabblyToken = urlParams.get('token');
          }
        } catch (getAccessError) {
          console.log('[signIn] GET Access error:', getAccessError.message);

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
        console.log('[signIn] Step 5: Trying verify-session endpoint...');

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

          console.log('[signIn] Verify Session Response:', JSON.stringify(verifyResponse.data, null, 2));

          pabblyToken = verifyResponse.data?.data?.token ||
                        verifyResponse.data?.token ||
                        verifyResponse.data?.jwt;
        } catch (verifyError) {
          console.log('[signIn] Verify session error:', verifyError.message);
        }
      }

      if (!pabblyToken) {
        console.log('[signIn] ERROR: No token found from Pabbly Accounts');
        return rejectWithValue('Authentication failed. The Pabbly Accounts API may require browser-based login. Please contact support if this issue persists.');
      }

      console.log('[signIn] Got Pabbly token:', pabblyToken.substring(0, 30) + '...');

      // Step 6: Use Pabbly token to authenticate with ChatFlow via tauth endpoint
      const tauthUrl = `${endpoints.auth.tokenAuth}/?token=${encodeURIComponent(pabblyToken)}&s=${APP_CONFIG.pabblyProject}`;
      console.log('[signIn] Step 6: Authenticating with ChatFlow');
      console.log('[signIn] ChatFlow tauth URL:', tauthUrl);

      const chatflowResponse = await callApi(tauthUrl, httpMethods.GET);

      console.log('[signIn] ChatFlow Response:', JSON.stringify(chatflowResponse, null, 2));

      if (chatflowResponse.status !== 'success' && chatflowResponse.data?.status === 'error') {
        console.log('[signIn] ChatFlow Auth Error:', chatflowResponse.data?.message || chatflowResponse.message);
        return rejectWithValue(chatflowResponse.data?.message || chatflowResponse.message || 'ChatFlow authentication failed');
      }

      // Extract token and user data from ChatFlow response
      const rawResponse = chatflowResponse._raw || {};
      const nestedData = rawResponse.data || chatflowResponse.data || {};

      console.log('[signIn] Extracting session data from ChatFlow response');

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

      console.log('[signIn] Extracted ChatFlow Token:', token ? `${token.substring(0, 30)}...` : 'NULL');
      console.log('[signIn] Extracted User:', user ? 'YES' : 'NULL');
      console.log('[signIn] Extracted SettingId:', settingId || 'NULL');

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token,
        user,
        settingId,
        tokenExpiresAt,
      });

      console.log('[signIn] Session created successfully');
      console.log('=== SIGN IN DEBUG END ===');

      return chatflowResponse;
    } catch (error) {
      console.log('=== SIGN IN ERROR ===');
      console.log('[signIn] Error Type:', error.name);
      console.log('[signIn] Error Message:', error.message);
      console.log('[signIn] Error Response Status:', error.response?.status);
      console.log('[signIn] Error Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('[signIn] Error Request URL:', error.config?.url);
      console.log('[signIn] Error Request Method:', error.config?.method);
      console.log('[signIn] Full Error:', error);
      console.log('=== SIGN IN ERROR END ===');

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
      console.log('=== GOOGLE SIGN IN DEBUG START ===');
      console.log('[googleSignIn] Step 1: Sending Google token to Pabbly Accounts');

      // Send Google token to Pabbly Accounts for verification
      // The endpoint might be /backend/google/verify or similar
      const pabblyGoogleAuthUrl = `${APP_CONFIG.pabblyAccountsBackendUrl}/google/verify`;

      console.log('[googleSignIn] Pabbly Google Auth URL:', pabblyGoogleAuthUrl);
      console.log('[googleSignIn] Google ID Token:', googleToken ? `${googleToken.substring(0, 30)}...` : 'NULL');
      console.log('[googleSignIn] Google Access Token:', accessToken ? `${accessToken.substring(0, 30)}...` : 'NULL');

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

      console.log('[googleSignIn] Pabbly Auth Response Status:', pabblyAuthResponse.status);
      console.log('[googleSignIn] Pabbly Auth Response Data:', JSON.stringify(pabblyAuthResponse.data, null, 2));

      // Check if Pabbly Accounts authentication was successful
      if (pabblyAuthResponse.data?.status === 'error') {
        console.log('[googleSignIn] Pabbly Auth Error:', pabblyAuthResponse.data?.message);
        return rejectWithValue(pabblyAuthResponse.data?.message || 'Google authentication failed');
      }

      // Extract the JWT token from Pabbly Accounts response
      const pabblyToken = pabblyAuthResponse.data?.data?.token ||
                          pabblyAuthResponse.data?.token ||
                          pabblyAuthResponse.data?.data?.jwt ||
                          pabblyAuthResponse.data?.jwt ||
                          (typeof pabblyAuthResponse.data?.data === 'string' ? pabblyAuthResponse.data?.data : null);

      console.log('[googleSignIn] Extracted Pabbly Token:', pabblyToken ? `${pabblyToken.substring(0, 30)}...` : 'NULL');

      if (!pabblyToken) {
        console.log('[googleSignIn] ERROR: No token found in Pabbly response');
        console.log('[googleSignIn] Full response data:', pabblyAuthResponse.data);
        return rejectWithValue('Failed to get authentication token from Pabbly Accounts');
      }

      // Step 2: Use Pabbly token to authenticate with ChatFlow via tauth endpoint
      const tauthUrl = `${endpoints.auth.tokenAuth}/?token=${encodeURIComponent(pabblyToken)}&s=${APP_CONFIG.pabblyProject}`;
      console.log('[googleSignIn] Step 2: Authenticating with ChatFlow');
      console.log('[googleSignIn] ChatFlow tauth URL:', tauthUrl);

      const chatflowResponse = await callApi(tauthUrl, httpMethods.GET);

      console.log('[googleSignIn] ChatFlow Response:', JSON.stringify(chatflowResponse, null, 2));

      if (chatflowResponse.status !== 'success' && chatflowResponse.data?.status === 'error') {
        console.log('[googleSignIn] ChatFlow Auth Error:', chatflowResponse.data?.message || chatflowResponse.message);
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

      console.log('[googleSignIn] Extracted ChatFlow Token:', token ? `${token.substring(0, 30)}...` : 'NULL');
      console.log('[googleSignIn] Extracted User:', user ? 'YES' : 'NULL');
      console.log('[googleSignIn] Extracted SettingId:', settingId || 'NULL');

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token,
        user,
        settingId,
        tokenExpiresAt,
      });

      console.log('[googleSignIn] Session created successfully');
      console.log('=== GOOGLE SIGN IN DEBUG END ===');

      return chatflowResponse;
    } catch (error) {
      console.log('=== GOOGLE SIGN IN ERROR ===');
      console.log('[googleSignIn] Error Type:', error.name);
      console.log('[googleSignIn] Error Message:', error.message);
      console.log('[googleSignIn] Error Response Status:', error.response?.status);
      console.log('[googleSignIn] Error Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('[googleSignIn] Error Request URL:', error.config?.url);
      console.log('=== GOOGLE SIGN IN ERROR END ===');

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
    console.log('========================================');
    console.log('[checkSession] CHECK SESSION STARTED');
    console.log('========================================');
    console.log('[checkSession] Timestamp:', new Date().toISOString());

    try {
      const url = endpoints.auth.session;

      console.log('[checkSession] API CALL:');
      console.log('[checkSession]   - Endpoint:', url);
      console.log('[checkSession]   - Method: GET');
      console.log('[checkSession] Sending request...');

      const response = await callApi(url, httpMethods.GET);

      console.log('[checkSession] API RESPONSE RECEIVED:');
      console.log('[checkSession]   - Status:', response?.status);
      console.log('[checkSession]   - Response:', JSON.stringify(response, null, 2));

      if (response?.status !== 'success' && response.data?.status === 'error') {
        console.log('[checkSession] ERROR: Session verification failed');
        console.log('[checkSession]   - Error message:', response.data?.message);
        return rejectWithValue(response.data?.message || 'Session verification failed');
      }

      console.log('[checkSession] SESSION DATA:');
      console.log('[checkSession]   - User:', response?.data?.user ? JSON.stringify(response.data.user, null, 2) : 'NULL');
      console.log('[checkSession]   - Setting ID:', response?.data?.user?.settingId || 'NULL');
      console.log('[checkSession]   - Token Expires At:', response?.data?.tokenExpiresAt || 'NULL');
      console.log('[checkSession]   - Active WA Number:', response?.data?.activeWaNumber || 'NULL');
      console.log('[checkSession]   - Team Member Status:', JSON.stringify(response?.data?.teamMemberStatus, null, 2));

      console.log('========================================');
      console.log('[checkSession] CHECK SESSION SUCCESSFUL');
      console.log('========================================');

      return response;
    } catch (error) {
      console.log('========================================');
      console.log('[checkSession] CHECK SESSION ERROR');
      console.log('========================================');
      console.log('[checkSession] Error Type:', error.name);
      console.log('[checkSession] Error Message:', error.message);
      console.log('[checkSession] Error Response:', JSON.stringify(error.response?.data, null, 2));
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
        // Log:('[logout] Cache cleared successfully');
      } catch (cacheError) {
        // Warn:('[logout] Failed to clear cache:', cacheError.message);
      }

      // Log:('[logout] Session destroyed successfully');
      return response;
    } catch (error) {
      // Still destroy session even on API error
      await sessionManager.destroySession();

      // Still try to clear cache
      try {
        await cacheManager.clearAllCache();
      } catch (cacheError) {
        // Warn:('[logout] Failed to clear cache on error:', cacheError.message);
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
    console.log('========================================');
    console.log('[tokenAuth] TOKEN AUTH STARTED');
    console.log('========================================');
    console.log('[tokenAuth] Timestamp:', new Date().toISOString());
    console.log('[tokenAuth] Input Parameters:');
    console.log('[tokenAuth]   - Token:', token ? `${token.substring(0, 50)}...` : 'NULL');
    console.log('[tokenAuth]   - Project:', project);
    console.log('[tokenAuth]   - Payment Link:', paymentLink || 'none');

    try {
      // Call the tauth endpoint with the token from Pabbly Accounts
      const url = `${endpoints.auth.tokenAuth}/?token=${encodeURIComponent(token)}&s=${encodeURIComponent(project || 'pcf')}${paymentLink ? `&pl=${encodeURIComponent(paymentLink)}` : ''}`;

      console.log('[tokenAuth] API CALL:');
      console.log('[tokenAuth]   - Endpoint:', endpoints.auth.tokenAuth);
      console.log('[tokenAuth]   - Full URL:', url);
      console.log('[tokenAuth]   - Method: GET');
      console.log('[tokenAuth] Sending request...');

      const response = await callApi(url, httpMethods.GET);

      console.log('[tokenAuth] API RESPONSE RECEIVED:');
      console.log('[tokenAuth]   - Status:', response.status);
      console.log('[tokenAuth]   - Response:', JSON.stringify(response, null, 2));

      if (response.status !== 'success' && response.data?.status === 'error') {
        console.log('[tokenAuth] ERROR: API returned error status');
        console.log('[tokenAuth]   - Error message:', response.data?.message || response.message);
        return rejectWithValue(response.data?.message || response.message || 'Token authentication failed');
      }

      // Extract token and user data from response
      const rawResponse = response._raw || {};
      const nestedData = rawResponse.data || response.data || {};

      console.log('[tokenAuth] Extracting session data...');
      console.log('[tokenAuth]   - Raw response keys:', Object.keys(rawResponse));
      console.log('[tokenAuth]   - Nested data keys:', typeof nestedData === 'object' ? Object.keys(nestedData) : 'string');

      // Determine correct token path
      let authToken;
      if (typeof response.data === 'string' && response.data.startsWith('eyJ')) {
        authToken = response.data;
        console.log('[tokenAuth]   - Token source: response.data (string)');
      } else if (typeof nestedData === 'string' && nestedData.startsWith('eyJ')) {
        authToken = nestedData;
        console.log('[tokenAuth]   - Token source: nestedData (string)');
      } else {
        authToken = response.data?.token || rawResponse.token || nestedData?.token;
        console.log('[tokenAuth]   - Token source: object property');
      }

      const user = response.data?.user || rawResponse.user || (typeof nestedData === 'object' ? nestedData?.user : null);
      const settingId = user?.settingId || rawResponse.settingId || (typeof nestedData === 'object' ? nestedData?.settingId : null);
      const tokenExpiresAt = response.data?.tokenExpiresAt || rawResponse.tokenExpiresAt || (typeof nestedData === 'object' ? nestedData?.tokenExpiresAt : null);

      console.log('[tokenAuth] EXTRACTED DATA:');
      console.log('[tokenAuth]   - Auth Token:', authToken ? `${authToken.substring(0, 30)}...` : 'NULL');
      console.log('[tokenAuth]   - User:', user ? JSON.stringify(user, null, 2) : 'NULL');
      console.log('[tokenAuth]   - Setting ID:', settingId || 'NULL');
      console.log('[tokenAuth]   - Token Expires At:', tokenExpiresAt || 'NULL');

      // Use SessionManager to create persistent session
      console.log('[tokenAuth] Creating session via SessionManager...');
      await sessionManager.createSession({
        token: authToken,
        user,
        settingId,
        tokenExpiresAt,
      });

      console.log('========================================');
      console.log('[tokenAuth] TOKEN AUTH SUCCESSFUL');
      console.log('========================================');

      return response;
    } catch (error) {
      console.log('========================================');
      console.log('[tokenAuth] TOKEN AUTH ERROR');
      console.log('========================================');
      console.log('[tokenAuth] Error Type:', error.name);
      console.log('[tokenAuth] Error Message:', error.message);
      console.log('[tokenAuth] Error Response:', JSON.stringify(error.response?.data, null, 2));
      console.log('[tokenAuth] Error Stack:', error.stack);
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
          sessionManager.updateSession({
            user: userData,
            settingId: userData.settingId,
            tokenExpiresAt: action.payload?.data?.tokenExpiresAt,
            timezone: action.payload?.data?.timeZone,
          });
          // Log:('[checkSession] User stored via SessionManager');
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
          } else {
            state.teamMemberStatus = { loggedIn: false, name: '', email: '', role: '' };
          }
        }

        // Set authenticated if success
        if (action.payload.status === 'success') {
          state.authenticated = true;
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
        // Web app stores selectedFolderId and then refreshes (calls checkSession)
        // For immediate UI update, we can store the settingId from response
        const data = action.payload.data || action.payload;
        if (data?._id) {
          state.settingId = data._id;
          // Also store to AsyncStorage for services that need it (file upload, socket, etc.)
          // Store under both keys for compatibility with socketService
          AsyncStorage.setItem('settingId', data._id);
          AsyncStorage.setItem('@pabbly_chatflow_settingId', data._id);
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
  setTokenExpiredDialogOpen,
  resetManualCloseOnNavigation,
  reopenTokenExpiredDialog,
  setTokenExpiresAt,
  clearError,
} = userSlice.actions;

export default userSlice.reducer;
