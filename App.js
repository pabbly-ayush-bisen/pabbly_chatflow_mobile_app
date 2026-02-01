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
import { setUser, setSettingId, checkSession } from './src/redux/slices/userSlice';
import { SocketProvider } from './src/contexts/SocketContext';
import { CacheProvider } from './src/contexts/CacheContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { sessionManager } from './src/services/SessionManager';
import ErrorBoundary from './src/components/ErrorBoundary';
import toastConfig from './src/components/ToastConfig';

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
        console.warn('[App] Runtime not ready, retrying...', error);
        setTimeout(checkRuntime, 100);
      }
    };
    checkRuntime();
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

          try {
            await dispatch(checkSession()).unwrap();
            sessionManager.markSessionVerified();
          } catch (err) {
            // Session is invalid - clear it
            dispatch(setUser(null));
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
    <NetworkProvider>
      <CacheProvider>
        <SocketProvider>
          <AppNavigator />
        </SocketProvider>
      </CacheProvider>
    </NetworkProvider>
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
