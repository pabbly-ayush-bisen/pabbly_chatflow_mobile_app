import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * Status color mapping for common statuses
 */
export const STATUS_COLORS = {
  CONNECTED: { bg: '#DCFCE7', text: '#166534', label: 'Connected' },
  PENDING: { bg: '#DBEAFE', text: '#1E40AF', label: 'Pending' },
  DISCONNECTED: { bg: '#FEE2E2', text: '#991B1B', label: 'Disconnected' },
  EXPIRED: { bg: '#FEF3C7', text: '#92400E', label: 'Expired' },
  BANNED: { bg: '#FEE2E2', text: '#991B1B', label: 'Banned' },
  ACTIVE: { bg: '#DCFCE7', text: '#166534', label: 'Active' },
  INACTIVE: { bg: '#F3F4F6', text: '#6B7280', label: 'Inactive' },
};

/**
 * Reusable StatusBadge component for displaying status indicators
 * @param {string} status - Status key to look up in STATUS_COLORS
 * @param {string} label - Optional custom label (overrides default)
 * @param {string} bgColor - Optional custom background color
 * @param {string} textColor - Optional custom text color
 * @param {object} style - Additional container styles
 */
const StatusBadge = ({ status, label, bgColor, textColor, style }) => {
  const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.INACTIVE;

  const backgroundColor = bgColor || statusInfo.bg;
  const color = textColor || statusInfo.text;
  const displayLabel = label || statusInfo.label;

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <Text style={[styles.text, { color }]}>
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default StatusBadge;
