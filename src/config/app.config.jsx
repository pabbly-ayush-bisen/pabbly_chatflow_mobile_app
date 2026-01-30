// App configuration
export const APP_CONFIG = {
  appName: 'Pabbly Chatflow',
  appVersion: '1.0.0',

  // API Configuration
  // Using the same API URL as the frontend web app (Production)
  apiUrl: 'https://chatflow.pabbly.com/api',
  socketUrl: 'https://chatflow.pabbly.com/',

  // Pabbly Accounts Configuration
  pabblyAccountsUrl: 'https://accounts.pabbly.com',
  pabblyAccountsBackendUrl: 'https://accounts.pabbly.com/backend',
  pabblyProject: 'pcf', // Project code for Pabbly ChatFlow

  // Google OAuth Configuration
  // ============================================================================
  // IMPORTANT: To enable native Google Sign-In, you need to:
  //
  // 1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials
  // 2. Create a new project or select existing
  // 3. Enable "Google Sign-In API" in APIs & Services → Library
  // 4. Create OAuth 2.0 Client IDs for each platform:
  //
  // FOR WEB (Expo Go development):
  //   - Type: Web application
  //   - Authorized JavaScript origins: https://auth.expo.io
  //   - Authorized redirect URIs: https://auth.expo.io/@YOUR_EXPO_USERNAME/chatflow_mobile_native
  //
  // FOR ANDROID:
  //   - Type: Android
  //   - Package name: com.pabbly.chatflow
  //   - SHA-1 fingerprint: Run 'keytool -list -v -keystore your-keystore.jks'
  //     For debug: keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  //
  // FOR iOS:
  //   - Type: iOS
  //   - Bundle ID: com.pabbly.chatflow
  //
  // NOTE: The WebView-based Google Sign-In (via Pabbly Accounts) works without these credentials.
  // Native credentials are optional but provide better UX with native account picker.
  // ============================================================================
  google: {
    // Web Client ID (pcf web) - used for Expo Go development
    webClientId: '848504831060-uen6psucq9c3ovguk3utheiidi4hpotc.apps.googleusercontent.com',
    // Android Client ID (pcf android) - used for production Android app
    androidClientId: '848504831060-p68o8ogq2lrfg7kg2tk42oosqfjnbodi.apps.googleusercontent.com',
    // iOS Client ID (pcf iOS) - used for production iOS app
    iosClientId: '848504831060-dt3ve1h090q2979md9eoqq8epc1rd7tr.apps.googleusercontent.com',
    // Expo username - IMPORTANT: Must match your Expo account username exactly
    // This is used for the auth.expo.io proxy redirect URI in Expo Go
    expoUsername: 'ayush_bisen_pabbly',
    // App slug from app.json - used for OAuth redirect URI
    expoSlug: 'chatflow_mobile_native',
  },
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
    apiUrl: 'https://chatflow.pabbly.com/api',
    socketUrl: 'https://chatflow.pabbly.com/',
    debug: true,
  },
  staging: {
    apiUrl: 'https://chatflow.pabbly.com/api',
    socketUrl: 'https://chatflow.pabbly.com/',
    debug: true,
  },
  production: {
    apiUrl: 'https://chatflow.pabbly.com/api',
    socketUrl: 'https://chatflow.pabbly.com/',
    debug: false,
  },
};

// Get current environment config
export const getCurrentEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  return ENV[env] || ENV.development;
};
