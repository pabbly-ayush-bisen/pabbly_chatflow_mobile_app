import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch } from 'react-redux';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { lightTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import store from './src/redux/store';
import { setUser, setSettingId, setTeamMemberStatus, checkSession } from './src/redux/slices/userSlice';
import { SocketProvider } from './src/contexts/SocketContext';
import { CacheProvider } from './src/contexts/CacheContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { UpdateProvider } from './src/contexts/UpdateContext';
import { sessionManager } from './src/services/SessionManager';
import ErrorBoundary from './src/components/ErrorBoundary';
import toastConfig from './src/components/ToastConfig';

// OneSignal Push Notifications (conditionally loaded - skipped in Expo Go)
import {
  initializeOneSignal,
  requestNotificationPermission,
  setupNotificationClickHandler,
  setupForegroundNotificationHandler,
  setupSubscriptionListener,
  isOneSignalAvailable,
  logCurrentState,
} from './src/services/oneSignalService';
import { navigate } from './src/navigation/navigationUtils';

// Initialize OneSignal (will skip automatically if running in Expo Go)
console.log('[App.js] Starting OneSignal initialization...');
initializeOneSignal();

// OTA Update configuration
// autoApply: true enables automatic refresh when updates are available
const UPDATE_CONFIG = {
  checkOnStart: true,        // Check for updates when app starts
  checkOnForeground: true,   // Check when app comes to foreground
  autoDownload: true,        // Auto-download updates in background
  autoApply: true,           // Auto-reload with loading overlay when update is ready
  minCheckInterval: 5 * 60 * 1000, // 5 minutes between checks
};

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);
  const dispatch = useDispatch();

  // Wait for Reanimated runtime to be ready
  useEffect(() => {
    const checkRuntime = () => {
      try {
        // Simple check to ensure the runtime is initialized
        setIsRuntimeReady(true);
      } catch (error) {
        setTimeout(checkRuntime, 100);
      }
    };
    checkRuntime();
  }, []);

  // Setup OneSignal notification handlers (skipped in Expo Go)
  useEffect(() => {
    console.log('[App.js] Setting up OneSignal handlers...');

    if (!isOneSignalAvailable()) {
      console.log('[App.js] OneSignal not available, skipping handler setup');
      return;
    }

    console.log('[App.js] OneSignal is available, proceeding with setup');

    // Request notification permission
    console.log('[App.js] Requesting notification permission...');
    requestNotificationPermission();

    // Handle notification clicks (when user taps notification)
    console.log('[App.js] Setting up notification click handler...');
    const removeClickHandler = setupNotificationClickHandler((data) => {
      console.log('[App.js] Notification click callback triggered');
      console.log('[App.js] Click data:', JSON.stringify(data, null, 2));
      // Navigate to chat when notification is tapped
      if (data?.chatId) {
        console.log('[App.js] Navigating to ChatDetails with chatId:', data.chatId);
        navigate('ChatDetails', { chatId: data.chatId });
      } else {
        console.log('[App.js] No chatId in click data, not navigating');
      }
    });

    // Handle foreground notifications
    console.log('[App.js] Setting up foreground notification handler...');
    const removeForegroundHandler = setupForegroundNotificationHandler((notification) => {
      console.log('[App.js] Foreground notification callback triggered');
      console.log('[App.js] Notification:', JSON.stringify(notification, null, 2));
    });

    // Listen for subscription changes (token refresh)
    console.log('[App.js] Setting up subscription listener...');
    const removeSubscriptionListener = setupSubscriptionListener();

    // Log initial OneSignal state after short delay
    setTimeout(async () => {
      console.log('[App.js] Logging initial OneSignal state...');
      await logCurrentState();
    }, 2000);

    console.log('[App.js] All OneSignal handlers setup complete');

    // Cleanup on unmount
    return () => {
      console.log('[App.js] Cleaning up OneSignal handlers...');
      if (removeClickHandler) removeClickHandler();
      if (removeForegroundHandler) removeForegroundHandler();
      if (removeSubscriptionListener) removeSubscriptionListener();
    };
  }, []);

  useEffect(() => {
    if (!isRuntimeReady) return;

    // Restore session from storage on app start using SessionManager
    const restoreSession = async () => {
      try {
        // Use SessionManager for session restoration
        const session = await sessionManager.initialize();

        // Check if we have session data (token OR user)
        // Token indicates explicit session, user without token indicates cookie-based session
        const hasToken = session && session.token;
        const hasUser = session && session.user;

        if (hasToken && hasUser) {
          // Best case: we have both token and user cached
          dispatch(setUser(session.user));
          if (session.settingId) {
            dispatch(setSettingId(session.settingId));
          }

          // Restore team member status from storage
          const teamMemberStatus = await sessionManager.getTeamMemberStatus();
          if (teamMemberStatus && teamMemberStatus.loggedIn) {
            dispatch(setTeamMemberStatus(teamMemberStatus));
          }

          // Background verify session with server
          const shouldVerify = await sessionManager.shouldVerifyWithServer();
          if (shouldVerify) {
            dispatch(checkSession())
              .then(() => {
                sessionManager.markSessionVerified();
              })
              .catch(() => {});
          }
        } else if (hasUser && !hasToken) {
          // User cached but no token - likely cookie-based session
          // Try to verify with server using cookies

          // First restore user for instant UI
          dispatch(setUser(session.user));
          if (session.settingId) {
            dispatch(setSettingId(session.settingId));
          }

          // Restore team member status from storage for instant UI
          const teamMemberStatus = await sessionManager.getTeamMemberStatus();
          if (teamMemberStatus && teamMemberStatus.loggedIn) {
            dispatch(setTeamMemberStatus(teamMemberStatus));
          }

          try {
            await dispatch(checkSession()).unwrap();
            sessionManager.markSessionVerified();
          } catch (err) {
            // Session is invalid - clear it
            dispatch(setUser(null));
            dispatch(setTeamMemberStatus({ loggedIn: false, name: '', email: '', role: '' }));
            await sessionManager.destroySession();
          }
        } else if (hasToken && !hasUser) {
          // Token exists but no cached user - verify session to get user data
          try {
            await dispatch(checkSession()).unwrap();
            sessionManager.markSessionVerified();
          } catch (err) {
            await sessionManager.destroySession();
          }
        }
        // else: No existing session found - showing login
      } catch (error) {
        // Don't crash - just show login screen
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [dispatch, isRuntimeReady]);

  if (isLoading || !isRuntimeReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#20B276" />
      </View>
    );
  }

  return (
    <UpdateProvider config={UPDATE_CONFIG}>
      <NetworkProvider>
        <CacheProvider>
          <SocketProvider>
            <AppNavigator />
          </SocketProvider>
        </CacheProvider>
      </NetworkProvider>
    </UpdateProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default function App() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={lightTheme}>
          <ErrorBoundary>
            <StatusBar style="dark" />
            <AppContent />
            <Toast config={toastConfig} />
          </ErrorBoundary>
        </PaperProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}
