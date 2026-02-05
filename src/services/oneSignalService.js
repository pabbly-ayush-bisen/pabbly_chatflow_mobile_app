import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

// OneSignal SDK - conditionally imported to avoid Expo Go crashes
let OneSignal = null;

// Logging prefix for easy filtering
const LOG_PREFIX = '[OneSignal]';

// Check if OneSignal is available (not in Expo Go)
export const isOneSignalAvailable = () => {
  const available = OneSignal !== null;
  console.log(`${LOG_PREFIX} isOneSignalAvailable:`, available);
  return available;
};

// Initialize OneSignal
export const initializeOneSignal = () => {
  console.log(`${LOG_PREFIX} Initializing OneSignal...`);
  console.log(`${LOG_PREFIX} App ID:`, APP_CONFIG.oneSignalAppId);
  console.log(`${LOG_PREFIX} Platform:`, Platform.OS);

  try {
    // Try to import OneSignal - will fail in Expo Go
    OneSignal = require('react-native-onesignal').default;
    console.log(`${LOG_PREFIX} OneSignal SDK imported successfully`);

    // Initialize with App ID
    OneSignal.initialize(APP_CONFIG.oneSignalAppId);
    console.log(`${LOG_PREFIX} OneSignal initialized with App ID`);

    // Set log level for debugging (0 = None, 1 = Fatal, 2 = Error, 3 = Warn, 4 = Info, 5 = Debug, 6 = Verbose)
    if (OneSignal.Debug) {
      OneSignal.Debug.setLogLevel(6); // Verbose logging
      console.log(`${LOG_PREFIX} Debug log level set to Verbose`);
    }

    // Configure notification settings for Android
    if (Platform.OS === 'android') {
      console.log(`${LOG_PREFIX} Android: Requesting notification permission...`);
      // Request notification permission on Android 13+ (API 33+)
      OneSignal.Notifications.requestPermission(true)
        .then((granted) => {
          console.log(`${LOG_PREFIX} Android notification permission granted:`, granted);
        })
        .catch((err) => {
          console.error(`${LOG_PREFIX} Android permission request error:`, err);
        });
    }

    // Request permission on iOS
    if (Platform.OS === 'ios') {
      console.log(`${LOG_PREFIX} iOS: Requesting notification permission...`);
      OneSignal.Notifications.requestPermission(true)
        .then((granted) => {
          console.log(`${LOG_PREFIX} iOS notification permission granted:`, granted);
        })
        .catch((err) => {
          console.error(`${LOG_PREFIX} iOS permission request error:`, err);
        });
    }

    // Log initial subscription state
    setTimeout(async () => {
      await logCurrentState();
    }, 2000);

  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to initialize OneSignal:`, error);
    console.log(`${LOG_PREFIX} This is expected if running in Expo Go`);
    OneSignal = null;
  }
};

// Debug function to log current OneSignal state
export const logCurrentState = async () => {
  if (!OneSignal) {
    console.log(`${LOG_PREFIX} Cannot log state - OneSignal not available`);
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    const token = await OneSignal.User.pushSubscription.getTokenAsync();
    const optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();

    console.log(`${LOG_PREFIX} ========== CURRENT STATE ==========`);
    console.log(`${LOG_PREFIX} Player ID (Subscription ID):`, playerId || 'NULL');
    console.log(`${LOG_PREFIX} Push Token:`, token ? `${token.substring(0, 20)}...` : 'NULL');
    console.log(`${LOG_PREFIX} Opted In:`, optedIn);
    console.log(`${LOG_PREFIX} ====================================`);

    return { playerId, token, optedIn };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting current state:`, error);
    return null;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  console.log(`${LOG_PREFIX} requestNotificationPermission called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available, returning false`);
    return false;
  }

  try {
    console.log(`${LOG_PREFIX} Requesting permission...`);
    const permission = await OneSignal.Notifications.requestPermission(true);
    console.log(`${LOG_PREFIX} Permission result:`, permission);

    // Check permission status
    const hasPermission = await OneSignal.Notifications.getPermissionAsync();
    console.log(`${LOG_PREFIX} Current permission status:`, hasPermission);

    return permission;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error requesting permission:`, error);
    return false;
  }
};

// Setup notification click handler
export const setupNotificationClickHandler = (callback) => {
  console.log(`${LOG_PREFIX} Setting up notification click handler...`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return null;
  }

  try {
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log(`${LOG_PREFIX} ========== NOTIFICATION CLICKED ==========`);
      console.log(`${LOG_PREFIX} Notification:`, JSON.stringify(event.notification, null, 2));
      console.log(`${LOG_PREFIX} Additional Data:`, JSON.stringify(event.notification.additionalData, null, 2));
      console.log(`${LOG_PREFIX} ==========================================`);

      const data = event.notification.additionalData;
      if (callback && data) {
        callback(data);
      }
    });

    console.log(`${LOG_PREFIX} Click handler registered successfully`);

    return () => {
      console.log(`${LOG_PREFIX} Removing click handler`);
      OneSignal.Notifications.removeEventListener('click');
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting up click handler:`, error);
    return null;
  }
};

// Setup foreground notification handler
export const setupForegroundNotificationHandler = (callback) => {
  console.log(`${LOG_PREFIX} Setting up foreground notification handler...`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return null;
  }

  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log(`${LOG_PREFIX} ========== FOREGROUND NOTIFICATION ==========`);
      console.log(`${LOG_PREFIX} Notification received in foreground`);
      console.log(`${LOG_PREFIX} Title:`, event.notification.title);
      console.log(`${LOG_PREFIX} Body:`, event.notification.body);
      console.log(`${LOG_PREFIX} Data:`, JSON.stringify(event.notification.additionalData, null, 2));
      console.log(`${LOG_PREFIX} =============================================`);

      if (callback) {
        callback(event.notification);
      }

      // Explicitly display the notification
      event.notification.display();
      console.log(`${LOG_PREFIX} Notification display() called`);
    });

    console.log(`${LOG_PREFIX} Foreground handler registered successfully`);

    return () => {
      console.log(`${LOG_PREFIX} Removing foreground handler`);
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting up foreground handler:`, error);
    return null;
  }
};

// Setup subscription listener (for player ID changes)
export const setupSubscriptionListener = () => {
  console.log(`${LOG_PREFIX} Setting up subscription listener...`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return null;
  }

  try {
    OneSignal.User.pushSubscription.addEventListener('change', async (subscription) => {
      console.log(`${LOG_PREFIX} ========== SUBSCRIPTION CHANGED ==========`);
      console.log(`${LOG_PREFIX} Previous state:`, JSON.stringify(subscription.previous, null, 2));
      console.log(`${LOG_PREFIX} Current state:`, JSON.stringify(subscription.current, null, 2));
      console.log(`${LOG_PREFIX} ==========================================`);

      // Get the player ID (subscription ID)
      const playerId = subscription.current.id;
      console.log(`${LOG_PREFIX} New Player ID:`, playerId);

      if (playerId) {
        console.log(`${LOG_PREFIX} Sending player ID to backend...`);
        await sendPlayerIdToServer(playerId);
      } else {
        console.log(`${LOG_PREFIX} No player ID available yet`);
      }
    });

    console.log(`${LOG_PREFIX} Subscription listener registered successfully`);

    return () => {
      console.log(`${LOG_PREFIX} Removing subscription listener`);
      OneSignal.User.pushSubscription.removeEventListener('change');
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting up subscription listener:`, error);
    return null;
  }
};

// Send OneSignal player ID to backend server
const sendPlayerIdToServer = async (playerId) => {
  console.log(`${LOG_PREFIX} sendPlayerIdToServer called with:`, playerId);

  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    console.log(`${LOG_PREFIX} Auth token exists:`, !!authToken);
    console.log(`${LOG_PREFIX} Setting ID:`, settingId);

    if (!authToken || !settingId) {
      console.log(`${LOG_PREFIX} Missing auth token or setting ID, skipping backend registration`);
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
    const payload = {
      playerId,
      platform: Platform.OS,
    };

    console.log(`${LOG_PREFIX} Sending to endpoint:`, endpoint);
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

    const responseText = await response.text();
    console.log(`${LOG_PREFIX} Backend response status:`, response.status);
    console.log(`${LOG_PREFIX} Backend response:`, responseText);

    if (response.ok) {
      console.log(`${LOG_PREFIX} Player ID successfully registered with backend`);
    } else {
      console.error(`${LOG_PREFIX} Failed to register player ID. Status:`, response.status);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending player ID to server:`, error);
  }
};

// Get OneSignal player ID
export const getPlayerId = async () => {
  console.log(`${LOG_PREFIX} getPlayerId called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return null;
  }

  try {
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    console.log(`${LOG_PREFIX} Current Player ID:`, playerId);
    return playerId;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting player ID:`, error);
    return null;
  }
};

// Alias for getPlayerId (used by userSlice)
export const getOneSignalPlayerId = getPlayerId;

// Set external user ID (for targeting specific users)
export const setExternalUserId = async (userId) => {
  console.log(`${LOG_PREFIX} setExternalUserId called with:`, userId);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return;
  }

  try {
    OneSignal.login(userId);
    console.log(`${LOG_PREFIX} External user ID set successfully`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting external user ID:`, error);
  }
};

// Set external user ID and register player ID with backend (used after login)
export const setOneSignalExternalUserId = async (userId, settingId) => {
  console.log(`${LOG_PREFIX} ========== REGISTERING DEVICE ==========`);
  console.log(`${LOG_PREFIX} User ID:`, userId);
  console.log(`${LOG_PREFIX} Setting ID:`, settingId);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available, skipping registration`);
    return;
  }

  try {
    // Set external user ID with OneSignal
    console.log(`${LOG_PREFIX} Calling OneSignal.login...`);
    OneSignal.login(userId);
    console.log(`${LOG_PREFIX} OneSignal.login completed`);

    // Wait a moment for the subscription to be established
    console.log(`${LOG_PREFIX} Waiting for subscription to be established...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the player ID (subscription ID)
    console.log(`${LOG_PREFIX} Getting player ID...`);
    const playerId = await OneSignal.User.pushSubscription.getIdAsync();
    console.log(`${LOG_PREFIX} Player ID retrieved:`, playerId);

    if (playerId) {
      // Get auth token
      const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
      const storedSettingId = settingId || await AsyncStorage.getItem('@pabbly_chatflow_settingId');

      console.log(`${LOG_PREFIX} Auth token exists:`, !!authToken);
      console.log(`${LOG_PREFIX} Stored Setting ID:`, storedSettingId);

      if (authToken && storedSettingId) {
        const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
        const payload = {
          playerId,
          platform: Platform.OS,
        };

        console.log(`${LOG_PREFIX} Registering with backend...`);
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

        const responseText = await response.text();
        console.log(`${LOG_PREFIX} Backend response status:`, response.status);
        console.log(`${LOG_PREFIX} Backend response:`, responseText);

        if (response.ok) {
          console.log(`${LOG_PREFIX} SUCCESS: Player ID registered with backend`);
        } else {
          console.error(`${LOG_PREFIX} FAILED: Could not register player ID. Status:`, response.status);
        }
      } else {
        console.log(`${LOG_PREFIX} Missing auth token or setting ID`);
      }
    } else {
      console.log(`${LOG_PREFIX} No player ID available - user may need to grant notification permission`);

      // Try requesting permission again
      console.log(`${LOG_PREFIX} Requesting notification permission...`);
      const permission = await requestNotificationPermission();
      console.log(`${LOG_PREFIX} Permission result:`, permission);

      // Try getting player ID again after permission
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retryPlayerId = await OneSignal.User.pushSubscription.getIdAsync();
      console.log(`${LOG_PREFIX} Retry Player ID:`, retryPlayerId);

      if (retryPlayerId) {
        // Recursively call to register
        console.log(`${LOG_PREFIX} Retrying registration with new player ID...`);
        await setOneSignalExternalUserId(userId, settingId);
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in setOneSignalExternalUserId:`, error);
  }

  console.log(`${LOG_PREFIX} =========================================`);
};

// Remove external user ID (on logout)
export const removeExternalUserId = async () => {
  console.log(`${LOG_PREFIX} removeExternalUserId called`);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return;
  }

  try {
    OneSignal.logout();
    console.log(`${LOG_PREFIX} External user ID removed (logged out)`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error removing external user ID:`, error);
  }
};

// Alias for removeExternalUserId (used by userSlice)
export const removeOneSignalExternalUserId = removeExternalUserId;

// Remove player ID from backend (called on logout)
export const removePlayerIdFromBackend = async (playerId) => {
  console.log(`${LOG_PREFIX} removePlayerIdFromBackend called with:`, playerId);

  if (!playerId) {
    console.log(`${LOG_PREFIX} No player ID provided, skipping`);
    return;
  }

  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    console.log(`${LOG_PREFIX} Auth token exists:`, !!authToken);
    console.log(`${LOG_PREFIX} Setting ID:`, settingId);

    if (!authToken || !settingId) {
      console.log(`${LOG_PREFIX} Missing auth token or setting ID, skipping`);
      return;
    }

    const endpoint = `${APP_CONFIG.apiUrl}/settings/onesignal-player-id`;
    console.log(`${LOG_PREFIX} Removing from endpoint:`, endpoint);

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify({
        playerId,
      }),
    });

    const responseText = await response.text();
    console.log(`${LOG_PREFIX} Backend response status:`, response.status);
    console.log(`${LOG_PREFIX} Backend response:`, responseText);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error removing player ID from backend:`, error);
  }
};

// Set notification tags (for segmentation)
export const setTags = async (tags) => {
  console.log(`${LOG_PREFIX} setTags called with:`, tags);

  if (!OneSignal) {
    console.log(`${LOG_PREFIX} OneSignal not available`);
    return;
  }

  try {
    OneSignal.User.addTags(tags);
    console.log(`${LOG_PREFIX} Tags set successfully`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting tags:`, error);
  }
};

// Test function to send a test notification (for debugging)
export const sendTestNotification = async () => {
  console.log(`${LOG_PREFIX} ========== SENDING TEST NOTIFICATION ==========`);

  const state = await logCurrentState();

  if (!state?.playerId) {
    console.error(`${LOG_PREFIX} Cannot send test - no player ID`);
    return false;
  }

  console.log(`${LOG_PREFIX} To test push notifications, send a test from OneSignal dashboard`);
  console.log(`${LOG_PREFIX} Target Player ID:`, state.playerId);
  console.log(`${LOG_PREFIX} ================================================`);

  return true;
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
