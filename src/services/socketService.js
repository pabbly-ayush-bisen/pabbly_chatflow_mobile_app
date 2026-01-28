import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app.config';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 3000;
let socketId = null;

// Event listeners storage
const eventListeners = new Map();

/**
 * Initialize socket connection
 * @param {Function} onConnect - Callback when connected
 * @param {Function} onDisconnect - Callback when disconnected
 * @param {Function} onError - Callback on error
 */
export const initializeSocket = async (onConnect, onDisconnect, onError) => {
  if (socket?.connected) {
    console.log('Socket already connected, reusing existing connection');
    return socket;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  const token = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
  // Try both possible keys for settingId (for backwards compatibility)
  let settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');
  if (!settingId) {
    settingId = await AsyncStorage.getItem('settingId');
  }
  console.log('[SocketService] Initializing with settingId:', settingId);

  socket = io(APP_CONFIG.socketUrl, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_INTERVAL,
    timeout: 10000,
    forceNew: false,
    autoConnect: false,
    path: '/socket.io/',
    auth: {
      token,
      settingId,
      ...(socketId ? { socketId } : {}),
    },
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Socket connected successfully');
    socketId = socket.id;
    reconnectAttempts = 0;
    onConnect?.();
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    onError?.('Connection failed. Retrying...');
    socket.disconnect();
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    onError?.('Connection error occurred');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    onDisconnect?.(reason);

    if (reason === 'io server disconnect' || reason === 'transport close') {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts += 1;
        console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

        setTimeout(() => {
          if (socket && !socket.connected) {
            socket.connect();
          }
        }, RECONNECT_INTERVAL);
      } else {
        console.log('Max reconnection attempts reached');
        onError?.('Connection lost. Please restart the app.');
        socket.disconnect();
        socket = null;
      }
    }
  });

  // Attempt initial connection
  try {
    socket.connect();
  } catch (error) {
    console.error('Initial connection error:', error);
    onError?.('Failed to connect');
  }

  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
    socketId = null;
    eventListeners.clear();
  }
};

/**
 * Get socket instance
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected
 */
export const isSocketConnected = () => socket?.connected ?? false;

/**
 * Emit event through socket
 * @param {string} eventName - Event name
 * @param {any} data - Event data
 */
export const emitSocketEvent = (eventName, data) => {
  if (socket?.connected) {
    socket.emit(eventName, data);
    return true;
  }
  console.warn('Socket not connected, cannot emit:', eventName);
  return false;
};

/**
 * Subscribe to socket event
 * @param {string} eventName - Event name
 * @param {Function} callback - Event handler
 */
export const subscribeToEvent = (eventName, callback) => {
  if (socket) {
    socket.on(eventName, callback);
    eventListeners.set(eventName, callback);
  }
};

/**
 * Unsubscribe from socket event
 * @param {string} eventName - Event name
 */
export const unsubscribeFromEvent = (eventName) => {
  if (socket) {
    const callback = eventListeners.get(eventName);
    if (callback) {
      socket.off(eventName, callback);
      eventListeners.delete(eventName);
    }
  }
};

/**
 * Send message through socket
 * @param {Object} messageData - Message data
 */
export const sendMessageViaSocket = (messageData) => {
  return emitSocketEvent('sendMessage', messageData);
};

/**
 * Reset unread count through socket
 * @param {string} chatId - Chat ID
 */
export const resetUnreadCountViaSocket = (chatId) => {
  return emitSocketEvent('resetUnreadCount', chatId);
};

/**
 * Create contact through socket
 * @param {Object} contactData - Contact data
 */
export const createContactViaSocket = (contactData) => {
  return emitSocketEvent('createContact', contactData);
};

/**
 * Send template message through socket
 * @param {Object} templateData - Template message data
 * @param {string} templateData.to - Recipient phone number
 * @param {string} templateData.chatId - Chat ID
 * @param {string} templateData.templateName - Template name
 * @param {string} templateData.templateId - Template ID
 * @param {string} templateData.languageCode - Template language code
 * @param {Array} templateData.bodyParams - Body parameter values
 * @param {Array} templateData.headerParams - Header parameter values
 * @param {string} templateData.templateType - Template type (TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION, LTO, CAROUSEL, CATALOG)
 * @param {string} templateData.filename - Optional file name for media templates
 * @param {string} templateData.link - Optional file URL for media templates
 * @param {string} templateData.replyToWamid - Optional message ID for reply context
 * @param {Object} templateData.ltoFields - LTO (Limited Time Offer) fields: { unixTimestamp, date, time, timeZone }
 * @param {Object} templateData.location - Location fields: { latitude, longitude, name, address }
 * @param {string} templateData.catalogProductId - Catalog product retailer ID
 * @param {string} templateData.copyCodeParam - Copy code/OTP value for authentication templates
 * @param {Array} templateData.urlVariables - Dynamic URL button variables
 * @param {Array} templateData.carouselBodies - Carousel card body params (for carousel templates)
 * @param {Array} templateData.fileData - Carousel card media files (for carousel templates)
 * @param {string} templateData.carouselMediaType - Carousel media type: IMAGE or VIDEO
 */
export const sendTemplateViaSocket = (templateData) => {
  const payload = {
    ...templateData,
    type: 'template',
    // Ensure bodyParams and headerParams are arrays (web app sends Object.values())
    bodyParams: Array.isArray(templateData.bodyParams)
      ? templateData.bodyParams
      : Object.values(templateData.bodyParams || {}),
    headerParams: Array.isArray(templateData.headerParams)
      ? templateData.headerParams
      : Object.values(templateData.headerParams || {}),
  };

  console.log('[SocketService] Sending template payload:', payload);
  return emitSocketEvent('sendMessage', payload);
};

/**
 * Send media message through socket
 * @param {Object} mediaData - Media message data
 * @param {string} mediaData.to - Recipient phone number
 * @param {string} mediaData.chatId - Chat ID
 * @param {string} mediaData.type - Media type (image, video, audio, document)
 * @param {string} mediaData.link - Media URL
 * @param {string} mediaData.caption - Optional caption
 * @param {string} mediaData.filename - Optional filename for documents
 * @param {string} mediaData.replyToWamid - Optional message ID for reply context
 */
export const sendMediaViaSocket = (mediaData) => {
  return emitSocketEvent('sendMessage', mediaData);
};

export default {
  initializeSocket,
  disconnectSocket,
  getSocket,
  isSocketConnected,
  emitSocketEvent,
  subscribeToEvent,
  unsubscribeFromEvent,
  sendMessageViaSocket,
  resetUnreadCountViaSocket,
  createContactViaSocket,
  sendTemplateViaSocket,
  sendMediaViaSocket,
};
