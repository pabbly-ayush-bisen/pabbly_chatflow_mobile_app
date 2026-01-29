import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { sessionManager } from '../../services/SessionManager';
import { cacheManager } from '../../database/CacheManager';

// ============================================================================
// ASYNC THUNKS - Same as Web App Implementation
// ============================================================================

/**
 * Login User - Same as web app's loginUser thunk
 * Uses SessionManager for persistent session storage
 */
export const signIn = createAsyncThunk(
  'user/signIn',
  async (credentials, { rejectWithValue }) => {
    try {
      const url = endpoints.auth.signIn;
      const response = await callApi(url, httpMethods.POST, credentials);

      // Check for error status like web app does
      if (response.status !== 'success' && response.data?.status === 'error') {
        return rejectWithValue(response.data?.message || response.message || 'Login failed');
      }

      // Debug: Log the full response structure to identify correct paths
      console.log('[signIn] Full API response:', JSON.stringify(response, null, 2));
      console.log('[signIn] Response keys:', Object.keys(response));
      console.log('[signIn] response._raw:', response._raw);
      console.log('[signIn] response._raw keys:', response._raw ? Object.keys(response._raw) : 'no _raw');

      // The callApi wrapper puts the raw API response in _raw
      // Token and user can be at: response.data, response._raw, or nested in response._raw.data
      const rawResponse = response._raw || {};
      const nestedData = response.data || rawResponse.data || {};

      // Determine correct token and user paths (check all possible locations)
      const token = response.data?.token || rawResponse.token || nestedData.token;
      const user = response.data?.user || rawResponse.user || nestedData.user;
      const settingId = user?.settingId || rawResponse.settingId || nestedData.settingId;
      const tokenExpiresAt = response.data?.tokenExpiresAt || rawResponse.tokenExpiresAt || nestedData.tokenExpiresAt;

      console.log('[signIn] Extracted values:', {
        hasToken: !!token,
        hasUser: !!user,
        settingId,
        tokenExpiresAt
      });

      // Use SessionManager to create persistent session
      await sessionManager.createSession({
        token,
        user,
        settingId,
        tokenExpiresAt,
      });

      console.log('[signIn] Session created successfully via SessionManager');

      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
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
        console.log('[logout] Cache cleared successfully');
      } catch (cacheError) {
        console.warn('[logout] Failed to clear cache:', cacheError.message);
      }

      console.log('[logout] Session destroyed successfully');
      return response;
    } catch (error) {
      // Still destroy session even on API error
      await sessionManager.destroySession();

      // Still try to clear cache
      try {
        await cacheManager.clearAllCache();
      } catch (cacheError) {
        console.warn('[logout] Failed to clear cache on error:', cacheError.message);
      }

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
