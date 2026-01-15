import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Reusable EmptyState component for displaying empty/no-data states
 * @param {string} icon - MaterialCommunityIcons icon name
 * @param {string} title - Main title text
 * @param {string} message - Description/subtitle text
 * @param {object} style - Additional container styles
 */
const EmptyState = ({
  icon = 'inbox-outline',
  title = 'No Data',
  message = 'Nothing to display',
  style,
}) => {
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
});

export default EmptyState;
