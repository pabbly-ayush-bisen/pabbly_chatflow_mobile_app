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
import { fetchAllTemplates, fetchTemplateStats, resetTemplates } from '../redux/slices/templateSlice';
import { colors, chatColors } from '../theme/colors';
import { EmptyState, TemplatesListSkeleton } from '../components/common';
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
};

// Button type configurations
const BUTTON_CONFIG = {
  URL: { icon: 'link', label: 'URL' },
  PHONE_NUMBER: { icon: 'phone', label: 'Call' },
  QUICK_REPLY: { icon: 'reply', label: 'Quick Reply' },
  COPY_CODE: { icon: 'content-copy', label: 'Copy Code' },
  FLOW: { icon: 'sitemap', label: 'Flow' },
  CATALOG: { icon: 'shopping', label: 'Catalog' },
  MPM: { icon: 'package-variant', label: 'Multi-Product' },
  SPM: { icon: 'package', label: 'Single Product' },
  VOICE_CALL: { icon: 'phone-outgoing', label: 'Voice Call' },
  OTP: { icon: 'shield-key', label: 'OTP' },
};

export default function TemplatesScreen() {
  const dispatch = useDispatch();
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [page, setPage] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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

  // Only show loading if online and actually loading, OR if never loaded before and online
  const isLoading = isNetworkAvailable && (templatesStatus === 'loading' || statsStatus === 'loading');
  const isRefreshing = isNetworkAvailable && templatesStatus === 'loading' && templates.length > 0;

  useEffect(() => {
    // Only fetch if online
    if (isNetworkAvailable) {
      loadTemplates({ reset: true });
    }
    // Cleanup debounce timer on unmount
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Fetch when network becomes available (if we haven't loaded yet)
  useEffect(() => {
    if (isNetworkAvailable && !hasLoadedOnce && templates.length === 0) {
      loadTemplates({ reset: true });
    }
  }, [isNetworkAvailable, hasLoadedOnce, templates.length]);

  const loadTemplates = useCallback(({ reset = true, append = false, search = '', status = 'all' } = {}) => {
    // Don't fetch if offline
    if (isOffline) {
      return;
    }

    // Build API params
    const apiParams = {
      limit: PAGE_SIZE,
      append,
    };

    // Add search param if provided
    if (search && search.trim()) {
      apiParams.search = search.trim();
    }

    // Add status param if not 'all' (API expects uppercase: APPROVED, PENDING, DRAFT, REJECTED)
    if (status && status !== 'all') {
      apiParams.status = status.toUpperCase();
    }

    if (reset) {
      dispatch(resetTemplates());
      setPage(0);
      dispatch(fetchTemplateStats());
      dispatch(fetchAllTemplates({ ...apiParams, page: 0, append: false }))
        .then(() => setHasLoadedOnce(true));
      setPage(1);
    } else if (append) {
      dispatch(fetchAllTemplates({ ...apiParams, page, append: true }));
      setPage(prev => prev + 1);
    }
  }, [dispatch, page, PAGE_SIZE, isOffline]);

  const onRefresh = () => {
    // Don't refresh if offline
    if (isOffline) return;

    setSearchQuery('');
    setSelectedStatus('all');
    loadTemplates({ reset: true, search: '', status: 'all' });
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
    // Don't load more if:
    // - Already loading
    // - No more templates from server
    // - Offline
    if (
      templatesStatus === 'loading' ||
      !hasMoreTemplates ||
      isOffline
    ) return;
    loadTemplates({ reset: false, append: true, search: searchQuery, status: selectedStatus });
  }, [templatesStatus, hasMoreTemplates, loadTemplates, searchQuery, selectedStatus]);

  // Templates are now filtered by API, so just use templates directly
  const filteredTemplates = templates;

  // Get template components
  const getTemplateBody = (template) => {
    if (!template?.components) return '';
    const bodyComponent = template.components.find((c) =>
      c.type === 'BODY' || c.type === 'body'
    );
    return bodyComponent?.text || '';
  };

  const getTemplateHeader = (template) => {
    if (!template?.components) return null;
    return template.components.find((c) =>
      c.type === 'HEADER' || c.type === 'header'
    );
  };

  const getTemplateFooter = (template) => {
    if (!template?.components) return '';
    const footerComponent = template.components.find((c) =>
      c.type === 'FOOTER' || c.type === 'footer'
    );
    return footerComponent?.text || '';
  };

  const getTemplateButtons = (template) => {
    if (!template?.components) return [];
    const buttonsComponent = template.components.find((c) =>
      c.type === 'BUTTONS' || c.type === 'buttons'
    );
    return buttonsComponent?.buttons || [];
  };

  // Get carousel cards for carousel templates
  const getCarouselCards = (template) => {
    if (!template?.components) return [];
    const carouselComponent = template.components.find((c) =>
      c.type === 'CAROUSEL' || c.type === 'carousel'
    );
    return carouselComponent?.cards || [];
  };

  // Get limited time offer component
  const getLimitedTimeOffer = (template) => {
    if (!template?.components) return null;
    return template.components.find((c) =>
      c.type === 'LIMITED_TIME_OFFER' || c.type === 'limited_time_offer'
    );
  };

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
    const formatConfig = FORMAT_CONFIG[header?.format?.toUpperCase()] || FORMAT_CONFIG.TEXT;

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
              <View style={[styles.typeChip, { backgroundColor: typeConfig.color + '12' }]}>
                <Icon name="tag-outline" size={12} color={typeConfig.color} />
                <Text style={[styles.typeChipText, { color: typeConfig.color }]}>
                  {typeConfig.label}
                </Text>
              </View>
              <View style={[styles.formatChip, { backgroundColor: formatConfig.color + '12' }]}>
                <Icon name={formatConfig.icon} size={12} color={formatConfig.color} />
                <Text style={[styles.formatChipText, { color: formatConfig.color }]}>
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

    const header = getTemplateHeader(previewTemplate);
    const bodyText = getTemplateBody(previewTemplate);
    const footerText = getTemplateFooter(previewTemplate);
    const buttons = getTemplateButtons(previewTemplate);
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
                <View style={styles.chatContainer}>
                  {/* Message Bubble */}
                  <View style={styles.messageBubble}>
                    {/* Header Media */}
                    {header && header.format && header.format !== 'TEXT' && (
                      <View style={styles.mediaBox}>
                        <Icon
                          name={
                            header.format === 'IMAGE' ? 'image' :
                            header.format === 'VIDEO' ? 'video' :
                            header.format === 'LOCATION' ? 'map-marker' :
                            header.format === 'CAROUSEL' ? 'view-carousel' :
                            'file-document'
                          }
                          size={28}
                          color={colors.grey[400]}
                        />
                        <Text style={styles.mediaText}>
                          {header.format.charAt(0) + header.format.slice(1).toLowerCase()}
                        </Text>
                      </View>
                    )}

                    {/* Header Text */}
                    {header && header.format === 'TEXT' && header.text && (
                      <Text style={styles.headerText}>{header.text}</Text>
                    )}

                    {/* Body */}
                    {bodyText ? (
                      <Text style={styles.bodyText}>{bodyText}</Text>
                    ) : (
                      <Text style={styles.noContentText}>No message content</Text>
                    )}

                    {/* Footer */}
                    {footerText && (
                      <Text style={styles.footerText}>{footerText}</Text>
                    )}

                    {/* Time & Ticks */}
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Icon name="check-all" size={14} color={chatColors.tickBlue} />
                    </View>
                  </View>

                  {/* Buttons */}
                  {buttons.length > 0 && (
                    <View style={styles.buttonsBox}>
                      {buttons.map((btn, idx) => {
                        // Get button config or use default
                        const buttonConfig = BUTTON_CONFIG[btn.type] || BUTTON_CONFIG.QUICK_REPLY;
                        return (
                          <View key={idx} style={styles.buttonItem}>
                            <Icon
                              name={buttonConfig.icon}
                              size={16}
                              color={chatColors.linkColor}
                            />
                            <Text style={styles.buttonText}>{btn.text}</Text>
                            {btn.url && (
                              <Icon name="open-in-new" size={12} color={colors.text.tertiary} style={{ marginLeft: 4 }} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Carousel Cards Preview */}
                {isCarousel && carouselCards.length > 0 && (
                  <View style={styles.carouselPreviewSection}>
                    <Text style={styles.carouselLabel}>CAROUSEL CARDS ({carouselCards.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carouselScroll}>
                      {carouselCards.map((card, cardIdx) => {
                        const cardHeader = card.components?.find(c => c.type === 'HEADER' || c.type === 'header');
                        const cardBody = card.components?.find(c => c.type === 'BODY' || c.type === 'body');
                        const cardButtons = card.components?.find(c => c.type === 'BUTTONS' || c.type === 'buttons')?.buttons || [];

                        return (
                          <View key={cardIdx} style={styles.carouselCard}>
                            {/* Card Header/Media */}
                            {cardHeader && (
                              <View style={styles.carouselCardMedia}>
                                <Icon
                                  name={cardHeader.format === 'IMAGE' ? 'image' : cardHeader.format === 'VIDEO' ? 'video' : 'file-document'}
                                  size={24}
                                  color={colors.grey[400]}
                                />
                                <Text style={styles.carouselCardMediaText}>Card {cardIdx + 1}</Text>
                              </View>
                            )}
                            {/* Card Body */}
                            {cardBody?.text && (
                              <Text style={styles.carouselCardBody} numberOfLines={3}>{cardBody.text}</Text>
                            )}
                            {/* Card Buttons */}
                            {cardButtons.length > 0 && (
                              <View style={styles.carouselCardButtons}>
                                {cardButtons.map((btn, btnIdx) => {
                                  const btnConfig = BUTTON_CONFIG[btn.type] || BUTTON_CONFIG.QUICK_REPLY;
                                  return (
                                    <View key={btnIdx} style={styles.carouselCardButton}>
                                      <Icon name={btnConfig.icon} size={12} color={chatColors.linkColor} />
                                      <Text style={styles.carouselCardButtonText} numberOfLines={1}>{btn.text}</Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Limited Time Offer */}
                {limitedTimeOffer && (
                  <View style={styles.limitedOfferBox}>
                    <Icon name="clock-alert-outline" size={18} color="#F59E0B" />
                    <Text style={styles.limitedOfferText}>Limited Time Offer Template</Text>
                  </View>
                )}
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

  // Loading - show skeleton (only if online and loading)
  if (isLoading && templates.length === 0 && isNetworkAvailable) {
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
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  formatChipText: {
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
  chatContainer: {
    backgroundColor: chatColors.chatBg,
    borderRadius: 16,
    padding: 16,
    minHeight: 180,
  },
  messageBubble: {
    backgroundColor: chatColors.outgoing,
    borderRadius: 12,
    borderTopRightRadius: 4,
    padding: 12,
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  mediaBox: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  noContentText: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  buttonsBox: {
    marginTop: 8,
    alignSelf: 'flex-end',
    maxWidth: '92%',
    gap: 4,
  },
  buttonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.linkColor,
  },

  // Carousel Preview
  carouselPreviewSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
  },
  carouselLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  carouselScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  carouselCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
    overflow: 'hidden',
  },
  carouselCardMedia: {
    backgroundColor: colors.grey[100],
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselCardMediaText: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  carouselCardBody: {
    fontSize: 13,
    color: colors.text.primary,
    padding: 12,
    lineHeight: 18,
  },
  carouselCardButtons: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  carouselCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  carouselCardButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: chatColors.linkColor,
  },

  // Limited Time Offer
  limitedOfferBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  limitedOfferText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
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
