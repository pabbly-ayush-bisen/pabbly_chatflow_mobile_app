import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar, Surface, Switch, Chip, Portal, Modal, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getAssistants, getAssistantStats, getAssistant } from '../redux/slices/assistantSlice';
import { colors } from '../theme/colors';

export default function AIAssistantScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [detailsVisible, setDetailsVisible] = useState(false);

  const {
    assistants,
    selectedAssistant,
    assistantsStatus,
    assistantsError,
    assistantStatus,
    statsStatus,
    totalAssistants,
    activeAssistants,
    inactiveAssistants,
    totalResults,
  } = useSelector((state) => state.assistant);

  const isLoading = assistantsStatus === 'loading';
  const isRefreshing = isLoading && assistants.length > 0;
  const isLoadingDetails = assistantStatus === 'loading';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAssistants();
  }, [searchQuery, selectedStatus]);

  const loadData = () => {
    dispatch(getAssistantStats());
    loadAssistants();
  };

  const loadAssistants = () => {
    const params = {
      page: 1,
      limit: 50,
      status: selectedStatus,
    };

    if (searchQuery) {
      params.name = searchQuery;
    }

    dispatch(getAssistants(params));
  };

  const onRefresh = () => {
    loadData();
  };

  const handleAssistantPress = (assistant) => {
    dispatch(getAssistant(assistant._id));
    setDetailsVisible(true);
  };

  const handleStatusFilter = (status) => {
    setSelectedStatus(status);
  };

  const renderStatsCard = () => (
    <Surface style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.statNumber}>
              {totalAssistants}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Total Assistants
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.success.main }]}>
              {activeAssistants}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Active
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.grey[500] }]}>
              {inactiveAssistants}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Inactive
            </Text>
          </Card.Content>
        </Card>
      </View>
    </Surface>
  );

  const renderStatusFilters = () => (
    <View style={styles.filterContainer}>
      <Chip
        selected={selectedStatus === 'all'}
        onPress={() => handleStatusFilter('all')}
        style={[styles.filterChip, selectedStatus === 'all' && styles.filterChipSelected]}
        textStyle={selectedStatus === 'all' && styles.filterChipTextSelected}
      >
        All
      </Chip>
      <Chip
        selected={selectedStatus === 'active'}
        onPress={() => handleStatusFilter('active')}
        style={[styles.filterChip, selectedStatus === 'active' && styles.filterChipSelected]}
        textStyle={selectedStatus === 'active' && styles.filterChipTextSelected}
      >
        Active
      </Chip>
      <Chip
        selected={selectedStatus === 'inactive'}
        onPress={() => handleStatusFilter('inactive')}
        style={[styles.filterChip, selectedStatus === 'inactive' && styles.filterChipSelected]}
        textStyle={selectedStatus === 'inactive' && styles.filterChipTextSelected}
      >
        Inactive
      </Chip>
    </View>
  );

  const renderAssistantItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleAssistantPress(item)}>
      <Card style={styles.assistantCard}>
        <Card.Content>
          <View style={styles.assistantHeader}>
            <View style={styles.assistantInfo}>
              <Text variant="titleMedium" style={styles.assistantName}>
                {item.name}
              </Text>
              <Text variant="bodySmall" style={styles.assistantId}>
                ID: {item._id}
              </Text>
            </View>

            <View style={styles.statusContainer}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'active' ? colors.success.light : colors.grey[400] }
              ]}>
                <Text variant="bodySmall" style={styles.statusText}>
                  {item.status || 'inactive'}
                </Text>
              </View>
              <Switch
                value={item.status === 'active'}
                disabled={true}
                color={colors.grey[400]}
              />
            </View>
          </View>

          {item.description && (
            <Text variant="bodyMedium" style={styles.assistantDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="bodySmall" style={styles.statItemLabel}>
                Conversations
              </Text>
              <Text variant="titleMedium" style={styles.statItemValue}>
                {item.conversationCount || 0}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text variant="bodySmall" style={styles.statItemLabel}>
                Success Rate
              </Text>
              <Text variant="titleMedium" style={styles.statItemValue}>
                {item.successRate || 0}%
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text variant="bodySmall" style={styles.statItemLabel}>
                Responses
              </Text>
              <Text variant="titleMedium" style={styles.statItemValue}>
                {item.responseCount || 0}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderDetailsModal = () => {
    if (!selectedAssistant) return null;

    return (
      <Portal>
        <Modal
          visible={detailsVisible}
          onDismiss={() => setDetailsVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          {isLoadingDetails ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
          ) : (
            <>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {selectedAssistant.name}
              </Text>

              <View style={styles.modalSection}>
                <Text variant="titleMedium" style={styles.modalSectionTitle}>
                  Status
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: selectedAssistant.status === 'active' ? colors.success.light : colors.grey[400] }
                ]}>
                  <Text variant="bodyMedium" style={styles.statusText}>
                    {selectedAssistant.status || 'inactive'}
                  </Text>
                </View>
              </View>

              {selectedAssistant.description && (
                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Description
                  </Text>
                  <Text variant="bodyMedium" style={styles.modalText}>
                    {selectedAssistant.description}
                  </Text>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text variant="titleMedium" style={styles.modalSectionTitle}>
                  Statistics
                </Text>
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatItem}>
                    <Text variant="bodySmall" style={styles.modalStatLabel}>
                      Conversations
                    </Text>
                    <Text variant="headlineSmall" style={styles.modalStatValue}>
                      {selectedAssistant.conversationCount || 0}
                    </Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text variant="bodySmall" style={styles.modalStatLabel}>
                      Success Rate
                    </Text>
                    <Text variant="headlineSmall" style={styles.modalStatValue}>
                      {selectedAssistant.successRate || 0}%
                    </Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text variant="bodySmall" style={styles.modalStatLabel}>
                      Responses
                    </Text>
                    <Text variant="headlineSmall" style={styles.modalStatValue}>
                      {selectedAssistant.responseCount || 0}
                    </Text>
                  </View>
                </View>
              </View>

              <Button
                mode="contained"
                onPress={() => setDetailsVisible(false)}
                style={styles.modalButton}
              >
                Close
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No assistants found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search'
          : 'No AI assistants available'}
      </Text>
    </View>
  );

  const renderError = () => {
    if (!assistantsError) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {assistantsError}
        </Text>
      </Surface>
    );
  };

  if (isLoading && !isRefreshing && assistants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading AI assistants...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          AI Assistants
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {totalResults} assistants available (Read-only)
        </Text>

        <Searchbar
          placeholder="Search assistants"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      {statsStatus !== 'loading' && renderStatsCard()}
      {renderStatusFilters()}

      <FlatList
        data={assistants}
        renderItem={renderAssistantItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {renderDetailsModal()}
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
  statsContainer: {
    backgroundColor: colors.background.paper,
    padding: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
  },
  statNumber: {
    color: colors.primary.main,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: colors.background.paper,
  },
  filterChip: {
    backgroundColor: colors.background.neutral,
  },
  filterChipSelected: {
    backgroundColor: colors.primary.main,
  },
  filterChipTextSelected: {
    color: colors.common.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  assistantCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  assistantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  assistantInfo: {
    flex: 1,
  },
  assistantName: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  assistantId: {
    color: colors.text.secondary,
    fontSize: 11,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: colors.common.white,
    textTransform: 'capitalize',
  },
  assistantDescription: {
    color: colors.text.secondary,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemLabel: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statItemValue: {
    color: colors.text.primary,
    fontWeight: '600',
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
  modalContent: {
    backgroundColor: colors.background.paper,
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalText: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatLabel: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  modalStatValue: {
    color: colors.primary.main,
    fontWeight: '700',
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: colors.primary.main,
  },
});
