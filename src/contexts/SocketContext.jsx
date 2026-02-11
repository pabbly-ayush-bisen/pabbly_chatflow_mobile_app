import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
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
  handleUpdateChatOnContactUpdate,
  handleUpdateTemplateStatus,
  handleNewMessagesBulk,
} from '../services/socketHandlers';
import { fetchChats } from '../redux/slices/inboxSlice';
import { fetchChatsWithCache } from '../redux/cacheThunks';
import {
  registerForPushNotifications,
  showMessageNotification,
  setBadgeCount,
  clearAllNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '../services/notificationService';
import { navigate } from '../navigation/navigationUtils';
import { processSyncQueue } from '../services/syncQueueService';
import { useNetwork } from './NetworkContext';

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
  const store = useStore();
  const { authenticated, settingId, teamMemberStatus } = useSelector((state) => state.user);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [pushToken, setPushToken] = useState(null);
  const appState = useRef(AppState.currentState);
  const currentChatIdRef = useRef(null); // Track currently open chat
  const notificationListenerRef = useRef(null);
  const responseListenerRef = useRef(null);
  const previousSettingIdRef = useRef(null); // Track previous settingId for reconnection
  const hasConnectedBeforeRef = useRef(false); // Track first connection vs reconnection
  const disconnectedAtRef = useRef(null); // Track when disconnection happened for smart reconnect

  const handleConnect = useCallback(() => {
    console.log('[SocketContext] handleConnect — socket connected');
    setConnectionStatus('connected');
    setError(null);

    if (!hasConnectedBeforeRef.current) {
      // First connection: load from cache first, then fetch all from API
      console.log('[SocketContext] First connection — fetching chats with cache');
      dispatch(fetchChatsWithCache({ all: true }));
      hasConnectedBeforeRef.current = true;
    } else {
      // Reconnection: determine how many pages to fetch based on downtime
      const disconnectedMs = disconnectedAtRef.current
        ? Date.now() - disconnectedAtRef.current
        : Infinity;
      const disconnectedMinutes = disconnectedMs / (1000 * 60);

      // Short disconnect (<5 min): fetch only 2 pages (most recent chats)
      // Medium disconnect (5-30 min): fetch 5 pages
      // Long disconnect (>30 min): fetch all pages (full refresh)
      let maxPages;
      if (disconnectedMinutes < 5) {
        maxPages = 2;
      } else if (disconnectedMinutes < 30) {
        maxPages = 5;
      } else {
        maxPages = 50;
      }

      console.log(`[SocketContext] Reconnection — fetching with maxPages=${maxPages}`);
      dispatch(fetchChatsWithCache({ all: true, forceRefresh: true, maxPages }));
      disconnectedAtRef.current = null;
    }

    // Process queued messages after reconnection
    console.log('[SocketContext] Scheduling sync queue processing (1s delay)');
    setTimeout(() => {
      console.log('[SocketContext] Processing sync queue after reconnection');
      processSyncQueue(dispatch);
    }, 1000);
  }, [dispatch]);

  const handleDisconnect = useCallback((reason) => {
    console.log('[SocketContext] handleDisconnect — reason:', reason);
    setConnectionStatus('disconnected');
    disconnectedAtRef.current = Date.now();
  }, []);

  const handleError = useCallback((errorMessage) => {
    setError(errorMessage);
    // If the message indicates retrying, keep status as 'connecting' (not 'error')
    // so InboxHeader shows "Connecting..." instead of "Connection error".
    // Only permanent failures (after max retries) should show 'error'.
    if (errorMessage && errorMessage.includes('Retrying')) {
      console.log('[SocketContext] handleError — retrying, keeping status as "connecting"');
      setConnectionStatus('connecting');
    } else {
      console.log('[SocketContext] handleError — permanent error:', errorMessage);
      setConnectionStatus('error');
    }
  }, []);

  const setupEventListeners = useCallback(() => {
    // New message event
    subscribeToEvent('newMessage', async (newChat) => {
      handleNewMessage(dispatch, newChat);

      // Show notification for incoming messages not currently visible
      // Find the last incoming (non-user) message for the notification
      // This handles multi-message events where [incoming_msg, flow_response] arrive together
      const allMessages = newChat.messages && newChat.messages.length > 0
        ? newChat.messages
        : [];
      let notificationMessage = null;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i] && allMessages[i].sentBy !== 'user') {
          notificationMessage = allMessages[i];
          break;
        }
      }

      if (notificationMessage) {
        const isInBackground = appState.current !== 'active';
        const isChatOpen = currentChatIdRef.current === newChat._id;

        if (isInBackground || !isChatOpen) {
          await showMessageNotification(notificationMessage, newChat.contact, newChat._id);

          // Update badge count with total unread messages
          try {
            const currentState = store.getState();
            const totalUnread = (currentState.inbox?.chats || []).reduce(
              (acc, chat) => acc + (chat.unreadCount || 0), 0
            );
            await setBadgeCount(totalUnread + 1);
          } catch (badgeError) {
            // Error updating badge count
          }
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
      handleSendMessageError(dispatch, errorMsg);
    });

    // Team member logout
    subscribeToEvent('teamMemberLogout', (emailsToLogout) => {
      handleTeamMemberLogout(dispatch, emailsToLogout);
    });

    // Chat update on contact update (when contact details change)
    subscribeToEvent('updateChatOnContactUpdate', async (response) => {
      handleUpdateChatOnContactUpdate(dispatch, response);
    });

    // Template status update (for real-time template approval notifications)
    subscribeToEvent('updateTemplateStatus', (template) => {
      handleUpdateTemplateStatus(dispatch, template);
    });

    // Bulk new messages (matching web app behavior)
    subscribeToEvent('newMessagesBulk', (newChats) => {
      handleNewMessagesBulk(dispatch, newChats, store.getState);
    });
  }, [dispatch, store]);

  const removeEventListeners = useCallback(() => {
    unsubscribeFromEvent('newMessage');
    unsubscribeFromEvent('messageStatus');
    unsubscribeFromEvent('resetUnreadCount');
    unsubscribeFromEvent('contactCreated');
    unsubscribeFromEvent('contactCreateError');
    unsubscribeFromEvent('sendMessageError');
    unsubscribeFromEvent('teamMemberLogout');
    unsubscribeFromEvent('updateChatOnContactUpdate');
    unsubscribeFromEvent('updateTemplateStatus');
    unsubscribeFromEvent('newMessagesBulk');
  }, []);

  const connect = useCallback(async () => {
    if (!authenticated) {
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
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground
        // Clear badge count and notifications when app becomes active
        try {
          await setBadgeCount(0);
          await clearAllNotifications();
        } catch (badgeError) {
          // Error clearing badge
        }

        // Reconnect socket if needed
        if (authenticated && !isSocketConnected()) {
          connect();
        }

        // Re-register push token in case it changed
        if (authenticated) {
          try {
            const token = await registerForPushNotifications();
            if (token && token !== pushToken) {
              setPushToken(token);
            }
          } catch (tokenError) {
            // Error re-registering push token
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [authenticated, connect, pushToken]);

  // Setup push notifications
  useEffect(() => {
    const setupNotifications = async () => {
      if (authenticated) {
        // Register for push notifications
        const token = await registerForPushNotifications();
        if (token) {
          setPushToken(token);
        }

        // Listen for notification interactions (when user taps notification)
        responseListenerRef.current = addNotificationResponseListener((response) => {
          const data = response.notification.request.content.data;

          // Handle navigation to chat when notification is tapped
          if (data?.chatId) {
            // Navigate to the chat
            navigate('ChatDetails', { chatId: data.chatId });
          }
        });

        // Listen for notifications received while app is in foreground
        notificationListenerRef.current = addNotificationReceivedListener((notification) => {
          // Notification received in foreground
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

  // Reconnect socket and process sync queue when network comes back online
  const { registerNetworkChangeCallback } = useNetwork();
  useEffect(() => {
    const unregister = registerNetworkChangeCallback((event) => {
      if (event.type === 'online') {
        console.log('[SocketContext] Network online event — socketConnected:', isSocketConnected());
        if (isSocketConnected()) {
          // Socket still connected — just process queued messages
          console.log('[SocketContext] Socket still connected — processing sync queue');
          processSyncQueue(dispatch);
        } else if (authenticated) {
          // Socket is NOT connected (disconnected or destroyed after max retries).
          // Trigger a fresh connection. handleConnect will call processSyncQueue
          // after the socket connects.
          console.log('[SocketContext] Socket disconnected — triggering fresh connection');
          connect();
        }
      }
    });
    return unregister;
  }, [dispatch, registerNetworkChangeCallback, authenticated, connect]);

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

  // Reconnect socket when settingId changes (e.g., after team member login)
  // This ensures the socket uses the new credentials when switching between accounts
  // Same behavior as web app where socket reconnects with new session after team member login
  useEffect(() => {
    if (!authenticated || !settingId) {
      previousSettingIdRef.current = settingId;
      return;
    }

    // Check if settingId has changed (team member login/logout)
    if (previousSettingIdRef.current && previousSettingIdRef.current !== settingId) {
      // Disconnect and reconnect with new credentials
      // This ensures the socket sends messages with the correct settingId
      disconnect();
      // Small delay to ensure clean disconnection before reconnecting
      setTimeout(() => {
        connect();
      }, 100);
    }

    previousSettingIdRef.current = settingId;
  }, [authenticated, settingId, teamMemberStatus?.loggedIn, connect, disconnect]);

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

  const value = useMemo(() => ({
    connectionStatus,
    error,
    isConnected: connectionStatus === 'connected',
    connect,
    disconnect,
    pushToken,
    setCurrentChatId,
    updateBadgeCount,
  }), [connectionStatus, error, connect, disconnect, pushToken, setCurrentChatId, updateBadgeCount]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
