import React, { useEffect, useState, useCallback, useRef } from 'react';
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

const PAGE_SIZE = 10;

export default function TagsScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Pagination state
  const [localTags, setLocalTags] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTags, setHasMoreTags] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const searchDebounceRef = useRef(null);

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);

  const isLoading = getSettingsStatus === 'loading';
  const isRefreshing = isLoading && localTags.length > 0 && !isLoadingMore;

  // Load tags with pagination
  const loadTags = useCallback(async ({ reset = false, search = '' } = {}) => {
    const currentPage = reset ? 0 : page;
    const skip = currentPage * PAGE_SIZE;

    // Build query string
    let queryString = `tags&skip=${skip}&limit=${PAGE_SIZE}&order=-1`;

    // Add search param if provided
    if (search && search.trim()) {
      queryString += `&field=name&value=${encodeURIComponent(search.trim())}`;
    }

    try {
      const result = await dispatch(getSettings(queryString)).unwrap();
      const data = result.data || result;

      // Tags data is nested under 'tags' key in the response
      const tagsData = data.tags || data;
      const newTags = tagsData.items || [];
      const total = tagsData.totalCount || 0;

      setTotalCount(total);

      if (reset) {
        setLocalTags(newTags);
        setPage(1);
      } else {
        // Filter out duplicates when appending
        setLocalTags(prev => {
          const existingIds = new Set(prev.map(tag => tag._id));
          const uniqueNewTags = newTags.filter(tag => !existingIds.has(tag._id));
          return [...prev, ...uniqueNewTags];
        });
        setPage(prev => prev + 1);
      }

      // Check if there are more tags to load
      const loadedCount = reset ? newTags.length : localTags.length + newTags.length;
      setHasMoreTags(loadedCount < total);
    } catch (error) {
      console.log('Error loading tags:', error);
      showSnackbar('Failed to load tags');
    }
  }, [dispatch, page, localTags.length]);

  useEffect(() => {
    loadTags({ reset: true });

    // Cleanup debounce timer on unmount
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    setSearchQuery('');
    loadTags({ reset: true, search: '' });
  }, [loadTags]);

  // Debounced search handler
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);

    // Clear previous debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Debounce API call by 500ms
    searchDebounceRef.current = setTimeout(() => {
      loadTags({ reset: true, search: text });
    }, 500);
  }, [loadTags]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    // Don't load more if already loading or no more tags
    if (isLoading || isLoadingMore || !hasMoreTags) return;

    setIsLoadingMore(true);
    await loadTags({ reset: false, search: searchQuery });
    setIsLoadingMore(false);
  }, [isLoading, isLoadingMore, hasMoreTags, loadTags, searchQuery]);

  // Filter tags locally for instant search feedback
  const filteredTags = localTags.filter((tag) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = tag.name?.toLowerCase() || '';
    const keywords = tag.keywords?.join(' ')?.toLowerCase() || '';
    return name.includes(query) || keywords.includes(query);
  });

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return { date: null, time: null };
    try {
      const date = new Date(dateString);
      return {
        date: date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: null, time: null };
    }
  };

  // Tag Card - Template-style card design with all web app info
  const renderTagCard = ({ item }) => {
    const tagName = item.name || 'Unnamed Tag';
    const isAutoTagEnabled = item.firstMessage === true;
    const keywords = item.keywords || [];
    const { date, time } = formatDateTime(item.createdAt);
    const contactCount = item.contactCount ?? 0;

    return (
      <View style={styles.tagCard}>
        <View style={styles.cardContent}>
          {/* Top Row: Tag Name and Auto-Tag Status Badge */}
          <View style={styles.cardTopRow}>
            <Text style={styles.tagName} numberOfLines={1}>{tagName}</Text>
            <View style={[
              styles.autoTagBadge,
              { backgroundColor: isAutoTagEnabled ? '#DCFCE7' : '#FEE2E2' }
            ]}>
              <View style={[
                styles.autoTagDot,
                { backgroundColor: isAutoTagEnabled ? '#16A34A' : '#DC2626' }
              ]} />
              <Text style={[
                styles.autoTagText,
                { color: isAutoTagEnabled ? '#16A34A' : '#DC2626' }
              ]}>
                {isAutoTagEnabled ? 'Auto Tag Enabled' : 'Auto Tag Disabled'}
              </Text>
            </View>
          </View>

          {/* Keywords Section - Only show if auto-tagging is enabled */}
          {isAutoTagEnabled && keywords.length > 0 && (
            <View style={styles.keywordsSection}>
              <View style={styles.keywordsHeader}>
                <Icon name="tag-text-outline" size={14} color={colors.text.secondary} />
                <Text style={styles.keywordsLabel}>Keywords (First Message)</Text>
              </View>
              <View style={styles.keywordsContainer}>
                {keywords.map((keyword, index) => (
                  <View key={index} style={styles.keywordChip}>
                    <Text style={styles.keywordText} numberOfLines={1}>{keyword}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* No Keywords message when auto-tagging is enabled but no keywords */}
          {isAutoTagEnabled && keywords.length === 0 && (
            <View style={styles.noKeywordsBox}>
              <Icon name="information-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.noKeywordsText}>
                No keywords set for auto-tagging
              </Text>
            </View>
          )}

          {/* Auto-tag disabled message */}
          {!isAutoTagEnabled && (
            <View style={styles.disabledBox}>
              <Icon name="tag-off-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.disabledText}>
                Auto-tagging from first message is disabled
              </Text>
            </View>
          )}

          {/* Bottom Row: Date, Time, Contact Count */}
          <View style={styles.cardBottomRow}>
            <View style={styles.cardTags}>
              {/* Created Date */}
              {date && (
                <View style={styles.infoBadge}>
                  <Icon name="calendar-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.infoBadgeText}>{date}</Text>
                </View>
              )}

              {/* Created Time */}
              {time && (
                <View style={styles.infoBadge}>
                  <Icon name="clock-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.infoBadgeText}>{time}</Text>
                </View>
              )}

              {/* Contact Count */}
              {contactCount > 0 && (
                <View style={styles.infoBadge}>
                  <Icon name="account-multiple-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.infoBadgeText}>
                    {contactCount} {contactCount === 1 ? 'contact' : 'contacts'}
                  </Text>
                </View>
              )}
            </View>

          </View>
        </View>
      </View>
    );
  };

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="tag-off-outline" size={64} color={colors.grey[300]} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No tags found' : 'No tags yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search criteria'
          : 'Create tags from the web dashboard to organize and categorize your contacts'}
      </Text>
    </View>
  );

  // Footer Component - Loading indicator for pagination
  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.footerLoaderText}>Loading more...</Text>
        </View>
      );
    }

    if (!hasMoreTags && localTags.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>
            Showing all {localTags.length} tags
          </Text>
        </View>
      );
    }

    return <View style={styles.listFooterSpace} />;
  };

  // Loading State - Initial load
  if (isLoading && !isRefreshing && localTags.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading tags...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search tags or keywords..."
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
        <Text style={styles.sectionTitle}>Tags</Text>
        <Text style={styles.sectionCount}>
          {localTags.length} of {totalCount} {totalCount === 1 ? 'tag' : 'tags'}
        </Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={16} color={colors.primary.main} />
        <Text style={styles.infoBannerText}>
          Manage tags from the web dashboard
        </Text>
      </View>

      {/* Tags List */}
      <FlatList
        data={filteredTags}
        renderItem={renderTagCard}
        keyExtractor={(item, index) => item._id ? `tag-${item._id}` : `tag-index-${index}`}
        contentContainerStyle={styles.tagsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
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

  // Tags List
  tagsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  separator: {
    height: 10,
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  footerEnd: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerEndText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  listFooterSpace: {
    height: 32,
  },

  // Tag Card - Template style
  tagCard: {
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tagName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: 10,
    lineHeight: 20,
  },
  autoTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  autoTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  autoTagText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Keywords Section
  keywordsSection: {
    backgroundColor: colors.grey[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  keywordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  keywordsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  keywordText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.primary,
    maxWidth: 150,
  },

  // No Keywords Box
  noKeywordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  noKeywordsText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },

  // Disabled Box
  disabledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  disabledText: {
    fontSize: 12,
    color: colors.text.tertiary,
    flex: 1,
  },

  // Bottom Row
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.grey[100],
    gap: 4,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
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
