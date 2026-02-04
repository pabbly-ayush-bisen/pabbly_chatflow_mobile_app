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
      // Set default notification icon to use app's configured icons
      // The icons are configured in app.config.js via onesignal-expo-plugin
      // smallIcons and largeIcons settings
    }

    // Request permission on iOS
    if (Platform.OS === 'ios') {
      OneSignal.Notifications.requestPermission(true);
    }

  } catch (error) {
    // OneSignal not available (running in Expo Go)
    OneSignal = null;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!OneSignal) return false;

  try {
    const permission = await OneSignal.Notifications.requestPermission(true);
    return permission;
  } catch (error) {
    return false;
  }
};

// Setup notification click handler
export const setupNotificationClickHandler = (callback) => {
  if (!OneSignal) return null;

  try {
    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = event.notification.additionalData;
      if (callback && data) {
        callback(data);
      }
    });

    // Return cleanup function
    return () => {
      OneSignal.Notifications.removeEventListener('click');
    };
  } catch (error) {
    return null;
  }
};

// Setup foreground notification handler
export const setupForegroundNotificationHandler = (callback) => {
  if (!OneSignal) return null;

  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      // Allow notification to display
      event.preventDefault();
      event.notification.display();

      if (callback) {
        callback(event.notification);
      }
    });

    // Return cleanup function
    return () => {
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
    };
  } catch (error) {
    return null;
  }
};

// Setup subscription listener (for token changes)
export const setupSubscriptionListener = () => {
  if (!OneSignal) return null;

  try {
    OneSignal.User.pushSubscription.addEventListener('change', async (subscription) => {
      const pushToken = subscription.current.token;

      if (pushToken) {
        // Send token to backend
        await sendPushTokenToServer(pushToken);
      }
    });

    // Return cleanup function
    return () => {
      OneSignal.User.pushSubscription.removeEventListener('change');
    };
  } catch (error) {
    return null;
  }
};

// Send push token to backend server
const sendPushTokenToServer = async (token) => {
  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    if (!authToken || !settingId) {
      return;
    }

    await fetch(`${APP_CONFIG.apiUrl}/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        provider: 'onesignal',
      }),
    });
  } catch (error) {
    // Error sending push token
  }
};

// Get OneSignal player ID
export const getPlayerId = async () => {
  if (!OneSignal) return null;

  try {
    const deviceState = await OneSignal.User.pushSubscription.getIdAsync();
    return deviceState;
  } catch (error) {
    return null;
  }
};

// Set external user ID (for targeting specific users)
export const setExternalUserId = async (userId) => {
  if (!OneSignal) return;

  try {
    OneSignal.login(userId);
  } catch (error) {
    // Error setting external user ID
  }
};

// Remove external user ID (on logout)
export const removeExternalUserId = async () => {
  if (!OneSignal) return;

  try {
    OneSignal.logout();
  } catch (error) {
    // Error removing external user ID
  }
};

// Set notification tags (for segmentation)
export const setTags = async (tags) => {
  if (!OneSignal) return;

  try {
    OneSignal.User.addTags(tags);
  } catch (error) {
    // Error setting tags
  }
};

export default {
  initializeOneSignal,
  isOneSignalAvailable,
  requestNotificationPermission,
  setupNotificationClickHandler,
  setupForegroundNotificationHandler,
  setupSubscriptionListener,
  getPlayerId,
  setExternalUserId,
  removeExternalUserId,
  setTags,
};
