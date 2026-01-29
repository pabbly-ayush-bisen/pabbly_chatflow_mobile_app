import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch } from 'react-redux';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { lightTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import store from './src/redux/store';
import { setUser, setSettingId, checkSession } from './src/redux/slices/userSlice';
import { SocketProvider } from './src/contexts/SocketContext';
import { CacheProvider } from './src/contexts/CacheContext';
import { sessionManager } from './src/services/SessionManager';

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Starting app...');
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
        console.log('[App] Checking for existing session...');
        setLoadingMessage('Restoring session...');

        // Use SessionManager for session restoration
        const session = await sessionManager.initialize();

        if (session && session.token && session.user) {
          console.log('[App] Session found:', {
            hasToken: true,
            hasUser: true,
            hasSettingId: !!session.settingId,
            loginTime: session.loginTime ? new Date(session.loginTime).toISOString() : null,
          });

          // Restore user and settingId from storage immediately
          // This ensures user sees the app instantly without waiting for server
          dispatch(setUser(session.user));
          if (session.settingId) {
            dispatch(setSettingId(session.settingId));
          }

          // Background verify session with server (don't block UI)
          // Only verify if it's been more than 1 hour since last check
          const shouldVerify = await sessionManager.shouldVerifyWithServer();
          if (shouldVerify) {
            console.log('[App] Verifying session with server in background...');
            // Fire and forget - don't await
            dispatch(checkSession())
              .then(() => {
                sessionManager.markSessionVerified();
                console.log('[App] Session verified with server');
              })
              .catch((err) => {
                // Don't logout on verification error - user might be offline
                console.log('[App] Session verification failed (user may be offline):', err.message);
              });
          } else {
            console.log('[App] Session verified recently, skipping server check');
          }

          console.log('[App] Session restored successfully - showing app');
        } else {
          console.log('[App] No existing session found - showing login');
        }
      } catch (error) {
        console.error('[App] Error restoring session:', error);
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
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return (
    <CacheProvider>
      <SocketProvider>
        <AppNavigator />
      </SocketProvider>
    </CacheProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
});

export default function App() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={lightTheme}>
          <StatusBar style="auto" />
          <AppContent />
        </PaperProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}
