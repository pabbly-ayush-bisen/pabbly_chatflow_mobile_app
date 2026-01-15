import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value || 0;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.value}>{formattedValue}</Text>
      <Text style={styles.label}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});

export default StatsCard;
