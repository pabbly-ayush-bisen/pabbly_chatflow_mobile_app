import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function SettingsScreen({ navigation }) {

  // Settings menu items organized by category
  const settingsItems = [
    {
      title: 'Inbox Settings',
      description: 'Messages, working hours & read receipts',
      icon: 'inbox-outline',
      color: '#2196F3',
      bg: '#E3F2FD',
      screen: 'InboxSettings',
    },
    {
      title: 'Quick Replies',
      description: 'Manage quick response templates',
      icon: 'lightning-bolt-outline',
      color: '#FF9800',
      bg: '#FFF3E0',
      screen: 'QuickReplies',
    },
    {
      title: 'Tags',
      description: 'Organize contacts with tags',
      icon: 'tag-multiple-outline',
      color: '#9C27B0',
      bg: '#F3E5F5',
      screen: 'Tags',
    },
    {
      title: 'Contact Custom Fields',
      description: 'View custom contact attributes',
      icon: 'form-textbox',
      color: '#009688',
      bg: '#E0F2F1',
      screen: 'ContactCustomField',
    },
    {
      title: 'Opt-in Management',
      description: 'Manage subscription settings',
      icon: 'check-decagram-outline',
      color: '#4CAF50',
      bg: '#E8F5E9',
      screen: 'OptInManagement',
    },
    {
      title: 'Chat Rules',
      description: 'Status & assignment rules',
      icon: 'swap-horizontal',
      color: '#3F51B5',
      bg: '#E8EAF6',
      screen: 'ChatRules',
    },
    {
      title: 'Configure SLA',
      description: 'Response time settings',
      icon: 'clock-check-outline',
      color: '#E91E63',
      bg: '#FCE4EC',
      screen: 'ConfigureSLA',
    },
    {
      title: 'Time Zone',
      description: 'View timezone configuration',
      icon: 'earth',
      color: '#607D8B',
      bg: '#ECEFF1',
      screen: 'TimeZone',
    },
  ];

  const handleNavigation = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings List Card */}
        <View style={styles.settingsCard}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.settingItem,
                index < settingsItems.length - 1 && styles.settingItemBorder,
              ]}
              onPress={() => handleNavigation(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.settingIconBox, { backgroundColor: item.bg }]}>
                <Icon name={item.icon} size={22} color={item.color} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.grey[400]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },

  // Settings Card
  settingsCard: {
    backgroundColor: colors.common.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    marginBottom: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  settingIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  bottomSpacing: {
    height: 24,
  },
});
