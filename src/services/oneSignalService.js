import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { APP_CONFIG } from '../config/app.config';

/**
 * OneSignal Push Notification Service
 * Handles initialization, user management, and notification events
 *
 * NOTE: OneSignal only works in development/production builds, NOT in Expo Go
 */

// Check if running in Expo Go (OneSignal won't work there)
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically import OneSignal only when not in Expo Go
let OneSignal = null;
let LogLevel = null;

if (!isExpoGo) {
  try {
    const onesignal = require('react-native-onesignal');
    OneSignal = onesignal.OneSignal;
    LogLevel = onesignal.LogLevel;
  } catch (error) {
    console.log('[OneSignal] Failed to load OneSignal module:', error.message);
  }
}

// Flag to track initialization
let isInitialized = false;

/**
 * Check if OneSignal is available (not in Expo Go)
 */
export const isOneSignalAvailable = () => {
  return !isExpoGo && OneSignal !== null;
};

/**
 * Initialize OneSignal
 * Call this once when app starts (in App.js)
 */
export const initializeOneSignal = () => {
  if (isExpoGo) {
    console.log('[OneSignal] Skipping initialization - running in Expo Go');
    return;
  }

  if (!OneSignal) {
    console.log('[OneSignal] OneSignal module not available');
    return;
  }

  if (isInitialized) {
    console.log('[OneSignal] Already initialized');
    return;
  }

  try {
    // Set log level for debugging (only in development)
    if (__DEV__ && LogLevel) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }

    // Initialize with App ID from config
    const appId = APP_CONFIG.oneSignalAppId;

    if (!appId) {
      console.error('[OneSignal] App ID not configured!');
      return;
    }

    OneSignal.initialize(appId);
    isInitialized = true;

    console.log('[OneSignal] Initialized successfully with App ID:', appId);
  } catch (error) {
    console.error('[OneSignal] Initialization error:', error);
  }
};

/**
 * Request push notification permission
 * Call this after initialization
 */
export const requestNotificationPermission = async () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    console.log('[OneSignal] Skipping permission request - not available');
    return false;
  }

  try {
    const granted = await OneSignal.Notifications.requestPermission(true);
    console.log('[OneSignal] Permission granted:', granted);
    return granted;
  } catch (error) {
    console.error('[OneSignal] Permission request error:', error);
    return false;
  }
};

/**
 * Set external user ID (link OneSignal user to your backend user)
 * Call this after user logs in
 *
 * @param {string} userId - Your backend user ID
 * @param {string} settingId - The settingId for the workspace
 */
export const setOneSignalExternalUserId = async (userId, settingId) => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return;
  }

  try {
    if (!userId) {
      console.warn('[OneSignal] No user ID provided');
      return;
    }

    // Login with external user ID - this links OneSignal subscription to your user
    OneSignal.login(userId);

    // Set tags for targeting (useful for sending to specific workspaces)
    OneSignal.User.addTags({
      settingId: settingId || '',
      platform: Platform.OS,
      appVersion: APP_CONFIG.appVersion,
    });

    console.log('[OneSignal] External user ID set:', userId);

    // Send player ID to backend after setting user
    setTimeout(async () => {
      const playerId = await getOneSignalPlayerId();
      if (playerId) {
        await sendPlayerIdToBackend(playerId);
      }
    }, 1000); // Small delay to ensure subscription is ready

  } catch (error) {
    console.error('[OneSignal] Error setting external user ID:', error);
  }
};

/**
 * Remove external user ID (call on logout)
 */
export const removeOneSignalExternalUserId = () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return;
  }

  try {
    OneSignal.logout();
    console.log('[OneSignal] User logged out from OneSignal');
  } catch (error) {
    console.error('[OneSignal] Error logging out:', error);
  }
};

/**
 * Get OneSignal Subscription ID (Player ID)
 * This is the unique device identifier for push notifications
 *
 * @returns {Promise<string|null>} OneSignal Player/Subscription ID
 */
export const getOneSignalPlayerId = async () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return null;
  }

  try {
    const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
    console.log('[OneSignal] Player ID:', subscriptionId);
    return subscriptionId;
  } catch (error) {
    console.error('[OneSignal] Error getting player ID:', error);
    return null;
  }
};

/**
 * Check if push notifications are enabled
 *
 * @returns {Promise<boolean>} Whether push is enabled
 */
export const isPushEnabled = async () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return false;
  }

  try {
    const optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();
    return optedIn;
  } catch (error) {
    console.error('[OneSignal] Error checking push status:', error);
    return false;
  }
};

/**
 * Send OneSignal Player ID to your backend
 * Uses session-based authentication (cookies)
 *
 * @param {string} playerId - OneSignal Player/Subscription ID
 */
export const sendPlayerIdToBackend = async (playerId) => {
  try {
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    if (!settingId) {
      console.log('[OneSignal] Missing settingId, skipping backend sync');
      return;
    }

    if (!playerId) {
      console.log('[OneSignal] No player ID to send');
      return;
    }

    const response = await fetch(`${APP_CONFIG.apiUrl}/settings/onesignal-player-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session cookies
      body: JSON.stringify({
        playerId,
        platform: Platform.OS,
      }),
    });

    if (response.ok) {
      console.log('[OneSignal] Player ID sent to backend successfully');
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OneSignal] Failed to send player ID to backend:', response.status, errorData);
    }
  } catch (error) {
    console.error('[OneSignal] Error sending player ID to backend:', error);
  }
};

/**
 * Remove player ID from backend (call on logout)
 * Uses session-based authentication (cookies)
 *
 * @param {string} playerId - OneSignal Player/Subscription ID
 */
export const removePlayerIdFromBackend = async (playerId) => {
  try {
    if (!playerId) {
      return;
    }

    await fetch(`${APP_CONFIG.apiUrl}/settings/onesignal-player-id`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session cookies
      body: JSON.stringify({ playerId }),
    });

    console.log('[OneSignal] Player ID removed from backend');
  } catch (error) {
    console.error('[OneSignal] Error removing player ID from backend:', error);
  }
};

/**
 * Setup notification click handler
 * Called when user taps on a notification
 *
 * @param {Function} onNotificationClicked - Callback with notification data
 * @returns {Function|null} Cleanup function to remove listener
 */
export const setupNotificationClickHandler = (onNotificationClicked) => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return null;
  }

  const handleClick = (event) => {
    const data = event.notification.additionalData;
    console.log('[OneSignal] Notification clicked:', data);

    if (onNotificationClicked) {
      onNotificationClicked(data);
    }
  };

  OneSignal.Notifications.addEventListener('click', handleClick);

  // Return cleanup function
  return () => {
    OneSignal.Notifications.removeEventListener('click', handleClick);
  };
};

/**
 * Setup foreground notification handler
 * Called when notification is received while app is in foreground
 *
 * @param {Function} onNotificationReceived - Callback with notification
 * @returns {Function|null} Cleanup function to remove listener
 */
export const setupForegroundNotificationHandler = (onNotificationReceived) => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return null;
  }

  const handleForeground = (event) => {
    const notification = event.getNotification();
    console.log('[OneSignal] Foreground notification received:', notification);

    // Display the notification (default behavior)
    event.getNotification().display();

    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  };

  OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleForeground);

  // Return cleanup function
  return () => {
    OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handleForeground);
  };
};

/**
 * Setup subscription change listener
 * Called when push subscription state changes (e.g., token refresh)
 *
 * @returns {Function|null} Cleanup function to remove listener
 */
export const setupSubscriptionListener = () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return null;
  }

  const handleChange = async (subscription) => {
    console.log('[OneSignal] Subscription changed:', subscription);

    // If new subscription ID available, send to backend
    if (subscription.current?.id) {
      await sendPlayerIdToBackend(subscription.current.id);
    }
  };

  OneSignal.User.pushSubscription.addEventListener('change', handleChange);

  // Return cleanup function
  return () => {
    OneSignal.User.pushSubscription.removeEventListener('change', handleChange);
  };
};

/**
 * Add a tag to the user (for segmentation)
 *
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
export const addTag = (key, value) => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return;
  }

  try {
    OneSignal.User.addTag(key, value);
    console.log('[OneSignal] Tag added:', key, value);
  } catch (error) {
    console.error('[OneSignal] Error adding tag:', error);
  }
};

/**
 * Remove a tag from the user
 *
 * @param {string} key - Tag key to remove
 */
export const removeTag = (key) => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return;
  }

  try {
    OneSignal.User.removeTag(key);
    console.log('[OneSignal] Tag removed:', key);
  } catch (error) {
    console.error('[OneSignal] Error removing tag:', error);
  }
};

/**
 * Clear all notifications from notification center
 */
export const clearAllNotifications = () => {
  if (!isOneSignalAvailable() || !isInitialized) {
    return;
  }

  try {
    OneSignal.Notifications.clearAll();
    console.log('[OneSignal] All notifications cleared');
  } catch (error) {
    console.error('[OneSignal] Error clearing notifications:', error);
  }
};

export default {
  isOneSignalAvailable,
  initializeOneSignal,
  requestNotificationPermission,
  setOneSignalExternalUserId,
  removeOneSignalExternalUserId,
  getOneSignalPlayerId,
  isPushEnabled,
  sendPlayerIdToBackend,
  removePlayerIdFromBackend,
  setupNotificationClickHandler,
  setupForegroundNotificationHandler,
  setupSubscriptionListener,
  addTag,
  removeTag,
  clearAllNotifications,
};
