/**
 * Centralized Error Handler
 * Normalizes and handles different types of errors across the application
 */
import { showError, showWarning, toastActions } from './toast';

// Error types for categorization
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
  PERMISSION: 'PERMISSION',
  NOT_FOUND: 'NOT_FOUND',
};

/**
 * Normalize error to a consistent format
 * @param {any} error - The error to normalize
 * @returns {object} Normalized error object
 */
export const normalizeError = (error) => {
  // Already normalized
  if (error?.normalized) {
    return error;
  }

  // String error
  if (typeof error === 'string') {
    return {
      normalized: true,
      type: ERROR_TYPES.UNKNOWN,
      message: error,
      originalError: error,
    };
  }

  // Axios error or API error
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;
    const message = data?.message || data?.error || error.message;

    let type = ERROR_TYPES.UNKNOWN;
    if (status === 401) type = ERROR_TYPES.AUTH;
    else if (status === 403) type = ERROR_TYPES.PERMISSION;
    else if (status === 404) type = ERROR_TYPES.NOT_FOUND;
    else if (status === 422 || status === 400) type = ERROR_TYPES.VALIDATION;
    else if (status >= 500) type = ERROR_TYPES.SERVER;

    return {
      normalized: true,
      type,
      message,
      status,
      data,
      originalError: error,
    };
  }

  // Network error
  if (error?.message?.includes('Network') || error?.code === 'ECONNABORTED' || error?.message?.includes('network')) {
    return {
      normalized: true,
      type: ERROR_TYPES.NETWORK,
      message: 'Network error. Please check your internet connection.',
      originalError: error,
    };
  }

  // Timeout error
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return {
      normalized: true,
      type: ERROR_TYPES.TIMEOUT,
      message: 'Request timed out. Please try again.',
      originalError: error,
    };
  }

  // Redux rejected action
  if (error?.payload) {
    return normalizeError(error.payload);
  }

  // Standard Error object
  if (error instanceof Error) {
    return {
      normalized: true,
      type: ERROR_TYPES.UNKNOWN,
      message: error.message || 'An unexpected error occurred.',
      originalError: error,
    };
  }

  // Object with message property
  if (error?.message) {
    return {
      normalized: true,
      type: ERROR_TYPES.UNKNOWN,
      message: error.message,
      originalError: error,
    };
  }

  // Unknown error
  return {
    normalized: true,
    type: ERROR_TYPES.UNKNOWN,
    message: 'An unexpected error occurred. Please try again.',
    originalError: error,
  };
};

/**
 * Handle error with appropriate toast notification
 * @param {any} error - The error to handle
 * @param {object} options - Options for error handling
 * @param {string} options.context - Context description (e.g., 'loading chats')
 * @param {boolean} options.silent - If true, don't show toast
 * @param {function} options.onAuthError - Callback for auth errors
 * @param {string} options.customMessage - Custom error message to show
 * @returns {object} Normalized error
 */
export const handleError = (error, options = {}) => {
  const { context, silent = false, onAuthError, customMessage } = options;
  const normalizedError = normalizeError(error);

  // Don't show toast if silent
  if (silent) {
    return normalizedError;
  }

  // Build error message
  let message = customMessage || normalizedError.message;
  if (context && !customMessage) {
    message = `Error ${context}: ${normalizedError.message}`;
  }

  // Handle based on error type
  switch (normalizedError.type) {
    case ERROR_TYPES.NETWORK:
      toastActions.networkError();
      break;

    case ERROR_TYPES.TIMEOUT:
      toastActions.timeout();
      break;

    case ERROR_TYPES.AUTH:
      if (onAuthError) {
        onAuthError(normalizedError);
      } else {
        toastActions.sessionExpired();
      }
      break;

    case ERROR_TYPES.SERVER:
      toastActions.serverError();
      break;

    case ERROR_TYPES.PERMISSION:
      showError('You do not have permission to perform this action.', 'Permission Denied');
      break;

    case ERROR_TYPES.NOT_FOUND:
      showError('The requested resource was not found.', 'Not Found');
      break;

    case ERROR_TYPES.VALIDATION:
      showError(message, 'Validation Error');
      break;

    default:
      showError(message);
      break;
  }

  return normalizedError;
};

/**
 * Safe async wrapper that catches and handles errors
 * @param {function} asyncFn - Async function to execute
 * @param {object} options - Error handling options
 * @returns {Promise<{data: any, error: object|null}>}
 */
export const safeAsync = async (asyncFn, options = {}) => {
  try {
    const data = await asyncFn();
    return { data, error: null };
  } catch (error) {
    const normalizedError = handleError(error, options);
    return { data: null, error: normalizedError };
  }
};

/**
 * Create a wrapped async function with error handling
 * @param {function} asyncFn - Async function to wrap
 * @param {object} defaultOptions - Default error handling options
 * @returns {function} Wrapped function
 */
export const withErrorHandling = (asyncFn, defaultOptions = {}) => {
  return async (...args) => {
    return safeAsync(() => asyncFn(...args), defaultOptions);
  };
};

/**
 * Handle Redux thunk error in component
 * @param {object} action - Redux action result
 * @param {object} options - Error handling options
 * @returns {boolean} True if action was successful
 */
export const handleThunkResult = (action, options = {}) => {
  if (action?.error || action?.payload?.error || action?.type?.endsWith('/rejected')) {
    const error = action?.payload || action?.error?.message || 'Action failed';
    handleError(error, options);
    return false;
  }
  return true;
};

/**
 * Global error handler for unhandled promise rejections
 * Call this in your app entry point
 */
export const setupGlobalErrorHandler = () => {
  // Handle unhandled promise rejections
  const handleUnhandledRejection = (error) => {
    const normalizedError = normalizeError(error);

    // Log for debugging in development
    if (__DEV__) {
      // Log to dev tools in development
    }

    // Don't show toast for every unhandled rejection in production
    // as it might be overwhelming. Log to error service instead.
  };

  // Note: In React Native, unhandled rejections are handled differently
  // This is mainly for documentation purposes
  if (typeof global !== 'undefined' && global.HermesInternal) {
    // Hermes engine
  }

  return handleUnhandledRejection;
};

export default {
  normalizeError,
  handleError,
  safeAsync,
  withErrorHandling,
  handleThunkResult,
  setupGlobalErrorHandler,
  ERROR_TYPES,
};
