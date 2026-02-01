import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Reusable SectionHeader component for section titles
 * @param {string} title - Section title text
 * @param {string} icon - Optional MaterialCommunityIcons icon name
 * @param {string} iconColor - Icon color
 * @param {number} count - Optional count to display in badge
 * @param {boolean} showBadge - Whether to show the count badge
 * @param {object} style - Additional container styles
 */
const SectionHeader = ({
  title,
  icon,
  iconColor = colors.primary.main,
  count,
  showBadge = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}15` }]}>
          <Icon name={icon} size={16} color={iconColor} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {showBadge && count !== undefined && count !== null && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  badge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});

export default SectionHeader;
