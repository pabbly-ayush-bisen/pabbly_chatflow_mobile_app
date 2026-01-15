import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

const FILTERS = [
  { id: 'all', label: 'All', icon: 'message-text-outline' },
  { id: 'unread', label: 'Unread', icon: 'email-outline' },
  { id: 'assigned_to_me', label: 'Assigned to me', icon: 'account-check-outline' },
];

const FilterChips = ({ activeFilter, onFilterChange, unreadCount = 0 }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const showBadge = filter.id === 'unread' && unreadCount > 0;

          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onFilterChange(filter.id)}
              activeOpacity={0.7}
            >
              <Icon
                name={filter.icon}
                size={16}
                color={isActive ? colors.common.white : colors.text.secondary}
              />
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {filter.label}
              </Text>
              {showBadge && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.common.white,
    borderBottomWidth: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    gap: 6,
  },
  chipActive: {
    backgroundColor: chatColors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.common.white,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: chatColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  badgeActive: {
    backgroundColor: colors.common.white,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.common.white,
  },
  badgeTextActive: {
    color: chatColors.primary,
  },
});

export default FilterChips;
