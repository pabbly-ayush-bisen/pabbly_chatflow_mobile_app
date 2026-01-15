// App configuration
export const APP_CONFIG = {
  appName: 'Pabbly Chatflow',
  appVersion: '1.0.0',

  // API Configuration
  // Using the same API URL as the frontend web app
  apiUrl: 'https://testchatflow.pabbly.com/api',
  socketUrl: 'https://testchatflow.pabbly.com/',
  apiTimeout: 30000,

  // Authentication
  tokenKey: '@pabbly_chatflow_token',
  userKey: '@pabbly_chatflow_user',

  // Features
  enablePushNotifications: true,
  enableBiometricAuth: false,
  enableDarkMode: true,

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
    apiUrl: 'https://testchatflow.pabbly.com/api',
    socketUrl: 'https://testchatflow.pabbly.com/',
    debug: true,
  },
  staging: {
    apiUrl: 'https://testchatflow.pabbly.com/api',
    socketUrl: 'https://testchatflow.pabbly.com/',
    debug: true,
  },
  production: {
    apiUrl: 'https://testchatflow.pabbly.com/api',
    socketUrl: 'https://testchatflow.pabbly.com/',
    debug: false,
  },
};

// Get current environment config
export const getCurrentEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  return ENV[env] || ENV.development;
};
