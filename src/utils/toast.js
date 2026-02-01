/**
 * Toast Notification Utility
 * Centralized toast management for the application
 */
import Toast from 'react-native-toast-message';

// Toast types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

// Default durations
const DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 4000,
};

/**
 * Show a success toast
 * @param {string} message - The message to display
 * @param {string} [title] - Optional title
 * @param {object} [options] - Additional toast options
 */
export const showSuccess = (message, title = 'Success', options = {}) => {
  Toast.show({
    type: TOAST_TYPES.SUCCESS,
    text1: title,
    text2: message,
    visibilityTime: options.duration || DURATION.MEDIUM,
    position: options.position || 'top',
    ...options,
  });
};

/**
 * Show an error toast
 * @param {string} message - The error message to display
 * @param {string} [title] - Optional title
 * @param {object} [options] - Additional toast options
 */
export const showError = (message, title = 'Error', options = {}) => {
  Toast.show({
    type: TOAST_TYPES.ERROR,
    text1: title,
    text2: message || 'Something went wrong. Please try again.',
    visibilityTime: options.duration || DURATION.LONG,
    position: options.position || 'top',
    ...options,
  });
};

/**
 * Show an info toast
 * @param {string} message - The message to display
 * @param {string} [title] - Optional title
 * @param {object} [options] - Additional toast options
 */
export const showInfo = (message, title = 'Info', options = {}) => {
  Toast.show({
    type: TOAST_TYPES.INFO,
    text1: title,
    text2: message,
    visibilityTime: options.duration || DURATION.MEDIUM,
    position: options.position || 'top',
    ...options,
  });
};

/**
 * Show a warning toast
 * @param {string} message - The warning message to display
 * @param {string} [title] - Optional title
 * @param {object} [options] - Additional toast options
 */
export const showWarning = (message, title = 'Warning', options = {}) => {
  Toast.show({
    type: TOAST_TYPES.WARNING,
    text1: title,
    text2: message,
    visibilityTime: options.duration || DURATION.MEDIUM,
    position: options.position || 'top',
    ...options,
  });
};

/**
 * Hide any visible toast
 */
export const hideToast = () => {
  Toast.hide();
};

/**
 * Show toast based on API response
 * @param {object} response - API response object
 * @param {string} [successMessage] - Custom success message
 * @param {string} [errorMessage] - Custom error message
 */
export const showApiResponseToast = (response, successMessage, errorMessage) => {
  if (response?.status === 'success' || response?.success) {
    showSuccess(successMessage || response?.message || 'Operation completed successfully');
  } else {
    showError(errorMessage || response?.message || response?.error || 'Operation failed');
  }
};

/**
 * Show toast for common actions
 */
export const toastActions = {
  // Authentication
  loginSuccess: () => showSuccess('Welcome back!', 'Login Successful'),
  loginFailed: (msg) => showError(msg || 'Invalid credentials. Please try again.', 'Login Failed'),
  logoutSuccess: () => showSuccess('You have been logged out.', 'Logged Out'),
  sessionExpired: () => showWarning('Please login again to continue.', 'Session Expired'),

  // Data operations
  saveSuccess: () => showSuccess('Changes saved successfully.', 'Saved'),
  saveFailed: (msg) => showError(msg || 'Failed to save changes.', 'Save Failed'),
  deleteSuccess: () => showSuccess('Item deleted successfully.', 'Deleted'),
  deleteFailed: (msg) => showError(msg || 'Failed to delete item.', 'Delete Failed'),
  loadFailed: (msg) => showError(msg || 'Failed to load data.', 'Load Failed'),

  // Network
  networkError: () => showError('Please check your internet connection.', 'Network Error'),
  serverError: () => showError('Server is temporarily unavailable. Please try again later.', 'Server Error'),
  timeout: () => showError('Request timed out. Please try again.', 'Timeout'),

  // Messages
  messageSent: () => showSuccess('Message sent successfully.', 'Sent'),
  messageFailed: (msg) => showError(msg || 'Failed to send message.', 'Send Failed'),

  // File operations
  uploadSuccess: () => showSuccess('File uploaded successfully.', 'Upload Complete'),
  uploadFailed: (msg) => showError(msg || 'Failed to upload file.', 'Upload Failed'),
  downloadSuccess: () => showSuccess('File downloaded successfully.', 'Download Complete'),
  downloadFailed: (msg) => showError(msg || 'Failed to download file.', 'Download Failed'),

  // Copy
  copiedToClipboard: () => showSuccess('Copied to clipboard.', 'Copied'),

  // Generic
  actionSuccess: (msg) => showSuccess(msg || 'Action completed successfully.'),
  actionFailed: (msg) => showError(msg || 'Action failed. Please try again.'),
};

export default {
  show: Toast.show,
  hide: Toast.hide,
  showSuccess,
  showError,
  showInfo,
  showWarning,
  hideToast,
  showApiResponseToast,
  toastActions,
  TOAST_TYPES,
};
