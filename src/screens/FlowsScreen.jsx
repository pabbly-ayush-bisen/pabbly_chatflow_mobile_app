import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Chip, IconButton, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const DUMMY_FLOWS = [
  { id: '1', name: 'Welcome Message', status: 'Active', triggers: 5, responses: 123 },
  { id: '2', name: 'Order Confirmation', status: 'Active', triggers: 8, responses: 89 },
  { id: '3', name: 'Customer Support', status: 'Paused', triggers: 3, responses: 45 },
  { id: '4', name: 'Feedback Collection', status: 'Active', triggers: 2, responses: 67 },
];

export default function FlowsScreen() {
  const renderFlowCard = ({ item }) => (
    <Card style={styles.flowCard}>
      <Card.Content>
        <View style={styles.flowHeader}>
          <Text variant="titleMedium" style={styles.flowName}>
            {item.name}
          </Text>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              item.status === 'Active'
                ? { backgroundColor: colors.success.lighter }
                : { backgroundColor: colors.warning.lighter },
            ]}
            textStyle={{
              color: item.status === 'Active' ? colors.success.dark : colors.warning.dark,
            }}
          >
            {item.status}
          </Chip>
        </View>

        <View style={styles.flowStats}>
          <View style={styles.statItem}>
            <Text variant="bodySmall" style={styles.statLabel}>
              Triggers
            </Text>
            <Text variant="titleMedium" style={styles.statValue}>
              {item.triggers}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="bodySmall" style={styles.statLabel}>
              Responses
            </Text>
            <Text variant="titleMedium" style={styles.statValue}>
              {item.responses}
            </Text>
          </View>
        </View>
      </Card.Content>

      <Card.Actions>
        <IconButton icon="pencil" size={20} onPress={() => { /* Log:('Edit') */ }} />
        <IconButton icon="eye" size={20} onPress={() => { /* Log:('View') */ }} />
        <IconButton icon="delete" size={20} onPress={() => { /* Log:('Delete') */ }} />
      </Card.Actions>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Flows
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Manage your automated workflows
        </Text>
      </View>

      <FlatList
        data={DUMMY_FLOWS}
        renderItem={renderFlowCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.flowList}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => { /* Log:('Create new flow') */ }}
        label="New Flow"
      />
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
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
  },
  flowList: {
    padding: 16,
    paddingBottom: 80,
  },
  flowCard: {
    marginBottom: 16,
    backgroundColor: colors.background.paper,
    borderRadius: 12,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  flowName: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    marginLeft: 8,
  },
  flowStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statValue: {
    color: colors.primary.main,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary.main,
  },
});
