import React from 'react';
import { View, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { Text, Card, List, Divider, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function GetHelpScreen() {
  const appVersion = '1.0.0'; // You can dynamically get this from package.json

  const helpCategories = [
    {
      title: 'FAQs',
      icon: 'frequently-asked-questions',
      items: [
        {
          question: 'How do I send a message?',
          answer: 'Go to the Inbox screen, select a chat, and use the message input at the bottom to send messages.',
        },
        {
          question: 'How do I create a broadcast?',
          answer: 'Navigate to the Broadcasts screen, tap the + button, select recipients, compose your message, and send.',
        },
        {
          question: 'Can I use templates in messages?',
          answer: 'Yes, go to Templates screen to view available templates. You can use them when sending messages or broadcasts.',
        },
        {
          question: 'How do I manage contacts?',
          answer: 'Visit the Contacts screen to view, add, edit, or organize your contacts into lists.',
        },
        {
          question: 'What are quick replies?',
          answer: 'Quick replies are saved message templates you can use frequently. Create them in Settings > Quick Replies.',
        },
      ],
    },
  ];

  const documentationLinks = [
    {
      title: 'Getting Started Guide',
      url: 'https://www.pabbly.com/connect/docs/getting-started/',
      icon: 'book-open-variant',
    },
    {
      title: 'WhatsApp Business API',
      url: 'https://www.pabbly.com/connect/docs/whatsapp-business-api/',
      icon: 'api',
    },
    {
      title: 'Chatflow Documentation',
      url: 'https://www.pabbly.com/connect/docs/chatflow/',
      icon: 'file-document',
    },
    {
      title: 'Video Tutorials',
      url: 'https://www.youtube.com/c/PabblyOnline',
      icon: 'video',
    },
  ];

  const supportContacts = [
    {
      title: 'Email Support',
      value: 'support@pabbly.com',
      icon: 'email',
      action: () => handleEmailSupport(),
    },
    {
      title: 'Website',
      value: 'www.pabbly.com',
      icon: 'web',
      action: () => handleOpenWebsite('https://www.pabbly.com'),
    },
    {
      title: 'Help Center',
      value: 'Forum & Knowledge Base',
      icon: 'help-circle',
      action: () => handleOpenWebsite('https://forum.pabbly.com'),
    },
  ];

  const handleEmailSupport = () => {
    const email = 'support@pabbly.com';
    const subject = 'Pabbly Chatflow Mobile App Support';
    const body = `App Version: ${appVersion}\nPlatform: ${Platform.OS}\n\nDescribe your issue:\n\n`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          console.log("Can't handle email URL");
        }
      })
      .catch((err) => console.error('Error opening email:', err));
  };

  const handleOpenWebsite = (url) => {
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          console.log("Can't handle URL:", url);
        }
      })
      .catch((err) => console.error('Error opening URL:', err));
  };

  const handleOpenDocumentation = (url) => {
    handleOpenWebsite(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Get Help
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          FAQs, documentation, and support
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* FAQs Section */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Frequently Asked Questions
          </Text>

          {helpCategories[0].items.map((item, index) => (
            <View key={index} style={styles.faqItem}>
              <Text variant="titleMedium" style={styles.faqQuestion}>
                {item.question}
              </Text>
              <Text variant="bodyMedium" style={styles.faqAnswer}>
                {item.answer}
              </Text>
              {index < helpCategories[0].items.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </Surface>

        {/* Documentation Section */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Documentation
          </Text>

          {documentationLinks.map((link, index) => (
            <React.Fragment key={index}>
              <List.Item
                title={link.title}
                left={(props) => <List.Icon {...props} icon={link.icon} color={colors.primary.main} />}
                right={(props) => <List.Icon {...props} icon="open-in-new" />}
                onPress={() => handleOpenDocumentation(link.url)}
                style={styles.listItem}
                titleStyle={styles.listTitle}
              />
              {index < documentationLinks.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}
        </Surface>

        {/* Contact Support Section */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Contact Support
          </Text>

          {supportContacts.map((contact, index) => (
            <React.Fragment key={index}>
              <List.Item
                title={contact.title}
                description={contact.value}
                left={(props) => <List.Icon {...props} icon={contact.icon} color={colors.primary.main} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={contact.action}
                style={styles.listItem}
                titleStyle={styles.listTitle}
                descriptionStyle={styles.listDescription}
              />
              {index < supportContacts.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}

          <Button
            mode="contained"
            icon="email"
            onPress={handleEmailSupport}
            style={styles.emailButton}
          >
            Email Support Team
          </Button>
        </Surface>

        {/* App Info Section */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            App Information
          </Text>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              Version:
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {appVersion}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              Platform:
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {Platform.OS === 'ios' ? 'iOS' : 'Android'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>
              Build:
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              Production
            </Text>
          </View>
        </Surface>

        {/* Additional Resources */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Additional Resources
          </Text>

          <Card style={styles.resourceCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.resourceTitle}>
                Community Forum
              </Text>
              <Text variant="bodyMedium" style={styles.resourceDescription}>
                Join our community to connect with other users and get answers to your questions.
              </Text>
              <Button
                mode="outlined"
                onPress={() => handleOpenWebsite('https://forum.pabbly.com')}
                style={styles.resourceButton}
              >
                Visit Forum
              </Button>
            </Card.Content>
          </Card>

          <Card style={styles.resourceCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.resourceTitle}>
                Feature Requests
              </Text>
              <Text variant="bodyMedium" style={styles.resourceDescription}>
                Have an idea for a new feature? Let us know!
              </Text>
              <Button
                mode="outlined"
                onPress={() => handleEmailSupport()}
                style={styles.resourceButton}
              >
                Submit Request
              </Button>
            </Card.Content>
          </Card>
        </Surface>
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
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  listItem: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  listTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  listDescription: {
    color: colors.text.secondary,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: colors.divider,
  },
  emailButton: {
    marginTop: 16,
    backgroundColor: colors.primary.main,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  infoValue: {
    color: colors.text.primary,
  },
  resourceCard: {
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
    marginBottom: 12,
  },
  resourceTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  resourceDescription: {
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  resourceButton: {
    borderColor: colors.primary.main,
  },
});
