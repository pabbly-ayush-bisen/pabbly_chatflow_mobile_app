/**
 * FCM Service for Pabbly ChatFlow
 *
 * This service handles:
 * 1. Getting FCM device token
 * 2. Registering token with notification server
 * 3. Handling FCM notification responses
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Notification server URL - change this to your deployed notification server URL
const NOTIFICATION_SERVER_URL = __DEV__
  ? 'http://192.168.1.21:3001' // Local development - your computer's IP
  : 'https://pabbly-notification-server.onrender.com'; // Production URL

// Storage keys
const FCM_TOKEN_KEY = '@pabbly_fcm_token';
const FCM_TOKEN_SENT_KEY = '@pabbly_fcm_token_sent';

/**
 * Get the native FCM/APNs token (not Expo push token)
 * This token is required for FCM to work when app is killed
 *
 * - Android: Returns FCM token directly
 * - iOS: Returns APNs token (Firebase uses this via APNs)
 */
export const getDevicePushToken = async () => {
  try {
    if (!Device.isDevice) {
      console.log('[FCM] Not a physical device, skipping');
      return null;
    }

    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      // iOS requires specific permission options
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[FCM] Notification permission not granted');
      return null;
    }

    // Get native device push token (FCM for Android, APNs for iOS)
    // Firebase Admin SDK can send to both using these tokens
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    const tokenType = tokenData.type; // 'android' or 'ios'

    console.log(`[FCM] ${Platform.OS.toUpperCase()} push token obtained (${tokenType}):`, token.substring(0, 20) + '...');

    // Store token locally
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);

    return token;
  } catch (error) {
    console.error('[FCM] Error getting device push token:', error);
    return null;
  }
};

// Track retry timeout for FCM registration
let retryTimeout = null;

/**
 * Register FCM token with the notification server
 * @param {number} retryCount - Current retry attempt (internal use)
 */
export const registerFCMToken = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000]; // Exponential backoff

  try {
    // Get FCM token
    const fcmToken = await getDevicePushToken();
    if (!fcmToken) {
      console.log('[FCM] No token available');
      return false;
    }

    // Get user info
    const userStr = await AsyncStorage.getItem('@pabbly_chatflow_user');
    const user = userStr ? JSON.parse(userStr) : null;

    // Get settingId
    let settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');
    if (!settingId) {
      settingId = await AsyncStorage.getItem('settingId');
    }

    if (!user?._id || !settingId) {
      console.log(`[FCM] Missing user or settingId (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

      // Retry with delay if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 30000;
        console.log(`[FCM] Will retry in ${delay / 1000}s...`);

        // Clear any existing timeout
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }

        retryTimeout = setTimeout(() => {
          registerFCMToken(retryCount + 1);
        }, delay);
      }
      return false;
    }

    // Clear any pending retry
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    // Check if we already sent this token for this user/setting combo
    const tokenSentKey = `${FCM_TOKEN_SENT_KEY}_${user._id}_${settingId}`;
    const previousToken = await AsyncStorage.getItem(tokenSentKey);

    if (previousToken === fcmToken) {
      console.log('[FCM] Token already registered, skipping');
      return true;
    }

    // Send token to notification server
    console.log('[FCM] Registering token with notification server...');
    console.log(`[FCM] User: ${user._id}, Setting: ${settingId}`);

    const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user._id,
        settingId: settingId,
        fcmToken: fcmToken,
        platform: Platform.OS,
        deviceName: Device.deviceName || 'Unknown Device',
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[FCM] Token registered successfully!');
      await AsyncStorage.setItem(tokenSentKey, fcmToken);
      return true;
    } else {
      console.error('[FCM] Failed to register token:', result.error);
      return false;
    }
  } catch (error) {
    console.error('[FCM] Error registering FCM token:', error);
    return false;
  }
};

/**
 * Force re-register FCM token (call when settingId changes)
 */
export const forceRegisterFCMToken = async () => {
  console.log('[FCM] Force registering token...');
  // Clear any pending retry and start fresh
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  return registerFCMToken(0);
};

/**
 * Unregister FCM token (call on logout)
 */
export const unregisterFCMToken = async () => {
  try {
    const fcmToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);

    if (!fcmToken) {
      return true;
    }

    const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/unregister-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fcmToken: fcmToken,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[FCM] Token unregistered successfully');

      // Clear stored token sent flags
      const keys = await AsyncStorage.getAllKeys();
      const tokenSentKeys = keys.filter(k => k.startsWith(FCM_TOKEN_SENT_KEY));
      await AsyncStorage.multiRemove(tokenSentKeys);

      return true;
    }

    return false;
  } catch (error) {
    console.error('[FCM] Error unregistering token:', error);
    return false;
  }
};

/**
 * Initialize FCM service
 * Call this after user logs in and settingId is set
 */
export const initializeFCM = async () => {
  try {
    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        description: 'Notifications for new messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#25D366',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });
    }

    // Register FCM token with notification server
    await registerFCMToken();

    console.log('[FCM] Service initialized');
    return true;
  } catch (error) {
    console.error('[FCM] Initialization error:', error);
    return false;
  }
};

/**
 * Get notification server URL (for debugging)
 */
export const getNotificationServerURL = () => NOTIFICATION_SERVER_URL;

/**
 * Test notification (for debugging)
 */
export const sendTestNotification = async () => {
  try {
    const fcmToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);

    if (!fcmToken) {
      console.error('[FCM] No token available for test');
      return false;
    }

    const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/test-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fcmToken: fcmToken,
        title: 'Test Notification',
        body: 'FCM is working! You will receive notifications even when app is closed.',
      }),
    });

    const result = await response.json();
    console.log('[FCM] Test notification result:', result);
    return result.success;
  } catch (error) {
    console.error('[FCM] Test notification error:', error);
    return false;
  }
};

export default {
  getDevicePushToken,
  registerFCMToken,
  forceRegisterFCMToken,
  unregisterFCMToken,
  initializeFCM,
  getNotificationServerURL,
  sendTestNotification,
};
