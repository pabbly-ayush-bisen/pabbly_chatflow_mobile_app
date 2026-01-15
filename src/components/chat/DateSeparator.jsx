import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, chatColors } from '../../theme/colors';

const DateSeparator = ({ date }) => {
  const formatDate = (dateValue) => {
    if (!dateValue) return '';

    const messageDate = new Date(dateValue);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    }

    if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    }

    // Check if within last week
    const daysAgo = Math.floor((todayOnly - messageDateOnly) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return weekdays[messageDate.getDay()];
    }

    // Format as date
    return messageDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.text}>{formatDate(date)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  badge: {
    backgroundColor: chatColors.dateBadge,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: chatColors.dateBadgeText,
  },
});

export default memo(DateSeparator);
