import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar, Surface, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

export default function UserAttributesScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const { settings, getSettingsStatus, getSettingsError } = useSelector((state) => state.settings);

  const isLoading = getSettingsStatus === 'loading';
  const userAttributes = settings.userAttributes?.items || [];
  const totalCount = settings.userAttributes?.totalCount || 0;
  const isRefreshing = isLoading && userAttributes.length > 0;

  useEffect(() => {
    loadUserAttributes();
  }, []);

  const loadUserAttributes = () => {
    dispatch(getSettings('userAttributes'));
  };

  const onRefresh = () => {
    loadUserAttributes();
  };

  const filteredAttributes = userAttributes.filter((attr) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = attr.name?.toLowerCase() || '';
    const type = attr.type?.toLowerCase() || '';

    return name.includes(query) || type.includes(query);
  });

  const getTypeColor = (type) => {
    const typeColors = {
      string: colors.primary.main,
      number: colors.success.main,
      boolean: colors.warning.main,
      date: colors.info.main,
      array: colors.secondary.main,
      object: colors.error.main,
    };
    return typeColors[type?.toLowerCase()] || colors.grey[500];
  };

  const renderAttributeItem = ({ item }) => (
    <Card style={styles.attributeCard}>
      <Card.Content>
        <View style={styles.attributeHeader}>
          <Text variant="titleMedium" style={styles.attributeName}>
            {item.name || 'Unnamed'}
          </Text>
          <Chip
            mode="flat"
            style={[styles.typeChip, { backgroundColor: getTypeColor(item.type) }]}
            textStyle={styles.typeChipText}
          >
            {item.type || 'unknown'}
          </Chip>
        </View>

        {item.description && (
          <Text variant="bodyMedium" style={styles.attributeDescription}>
            {item.description}
          </Text>
        )}

        <View style={styles.attributeDetails}>
          {item.defaultValue !== undefined && item.defaultValue !== null && (
            <View style={styles.detailRow}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                Default Value:
              </Text>
              <Text variant="bodySmall" style={styles.detailValue}>
                {String(item.defaultValue)}
              </Text>
            </View>
          )}

          {item.required !== undefined && (
            <View style={styles.detailRow}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                Required:
              </Text>
              <Text variant="bodySmall" style={styles.detailValue}>
                {item.required ? 'Yes' : 'No'}
              </Text>
            </View>
          )}

          {item.key && (
            <View style={styles.detailRow}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                Key:
              </Text>
              <Text variant="bodySmall" style={styles.detailValue}>
                {item.key}
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No user attributes found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search'
          : 'No custom user attributes available'}
      </Text>
    </View>
  );

  const renderError = () => {
    if (!getSettingsError) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {getSettingsError}
        </Text>
      </Surface>
    );
  };

  if (isLoading && !isRefreshing && userAttributes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading user attributes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          User Attributes
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {totalCount} custom attributes (Read-only)
        </Text>

        <Searchbar
          placeholder="Search attributes"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      <FlatList
        data={filteredAttributes}
        renderItem={renderAttributeItem}
        keyExtractor={(item, index) => item._id || item.key || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
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
    paddingBottom: 80,
  },
  attributeCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  attributeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attributeName: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  typeChip: {
    height: 24,
  },
  typeChipText: {
    color: colors.common.white,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  attributeDescription: {
    color: colors.text.secondary,
    marginBottom: 12,
  },
  attributeDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.text.primary,
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
