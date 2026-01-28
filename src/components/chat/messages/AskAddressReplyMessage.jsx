import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../../../theme/colors';

const AskAddressReplyMessage = ({ message }) => {
  const data = message?.values ?? message ?? {};

  const phoneNumber = data?.phone_number?.trim();

  const addressFields = [
    { key: 'address' },
    { key: 'landmark_area' },
    { key: 'house_number' },
    { key: 'floor_number' },
    { key: 'tower_number' },
    { key: 'building_name' },
    { key: 'in_pin_code' },
    { key: 'city' },
    { key: 'state' },
  ];

  const addressLine = addressFields
    .map(({ key }) => {
      const value = data?.[key];
      return typeof value === 'string' ? value.trim() : value;
    })
    .filter(Boolean)
    .join(', ');

  const hasAddress = Boolean(addressLine);

  if (!phoneNumber && !hasAddress) {
    return null;
  }

  return (
    <View style={styles.container}>
      {phoneNumber && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHONE</Text>
          <Text style={styles.sectionValue}>{phoneNumber}</Text>
        </View>
      )}

      {phoneNumber && hasAddress && <View style={styles.divider} />}

      {hasAddress && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ADDRESS DETAILS</Text>
          <Text style={styles.addressValue}>{addressLine}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  section: {
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    color: colors.text.primary,
  },
  addressValue: {
    fontSize: 14,
    color: colors.text.primary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey[300],
    marginVertical: 8,
  },
});

export default AskAddressReplyMessage;
