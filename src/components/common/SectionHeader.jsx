import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../../theme/colors';

/**
 * Reusable SectionHeader component for section titles
 * @param {string} title - Section title text
 * @param {number} count - Optional count to display in badge
 * @param {boolean} showBadge - Whether to show the count badge
 * @param {object} style - Additional container styles
 */
const SectionHeader = ({
  title,
  count,
  showBadge = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

export default SectionHeader;
