import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors, darkColors } from './colors';
import { typography } from './typography';

// Light theme configuration
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary.main,
    primaryContainer: colors.primary.light,
    secondary: colors.secondary.main,
    secondaryContainer: colors.secondary.light,
    tertiary: colors.info.main,
    error: colors.error.main,
    errorContainer: colors.error.light,
    background: colors.background.default,
    surface: colors.background.paper,
    surfaceVariant: colors.background.neutral,
    onPrimary: colors.primary.contrastText,
    onSecondary: colors.secondary.contrastText,
    onBackground: colors.text.primary,
    onSurface: colors.text.primary,
    onSurfaceVariant: colors.text.secondary,
    outline: colors.divider,
    // Custom colors
    success: colors.success.main,
    successContainer: colors.success.light,
    warning: colors.warning.main,
    warningContainer: colors.warning.light,
    info: colors.info.main,
    infoContainer: colors.info.light,
  },
  typography,
  roundness: 8,
  spacing: (factor) => factor * 8,
};

// Dark theme configuration
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary.main,
    primaryContainer: darkColors.primary.dark,
    secondary: darkColors.secondary.main,
    secondaryContainer: darkColors.secondary.dark,
    tertiary: darkColors.info.main,
    error: darkColors.error.main,
    errorContainer: darkColors.error.dark,
    background: darkColors.background.default,
    surface: darkColors.background.paper,
    surfaceVariant: darkColors.background.neutral,
    onPrimary: darkColors.primary.contrastText,
    onSecondary: darkColors.secondary.contrastText,
    onBackground: darkColors.text.primary,
    onSurface: darkColors.text.primary,
    onSurfaceVariant: darkColors.text.secondary,
    outline: darkColors.divider,
    // Custom colors
    success: darkColors.success.main,
    successContainer: darkColors.success.dark,
    warning: darkColors.warning.main,
    warningContainer: darkColors.warning.dark,
    info: darkColors.info.main,
    infoContainer: darkColors.info.dark,
  },
  typography,
  roundness: 8,
  spacing: (factor) => factor * 8,
};
