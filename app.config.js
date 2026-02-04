// Dynamic Expo configuration with environment variable support
// This file replaces app.json for environment-aware builds

export default ({ config }) => {
  // Get environment variables with fallbacks
  const API_URL = process.env.API_URL || 'https://chatflow.pabbly.com/api';
  const SOCKET_URL = process.env.SOCKET_URL || 'https://chatflow.pabbly.com/';
  const PABBLY_ACCOUNTS_URL = process.env.PABBLY_ACCOUNTS_URL || 'https://accounts.pabbly.com';
  const PABBLY_ACCOUNTS_BACKEND_URL = process.env.PABBLY_ACCOUNTS_BACKEND_URL || 'https://accounts.pabbly.com/backend';
  const PABBLY_PROJECT = process.env.PABBLY_PROJECT || 'pcf';
  const APP_ENV = process.env.APP_ENV || 'development';
  const DEBUG_MODE = process.env.DEBUG_MODE || 'false';

  // Google OAuth - use EAS secrets for these in production
  const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || '848504831060-uen6psucq9c3ovguk3utheiidi4hpotc.apps.googleusercontent.com';
  const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID || '848504831060-p68o8ogq2lrfg7kg2tk42oosqfjnbodi.apps.googleusercontent.com';
  const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID || '848504831060-dt3ve1h090q2979md9eoqq8epc1rd7tr.apps.googleusercontent.com';
  const EXPO_USERNAME = process.env.EXPO_USERNAME || 'ayush_bisen_pabbly';

  return {
    ...config,
    name: 'Pabbly Chatflow',
    slug: 'chatflow_mobile_native',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'pabblychatflow',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pabbly.chatflow',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      associatedDomains: ['applinks:chatflow.pabbly.com'],
      config: {
        googleSignIn: {
          reservedClientId: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('-')[0]}`,
        },
      },
    },
    android: {
      package: 'com.pabbly.chatflow',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'chatflow.pabbly.com',
              pathPrefix: '/api/auth/tauth',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-asset',
      'expo-font',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#25D366',
          sounds: [],
          mode: 'production',
        },
      ],
      'expo-sqlite',
      'expo-web-browser',
      '@react-native-google-signin/google-signin',
    ],
    // EAS Update configuration for OTA updates
    updates: {
      url: 'https://u.expo.dev/b49e424a-9ca4-4577-a11a-0b5161d62953',
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      // EAS project configuration
      eas: {
        projectId: 'b49e424a-9ca4-4577-a11a-0b5161d62953',
      },
      // Environment variables available at runtime via expo-constants
      API_URL,
      SOCKET_URL,
      PABBLY_ACCOUNTS_URL,
      PABBLY_ACCOUNTS_BACKEND_URL,
      PABBLY_PROJECT,
      APP_ENV,
      DEBUG_MODE,
      GOOGLE_WEB_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID,
      EXPO_USERNAME,
    },
  };
};
