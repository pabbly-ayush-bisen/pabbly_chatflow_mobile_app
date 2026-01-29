/**
 * SessionManager - Persistent Session Management
 *
 * This service handles user session persistence, ensuring that:
 * 1. Users stay logged in until they manually logout
 * 2. Session survives app restarts/closes
 * 3. Session data is cached for instant app launch
 *
 * Storage Keys:
 * - @pabbly_chatflow_token: JWT auth token
 * - @pabbly_chatflow_user: User data (JSON)
 * - @pabbly_chatflow_session: Session metadata (loginTime, lastActive, etc.)
 * - settingId: Current business account ID
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: APP_CONFIG.tokenKey,
  USER: APP_CONFIG.userKey,
  SESSION: '@pabbly_chatflow_session',
  SETTING_ID: 'settingId',
  SETTING_ID_ALT: '@pabbly_chatflow_settingId',
  SHOULD_CHECK_SESSION: 'shouldCheckSession',
  TOKEN_EXPIRES_AT: 'tokenExpiresAt',
  TIMEZONE: 'timezone',
};

class SessionManager {
  constructor() {
    this.isInitialized = false;
    this.cachedSession = null;
    this.onSessionExpiredCallback = null;
  }

  /**
   * Initialize session manager and restore cached session
   * @returns {Promise<Object|null>} Restored session or null
   */
  async initialize() {
    if (this.isInitialized && this.cachedSession) {
      return this.cachedSession;
    }

    try {
      const session = await this.getStoredSession();
      this.cachedSession = session;
      this.isInitialized = true;

      if (session) {
        console.log('[SessionManager] Session restored:', {
          hasToken: !!session.token,
          hasUser: !!session.user,
          loginTime: session.loginTime ? new Date(session.loginTime).toISOString() : null,
        });
      }

      return session;
    } catch (error) {
      console.error('[SessionManager] Initialization error:', error);
      return null;
    }
  }

  /**
   * Create a new session after successful login
   * @param {Object} params - Session parameters
   * @param {string} params.token - JWT token
   * @param {Object} params.user - User data
   * @param {string} params.settingId - Business account ID
   * @param {number} params.tokenExpiresAt - Token expiry timestamp
   * @returns {Promise<void>}
   */
  async createSession({ token, user, settingId, tokenExpiresAt }) {
    try {
      const now = Date.now();

      // Debug: Log what we're trying to store
      console.log('[SessionManager.createSession] Input values:', {
        hasToken: !!token,
        tokenLength: token?.length,
        hasUser: !!user,
        userName: user?.name || user?.email,
        settingId,
        tokenExpiresAt
      });

      // Store token
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
        console.log('[SessionManager.createSession] Token stored successfully');
      } else {
        console.warn('[SessionManager.createSession] WARNING: No token provided!');
      }

      // Store user data
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        console.log('[SessionManager.createSession] User stored successfully');
      } else {
        console.warn('[SessionManager.createSession] WARNING: No user provided!');
      }

      // Store settingId (both keys for compatibility)
      if (settingId) {
        await AsyncStorage.setItem(STORAGE_KEYS.SETTING_ID, settingId);
        await AsyncStorage.setItem(STORAGE_KEYS.SETTING_ID_ALT, settingId);
      }

      // Store token expiry
      if (tokenExpiresAt) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(tokenExpiresAt));
      }

      // Store session metadata
      const sessionMeta = {
        loginTime: now,
        lastActiveTime: now,
        deviceInfo: 'mobile_app',
        isValid: true,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionMeta));

      // Update shouldCheckSession
      await AsyncStorage.setItem(
        STORAGE_KEYS.SHOULD_CHECK_SESSION,
        JSON.stringify({ status: true, timestamp: now })
      );

      // Update cache
      this.cachedSession = {
        token,
        user,
        settingId,
        tokenExpiresAt,
        ...sessionMeta,
      };

      console.log('[SessionManager] Session created successfully');

      // Verify session was stored correctly by reading it back
      const verifyToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const verifyUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      console.log('[SessionManager.createSession] Verification:', {
        tokenStored: !!verifyToken,
        userStored: !!verifyUser,
      });
    } catch (error) {
      console.error('[SessionManager] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Update session with new data (e.g., after checkSession)
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateSession(updates) {
    try {
      const { user, settingId, tokenExpiresAt, timezone } = updates;

      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        if (this.cachedSession) {
          this.cachedSession.user = user;
        }
      }

      if (settingId) {
        await AsyncStorage.setItem(STORAGE_KEYS.SETTING_ID, settingId);
        await AsyncStorage.setItem(STORAGE_KEYS.SETTING_ID_ALT, settingId);
        if (this.cachedSession) {
          this.cachedSession.settingId = settingId;
        }
      }

      if (tokenExpiresAt) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(tokenExpiresAt));
        if (this.cachedSession) {
          this.cachedSession.tokenExpiresAt = tokenExpiresAt;
        }
      }

      if (timezone) {
        await AsyncStorage.setItem(STORAGE_KEYS.TIMEZONE, timezone);
      }

      // Update last active time
      const sessionMeta = await this.getSessionMeta();
      if (sessionMeta) {
        sessionMeta.lastActiveTime = Date.now();
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionMeta));
      }

      console.log('[SessionManager] Session updated');
    } catch (error) {
      console.error('[SessionManager] Error updating session:', error);
    }
  }

  /**
   * Get stored session from AsyncStorage
   * @returns {Promise<Object|null>}
   */
  async getStoredSession() {
    try {
      const [token, userStr, settingId, sessionMetaStr, tokenExpiresAt] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.SETTING_ID),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT),
      ]);

      // Debug: Log what was read from storage
      console.log('[SessionManager.getStoredSession] Read from AsyncStorage:', {
        hasToken: !!token,
        tokenLength: token?.length,
        hasUserStr: !!userStr,
        hasSettingId: !!settingId,
        hasSessionMeta: !!sessionMetaStr,
      });

      // No token = no session
      if (!token) {
        console.log('[SessionManager.getStoredSession] No token found - returning null');
        return null;
      }

      const user = userStr ? JSON.parse(userStr) : null;
      const sessionMeta = sessionMetaStr ? JSON.parse(sessionMetaStr) : {};

      return {
        token,
        user,
        settingId,
        tokenExpiresAt: tokenExpiresAt ? parseInt(tokenExpiresAt, 10) : null,
        ...sessionMeta,
      };
    } catch (error) {
      console.error('[SessionManager] Error getting stored session:', error);
      return null;
    }
  }

  /**
   * Get session metadata
   * @returns {Promise<Object|null>}
   */
  async getSessionMeta() {
    try {
      const metaStr = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      return metaStr ? JSON.parse(metaStr) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if session is valid (has token and not expired)
   * @returns {Promise<boolean>}
   */
  async isSessionValid() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      if (!token) {
        return false;
      }

      // Check token expiry (optional - server will validate anyway)
      const tokenExpiresAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      if (tokenExpiresAt) {
        const expiryTime = parseInt(tokenExpiresAt, 10) * 1000; // Convert to ms
        if (Date.now() > expiryTime) {
          console.log('[SessionManager] Token expired locally');
          // Don't invalidate - let server decide
          // Server might have extended the session
        }
      }

      return true;
    } catch (error) {
      console.error('[SessionManager] Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Check if user has a stored session (for quick app launch decision)
   * @returns {Promise<boolean>}
   */
  async hasStoredSession() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      return !!token;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current token
   * @returns {Promise<string|null>}
   */
  async getToken() {
    if (this.cachedSession?.token) {
      return this.cachedSession.token;
    }
    return AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    if (this.cachedSession?.user) {
      return this.cachedSession.user;
    }

    const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Get current settingId
   * @returns {Promise<string|null>}
   */
  async getSettingId() {
    if (this.cachedSession?.settingId) {
      return this.cachedSession.settingId;
    }
    return AsyncStorage.getItem(STORAGE_KEYS.SETTING_ID);
  }

  /**
   * Destroy session (logout)
   * @returns {Promise<void>}
   */
  async destroySession() {
    try {
      console.log('[SessionManager] Destroying session...');

      // Clear all session-related storage
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.SETTING_ID),
        AsyncStorage.removeItem(STORAGE_KEYS.SETTING_ID_ALT),
        AsyncStorage.removeItem(STORAGE_KEYS.SHOULD_CHECK_SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT),
        AsyncStorage.removeItem(STORAGE_KEYS.TIMEZONE),
        AsyncStorage.removeItem('selectedFolderId'),
        AsyncStorage.removeItem('notifiedThresholds'),
      ]);

      // Clear cache
      this.cachedSession = null;

      console.log('[SessionManager] Session destroyed successfully');
    } catch (error) {
      console.error('[SessionManager] Error destroying session:', error);
      // Still clear cache even on error
      this.cachedSession = null;
    }
  }

  /**
   * Handle session expiration (called when server returns 401)
   * This is only called for genuine session invalidation, not network errors
   * @param {string} reason - Reason for expiration
   */
  async handleSessionExpired(reason = 'unknown') {
    console.log('[SessionManager] Session expired:', reason);

    // Mark session as invalid but don't clear storage yet
    // Let the app decide what to do (show dialog, redirect to login, etc.)
    const sessionMeta = await this.getSessionMeta();
    if (sessionMeta) {
      sessionMeta.isValid = false;
      sessionMeta.expiredReason = reason;
      sessionMeta.expiredAt = Date.now();
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionMeta));
    }

    // Notify callback if registered
    if (this.onSessionExpiredCallback) {
      this.onSessionExpiredCallback(reason);
    }
  }

  /**
   * Register callback for session expiration
   * @param {Function} callback - Callback function
   */
  onSessionExpired(callback) {
    this.onSessionExpiredCallback = callback;
  }

  /**
   * Check if should verify session with server
   * (Limits server calls to once per hour)
   * @returns {Promise<boolean>}
   */
  async shouldVerifyWithServer() {
    try {
      const checkStr = await AsyncStorage.getItem(STORAGE_KEYS.SHOULD_CHECK_SESSION);
      if (!checkStr) return true;

      const { timestamp } = JSON.parse(checkStr);
      const oneHour = 60 * 60 * 1000;

      return !timestamp || (Date.now() - timestamp) > oneHour;
    } catch (error) {
      return true;
    }
  }

  /**
   * Mark session as verified with server
   * @returns {Promise<void>}
   */
  async markSessionVerified() {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SHOULD_CHECK_SESSION,
      JSON.stringify({ status: true, timestamp: Date.now() })
    );
  }

  /**
   * Get cached session (synchronous, from memory)
   * @returns {Object|null}
   */
  getCachedSession() {
    return this.cachedSession;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

export default sessionManager;
