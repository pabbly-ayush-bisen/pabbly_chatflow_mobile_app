import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { APP_CONFIG } from '../../config/app.config';

// ============================================================================
// ASYNC THUNKS - Same as Web App Implementation
// ============================================================================

/**
 * Login User - Same as web app's loginUser thunk
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

      // Store token and user data on successful login
      if (response.data?.token) {
        await AsyncStorage.setItem(APP_CONFIG.tokenKey, response.data.token);
      }
      if (response.data?.user) {
        await AsyncStorage.setItem(APP_CONFIG.userKey, JSON.stringify(response.data.user));
      }

      // Store shouldCheckSession like web app does
      await AsyncStorage.setItem(
        'shouldCheckSession',
        JSON.stringify({ status: true, timestamp: Date.now() })
      );

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

      // Clear storage like web app does
      await AsyncStorage.removeItem('settingId');
      await AsyncStorage.removeItem('shouldCheckSession');
      await AsyncStorage.removeItem('tokenExpiresAt');
      await AsyncStorage.removeItem('notifiedThresholds');
      await AsyncStorage.removeItem('timezone');
      await AsyncStorage.removeItem('selectedFolderId');
      await AsyncStorage.removeItem(APP_CONFIG.tokenKey);
      await AsyncStorage.removeItem(APP_CONFIG.userKey);

      return response;
    } catch (error) {
      // Still clear storage even on error
      await AsyncStorage.removeItem('settingId');
      await AsyncStorage.removeItem('shouldCheckSession');
      await AsyncStorage.removeItem('tokenExpiresAt');
      await AsyncStorage.removeItem('notifiedThresholds');
      await AsyncStorage.removeItem('timezone');
      await AsyncStorage.removeItem('selectedFolderId');
      await AsyncStorage.removeItem(APP_CONFIG.tokenKey);
      await AsyncStorage.removeItem(APP_CONFIG.userKey);
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
          AsyncStorage.setItem('settingId', userSettingId);

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
      .addCase(loginViaTeammemberAccount.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // After team member login, checkSession should be called to update state
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
          // Also store to AsyncStorage for services that need it (file upload, etc.)
          AsyncStorage.setItem('settingId', data._id);
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
