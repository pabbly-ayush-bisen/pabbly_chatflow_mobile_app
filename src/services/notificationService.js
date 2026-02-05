import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import { APP_CONFIG } from '../config/app.config';

// Pabbly logo asset for notification large icon
const pabblyLogoAsset = require('../../assets/ios_icon.png');

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = '@pabbly_notification_prefs';

// Sound object reference for cleanup
let notificationSound = null;

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get push token
 * @returns {Promise<string|null>} Push token or null if unavailable
 */
export const registerForPushNotifications = async () => {
  let token = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    return null;
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'b49e424a-9ca4-4577-a11a-0b5161d62953', // EAS project ID from app.json
    });
    token = tokenData.data;

    // Store token locally
    await AsyncStorage.setItem('@pabbly_chatflow_pushToken', token);

    // Send token to your backend server
    await sendTokenToServer(token);
  } catch (error) {
    // Error getting push token
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#25D366',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    // Create channel for messages
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'Notifications for new messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#25D366',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });
  }

  return token;
};

/**
 * Send push token to backend server
 * @param {string} token - Expo push token
 */
const sendTokenToServer = async (token) => {
  try {
    const authToken = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    if (!authToken || !settingId) {
      return;
    }

    // Send token to your backend
    const response = await fetch(`${APP_CONFIG.apiUrl}/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        settingId: settingId,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      }),
    });

  } catch (error) {
    // Error sending push token to server
  }
};

/**
 * Get notification preferences from storage
 * @returns {Promise<Object>} Notification preferences
 */
export const getNotificationPreferences = async () => {
  try {
    const prefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (prefs) {
      return JSON.parse(prefs);
    }
    // Default preferences
    return {
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
    };
  } catch (error) {
    return {
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }
};

/**
 * Play WhatsApp-like notification sound
 * Uses a pleasant pop/chime sound similar to WhatsApp
 */
export const playNotificationSound = async () => {
  try {
    // Unload previous sound if exists
    if (notificationSound) {
      await notificationSound.unloadAsync();
      notificationSound = null;
    }

    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Load and play the notification sound
    // Using a built-in system sound URI that works across platforms
    const { sound } = await Audio.Sound.createAsync(
      // WhatsApp-like notification sound - using a web URL for a pleasant pop sound
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
      { shouldPlay: true, volume: 0.8 }
    );

    notificationSound = sound;

    // Cleanup after sound finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        notificationSound = null;
      }
    });
  } catch (error) {
    // Fallback: try using system default
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/notification.mp3'),
        { shouldPlay: true, volume: 0.8 }
      );
      notificationSound = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
          notificationSound = null;
        }
      });
    } catch (fallbackError) {
      // Fallback sound also failed
    }
  }
};

/**
 * Trigger vibration pattern similar to WhatsApp
 */
export const vibrateNotification = () => {
  // WhatsApp-like vibration pattern: short buzz, pause, short buzz
  const pattern = Platform.OS === 'android'
    ? [0, 100, 50, 100] // Android: delay, vibrate, pause, vibrate
    : [100, 100]; // iOS: simplified pattern

  Vibration.vibrate(pattern);
};

/**
 * Play sound and vibrate based on user preferences
 */
export const triggerNotificationFeedback = async () => {
  try {
    const prefs = await getNotificationPreferences();

    if (!prefs.notificationsEnabled) {
      return; // Notifications disabled, do nothing
    }

    // Play sound if enabled
    if (prefs.soundEnabled) {
      await playNotificationSound();
    }

    // Vibrate if enabled
    if (prefs.vibrationEnabled) {
      vibrateNotification();
    }
  } catch (error) {
    // Error triggering notification feedback
  }
};

/**
 * Get Pabbly logo URI for notification
 * @returns {Promise<string|null>} Local URI of the Pabbly logo
 */
const getPabblyLogoUri = async () => {
  try {
    const asset = Asset.fromModule(pabblyLogoAsset);
    await asset.downloadAsync();
    return asset.localUri || asset.uri;
  } catch (error) {
    return null;
  }
};

/**
 * Show a local notification for a new message
 * @param {Object} message - Message object
 * @param {Object} contact - Contact object
 * @param {string} chatId - Chat ID
 */
export const showMessageNotification = async (message, contact, chatId) => {
  try {
    // Check if notifications are enabled
    const prefs = await getNotificationPreferences();
    if (!prefs.notificationsEnabled) {
      return;
    }

    // Trigger sound and vibration feedback
    await triggerNotificationFeedback();

    const contactName = contact?.name || contact?.phoneNumber || 'Unknown';
    let messageText = 'New message';

    // Determine message content based on type
    const messageType = message.type || 'text';
    switch (messageType) {
      case 'text':
        messageText = message.message?.body?.text || message.message?.body || message.text || 'Message';
        break;
      case 'image':
        messageText = '🖼️ Image';
        break;
      case 'video':
        messageText = '🎬 Video';
        break;
      case 'audio':
        messageText = '🎵 Audio';
        break;
      case 'document':
        messageText = '📄 Document';
        break;
      case 'sticker':
        messageText = '😀 Sticker';
        break;
      case 'location':
        messageText = '📍 Location';
        break;
      case 'contact':
      case 'contacts':
        messageText = '👤 Contact';
        break;
      case 'template':
        messageText = '📋 Template';
        break;
      default:
        messageText = 'New message';
    }

    // Truncate long messages
    if (typeof messageText === 'string' && messageText.length > 100) {
      messageText = messageText.substring(0, 100) + '...';
    }

    // Get Pabbly logo for large icon (Android)
    const pabblyLogoUri = Platform.OS === 'android' ? await getPabblyLogoUri() : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: contactName,
        body: messageText,
        data: {
          chatId,
          contactId: contact?._id,
          type: 'message',
        },
        sound: 'default',
        badge: 1,
        ...(Platform.OS === 'android' && {
          channelId: 'messages',
          // Use Pabbly logo as the large icon in notification banner
          ...(pabblyLogoUri && { largeIcon: pabblyLogoUri }),
        }),
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    // Error showing notification
  }
};

/**
 * Update app badge count
 * @param {number} count - Badge count
 */
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    // Error setting badge count
  }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    // Error clearing notifications
  }
};

/**
 * Add notification response listener (when user taps notification)
 * @param {Function} callback - Callback function with notification response
 * @returns {Object} Subscription object
 */
export const addNotificationResponseListener = (callback) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Add notification received listener (when notification arrives)
 * @param {Function} callback - Callback function with notification
 * @returns {Object} Subscription object
 */
export const addNotificationReceivedListener = (callback) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Get last notification response (if app was opened from notification)
 * @returns {Promise<Object|null>} Last notification response
 */
export const getLastNotificationResponse = async () => {
  return await Notifications.getLastNotificationResponseAsync();
};

export default {
  registerForPushNotifications,
  showMessageNotification,
  setBadgeCount,
  clearAllNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getLastNotificationResponse,
  getNotificationPreferences,
  playNotificationSound,
  vibrateNotification,
  triggerNotificationFeedback,
};
