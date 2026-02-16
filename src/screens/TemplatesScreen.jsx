import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  IconButton,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { resetTemplates } from '../redux/slices/templateSlice';
import { fetchTemplatesWithCache, fetchTemplateStatsWithCache } from '../redux/cacheThunks';
import { colors } from '../theme/colors';
import { TemplatesListSkeleton, MessagePreviewBubble } from '../components/common';
import { getTemplateHeader, getCarouselCards, getLimitedTimeOffer } from '../components/common/MessagePreview';
import { useNetwork } from '../contexts/NetworkContext';

// Status configurations
const STATUS_CONFIG = {
  all: { label: 'All', icon: 'view-grid-outline', color: colors.primary.main },
  approved: { label: 'Approved', icon: 'check-circle', color: '#16A34A' },
  pending: { label: 'Pending', icon: 'clock-outline', color: '#D97706' },
  draft: { label: 'Draft', icon: 'file-edit-outline', color: '#0891B2' },
  rejected: { label: 'Rejected', icon: 'close-circle', color: '#DC2626' },
};

// Template type configurations
const TYPE_CONFIG = {
  marketing: { label: 'Marketing', color: '#8B5CF6' },
  utility: { label: 'Utility', color: '#0891B2' },
  authentication: { label: 'Auth', color: '#059669' },
};

// Header format configurations
const FORMAT_CONFIG = {
  IMAGE: { label: 'Image', icon: 'image-outline', color: '#0EA5E9' },
  VIDEO: { label: 'Video', icon: 'video-outline', color: '#F97316' },
  DOCUMENT: { label: 'Document', icon: 'file-document-outline', color: '#8B5CF6' },
  TEXT: { label: 'Text', icon: 'format-text', color: '#64748B' },
  LOCATION: { label: 'Location', icon: 'map-marker-outline', color: '#10B981' },
  CAROUSEL: { label: 'Carousel', icon: 'view-carousel-outline', color: '#EC4899' },
  LIMITED_TIME_OFFER: { label: 'LTO', icon: 'clock-alert-outline', color: '#F59E0B' },
};

export default function TemplatesScreen() {
  const dispatch = useDispatch();
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const PAGE_SIZE = 10;
  const searchDebounceRef = useRef(null);
  const filterChipListRef = useRef(null);
  const hasInitialLoadRef = useRef(false);

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
    hasMoreTemplates,
  } = useSelector((state) => state.template);

  const { settingId } = useSelector((state) => state.user);
  const prevSettingIdRef = useRef(settingId);

  const isLoading = templatesStatus === 'loading' || statsStatus === 'loading';
  const isRefreshing = templatesStatus === 'loading' && templates.length > 0;

  // Track first successful load — after this, full-screen skeleton is never shown again
  if (templatesStatus === 'succeeded' && !hasInitialLoadRef.current) {
    hasInitialLoadRef.current = true;
  }

  // Initial load + re-fetch with forceRefresh on account switch
  useEffect(() => {
    const isAccountSwitch = prevSettingIdRef.current !== settingId;
    prevSettingIdRef.current = settingId;

    if (isAccountSwitch) {
      // Account changed — reset filters and force fresh fetch
      setSearchQuery('');
      setSelectedStatus('all');
      hasInitialLoadRef.current = false;
    }

    loadTemplates({ reset: true, search: '', status: 'all', forceRefresh: isAccountSwitch });

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [settingId]);

  // Network recovery — re-fetch when connectivity is restored
  useEffect(() => {
    if (isNetworkAvailable && templates.length === 0 && templatesStatus !== 'loading') {
      loadTemplates({ reset: true });
    } else if (isNetworkAvailable && templatesStatus === 'failed') {
      loadTemplates({ reset: true });
    }
  }, [isNetworkAvailable]);

  const loadTemplates = useCallback(({ reset = true, loadMore = false, search = '', status = 'all', forceRefresh = false } = {}) => {
    const params = {
      limit: PAGE_SIZE,
    };

    if (search && search.trim()) {
      params.search = search.trim();
    }

    if (status && status !== 'all') {
      params.status = status.toUpperCase();
    }

    if (reset) {
      dispatch(resetTemplates());
      dispatch(fetchTemplateStatsWithCache({ forceRefresh }));
      dispatch(fetchTemplatesWithCache({ ...params, skip: 0, forceRefresh }));
    } else if (loadMore) {
      dispatch(fetchTemplatesWithCache({ ...params, skip: templates.length }));
    }
  }, [dispatch, PAGE_SIZE, templates.length]);

  const onRefresh = () => {
    if (isOffline) return;

    setSearchQuery('');
    loadTemplates({ reset: true, search: '', status: selectedStatus, forceRefresh: true });
  };

  // Debounced search handler
  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);

    // Clear previous debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Debounce API call by 500ms
    searchDebounceRef.current = setTimeout(() => {
      loadTemplates({ reset: true, search: text, status: selectedStatus });
    }, 500);
  }, [loadTemplates, selectedStatus]);

  // Handle status filter change
  const handleStatusChange = useCallback((status, index) => {
    setSelectedStatus(status);
    loadTemplates({ reset: true, search: searchQuery, status });

    // Auto-scroll the selected chip into view
    if (filterChipListRef.current && typeof index === 'number') {
      filterChipListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });
    }
  }, [loadTemplates, searchQuery]);

  const handleLoadMore = useCallback(() => {
    if (
      templatesStatus === 'loading' ||
      !hasMoreTemplates ||
      isOffline
    ) return;
    loadTemplates({ reset: false, loadMore: true, search: searchQuery, status: selectedStatus });
  }, [templatesStatus, hasMoreTemplates, loadTemplates, searchQuery, selectedStatus, isOffline]);

  // Templates are now filtered by API, so just use templates directly
  const filteredTemplates = templates;

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  // Filter chip data for FlatList
  const filterChipData = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
    key,
    config,
    count: key === 'all' ? totalTemplates :
      key === 'approved' ? approvedTemplates :
      key === 'pending' ? pendingTemplates :
      key === 'draft' ? draftTemplates : rejectedTemplates,
  }));

  // Render individual filter chip
  const renderFilterChip = ({ item, index }) => {
    const { key, config, count } = item;
    const isSelected = selectedStatus === key;
    const chipColor = config.color;

    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          isSelected
            ? styles.filterChipActive
            : { backgroundColor: chipColor + '10', borderColor: chipColor + '30' },
        ]}
        onPress={() => handleStatusChange(key, index)}
        activeOpacity={0.7}
      >
        <Icon
          name={config.icon}
          size={16}
          color={isSelected ? '#FFFFFF' : chipColor}
        />
        <Text style={[styles.filterText, isSelected ? styles.filterTextActive : { color: chipColor }]}>
          {config.label}
        </Text>
        <View style={[
          styles.filterBadge,
          isSelected
            ? styles.filterBadgeActive
            : { backgroundColor: chipColor + '18' },
        ]}>
          <Text style={[
            styles.filterBadgeText,
            isSelected ? styles.filterBadgeTextActive : { color: chipColor },
          ]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Template Card - Modern Design
  const renderTemplateItem = ({ item }) => {
    const statusConfig = STATUS_CONFIG[item.status?.toLowerCase()] || STATUS_CONFIG.draft;
    const typeConfig = TYPE_CONFIG[item.type?.toLowerCase()] || TYPE_CONFIG.utility;
    const header = getTemplateHeader(item);
    const hasCarousel = item.components?.some(c => c.type === 'CAROUSEL' || c.type === 'carousel');
    const hasLTO = item.components?.some(c => c.type === 'LIMITED_TIME_OFFER' || c.type === 'limited_time_offer');
    const detectedFormat = hasCarousel
      ? 'CAROUSEL'
      : hasLTO
      ? 'LIMITED_TIME_OFFER'
      : header?.format?.toUpperCase() || 'TEXT';
    const formatConfig = FORMAT_CONFIG[detectedFormat] || FORMAT_CONFIG.TEXT;

    return (
      <TouchableOpacity
        style={styles.templateCard}
        onPress={() => handlePreview(item)}
        activeOpacity={0.8}
      >
        {/* Card Content */}
        <View style={styles.cardContent}>
          {/* Top Row: Name and Status */}
          <View style={styles.cardTopRow}>
            <Text style={styles.templateName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusChip, { backgroundColor: statusConfig.color + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusChipText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Type, Format, Language, Preview */}
          <View style={styles.cardBottomRow}>
            <View style={styles.cardTags}>
              <View style={[styles.chip, { backgroundColor: typeConfig.color + '12' }]}>
                <Icon name="tag-outline" size={12} color={typeConfig.color} />
                <Text style={[styles.chipText, { color: typeConfig.color }]}>
                  {typeConfig.label}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: formatConfig.color + '12' }]}>
                <Icon name={formatConfig.icon} size={12} color={formatConfig.color} />
                <Text style={[styles.chipText, { color: formatConfig.color }]}>
                  {formatConfig.label}
                </Text>
              </View>
              <View style={styles.langChip}>
                <Text style={styles.langChipText}>{item.language?.toUpperCase() || 'EN'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => handlePreview(item)}
              activeOpacity={0.7}
            >
              <Icon name="eye-outline" size={16} color={colors.primary.main} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Preview Modal
  const renderPreviewModal = () => {
    if (!previewTemplate) return null;

    const carouselCards = getCarouselCards(previewTemplate);
    const limitedTimeOffer = getLimitedTimeOffer(previewTemplate);
    const statusConfig = STATUS_CONFIG[previewTemplate.status?.toLowerCase()] || STATUS_CONFIG.draft;
    const typeConfig = TYPE_CONFIG[previewTemplate.type?.toLowerCase()] || TYPE_CONFIG.utility;
    const isCarousel = carouselCards.length > 0;

    return (
      <Modal
        visible={showPreview}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Preview</Text>
                <IconButton
                  icon="close"
                  size={22}
                  onPress={() => setShowPreview(false)}
                />
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Template Info */}
              <View style={styles.templateInfoBox}>
                <Text style={styles.templateInfoTitle}>{previewTemplate.name}</Text>
                <View style={styles.templateInfoMeta}>
                  <View style={[styles.infoBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <Icon name={statusConfig.icon} size={14} color={statusConfig.color} />
                    <Text style={[styles.infoBadgeText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                  <View style={[styles.infoBadge, { backgroundColor: typeConfig.color + '20' }]}>
                    <Text style={[styles.infoBadgeText, { color: typeConfig.color }]}>
                      {typeConfig.label}
                    </Text>
                  </View>
                  <View style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>{previewTemplate.language || 'en'}</Text>
                  </View>
                </View>
              </View>

              {/* WhatsApp Preview */}
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>MESSAGE PREVIEW</Text>
                <MessagePreviewBubble
                  mode="template"
                  templateData={previewTemplate}
                  templateName={previewTemplate.name}
                  showActualMedia={false}
                  buttonsInsideBubble={true}
                  showCarousel={isCarousel}
                  showLTO={!!limitedTimeOffer}
                  showTypeBadge={false}
                  preservePlaceholders={true}
                />
              </View>
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowPreview(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Full-screen skeleton — only on very first load (before any templates have ever loaded)
  if (isLoading && templates.length === 0 && !hasInitialLoadRef.current) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonContainer}>
          <TemplatesListSkeleton count={8} />
        </View>
      </View>
    );
  }

  // Offline with no data
  if (isOffline && templates.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="cloud-off-outline" size={64} color={colors.grey[300]} />
          </View>
          <Text style={styles.emptyTitle}>You're Offline</Text>
          <Text style={styles.emptySubtitle}>
            Connect to the internet to load templates.{'\n'}Previously loaded templates will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Empty state — custom design matching ContactsScreen/InboxScreen
  const renderEmptyState = () => {
    // Loading after pill switch or search — show inline skeleton (not full-screen)
    if (templatesStatus === 'loading') {
      return (
        <View style={styles.skeletonInListContainer}>
          <TemplatesListSkeleton count={6} />
        </View>
      );
    }

    // Search with no results
    if (searchQuery && searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="file-search-outline" size={64} color={colors.grey[300]} />
          </View>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            No templates matching "{searchQuery}".{'\n'}Try a different search term.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => { setSearchQuery(''); loadTemplates({ reset: true, search: '', status: selectedStatus }); }}
            activeOpacity={0.8}
          >
            <Icon name="close" size={18} color="#FFFFFF" />
            <Text style={styles.emptyActionButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Status filter with no results
    if (selectedStatus && selectedStatus !== 'all') {
      const statusConf = STATUS_CONFIG[selectedStatus] || STATUS_CONFIG.draft;
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: statusConf.color + '12' }]}>
            <Icon name={statusConf.icon} size={64} color={statusConf.color} />
          </View>
          <Text style={styles.emptyTitle}>No {statusConf.label} Templates</Text>
          <Text style={styles.emptySubtitle}>
            There are no templates with "{statusConf.label}" status.{'\n'}Try selecting a different filter.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => handleStatusChange('all', 0)}
            activeOpacity={0.8}
          >
            <Icon name="filter-remove-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyActionButtonText}>Show All</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default — no templates at all
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon name="file-document-outline" size={64} color={colors.grey[300]} />
        </View>
        <Text style={styles.emptyTitle}>No Templates Yet</Text>
        <Text style={styles.emptySubtitle}>
          Your message templates will appear here.{'\n'}Create templates from the WhatsApp Business Manager.
        </Text>
      </View>
    );
  };

  // List Header Component
  const renderListHeader = () => (
    <>
      {/* Error */}
      {templatesError && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{templatesError}</Text>
        </View>
      )}
    </>
  );

  // List Footer Component
  const renderListFooter = () => {
    // Show loading footer only when loading more templates
    if (templatesStatus === 'loading' && templates.length > 0 && hasMoreTemplates) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.footerLoaderText}>Loading more...</Text>
        </View>
      );
    }
    return <View style={styles.listFooterSpace} />;
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search templates..."
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Filter by Status - Outside scroll area */}
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>Filter by Status</Text>
        <FlatList
          ref={filterChipListRef}
          data={filterChipData}
          renderItem={renderFilterChip}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              filterChipListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.3,
              });
            }, 100);
          }}
        />
      </View>

      {/* Section Header with count */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedStatus === 'all' ? 'All Templates' : STATUS_CONFIG[selectedStatus]?.label || 'Templates'}
        </Text>
        <Text style={styles.sectionCount}>
          {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'}
        </Text>
      </View>

      <FlatList
        data={filteredTemplates}
        renderItem={renderTemplateItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {renderPreviewModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },

  // Empty State
  emptyContainer: {
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
    marginBottom: 24,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  emptyActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 16,
  },
  skeletonInListContainer: {
    paddingTop: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },

  // Header (matching ContactsScreen)
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.background.default,
  },

  // Search (matching ContactsScreen)
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

  // Filter Section
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
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

  // Filters
  filtersContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.grey[200],
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Template Card - Modern Design
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
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
  templateName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: 10,
    lineHeight: 20,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.grey[100],
    gap: 4,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary.main + '10',
    gap: 4,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },
  divider: {
    height: 0,
  },
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
  listFooterSpace: {
    height: 32,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[300],
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Template Info Box
  templateInfoBox: {
    padding: 16,
    backgroundColor: colors.grey[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  templateInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },
  templateInfoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    gap: 4,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Preview Section
  previewSection: {
    padding: 16,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Close Button
  closeBtn: {
    marginHorizontal: 16,
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
