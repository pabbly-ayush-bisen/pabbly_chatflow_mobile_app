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
      return session;
    } catch (error) {
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

      // Store token
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      }

      // Store user data
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
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
    } catch (error) {
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
    } catch (error) {
      // Error updating session
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

      const user = userStr ? JSON.parse(userStr) : null;
      const sessionMeta = sessionMetaStr ? JSON.parse(sessionMetaStr) : {};

      // Return session if we have token OR user data
      // User data without token means cookie-based session that needs verification
      if (!token && !user) {
        return null;
      }

      return {
        token,
        user,
        settingId,
        tokenExpiresAt: tokenExpiresAt ? parseInt(tokenExpiresAt, 10) : null,
        ...sessionMeta,
      };
    } catch (error) {
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

      // Check token expiry - enforce locally for security
      const tokenExpiresAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      if (tokenExpiresAt) {
        const expiryTime = parseInt(tokenExpiresAt, 10) * 1000; // Convert to ms
        if (Date.now() > expiryTime) {
          // Token expired - clear session for security
          await this.destroySession();
          return false;
        }
      }

      return true;
    } catch (error) {
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
    } catch (error) {
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
