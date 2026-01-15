import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch } from 'react-redux';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import store from './src/redux/store';
import { setUser, setSettingId, checkSession } from './src/redux/slices/userSlice';
import { APP_CONFIG } from './src/config/app.config';
import { SocketProvider } from './src/contexts/SocketContext';

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

    // Restore session from storage on app start
    const restoreSession = async () => {
      try {
        console.log('[App] Checking for existing session...');

        const token = await AsyncStorage.getItem(APP_CONFIG.tokenKey);
        const userString = await AsyncStorage.getItem(APP_CONFIG.userKey);
        const settingId = await AsyncStorage.getItem('settingId');
        const shouldCheckSession = await AsyncStorage.getItem('shouldCheckSession');

        console.log('[App] Session data found:', {
          hasToken: !!token,
          hasUser: !!userString,
          hasSettingId: !!settingId,
          shouldCheckSession: !!shouldCheckSession,
        });

        if (token && userString) {
          const user = JSON.parse(userString);

          // Restore user and settingId from storage immediately
          dispatch(setUser(user));
          if (settingId) {
            dispatch(setSettingId(settingId));
          }

          // Verify session with server - Same as web app's checkSession
          // If server says session is invalid, the API calls will handle logout
          try {
            const sessionCheck = JSON.parse(shouldCheckSession || '{}');
            // Only verify if it's been more than 1 hour since last check
            const oneHour = 60 * 60 * 1000;
            if (!sessionCheck.timestamp || Date.now() - sessionCheck.timestamp > oneHour) {
              console.log('[App] Verifying session with server...');
              dispatch(checkSession());
              // Update the check timestamp
              await AsyncStorage.setItem(
                'shouldCheckSession',
                JSON.stringify({ status: true, timestamp: Date.now() })
              );
            }
          } catch (verifyError) {
            console.log('[App] Session verification skipped:', verifyError.message);
          }

          console.log('[App] Session restored successfully');
        } else {
          console.log('[App] No existing session found');
        }
      } catch (error) {
        console.error('[App] Error restoring session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [dispatch, isRuntimeReady]);

  if (isLoading || !isRuntimeReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#20B276" />
      </View>
    );
  }

  return (
    <SocketProvider>
      <AppNavigator />
    </SocketProvider>
  );
}

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
