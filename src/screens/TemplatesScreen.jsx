import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Surface, Chip, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllTemplates, fetchTemplateStats } from '../redux/slices/templateSlice';
import { colors } from '../theme/colors';

export default function TemplatesScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    templates,
    templatesStatus,
    templatesError,
    statsStatus,
    totalTemplates,
    approvedTemplates,
    pendingTemplates,
    draftTemplates,
    rejectedTemplates,
  } = useSelector((state) => state.template);

  const isLoading = templatesStatus === 'loading' || statsStatus === 'loading';
  const isRefreshing = templatesStatus === 'loading' && templates.length > 0;

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    dispatch(fetchTemplateStats());
    dispatch(fetchAllTemplates({ page: 0, limit: 50 }));
  };

  const onRefresh = () => {
    loadTemplates();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return colors.success.main;
      case 'pending':
        return colors.warning.main;
      case 'rejected':
        return colors.error.main;
      case 'draft':
        return colors.grey[500];
      default:
        return colors.grey[400];
    }
  };

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'marketing':
        return colors.info.main;
      case 'utility':
        return colors.primary.main;
      case 'authentication':
        return colors.secondary.main;
      default:
        return colors.grey[500];
    }
  };

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = template.name?.toLowerCase() || '';
    const category = template.category?.toLowerCase() || '';

    return name.includes(query) || category.includes(query);
  });

  const renderStatsCard = () => (
    <Surface style={styles.statsContainer}>
      <Text variant="titleLarge" style={styles.statsTitle}>
        Template Statistics
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={styles.statNumber}>
            {totalTemplates}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Total
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.success.main }]}>
            {approvedTemplates}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Approved
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.warning.main }]}>
            {pendingTemplates}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Pending
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.error.main }]}>
            {rejectedTemplates}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Rejected
          </Text>
        </View>
      </View>
    </Surface>
  );

  const renderTemplateItem = ({ item }) => (
    <Card style={styles.templateCard}>
      <Card.Content>
        <View style={styles.templateHeader}>
          <Text variant="titleMedium" style={styles.templateName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.badges}>
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
        </View>

        {item.category && (
          <Text variant="bodySmall" style={styles.templateCategory}>
            Category: {item.category}
          </Text>
        )}

        {item.language && (
          <Text variant="bodySmall" style={styles.templateLanguage}>
            Language: {item.language}
          </Text>
        )}

        {item.components && item.components.length > 0 && (
          <View style={styles.componentsContainer}>
            {item.components.map((component, index) => {
              if (component.type === 'BODY' && component.text) {
                return (
                  <View key={index} style={styles.bodyPreview}>
                    <Text variant="bodyMedium" style={styles.bodyText} numberOfLines={3}>
                      {component.text}
                    </Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
        )}

        {item.type && (
          <Chip
            mode="outlined"
            style={[styles.typeChip, { borderColor: getTypeColor(item.type) }]}
            textStyle={{ color: getTypeColor(item.type) }}
            compact
          >
            {item.type}
          </Chip>
        )}
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No templates found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Templates will appear here once they are created and approved.
      </Text>
    </View>
  );

  const renderError = () => {
    if (!templatesError) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {templatesError}
        </Text>
      </Surface>
    );
  };

  if (isLoading && !isRefreshing && templates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading templates...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Templates
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          View your WhatsApp message templates
        </Text>

        <Searchbar
          placeholder="Search templates"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      <FlatList
        data={filteredTemplates}
        renderItem={renderTemplateItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderStatsCard}
        ListEmptyComponent={renderEmptyState}
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
  templateCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateName: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  statusChip: {
    height: 24,
  },
  chipText: {
    color: colors.common.white,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  templateCategory: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  templateLanguage: {
    color: colors.text.secondary,
    marginBottom: 8,
  },
  componentsContainer: {
    marginBottom: 8,
  },
  bodyPreview: {
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  bodyText: {
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  typeChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
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
});
