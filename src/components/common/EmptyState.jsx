import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Reusable EmptyState component for displaying empty/no-data states
 * @param {string} icon - MaterialCommunityIcons icon name
 * @param {string} title - Main title text
 * @param {string} message - Description/subtitle text
 * @param {boolean} compact - Use compact inline size (minimal height)
 * @param {object} style - Additional container styles
 */
const EmptyState = ({
  icon = 'inbox-outline',
  title = 'No Data',
  message = 'Nothing to display',
  compact = false,
  style,
}) => {
  // Compact: inline layout with icon and text side by side
  if (compact) {
    return (
      <View style={[styles.containerCompact, style]}>
        <View style={styles.iconContainerCompact}>
          <Icon name={icon} size={18} color={colors.text.tertiary} />
        </View>
        <View style={styles.textContainerCompact}>
          <Text style={styles.titleCompact}>{title}</Text>
          <Text style={styles.messageCompact}>{message}</Text>
        </View>
      </View>
    );
  }

  // Default: centered vertical layout
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={48} color={colors.text.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // Default large centered layout
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Compact inline layout
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainerCompact: {
    flex: 1,
  },
  titleCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  messageCompact: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
});

export default EmptyState;
