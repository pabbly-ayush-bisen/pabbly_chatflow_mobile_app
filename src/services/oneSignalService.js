import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

// Debug logging prefix for easy filtering in console
const LOG_PREFIX = '[OneSignal Debug]';

// OneSignal SDK - conditionally imported to avoid Expo Go crashes
let OneSignal = null;

// Check if OneSignal is available (not in Expo Go)
export const isOneSignalAvailable = () => {
  const available = OneSignal !== null;
  console.log(`${LOG_PREFIX} isOneSignalAvailable: ${available}`);
  return available;
};

// Initialize OneSignal
export const initializeOneSignal = () => {
  console.log(`${LOG_PREFIX} ========================================`);
  console.log(`${LOG_PREFIX} Initializing OneSignal...`);
  console.log(`${LOG_PREFIX} Platform: ${Platform.OS}`);
  console.log(`${LOG_PREFIX} App ID: ${APP_CONFIG.oneSignalAppId}`);
  console.log(`${LOG_PREFIX} ========================================`);

  try {
    // Try to import OneSignal - will fail in Expo Go
    OneSignal = require('react-native-onesignal').default;
    console.log(`${LOG_PREFIX} OneSignal SDK imported successfully`);

    // Initialize with App ID
    OneSignal.initialize(APP_CONFIG.oneSignalAppId);
    console.log(`${LOG_PREFIX} OneSignal.initialize() called`);

    // Configure notification settings for Android
    if (Platform.OS === 'android') {
      console.log(`${LOG_PREFIX} Requesting Android notification permission...`);
      OneSignal.Notifications.requestPermission(true)
        .then((granted) => {
          console.log(`${LOG_PREFIX} Android permission result: ${granted}`);
        })
        .catch((err) => {
          console.log(`${LOG_PREFIX} Android permission error:`, err);
        });
    }

    // Request permission on iOS
    if (Platform.OS === 'ios') {
      console.log(`${LOG_PREFIX} Requesting iOS notification permission...`);
      OneSignal.Notifications.requestPermission(true)
        .then((granted) => {
          console.log(`${LOG_PREFIX} iOS permission result: ${granted}`);
        })
        .catch((err) => {
          console.log(`${LOG_PREFIX} iOS permission error:`, err);
        });
    }

    console.log(`${LOG_PREFIX} Initialization complete!`);
  } catch (error) {
    console.log(`${LOG_PREFIX} ========================================`);
    console.log(`${LOG_PREFIX} INITIALIZATION FAILED!`);
    console.log(`${LOG_PREFIX} Error:`, error.message);
    console.log(`${LOG_PREFIX} This is normal if running in Expo Go`);
    console.log(`${LOG_PREFIX} ========================================`);
    OneSignal = null;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  console.log(`${LOG_PREFIX} requestNotificationPermission called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} requestNotificationPermission: OneSignal not available`);
    return false;
  }

  try {
    console.log(`${LOG_PREFIX} Calling OneSignal.Notifications.requestPermission(true)...`);
    const permission = await OneSignal.Notifications.requestPermission(true);
    console.log(`${LOG_PREFIX} Permission request result: ${permission}`);
    return permission;
  } catch (error) {
    console.log(`${LOG_PREFIX} Permission request error:`, error.message);
    return false;
  }
};

// Setup notification click handler
export const setupNotificationClickHandler = (callback) => {
  console.log(`${LOG_PREFIX} setupNotificationClickHandler called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setupNotificationClickHandler: OneSignal not available`);
    return null;
  }

  try {
    console.log(`${LOG_PREFIX} Adding 'click' event listener...`);
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log(`${LOG_PREFIX} ========================================`);
      console.log(`${LOG_PREFIX} NOTIFICATION CLICKED!`);
      console.log(`${LOG_PREFIX} Event:`, JSON.stringify(event, null, 2));
      console.log(`${LOG_PREFIX} Notification Title:`, event?.notification?.title);
      console.log(`${LOG_PREFIX} Notification Body:`, event?.notification?.body);
      console.log(`${LOG_PREFIX} Additional Data:`, JSON.stringify(event?.notification?.additionalData, null, 2));
      console.log(`${LOG_PREFIX} ========================================`);

      const data = event.notification.additionalData;
      if (callback && data) {
        console.log(`${LOG_PREFIX} Calling click callback with data:`, data);
        callback(data);
      } else {
        console.log(`${LOG_PREFIX} No callback or no data, skipping callback`);
      }
    });

    console.log(`${LOG_PREFIX} Click handler registered successfully`);
    return () => {
      console.log(`${LOG_PREFIX} Removing click event listener`);
      OneSignal.Notifications.removeEventListener('click');
    };
  } catch (error) {
    console.log(`${LOG_PREFIX} setupNotificationClickHandler error:`, error.message);
    return null;
  }
};

// Setup foreground notification handler
export const setupForegroundNotificationHandler = (callback) => {
  console.log(`${LOG_PREFIX} setupForegroundNotificationHandler called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setupForegroundNotificationHandler: OneSignal not available`);
    return null;
  }

  try {
    console.log(`${LOG_PREFIX} Adding 'foregroundWillDisplay' event listener...`);
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log(`${LOG_PREFIX} ========================================`);
      console.log(`${LOG_PREFIX} FOREGROUND NOTIFICATION RECEIVED!`);
      console.log(`${LOG_PREFIX} Notification ID:`, event?.notification?.notificationId);
      console.log(`${LOG_PREFIX} Title:`, event?.notification?.title);
      console.log(`${LOG_PREFIX} Body:`, event?.notification?.body);
      console.log(`${LOG_PREFIX} Additional Data:`, JSON.stringify(event?.notification?.additionalData, null, 2));
      console.log(`${LOG_PREFIX} Full Notification:`, JSON.stringify(event?.notification, null, 2));
      console.log(`${LOG_PREFIX} ========================================`);

      if (callback) {
        console.log(`${LOG_PREFIX} Calling foreground callback`);
        callback(event.notification);
      }
      // Explicitly display the notification
      console.log(`${LOG_PREFIX} Calling event.notification.display() to show notification`);
      event.notification.display();
    });

    console.log(`${LOG_PREFIX} Foreground handler registered successfully`);
    return () => {
      console.log(`${LOG_PREFIX} Removing foregroundWillDisplay event listener`);
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
    };
  } catch (error) {
    console.log(`${LOG_PREFIX} setupForegroundNotificationHandler error:`, error.message);
    return null;
  }
};

// Setup subscription listener (for player ID changes)
export const setupSubscriptionListener = () => {
  console.log(`${LOG_PREFIX} setupSubscriptionListener called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setupSubscriptionListener: OneSignal not available`);
    return null;
  }

  try {
    console.log(`${LOG_PREFIX} Adding subscription 'change' event listener...`);
    OneSignal.User.pushSubscription.addEventListener('change', async (subscription) => {
      console.log(`${LOG_PREFIX} ========================================`);
      console.log(`${LOG_PREFIX} SUBSCRIPTION CHANGED!`);
      console.log(`${LOG_PREFIX} Previous Subscription:`, JSON.stringify(subscription.previous, null, 2));
      console.log(`${LOG_PREFIX} Current Subscription:`, JSON.stringify(subscription.current, null, 2));
      console.log(`${LOG_PREFIX} ========================================`);

      const playerId = subscription.current.id;
      console.log(`${LOG_PREFIX} Player ID from subscription:`, playerId);

      if (playerId) {
        console.log(`${LOG_PREFIX} Sending player ID to server...`);
        await sendPlayerIdToServer(playerId);
      } else {
        console.log(`${LOG_PREFIX} No player ID available, skipping server sync`);
      }
    });

    console.log(`${LOG_PREFIX} Subscription listener registered successfully`);
    return () => {
      console.log(`${LOG_PREFIX} Removing subscription change event listener`);
      OneSignal.User.pushSubscription.removeEventListener('change');
    };
  } catch (error) {
    console.log(`${LOG_PREFIX} setupSubscriptionListener error:`, error.message);
    return null;
  }
};

// Send OneSignal player ID to backend server
const sendPlayerIdToServer = async (playerId) => {
  console.log(`${LOG_PREFIX} sendPlayerIdToServer called`);
  console.log(`${LOG_PREFIX} Player ID:`, playerId);

  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    console.log(`${LOG_PREFIX} Auth Token exists:`, !!authToken);
    console.log(`${LOG_PREFIX} Setting ID:`, settingId);

    if (!authToken || !settingId) {
      console.log(`${LOG_PREFIX} Missing auth token or setting ID, skipping server sync`);
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
    const payload = {
      playerId,
      platform: Platform.OS,
    };

    console.log(`${LOG_PREFIX} Sending POST to:`, endpoint);
    console.log(`${LOG_PREFIX} Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));
    console.log(`${LOG_PREFIX} Server Response Status:`, response.status);
    console.log(`${LOG_PREFIX} Server Response:`, JSON.stringify(responseData, null, 2));
  } catch (error) {
    console.log(`${LOG_PREFIX} sendPlayerIdToServer error:`, error.message);
  }
};

// Get OneSignal player ID
export const getPlayerId = async () => {
  console.log(`${LOG_PREFIX} getPlayerId called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} getPlayerId: OneSignal not available`);
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    console.log(`${LOG_PREFIX} Current Player ID:`, playerId);
    return playerId;
  } catch (error) {
    console.log(`${LOG_PREFIX} getPlayerId error:`, error.message);
    return null;
  }
};

// Alias for getPlayerId (used by userSlice)
export const getOneSignalPlayerId = getPlayerId;

// Set external user ID (for targeting specific users)
export const setExternalUserId = async (userId) => {
  console.log(`${LOG_PREFIX} setExternalUserId called`);
  console.log(`${LOG_PREFIX} User ID:`, userId);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setExternalUserId: OneSignal not available`);
    return;
  }

  try {
    console.log(`${LOG_PREFIX} Calling OneSignal.login(${userId})...`);
    OneSignal.login(userId);
    console.log(`${LOG_PREFIX} OneSignal.login() completed`);
  } catch (error) {
    console.log(`${LOG_PREFIX} setExternalUserId error:`, error.message);
  }
};

// Set external user ID and register player ID with backend (used after login)
export const setOneSignalExternalUserId = async (userId, settingId) => {
  console.log(`${LOG_PREFIX} ========================================`);
  console.log(`${LOG_PREFIX} setOneSignalExternalUserId called`);
  console.log(`${LOG_PREFIX} User ID:`, userId);
  console.log(`${LOG_PREFIX} Setting ID:`, settingId);
  console.log(`${LOG_PREFIX} ========================================`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setOneSignalExternalUserId: OneSignal not available`);
    return;
  }

  try {
    // Set external user ID with OneSignal
    console.log(`${LOG_PREFIX} Calling OneSignal.login(${userId})...`);
    OneSignal.login(userId);
    console.log(`${LOG_PREFIX} OneSignal.login() completed`);

    // Wait a moment for the subscription to be established
    console.log(`${LOG_PREFIX} Waiting 1 second for subscription to establish...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the player ID (subscription ID)
    console.log(`${LOG_PREFIX} Getting player ID...`);
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    console.log(`${LOG_PREFIX} Player ID obtained:`, playerId);

    if (playerId) {
      // Get auth token
      const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      const storedSettingId = settingId || await AsyncStorage.getItem('@pabbly_chatflow_settingId');

      console.log(`${LOG_PREFIX} Auth Token exists:`, !!authToken);
      console.log(`${LOG_PREFIX} Stored Setting ID:`, storedSettingId);

      if (authToken && storedSettingId) {
        const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
        const payload = {
          playerId,
          platform: Platform.OS,
        };

        console.log(`${LOG_PREFIX} Registering player ID with backend...`);
        console.log(`${LOG_PREFIX} Endpoint:`, endpoint);
        console.log(`${LOG_PREFIX} Payload:`, JSON.stringify(payload, null, 2));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            settingId: storedSettingId,
          },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json().catch(() => ({}));
        console.log(`${LOG_PREFIX} Backend Response Status:`, response.status);
        console.log(`${LOG_PREFIX} Backend Response:`, JSON.stringify(responseData, null, 2));
      } else {
        console.log(`${LOG_PREFIX} Missing auth token or setting ID, skipping backend registration`);
      }
    } else {
      console.log(`${LOG_PREFIX} No player ID available, attempting permission request...`);
      // Try requesting permission again
      const permission = await requestNotificationPermission();
      console.log(`${LOG_PREFIX} Permission request result:`, permission);

      if (permission) {
        // Try getting player ID again after permission
        console.log(`${LOG_PREFIX} Waiting 1 second after permission...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryPlayerId = await OneSignal.User.pushSubscription.getIdAsync();
        console.log(`${LOG_PREFIX} Retry Player ID:`, retryPlayerId);

        if (retryPlayerId) {
          console.log(`${LOG_PREFIX} Retrying setOneSignalExternalUserId...`);
          await setOneSignalExternalUserId(userId, settingId);
        } else {
          console.log(`${LOG_PREFIX} Still no player ID after retry`);
        }
      } else {
        console.log(`${LOG_PREFIX} Permission not granted, cannot get player ID`);
      }
    }
  } catch (error) {
    console.log(`${LOG_PREFIX} setOneSignalExternalUserId error:`, error.message);
    console.log(`${LOG_PREFIX} Error stack:`, error.stack);
  }
};

// Remove external user ID (on logout)
export const removeExternalUserId = async () => {
  console.log(`${LOG_PREFIX} removeExternalUserId called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} removeExternalUserId: OneSignal not available`);
    return;
  }

  try {
    console.log(`${LOG_PREFIX} Calling OneSignal.logout()...`);
    OneSignal.logout();
    console.log(`${LOG_PREFIX} OneSignal.logout() completed`);
  } catch (error) {
    console.log(`${LOG_PREFIX} removeExternalUserId error:`, error.message);
  }
};

// Alias for removeExternalUserId (used by userSlice)
export const removeOneSignalExternalUserId = removeExternalUserId;

// Remove player ID from backend (called on logout)
export const removePlayerIdFromBackend = async (playerId) => {
  console.log(`${LOG_PREFIX} removePlayerIdFromBackend called`);
  console.log(`${LOG_PREFIX} Player ID to remove:`, playerId);

  if (!playerId) {
    console.log(`${LOG_PREFIX} No player ID provided, skipping removal`);
    return;
  }

  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    console.log(`${LOG_PREFIX} Auth Token exists:`, !!authToken);
    console.log(`${LOG_PREFIX} Setting ID:`, settingId);

    if (!authToken || !settingId) {
      console.log(`${LOG_PREFIX} Missing auth token or setting ID, skipping removal`);
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;

    console.log(`${LOG_PREFIX} Sending DELETE to:`, endpoint);
    console.log(`${LOG_PREFIX} Payload:`, JSON.stringify({ playerId }, null, 2));

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify({ playerId }),
    });

    const responseData = await response.json().catch(() => ({}));
    console.log(`${LOG_PREFIX} DELETE Response Status:`, response.status);
    console.log(`${LOG_PREFIX} DELETE Response:`, JSON.stringify(responseData, null, 2));
  } catch (error) {
    console.log(`${LOG_PREFIX} removePlayerIdFromBackend error:`, error.message);
  }
};

// Set notification tags (for segmentation)
export const setTags = async (tags) => {
  console.log(`${LOG_PREFIX} setTags called`);
  console.log(`${LOG_PREFIX} Tags:`, JSON.stringify(tags, null, 2));

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} setTags: OneSignal not available`);
    return;
  }

  try {
    console.log(`${LOG_PREFIX} Calling OneSignal.User.addTags()...`);
    OneSignal.User.addTags(tags);
    console.log(`${LOG_PREFIX} Tags added successfully`);
  } catch (error) {
    console.log(`${LOG_PREFIX} setTags error:`, error.message);
  }
};

// Debug function to log current OneSignal state
export const logCurrentState = async () => {
  console.log(`${LOG_PREFIX} ========================================`);
  console.log(`${LOG_PREFIX} LOGGING CURRENT ONESIGNAL STATE`);
  console.log(`${LOG_PREFIX} ========================================`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal SDK not loaded`);
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    const token = await OneSignal.User.pushSubscription.getTokenAsync();
    const optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();

    const state = { playerId, token, optedIn };

    console.log(`${LOG_PREFIX} Player ID:`, playerId);
    console.log(`${LOG_PREFIX} Push Token:`, token);
    console.log(`${LOG_PREFIX} Opted In:`, optedIn);
    console.log(`${LOG_PREFIX} Full State:`, JSON.stringify(state, null, 2));
    console.log(`${LOG_PREFIX} ========================================`);

    return state;
  } catch (error) {
    console.log(`${LOG_PREFIX} logCurrentState error:`, error.message);
    return null;
  }
};

// Test function to send a test notification (for debugging)
export const sendTestNotification = async () => {
  console.log(`${LOG_PREFIX} sendTestNotification called`);
  const state = await logCurrentState();
  const isReady = !!state?.playerId;
  console.log(`${LOG_PREFIX} Ready to receive notifications:`, isReady);
  return isReady;
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
