import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import { colors } from '../../theme/colors';

/**
 * Shadow presets matching the iOS shadow values from cardStyles.
 * react-native-shadow-2 renders identical shadows on both iOS and Android.
 *
 * card  → stronger shadow (settings cards, detail cards)
 * flat  → subtle shadow (dashboard cards, stats, list items)
 */
const SHADOW_PRESETS = {
  card: {
    distance: 6,
    startColor: '#00000008',
    offset: [0, 2],
  },
  flat: {
    distance: 4,
    startColor: '#00000005',
    offset: [0, 1],
  },
};

const MARGIN_KEYS = [
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
];

/**
 * Reusable card wrapper with consistent cross-platform shadows.
 *
 * @param {'card'|'flat'} variant - Shadow intensity (default: 'card')
 * @param {object} style - Styles for the inner card View (padding, overflow, width, etc.)
 *                         Margin props are auto-extracted to the Shadow container.
 * @param {React.ReactNode} children
 */
const ShadowCard = ({ variant = 'card', style, children }) => {
  const flatStyle = StyleSheet.flatten(style || {});

  // Separate margins (for Shadow container) from inner styles
  const containerMargins = {};
  const innerStyle = {};

  Object.keys(flatStyle).forEach((key) => {
    if (MARGIN_KEYS.includes(key)) {
      containerMargins[key] = flatStyle[key];
    } else {
      innerStyle[key] = flatStyle[key];
    }
  });

  const shadowProps = SHADOW_PRESETS[variant] || SHADOW_PRESETS.card;
  const hasExplicitWidth = flatStyle.width !== undefined;
  const borderRadius = innerStyle.borderRadius || 16;

  return (
    <Shadow
      {...shadowProps}
      stretch={!hasExplicitWidth}
      containerStyle={containerMargins}
      style={{ borderRadius }}
    >
      <View style={[styles.base, innerStyle]}>
        {children}
      </View>
    </Shadow>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
  },
});

export default ShadowCard;
