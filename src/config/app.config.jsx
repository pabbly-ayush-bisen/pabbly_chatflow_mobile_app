import Constants from 'expo-constants';

// Environment detection from expo-constants (set by app.config.js/eas.json)
const getExpoEnvVar = (key, defaultValue) => {
  // Check expo-constants extra (from app.config.js during build)
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }
  return defaultValue;
};

// Environment detection
const APP_ENV = getExpoEnvVar('APP_ENV', 'development');
const isProduction = APP_ENV === 'production';
const isPreview = APP_ENV === 'preview';
const isDevelopment = APP_ENV === 'development';

// App configuration
// Default values point to testchatflow for development
// EAS builds will override via eas.json env variables
export const APP_CONFIG = {
  appName: 'Pabbly Chatflow',
  appVersion: '1.0.0',
  appEnv: APP_ENV,

  // API Configuration - defaults to testchatflow
  apiUrl: getExpoEnvVar('API_URL', 'https://testchatflow.pabbly.com/api'),
  socketUrl: getExpoEnvVar('SOCKET_URL', 'https://testchatflow.pabbly.com/'),

  // OneSignal Configuration
  oneSignalAppId: 'f078c1e9-fe64-4ef6-ae44-4546b082f14e',

  // Pabbly Accounts Configuration
  pabblyAccountsUrl: getExpoEnvVar('PABBLY_ACCOUNTS_URL', 'https://accounts.pabbly.com'),
  pabblyAccountsBackendUrl: getExpoEnvVar('PABBLY_ACCOUNTS_BACKEND_URL', 'https://accounts.pabbly.com/backend'),
  pabblyProject: getExpoEnvVar('PABBLY_PROJECT', 'pcf'),

  // Google OAuth Configuration
  google: {
    webClientId: getExpoEnvVar('GOOGLE_WEB_CLIENT_ID', '848504831060-uen6psucq9c3ovguk3utheiidi4hpotc.apps.googleusercontent.com'),
    androidClientId: getExpoEnvVar('GOOGLE_ANDROID_CLIENT_ID', '848504831060-p68o8ogq2lrfg7kg2tk42oosqfjnbodi.apps.googleusercontent.com'),
    iosClientId: getExpoEnvVar('GOOGLE_IOS_CLIENT_ID', '848504831060-dt3ve1h090q2979md9eoqq8epc1rd7tr.apps.googleusercontent.com'),
    expoUsername: getExpoEnvVar('EXPO_USERNAME', 'aakash-bhelkar-pabbly'),
    expoSlug: getExpoEnvVar('EXPO_SLUG', 'chatflow_mobile_native'),
  },

  apiTimeout: 30000,

  // Authentication
  tokenKey: '@pabbly_chatflow_token',
  userKey: '@pabbly_chatflow_user',

  // Features
  enablePushNotifications: getExpoEnvVar('ENABLE_PUSH_NOTIFICATIONS', 'true') === 'true',
  enableBiometricAuth: getExpoEnvVar('ENABLE_BIOMETRIC_AUTH', 'false') === 'true',
  enableDarkMode: getExpoEnvVar('ENABLE_DARK_MODE', 'true') === 'true',

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

// Check if using testchatflow API (for direct login)
export const isTestChatflow = () => {
  return APP_CONFIG.apiUrl.includes('testchatflow');
};

// Get current environment config
export const getCurrentEnv = () => {
  const debugMode = getExpoEnvVar('DEBUG_MODE', 'false') === 'true';

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
