import Constants from 'expo-constants';

// Get environment variables from EAS build or fallback to defaults
const getEnvVar = (key, defaultValue) => {
  // Check process.env first (EAS build time)
  if (process.env[key]) {
    return process.env[key];
  }
  // Check expo-constants extra (runtime)
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }
  // Return default value
  return defaultValue;
};

// Environment detection
const APP_ENV = getEnvVar('APP_ENV', 'development');
const isProduction = APP_ENV === 'production';
const isPreview = APP_ENV === 'preview';
const isDevelopment = APP_ENV === 'development';

// App configuration using environment variables
export const APP_CONFIG = {
  appName: 'Pabbly Chatflow',
  appVersion: '1.0.0',
  appEnv: APP_ENV,

  // API Configuration - from environment variables
  apiUrl: getEnvVar('API_URL', 'https://chatflow.pabbly.com/api'),
  socketUrl: getEnvVar('SOCKET_URL', 'https://chatflow.pabbly.com/'),

  // Pabbly Accounts Configuration - from environment variables
  pabblyAccountsUrl: getEnvVar('PABBLY_ACCOUNTS_URL', 'https://accounts.pabbly.com'),
  pabblyAccountsBackendUrl: getEnvVar('PABBLY_ACCOUNTS_BACKEND_URL', 'https://accounts.pabbly.com/backend'),
  pabblyProject: getEnvVar('PABBLY_PROJECT', 'pcf'),

  // Google OAuth Configuration - from environment variables
  // These should be set as EAS secrets for production builds
  google: {
    webClientId: getEnvVar('GOOGLE_WEB_CLIENT_ID', '848504831060-uen6psucq9c3ovguk3utheiidi4hpotc.apps.googleusercontent.com'),
    androidClientId: getEnvVar('GOOGLE_ANDROID_CLIENT_ID', '848504831060-p68o8ogq2lrfg7kg2tk42oosqfjnbodi.apps.googleusercontent.com'),
    iosClientId: getEnvVar('GOOGLE_IOS_CLIENT_ID', '848504831060-dt3ve1h090q2979md9eoqq8epc1rd7tr.apps.googleusercontent.com'),
    expoUsername: getEnvVar('EXPO_USERNAME', 'ayush_bisen_pabbly'),
    expoSlug: getEnvVar('EXPO_SLUG', 'chatflow_mobile_native'),
  },

  apiTimeout: 30000,

  // Authentication
  tokenKey: '@pabbly_chatflow_token',
  userKey: '@pabbly_chatflow_user',

  // Features - from environment variables
  enablePushNotifications: getEnvVar('ENABLE_PUSH_NOTIFICATIONS', 'true') === 'true',
  enableBiometricAuth: getEnvVar('ENABLE_BIOMETRIC_AUTH', 'false') === 'true',
  enableDarkMode: getEnvVar('ENABLE_DARK_MODE', 'true') === 'true',

  // Pagination
  itemsPerPage: 20,

  // File Upload
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],

  // Chat
  messageLoadLimit: 50,
  typingIndicatorTimeout: 3000,

  // Cache
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
};

// Environment-specific configuration
export const ENV = {
  development: {
    apiUrl: getEnvVar('API_URL', 'https://chatflow.pabbly.com/api'),
    socketUrl: getEnvVar('SOCKET_URL', 'https://chatflow.pabbly.com/'),
    debug: true,
  },
  preview: {
    apiUrl: getEnvVar('API_URL', 'https://chatflow.pabbly.com/api'),
    socketUrl: getEnvVar('SOCKET_URL', 'https://chatflow.pabbly.com/'),
    debug: false,
  },
  production: {
    apiUrl: getEnvVar('API_URL', 'https://chatflow.pabbly.com/api'),
    socketUrl: getEnvVar('SOCKET_URL', 'https://chatflow.pabbly.com/'),
    debug: false,
  },
};

// Get current environment config
export const getCurrentEnv = () => {
  const debugMode = getEnvVar('DEBUG_MODE', 'false') === 'true';

  return {
    apiUrl: APP_CONFIG.apiUrl,
    socketUrl: APP_CONFIG.socketUrl,
    debug: debugMode || isDevelopment,
    isProduction,
    isPreview,
    isDevelopment,
    appEnv: APP_ENV,
  };
};

// Export environment helpers
export { isProduction, isPreview, isDevelopment, APP_ENV };
