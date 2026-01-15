import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * Quality score color mapping
 */
export const QUALITY_COLORS = {
  GREEN: { color: '#22C55E', label: 'High', bg: '#DCFCE7' },
  YELLOW: { color: '#F59E0B', label: 'Medium', bg: '#FEF3C7' },
  RED: { color: '#EF4444', label: 'Low', bg: '#FEE2E2' },
};

/**
 * Reusable QualityBadge component for displaying quality scores
 * @param {string} score - Quality score key ('GREEN', 'YELLOW', 'RED')
 * @param {boolean} showDot - Whether to show the color dot
 * @param {object} style - Additional container styles
 */
const QualityBadge = ({ score, showDot = true, style }) => {
  const qualityInfo = QUALITY_COLORS[score];

  if (!qualityInfo) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: qualityInfo.bg }, style]}>
      {showDot && (
        <View style={[styles.dot, { backgroundColor: qualityInfo.color }]} />
      )}
      <Text style={[styles.text, { color: qualityInfo.color }]}>
        {qualityInfo.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default QualityBadge;
