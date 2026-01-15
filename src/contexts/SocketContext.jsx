import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from 'react-native';
import {
  initializeSocket,
  disconnectSocket,
  isSocketConnected,
  subscribeToEvent,
  unsubscribeFromEvent,
} from '../services/socketService';
import {
  handleNewMessage,
  handleMessageStatus,
  handleResetUnreadCount,
  handleContactCreated,
  handleContactCreateError,
  handleSendMessageError,
  handleTeamMemberLogout,
} from '../services/socketHandlers';
import { fetchChats } from '../redux/slices/inboxSlice';
import {
  registerForPushNotifications,
  showMessageNotification,
  setBadgeCount,
  clearAllNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '../services/notificationService';
import { navigate } from '../navigation/AppNavigator';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { authenticated } = useSelector((state) => state.user);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [pushToken, setPushToken] = useState(null);
  const appState = useRef(AppState.currentState);
  const currentChatIdRef = useRef(null); // Track currently open chat
  const notificationListenerRef = useRef(null);
  const responseListenerRef = useRef(null);

  const handleConnect = useCallback(() => {
    console.log('Socket connected - fetching chats');
    setConnectionStatus('connected');
    setError(null);
    dispatch(fetchChats());
  }, [dispatch]);

  const handleDisconnect = useCallback((reason) => {
    console.log('Socket disconnected:', reason);
    setConnectionStatus('disconnected');
  }, []);

  const handleError = useCallback((errorMessage) => {
    console.error('Socket error:', errorMessage);
    setError(errorMessage);
    setConnectionStatus('error');
  }, []);

  const setupEventListeners = useCallback(() => {
    console.log('[SocketContext] Setting up event listeners');

    // New message event
    subscribeToEvent('newMessage', async (newChat) => {
      console.log('[SocketContext] newMessage event received:', {
        chatId: newChat._id,
        currentChatId: currentChatIdRef.current,
        appState: appState.current,
      });

      handleNewMessage(dispatch, newChat);

      // Show notification if app is in background or chat is not currently open
      const lastMessage = newChat.messages && newChat.messages.length > 0
        ? newChat.messages[newChat.messages.length - 1]
        : null;

      // Only show notification for incoming messages (not sent by user)
      if (lastMessage && lastMessage.sentBy !== 'user') {
        // Check if the app is in background or the chat is not open
        const isInBackground = appState.current !== 'active';
        const isChatOpen = currentChatIdRef.current === newChat._id;

        console.log('[SocketContext] Notification check:', { isInBackground, isChatOpen });

        if (isInBackground || !isChatOpen) {
          // Show local notification
          await showMessageNotification(
            lastMessage,
            newChat.contact,
            newChat._id
          );
        }
      }
    });

    // Message status update
    subscribeToEvent('messageStatus', (data) => {
      handleMessageStatus(dispatch, data);
    });

    // Reset unread count
    subscribeToEvent('resetUnreadCount', (chatId) => {
      handleResetUnreadCount(dispatch, chatId);
    });

    // Contact created
    subscribeToEvent('contactCreated', (id) => {
      handleContactCreated(dispatch, id);
    });

    // Contact create error
    subscribeToEvent('contactCreateError', (errorMsg) => {
      handleContactCreateError(dispatch, errorMsg);
    });

    // Send message error
    subscribeToEvent('sendMessageError', (errorMsg) => {
      console.error('[SocketContext] sendMessageError received:', errorMsg);
      handleSendMessageError(dispatch, errorMsg);
    });

    // Team member logout
    subscribeToEvent('teamMemberLogout', (emailsToLogout) => {
      handleTeamMemberLogout(dispatch, emailsToLogout);
    });
  }, [dispatch]);

  const removeEventListeners = useCallback(() => {
    unsubscribeFromEvent('newMessage');
    unsubscribeFromEvent('messageStatus');
    unsubscribeFromEvent('resetUnreadCount');
    unsubscribeFromEvent('contactCreated');
    unsubscribeFromEvent('contactCreateError');
    unsubscribeFromEvent('sendMessageError');
    unsubscribeFromEvent('teamMemberLogout');
  }, []);

  const connect = useCallback(async () => {
    if (!authenticated) {
      console.log('Not authenticated, skipping socket connection');
      return;
    }

    setConnectionStatus('connecting');
    await initializeSocket(handleConnect, handleDisconnect, handleError);
    setupEventListeners();
  }, [authenticated, handleConnect, handleDisconnect, handleError, setupEventListeners]);

  const disconnect = useCallback(() => {
    removeEventListeners();
    disconnectSocket();
    setConnectionStatus('disconnected');
  }, [removeEventListeners]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground
        if (authenticated && !isSocketConnected()) {
          console.log('App came to foreground, reconnecting socket');
          connect();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [authenticated, connect]);

  // Setup push notifications
  useEffect(() => {
    const setupNotifications = async () => {
      if (authenticated) {
        // Register for push notifications
        const token = await registerForPushNotifications();
        if (token) {
          setPushToken(token);
          console.log('Push notification token registered:', token);
        }

        // Listen for notification interactions (when user taps notification)
        responseListenerRef.current = addNotificationResponseListener((response) => {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);

          // Handle navigation to chat when notification is tapped
          if (data?.chatId) {
            console.log('Navigating to chat:', data.chatId);
            // Navigate to the chat
            navigate('ChatDetails', { chatId: data.chatId });
          }
        });

        // Listen for notifications received while app is in foreground
        notificationListenerRef.current = addNotificationReceivedListener((notification) => {
          console.log('Notification received in foreground:', notification);
        });
      }
    };

    setupNotifications();

    return () => {
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, [authenticated]);

  // Connect when authenticated
  useEffect(() => {
    if (authenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [authenticated, connect, disconnect]);

  // Function to set current open chat (call from ChatDetailsScreen)
  const setCurrentChatId = useCallback((chatId) => {
    currentChatIdRef.current = chatId;
    // Clear notifications for this chat when opened
    if (chatId) {
      clearAllNotifications();
    }
  }, []);

  // Function to update badge count
  const updateBadgeCount = useCallback(async (count) => {
    await setBadgeCount(count);
  }, []);

  const value = {
    connectionStatus,
    error,
    isConnected: connectionStatus === 'connected',
    connect,
    disconnect,
    pushToken,
    setCurrentChatId,
    updateBadgeCount,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
