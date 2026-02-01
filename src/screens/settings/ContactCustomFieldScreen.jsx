import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator, Searchbar, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

export default function ContactCustomFieldScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);

  const isLoading = getSettingsStatus === 'loading';
  const customFields = settings.userAttributes?.items || [];
  const totalCount = settings.userAttributes?.totalCount || customFields.length;
  const isRefreshing = isLoading && customFields.length > 0;

  useEffect(() => {
    loadCustomFields();
  }, []);

  const loadCustomFields = () => {
    dispatch(getSettings('userAttributes'));
  };

  const onRefresh = useCallback(() => {
    loadCustomFields();
  }, []);

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const filteredFields = customFields.filter((field) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = field.name?.toLowerCase() || '';
    const type = field.type?.toLowerCase() || '';
    const key = field.key?.toLowerCase() || '';
    return name.includes(query) || type.includes(query) || key.includes(query);
  });

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const copyToClipboard = (text) => {
    showSnackbar(`Copied: ${text}`);
  };

  // Custom Field Card - Two column layout: Name (left) | Description (right)
  const renderFieldCard = ({ item }) => {
    const fieldName = item.name || 'Unnamed Field';
    const fieldKey = item.key || '';
    const description = item.description || '';
    const hasDescription = description.trim().length > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => fieldKey && copyToClipboard(fieldKey)}
        style={styles.fieldCard}
      >
        <View style={styles.cardContent}>
          {/* Main Row: Field Name (left) | Description (right) */}
          <View style={styles.mainRow}>
            {/* Left Side - Field Name */}
            <View style={styles.leftColumn}>
              <Text style={styles.fieldName} numberOfLines={2}>{fieldName}</Text>
            </View>

            {/* Right Side - Description */}
            <View style={styles.rightColumn}>
              <Text
                style={[
                  styles.descriptionText,
                  !hasDescription && styles.noDescriptionText
                ]}
              >
                {hasDescription ? description : 'No description available'}
              </Text>
            </View>
          </View>

          {/* Key Row */}
          {fieldKey && (
            <View style={styles.keyRow}>
              <Icon name="key-variant" size={14} color={colors.text.tertiary} />
              <Text style={styles.keyText} numberOfLines={1}>{fieldKey}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(fieldKey)}
                activeOpacity={0.7}
              >
                <Icon name="content-copy" size={14} color={colors.primary.main} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="form-textbox" size={64} color={colors.grey[300]} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No fields found' : 'No custom fields'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search criteria'
          : 'Create custom fields from the web dashboard to store additional contact information'}
      </Text>
    </View>
  );

  // Loading State
  if (isLoading && !isRefreshing && customFields.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading custom fields...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search by name, type or key..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Contact Custom Fields</Text>
        <Text style={styles.sectionCount}>
          {filteredFields.length} {filteredFields.length === 1 ? 'field' : 'fields'}
        </Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={16} color={colors.primary.main} />
        <Text style={styles.infoBannerText}>
          Manage custom fields from the web dashboard
        </Text>
      </View>

      {/* Fields List */}
      <FlatList
        data={filteredFields}
        renderItem={renderFieldCard}
        keyExtractor={(item) => item._id || item.key || item.name}
        contentContainerStyle={styles.fieldsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.background.default,
  },
  searchbar: {
    backgroundColor: colors.grey[100],
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 48,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary.dark,
  },

  // Fields List
  fieldsList: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  separator: {
    height: 10,
  },

  // Field Card
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 14,
  },

  // Main Row - Two columns
  mainRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: colors.grey[100],
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  fieldName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: 'right',
  },
  noDescriptionText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },

  // Key Row
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  keyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text.secondary,
  },
  copyBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: colors.primary.main + '10',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
