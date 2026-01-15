import { format, formatDistance, formatRelative } from 'date-fns';

// Date formatting utilities
export const dateHelpers = {
  // Format date to readable string
  formatDate: (date, formatString = 'MMM dd, yyyy') => {
    return format(new Date(date), formatString);
  },

  // Format time
  formatTime: (date, formatString = 'hh:mm a') => {
    return format(new Date(date), formatString);
  },

  // Format datetime
  formatDateTime: (date, formatString = 'MMM dd, yyyy hh:mm a') => {
    return format(new Date(date), formatString);
  },

  // Relative time (e.g., "2 hours ago")
  formatRelativeTime: (date) => {
    return formatDistance(new Date(date), new Date(), { addSuffix: true });
  },

  // Chat time format
  formatChatTime: (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // If today, show time
    if (messageDate.toDateString() === today.toDateString()) {
      return format(messageDate, 'hh:mm a');
    }

    // If yesterday
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // If this week
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (messageDate > weekAgo) {
      return format(messageDate, 'EEEE');
    }

    // Otherwise show date
    return format(messageDate, 'MMM dd');
  },
};

// String utilities
export const stringHelpers = {
  // Truncate string
  truncate: (str, length = 50) => {
    if (!str) return '';
    return str.length > length ? `${str.substring(0, length)}...` : str;
  },

  // Capitalize first letter
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Get initials from name
  getInitials: (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  },

  // Format phone number
  formatPhoneNumber: (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    return phone;
  },
};

// Validation utilities
export const validators = {
  // Email validation
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Phone validation
  isValidPhone: (phone) => {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  // Password strength
  getPasswordStrength: (password) => {
    if (!password) return 0;
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    return strength;
  },

  // URL validation
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};

// Number utilities
export const numberHelpers = {
  // Format number with commas
  formatNumber: (num) => {
    if (!num && num !== 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // Format currency
  formatCurrency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },

  // Format percentage
  formatPercentage: (value, decimals = 0) => {
    return `${value.toFixed(decimals)}%`;
  },

  // Format file size
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },
};

// Color utilities
export const colorHelpers = {
  // Generate random color
  randomColor: () => {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
  },

  // Get contrast color (black or white)
  getContrastColor: (hexColor) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  },
};

// Export all helpers
export default {
  dateHelpers,
  stringHelpers,
  validators,
  numberHelpers,
  colorHelpers,
};
