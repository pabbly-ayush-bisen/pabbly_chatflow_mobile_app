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
import { EmptyState, TemplatesListSkeleton, MessagePreviewBubble } from '../components/common';
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

  const isLoading = templatesStatus === 'loading' || statsStatus === 'loading';
  const isRefreshing = templatesStatus === 'loading' && templates.length > 0;

  // Initial load — cache-first (works offline too)
  useEffect(() => {
    loadTemplates({ reset: true });
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Network recovery — re-fetch when connectivity is restored
  useEffect(() => {
    if (isNetworkAvailable && templates.length === 0 && templatesStatus !== 'loading') {
      loadTemplates({ reset: true });
    } else if (isNetworkAvailable && templatesStatus === 'failed') {
      loadTemplates({ reset: true });
    }
  }, [isNetworkAvailable]);

  const loadTemplates = useCallback(({ reset = true, append = false, search = '', status = 'all', forceRefresh = false } = {}) => {
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
      dispatch(fetchTemplatesWithCache({ ...params, skip: 0, append: false, forceRefresh }));
    } else if (append) {
      dispatch(fetchTemplatesWithCache({ ...params, skip: templates.length, append: true }));
    }
  }, [dispatch, PAGE_SIZE, templates.length]);

  const onRefresh = () => {
    if (isOffline) return;

    setSearchQuery('');
    setSelectedStatus('all');
    loadTemplates({ reset: true, search: '', status: 'all', forceRefresh: true });
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
  const handleStatusChange = useCallback((status) => {
    setSelectedStatus(status);
    loadTemplates({ reset: true, search: searchQuery, status });
  }, [loadTemplates, searchQuery]);

  const handleLoadMore = useCallback(() => {
    if (
      templatesStatus === 'loading' ||
      !hasMoreTemplates ||
      isOffline
    ) return;
    loadTemplates({ reset: false, append: true, search: searchQuery, status: selectedStatus });
  }, [templatesStatus, hasMoreTemplates, loadTemplates, searchQuery, selectedStatus, isOffline]);

  // Templates are now filtered by API, so just use templates directly
  const filteredTemplates = templates;

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  // Filter Tabs
  const renderFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filtersContainer}
    >
      {Object.entries(STATUS_CONFIG).map(([key, config]) => {
        const isSelected = selectedStatus === key;
        const count = key === 'all' ? totalTemplates :
          key === 'approved' ? approvedTemplates :
          key === 'pending' ? pendingTemplates :
          key === 'draft' ? draftTemplates : rejectedTemplates;

        return (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, isSelected && styles.filterChipActive]}
            onPress={() => handleStatusChange(key)}
            activeOpacity={0.7}
          >
            <Icon
              name={config.icon}
              size={16}
              color={isSelected ? '#FFFFFF' : colors.text.secondary}
            />
            <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
              {config.label}
            </Text>
            <View style={[styles.filterBadge, isSelected && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, isSelected && styles.filterBadgeTextActive]}>
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

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

  // Loading - show skeleton only when no data at all (cache miss + API loading)
  if (isLoading && templates.length === 0) {
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
        <EmptyState
          icon="cloud-off-outline"
          title="You're Offline"
          message="Connect to the internet to load templates. Previously loaded templates will appear here."
        />
      </View>
    );
  }

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
        {renderFilters()}
      </View>

      <FlatList
        data={filteredTemplates}
        renderItem={renderTemplateItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={
          <EmptyState
            icon="file-document-outline"
            title="No templates"
            message={searchQuery ? `No results for "${searchQuery}"` : 'No templates found'}
          />
        }
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
