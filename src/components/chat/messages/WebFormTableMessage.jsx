import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../../../theme/colors';

const WebFormTableMessage = ({ message }) => {
  if (!message || typeof message !== 'object') {
    return null;
  }

  // Extract entries that match the pattern: key contains _digit_ (e.g., "0_name", "1_email")
  const entries = Object.entries(message)
    .filter(([key]) => typeof key === 'string' && key.match(/_\d+_/))
    .map(([key, value]) => {
      // Extract label from key (e.g., "0_name" -> "name")
      const label = key.split(/_\d+_/)[1];
      // Clean value (remove any digit_ patterns)
      const cleanValue = String(value).replace(/\d_/g, '');
      return { label, value: cleanValue };
    });

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.tableHeader}>
        <Text style={styles.headerText}>Labels</Text>
        <Text style={styles.headerText}>Values</Text>
      </View>
      {entries.map(({ label, value }, index) => (
        <View key={index} style={styles.tableRow}>
          <View style={styles.labelCell}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.common.white,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.grey[100],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    minHeight: 40,
  },
  labelCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.06)',
    justifyContent: 'center',
  },
  valueCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 14,
    color: colors.text.primary,
  },
});

export default WebFormTableMessage;
