import { Platform, StyleSheet } from 'react-native';

/**
 * Platform-specific styles utility
 * Ensures consistent UI across iOS and Android
 */

// Default text input style for Android to match iOS
export const textInputStyle = Platform.select({
  android: {
    fontWeight: '400',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  ios: {},
});

// Normalize font weight for Android
export const normalFontWeight = Platform.select({
  android: '400',
  ios: 'normal',
});

// Medium font weight that looks consistent across platforms
export const mediumFontWeight = Platform.select({
  android: '500',
  ios: '500',
});

// Semi-bold font weight
export const semiBoldFontWeight = Platform.select({
  android: '600',
  ios: '600',
});

// Bold font weight
export const boldFontWeight = Platform.select({
  android: '700',
  ios: '700',
});

// Common input styles that work well on both platforms
export const commonInputStyles = StyleSheet.create({
  input: {
    fontWeight: normalFontWeight,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
        paddingVertical: 0,
      },
      ios: {},
    }),
  },
  searchInput: {
    fontWeight: normalFontWeight,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
      },
      ios: {},
    }),
  },
});

// Shadow styles that work on both platforms
export const createShadow = (elevation = 4, color = '#000') => ({
  ...Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.1 + (elevation * 0.02),
      shadowRadius: elevation,
    },
    android: {
      elevation: elevation,
    },
  }),
});

// Tab bar specific styles for Android
export const tabBarStyles = Platform.select({
  android: {
    paddingBottom: 8,
    height: 65,
  },
  ios: {},
});

export default {
  textInputStyle,
  normalFontWeight,
  mediumFontWeight,
  semiBoldFontWeight,
  boldFontWeight,
  commonInputStyles,
  createShadow,
  tabBarStyles,
};
