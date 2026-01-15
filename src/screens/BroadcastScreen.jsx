import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Surface, FAB, Chip, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getBroadcasts, fetchBroadcastStats } from '../redux/slices/broadcastSlice';
import { colors } from '../theme/colors';

export default function BroadcastScreen({ navigation }) {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    broadcasts,
    broadcastsStatus,
    broadcastsError,
    statsStatus,
    totalBroadcast,
    liveBroadcast,
    sentBroadcast,
    scheduledBroadcast,
    failedBroadcast,
  } = useSelector((state) => state.broadcast);

  const isLoading = broadcastsStatus === 'loading' || statsStatus === 'loading';
  const isRefreshing = broadcastsStatus === 'loading' && broadcasts.length > 0;

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = () => {
    dispatch(fetchBroadcastStats());
    dispatch(getBroadcasts({ page: 0, limit: 50 }));
  };

  const onRefresh = () => {
    loadBroadcasts();
  };

  const handleCreateBroadcast = () => {
    navigation.navigate('CreateBroadcast');
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return colors.success.main;
      case 'live':
        return colors.info.main;
      case 'scheduled':
        return colors.warning.main;
      case 'failed':
        return colors.error.main;
      case 'stopped':
      case 'paused':
        return colors.grey[500];
      default:
        return colors.grey[400];
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredBroadcasts = broadcasts.filter((broadcast) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = broadcast.name?.toLowerCase() || '';

    return name.includes(query);
  });

  const renderStatsCard = () => (
    <Surface style={styles.statsContainer}>
      <Text variant="titleLarge" style={styles.statsTitle}>
        Broadcast Statistics
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={styles.statNumber}>
            {totalBroadcast}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Total
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.success.main }]}>
            {sentBroadcast}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Sent
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.info.main }]}>
            {liveBroadcast}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Live
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.warning.main }]}>
            {scheduledBroadcast}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Scheduled
          </Text>
        </View>
      </View>
    </Surface>
  );

  const renderBroadcastItem = ({ item }) => (
    <Card style={styles.broadcastCard}>
      <Card.Content>
        <View style={styles.broadcastHeader}>
          <Text variant="titleMedium" style={styles.broadcastName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.status && (
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={styles.chipText}
              compact
            >
              {item.status}
            </Chip>
          )}
        </View>

        <View style={styles.broadcastInfo}>
          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.infoLabel}>
              Recipients:
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {item.totalRecipients || 0}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.infoLabel}>
              Sent:
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {item.sentCount || 0}
            </Text>
          </View>

          {item.failedCount > 0 && (
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>
                Failed:
              </Text>
              <Text variant="bodyMedium" style={[styles.infoValue, { color: colors.error.main }]}>
                {item.failedCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.dateContainer}>
          <Text variant="bodySmall" style={styles.dateLabel}>
            Created: {formatDate(item.createdAt)}
          </Text>
          {item.scheduledAt && (
            <Text variant="bodySmall" style={styles.dateLabel}>
              Scheduled: {formatDate(item.scheduledAt)}
            </Text>
          )}
        </View>

        {item.message && (
          <View style={styles.messagePreview}>
            <Text variant="bodySmall" style={styles.messageText} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No broadcasts yet
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Create your first broadcast to reach multiple contacts at once
      </Text>
    </View>
  );

  const renderError = () => {
    if (!broadcastsError) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {broadcastsError}
        </Text>
      </Surface>
    );
  };

  if (isLoading && !isRefreshing && broadcasts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading broadcasts...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Broadcasts
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Manage your broadcast campaigns
        </Text>

        <Searchbar
          placeholder="Search broadcasts"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      <FlatList
        data={filteredBroadcasts}
        renderItem={renderBroadcastItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderStatsCard}
        ListEmptyComponent={renderEmptyState}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleCreateBroadcast}
        label="New Broadcast"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
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
    marginBottom: 16,
  },
  searchbar: {
    backgroundColor: colors.background.neutral,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  statsContainer: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  statsTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.primary.main,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.text.secondary,
  },
  broadcastCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  broadcastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  broadcastName: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    height: 24,
  },
  chipText: {
    color: colors.common.white,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  broadcastInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    color: colors.text.secondary,
  },
  infoValue: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  dateContainer: {
    marginBottom: 8,
  },
  dateLabel: {
    color: colors.text.secondary,
    marginBottom: 2,
  },
  messagePreview: {
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  messageText: {
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.error.lighter,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: colors.error.main,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary.main,
  },
});
