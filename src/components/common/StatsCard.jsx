import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Format large numbers to display in human-readable format
 * Uses K, M, B, T suffixes for thousands, millions, billions, trillions
 * @param {number|string} num - The number to format
 * @returns {string} Formatted number string (e.g., "1.2K", "3.5M", "2.1B")
 */
const formatLargeNumber = (num) => {
  // Handle null, undefined, or non-numeric values
  if (num === null || num === undefined) return '0';

  // Convert to string first to handle scientific notation input
  const numStr = String(num);

  // Parse the number (handles both regular and scientific notation)
  const parsed = parseFloat(numStr);
  if (!isFinite(parsed)) return '0';

  const absNum = Math.abs(parsed);
  const sign = parsed < 0 ? '-' : '';

  // Format based on magnitude with appropriate suffix
  if (absNum >= 1e12) {
    // Trillions
    return `${sign}${(absNum / 1e12).toFixed(1)}T`;
  } else if (absNum >= 1e9) {
    // Billions
    return `${sign}${(absNum / 1e9).toFixed(1)}B`;
  } else if (absNum >= 1e6) {
    // Millions
    return `${sign}${(absNum / 1e6).toFixed(1)}M`;
  } else if (absNum >= 1e3) {
    // Thousands
    return `${sign}${(absNum / 1e3).toFixed(1)}K`;
  }

  // For smaller numbers, use locale formatting with commas
  return parsed.toLocaleString();
};

/**
 * Reusable StatsCard component for displaying statistics
 * @param {string} title - Label text below the value
 * @param {number|string} value - Main statistic value
 * @param {string} icon - MaterialCommunityIcons icon name
 * @param {string} iconBg - Background color for icon container
 * @param {string} iconColor - Icon color
 * @param {object} style - Additional container styles
 */
const StatsCard = ({
  title,
  value,
  icon,
  iconBg = '#F3F4F6',
  iconColor = '#6B7280',
  style,
}) => {
  const formattedValue = formatLargeNumber(value);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.label}>{title}</Text>
      </View>
      <Text style={styles.value}>{formattedValue}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
  },
});

export default StatsCard;
