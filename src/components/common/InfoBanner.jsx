import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const InfoBanner = ({ message, style }) => (
  <View style={[styles.container, style]}>
    <Icon name="information" size={18} color="#F57F17" />
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#F57F17',
    lineHeight: 18,
  },
});

export default InfoBanner;
