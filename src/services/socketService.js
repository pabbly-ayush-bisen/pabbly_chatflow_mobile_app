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
    // Log:('Socket already connected, reusing existing connection');
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
  // Log:('[SocketService] Initializing with settingId:', settingId);

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
    socketId = socket.id;
    reconnectAttempts = 0;
    onConnect?.();
  });

  socket.on('connect_error', () => {
    // Do NOT call socket.disconnect() here — it kills socket.io's built-in
    // reconnection (reconnection: true, reconnectionAttempts: 5).
    // Let socket.io handle retries automatically.
    reconnectAttempts += 1;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      onError?.('Connection failed. Retrying...');
    }
    // socket.io will fire 'reconnect_failed' on the manager after all attempts exhausted
  });

  // All built-in reconnection attempts exhausted
  socket.io.on('reconnect_failed', () => {
    onError?.('Connection lost. Please check your network.');
  });

  socket.on('error', (error) => {
    // Error:('Socket error:', error);
    onError?.('Connection error occurred');
  });

  socket.on('disconnect', (reason) => {
    onDisconnect?.(reason);

    // 'io server disconnect' means the server forcefully disconnected us.
    // socket.io does NOT auto-reconnect for this reason, so we must do it manually.
    if (reason === 'io server disconnect') {
      setTimeout(() => {
        if (socket && !socket.connected) {
          socket.connect();
        }
      }, RECONNECT_INTERVAL);
    }
    // For all other reasons (transport close, transport error, ping timeout),
    // socket.io's built-in reconnection handles it automatically.
  });

  // Attempt initial connection
  try {
    socket.connect();
  } catch (error) {
    // Error:('Initial connection error:', error);
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
  // Warn:('Socket not connected, cannot emit:', eventName);
  return false;
};

/**
 * Emit event and wait for server acknowledgment (with timeout fallback).
 * Uses socket.io ack callback — if the server supports it, resolves immediately
 * on server confirmation. Otherwise falls back to timeout.
 * @param {string} eventName - Event name
 * @param {any} data - Event data
 * @param {number} timeoutMs - Timeout in ms (default 8 seconds)
 * @returns {Promise<boolean>} - true if sent, false if socket not connected
 */
export const emitSocketEventAsync = (eventName, data, timeoutMs = 8000) => {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve(false);
      return;
    }

    const timer = setTimeout(() => {
      resolve(true);
    }, timeoutMs);

    socket.emit(eventName, data, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
};

/**
 * Send message through socket and wait for server acknowledgment
 * @param {Object} messageData - Message data
 * @returns {Promise<boolean>}
 */
export const sendMessageViaSocketAsync = (messageData) => {
  return emitSocketEventAsync('sendMessage', messageData);
};

/**
 * Send template message through socket and wait for server acknowledgment
 * @param {Object} templateData - Template message data
 * @returns {Promise<boolean>}
 */
export const sendTemplateViaSocketAsync = (templateData) => {
  const payload = {
    ...templateData,
    type: 'template',
    bodyParams: Array.isArray(templateData.bodyParams)
      ? templateData.bodyParams
      : Object.values(templateData.bodyParams || {}),
    headerParams: Array.isArray(templateData.headerParams)
      ? templateData.headerParams
      : Object.values(templateData.headerParams || {}),
  };
  return emitSocketEventAsync('sendMessage', payload);
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

  // Log:('[SocketService] Sending template payload:', payload);
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
  emitSocketEventAsync,
  subscribeToEvent,
  unsubscribeFromEvent,
  sendMessageViaSocket,
  sendMessageViaSocketAsync,
  resetUnreadCountViaSocket,
  createContactViaSocket,
  sendTemplateViaSocket,
  sendTemplateViaSocketAsync,
  sendMediaViaSocket,
};
