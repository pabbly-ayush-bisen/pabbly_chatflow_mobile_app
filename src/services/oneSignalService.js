import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

// OneSignal SDK - conditionally imported to avoid Expo Go crashes
let OneSignal = null;

// Check if OneSignal is available (not in Expo Go)
export const isOneSignalAvailable = () => {
  return OneSignal !== null;
};

// Initialize OneSignal
export const initializeOneSignal = () => {
  try {
    // Try to import OneSignal - will fail in Expo Go
    OneSignal = require('react-native-onesignal').default;

    // Initialize with App ID
    OneSignal.initialize(APP_CONFIG.oneSignalAppId);

    // Configure notification settings for Android
    if (Platform.OS === 'android') {
      OneSignal.Notifications.requestPermission(true).catch(() => {});
    }

    // Request permission on iOS
    if (Platform.OS === 'ios') {
      OneSignal.Notifications.requestPermission(true).catch(() => {});
    }
  } catch (error) {
    OneSignal = null;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!OneSignal) {
    return false;
  }

  try {
    const permission = await OneSignal.Notifications.requestPermission(true);
    return permission;
  } catch (error) {
    return false;
  }
};

// Setup notification click handler
export const setupNotificationClickHandler = (callback) => {
  if (!OneSignal) {
    return null;
  }

  try {
    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = event.notification.additionalData;
      if (callback && data) {
        callback(data);
      }
    });

    return () => {
      OneSignal.Notifications.removeEventListener('click');
    };
  } catch (error) {
    return null;
  }
};

// Setup foreground notification handler
export const setupForegroundNotificationHandler = (callback) => {
  if (!OneSignal) {
    return null;
  }

  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      if (callback) {
        callback(event.notification);
      }
      // Explicitly display the notification
      event.notification.display();
    });

    return () => {
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
    };
  } catch (error) {
    return null;
  }
};

// Setup subscription listener (for player ID changes)
export const setupSubscriptionListener = () => {
  if (!OneSignal) {
    return null;
  }

  try {
    OneSignal.User.pushSubscription.addEventListener('change', async (subscription) => {
      const playerId = subscription.current.id;
      if (playerId) {
        await sendPlayerIdToServer(playerId);
      }
    });

    return () => {
      OneSignal.User.pushSubscription.removeEventListener('change');
    };
  } catch (error) {
    return null;
  }
};

// Send OneSignal player ID to backend server
const sendPlayerIdToServer = async (playerId) => {
  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    if (!authToken || !settingId) {
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
    const payload = {
      playerId,
      platform: Platform.OS,
    };

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Silently fail
  }
};

// Get OneSignal player ID
export const getPlayerId = async () => {
  if (!OneSignal) {
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    return playerId;
  } catch (error) {
    return null;
  }
};

// Alias for getPlayerId (used by userSlice)
export const getOneSignalPlayerId = getPlayerId;

// Set external user ID (for targeting specific users)
export const setExternalUserId = async (userId) => {
  if (!OneSignal) {
    return;
  }

  try {
    OneSignal.login(userId);
  } catch (error) {
    // Silently fail
  }
};

// Set external user ID and register player ID with backend (used after login)
export const setOneSignalExternalUserId = async (userId, settingId) => {
  if (!OneSignal) {
    return;
  }

  try {
    // Set external user ID with OneSignal
    OneSignal.login(userId);

    // Wait a moment for the subscription to be established
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the player ID (subscription ID)
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();

    if (playerId) {
      // Get auth token
      const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      const storedSettingId = settingId || await AsyncStorage.getItem('@pabbly_chatflow_settingId');

      if (authToken && storedSettingId) {
        const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
        const payload = {
          playerId,
          platform: Platform.OS,
        };

        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            settingId: storedSettingId,
          },
          body: JSON.stringify(payload),
        });
      }
    } else {
      // Try requesting permission again
      const permission = await requestNotificationPermission();

      if (permission) {
        // Try getting player ID again after permission
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryPlayerId = await OneSignal.User.pushSubscription.getIdAsync();

        if (retryPlayerId) {
          await setOneSignalExternalUserId(userId, settingId);
        }
      }
    }
  } catch (error) {
    // Silently fail
  }
};

// Remove external user ID (on logout)
export const removeExternalUserId = async () => {
  if (!OneSignal) {
    return;
  }

  try {
    OneSignal.logout();
  } catch (error) {
    // Silently fail
  }
};

// Alias for removeExternalUserId (used by userSlice)
export const removeOneSignalExternalUserId = removeExternalUserId;

// Remove player ID from backend (called on logout)
export const removePlayerIdFromBackend = async (playerId) => {
  if (!playerId) {
    return;
  }

  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    if (!authToken || !settingId) {
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;

    await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify({ playerId }),
    });
  } catch (error) {
    // Silently fail
  }
};

// Set notification tags (for segmentation)
export const setTags = async (tags) => {
  if (!OneSignal) {
    return;
  }

  try {
    OneSignal.User.addTags(tags);
  } catch (error) {
    // Silently fail
  }
};

// Debug function to log current OneSignal state
export const logCurrentState = async () => {
  if (!OneSignal) {
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    const token = await OneSignal.User.pushSubscription.getTokenAsync();
    const optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();
    return { playerId, token, optedIn };
  } catch (error) {
    return null;
  }
};

// Test function to send a test notification (for debugging)
export const sendTestNotification = async () => {
  const state = await logCurrentState();
  return !!state?.playerId;
};

export default {
  initializeOneSignal,
  isOneSignalAvailable,
  requestNotificationPermission,
  setupNotificationClickHandler,
  setupForegroundNotificationHandler,
  setupSubscriptionListener,
  getPlayerId,
  getOneSignalPlayerId,
  setExternalUserId,
  setOneSignalExternalUserId,
  removeExternalUserId,
  removeOneSignalExternalUserId,
  removePlayerIdFromBackend,
  setTags,
  logCurrentState,
  sendTestNotification,
};
