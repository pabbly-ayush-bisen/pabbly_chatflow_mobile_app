// Theme colors matching WhatsApp design

// Chat colors for WhatsApp-style UI
export const chatColors = {
  primary: '#128C7E',        // WhatsApp teal (primary accent)
  secondary: '#075E54',      // Dark teal
  accent: '#25D366',         // WhatsApp green (FAB, badges)
  outgoing: '#DCF8C6',       // Light green (outgoing bubble)
  outgoingDark: '#C5E1A5',   // Darker green for contrast
  chatBg: '#ECE5DD',         // WhatsApp chat background (beige/tan)
  incoming: '#FFFFFF',       // White (incoming bubble)
  tickBlue: '#53BDEB',       // WhatsApp blue tick color
  tickGrey: '#8E8E8E',       // Sent/delivered tick
  unreadBadge: '#25D366',    // Green for unread
  online: '#25D366',         // Green online indicator
  headerBg: '#075E54',       // Dark teal header background
  inputBg: '#F0F2F5',        // Input area background
  dateBadge: '#E1F2FB',      // Date separator badge
  dateBadgeText: '#455A64',  // Date separator text
  replyBg: '#F0F2F5',        // Reply preview background
  linkColor: '#039BE5',      // Link color in messages
  systemMessage: '#FFF8E1',  // System message background
  // Avatar colors based on name initials
  avatarColors: [
    '#128C7E', '#25D366', '#00BCD4', '#4CAF50', '#FF9800',
    '#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722',
  ],
};

// Helper function to get avatar color based on name
export const getAvatarColor = (name) => {
  if (!name) return chatColors.avatarColors[0];
  const charCode = name.charCodeAt(0);
  const index = charCode % chatColors.avatarColors.length;
  return chatColors.avatarColors[index];
};

export const colors = {
  primary: {
    lighter: '#CCF4FE',
    light: '#5BE49B',
    main: '#0C68E9',
    blue: '#078DEE',
    dark: '#0351AB',
    darker: '#004B50',
    contrastText: '#FFFFFF',
  },
  secondary: {
    lighter: '#EFD6FF',
    light: '#C684FF',
    main: '#8E33FF',
    dark: '#5119B7',
    darker: '#27097A',
    contrastText: '#FFFFFF',
  },
  info: {
    lighter: '#CAFDF5',
    light: '#61F3F3',
    main: '#00B8D9',
    dark: '#006C9C',
    darker: '#003768',
    contrastText: '#FFFFFF',
  },
  success: {
    lighter: '#D3FCD2',
    light: '#77ED8B',
    main: '#22C55E',
    dark: '#118D57',
    darker: '#065E49',
    contrastText: '#ffffff',
  },
  warning: {
    lighter: '#FFF5CC',
    light: '#FFD666',
    main: '#FFAB00',
    dark: '#B76E00',
    darker: '#7A4100',
    contrastText: '#1C252E',
  },
  error: {
    lighter: '#FFE9D5',
    light: '#FFAC82',
    main: '#FF5630',
    dark: '#B71D18',
    darker: '#7A0916',
    contrastText: '#FFFFFF',
  },
  grey: {
    50: '#FCFDFD',
    100: '#F9FAFB',
    200: '#F4F6F8',
    300: '#DFE3E8',
    400: '#C4CDD5',
    500: '#919EAB',
    600: '#637381',
    700: '#454F5B',
    800: '#1C252E',
    900: '#141A21',
  },
  common: {
    black: '#000000',
    white: '#FFFFFF',
  },
  text: {
    primary: '#1C252E',
    secondary: '#637381',
    tertiary: '#9CA3AF',
    disabled: '#919EAB',
  },
  background: {
    paper: '#FFFFFF',
    default: '#FFFFFF',
    neutral: '#F4F6F8',
  },
  divider: 'rgba(145, 158, 171, 0.2)',
};

// Dark mode colors
export const darkColors = {
  ...colors,
  text: {
    primary: '#FFFFFF',
    secondary: '#919EAB',
    disabled: '#637381',
  },
  background: {
    paper: '#1C252E',
    default: '#141A21',
    neutral: '#28323D',
  },
};
