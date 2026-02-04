// Dynamic Expo configuration with environment variable support
// This file replaces app.json for environment-aware builds

export default ({ config }) => {
  // Get environment variables with fallbacks
  const API_URL = process.env.API_URL || 'https://testchatflow.pabbly.com/api';
  const SOCKET_URL = process.env.SOCKET_URL || 'https://testchatflow.pabbly.com/';
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
      associatedDomains: ['applinks:testchatflow.pabbly.com'],
      config: {
        googleSignIn: {
          reservedClientId: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('-')[0]}`,
        },
      },
    },
    android: {
      package: 'com.pabbly.chatflow',
      googleServicesFile: './google-services.json',
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
              host: 'testchatflow.pabbly.com',
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
      [
        'onesignal-expo-plugin',
        {
          mode: 'production',
          smallIcons: ['./assets/notification-icon.png'],
          largeIcons: ['./assets/icon.png'],
        },
      ],
    ],
    // EAS Update configuration for OTA updates
    updates: {
      url: 'https://u.expo.dev/aae850ee-f690-43e6-9b5b-3faa4f60fee7',
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
        projectId: 'aae850ee-f690-43e6-9b5b-3faa4f60fee7',
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
