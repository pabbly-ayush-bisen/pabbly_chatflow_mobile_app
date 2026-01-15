import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * Get progress bar color based on percentage
 */
const getProgressColor = (percentage) => {
  if (percentage > 80) return '#EF4444'; // Red - high usage
  if (percentage > 50) return '#F59E0B'; // Yellow - medium usage
  return '#22C55E'; // Green - low usage
};

/**
 * Reusable ProgressBar component for displaying progress/usage
 * @param {number} percentage - Progress percentage (0-100)
 * @param {boolean} showLabel - Whether to show percentage label
 * @param {string} color - Optional custom color (overrides auto-color)
 * @param {number} height - Height of the progress bar
 * @param {object} style - Additional container styles
 */
const ProgressBar = ({
  percentage = 0,
  showLabel = true,
  color,
  height = 6,
  style,
}) => {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const barColor = color || getProgressColor(safePercentage);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${safePercentage}%`,
              backgroundColor: barColor,
              height,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: barColor }]}>
          {safePercentage.toFixed(0)}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
});

export default ProgressBar;
