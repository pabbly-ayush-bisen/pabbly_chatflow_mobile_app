import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Format credit numbers
 * - Very large numbers (>= 10^15 or special "unlimited" values) show as "Unlimited"
 * - All other numbers show full value with comma separators (e.g., 55,000)
 */
const formatCreditValue = (value) => {
  if (value === null || value === undefined) return '0';

  // Handle string values
  if (typeof value === 'string') {
    // Check if already formatted or special string
    if (value.toLowerCase() === 'unlimited') return 'Unlimited';
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    value = parsed;
  }

  // Handle non-finite numbers
  if (!isFinite(value)) return 'Unlimited';

  // Very large numbers (10^15 or more) are considered "Unlimited"
  // This handles values like 3.2e+109 which are effectively unlimited
  if (value >= 1e15) return 'Unlimited';

  // Negative numbers (shouldn't happen but handle gracefully)
  if (value < 0) return '0';

  // Show full number with comma separators
  return Math.round(value).toLocaleString();
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
  const formattedValue = formatCreditValue(value);

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
