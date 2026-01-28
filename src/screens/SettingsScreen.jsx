import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function SettingsScreen({ navigation }) {
  const settingsOptions = [
    {
      section: 'General',
      items: [
        {
          title: 'Opt-in Management',
          description: 'Manage opt-in and opt-out settings',
          icon: 'check-circle-outline',
          screen: 'OptInManagement',
        },
        {
          title: 'Inbox Settings',
          description: 'Read receipts, messages & working hours',
          icon: 'cog-outline',
          screen: 'InboxSettings',
        },
      ],
    },
    {
      section: 'Management',
      items: [
        {
          title: 'Contact Custom Field',
          description: 'View custom contact fields',
          icon: 'form-textbox',
          screen: 'ContactCustomField',
        },
        {
          title: 'Tags',
          description: 'Manage tags for contacts',
          icon: 'tag-multiple',
          screen: 'Tags',
        },
        {
          title: 'Quick Replies',
          description: 'Manage quick reply templates',
          icon: 'reply',
          screen: 'QuickReplies',
        },
        {
          title: 'Team Members',
          description: 'View team members',
          icon: 'account-group',
          screen: 'TeamMember',
        },
      ],
    },
    {
      section: 'Support',
      items: [
        {
          title: 'Get Help',
          description: 'FAQs, documentation, and support',
          icon: 'help-circle-outline',
          screen: 'GetHelp',
        },
      ],
    },
  ];

  const handleNavigation = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Manage your app preferences and configurations
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {settingsOptions.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {section.section}
            </Text>

            {section.items.map((item, itemIndex) => (
              <React.Fragment key={itemIndex}>
                <List.Item
                  title={item.title}
                  description={item.description}
                  left={(props) => <List.Icon {...props} icon={item.icon} color={colors.primary.main} />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => handleNavigation(item.screen)}
                  style={styles.listItem}
                  titleStyle={styles.listTitle}
                  descriptionStyle={styles.listDescription}
                />
                {itemIndex < section.items.length - 1 && <Divider style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  section: {
    backgroundColor: colors.background.paper,
    marginBottom: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  listDescription: {
    color: colors.text.secondary,
  },
  divider: {
    marginHorizontal: 16,
    backgroundColor: colors.divider,
  },
});
