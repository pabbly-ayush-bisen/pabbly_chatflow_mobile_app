import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.headerTitle}>
            Dashboard
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Welcome to Pabbly Chatflow
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.statNumber}>
                1,234
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Total Chats
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.statNumber}>
                456
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Active Flows
              </Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.statNumber}>
                789
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Contacts
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.statNumber}>
                92%
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Response Rate
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Quick Actions */}
        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.quickActions}>
            <Button
              mode="contained"
              style={styles.actionButton}
              icon="message-plus"
              onPress={() => { /* Log:('New Chat') */ }}
            >
              New Chat
            </Button>
            <Button
              mode="contained"
              style={styles.actionButton}
              icon="plus"
              onPress={() => { /* Log:('Create Flow') */ }}
            >
              Create Flow
            </Button>
          </View>
        </Surface>

        {/* Recent Activity */}
        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recent Activity
          </Text>
          <Card style={styles.activityCard}>
            <Card.Content>
              <Text variant="bodyMedium">New message from John Doe</Text>
              <Text variant="bodySmall" style={styles.timestamp}>
                2 minutes ago
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.activityCard}>
            <Card.Content>
              <Text variant="bodyMedium">Flow "Welcome Message" completed</Text>
              <Text variant="bodySmall" style={styles.timestamp}>
                15 minutes ago
              </Text>
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
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderRadius: 12,
  },
  statNumber: {
    color: colors.primary.main,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.text.secondary,
  },
  section: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActions: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 8,
  },
  activityCard: {
    marginBottom: 12,
    backgroundColor: colors.background.neutral,
  },
  timestamp: {
    color: colors.text.secondary,
    marginTop: 4,
  },
});
