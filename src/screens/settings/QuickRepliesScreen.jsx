import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Snackbar,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { getSettings, updateSettings, deleteSettings } from '../../redux/slices/settingsSlice';
import { fetchQuickRepliesWithCache } from '../../redux/cacheThunks';
import { cacheManager } from '../../database/CacheManager';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../contexts/NetworkContext';
import { colors } from '../../theme/colors';
import { cardStyles } from '../../theme/cardStyles';
import { MessagePreviewBubble, InfoBanner } from '../../components/common';
import AddQuickReplyModal from '../../components/settings/AddQuickReplyModal';
import EditQuickReplyModal from '../../components/settings/EditQuickReplyModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 10;

// Message type configurations
const MESSAGE_TYPES = {
  text: { label: 'Text', icon: 'message-text', color: '#9E9E9E', bg: '#F5F5F5' },
  image: { label: 'Image', icon: 'image', color: '#2196F3', bg: '#E3F2FD' },
  video: { label: 'Video', icon: 'video', color: '#9C27B0', bg: '#F3E5F5' },
  audio: { label: 'Audio', icon: 'microphone', color: '#3F51B5', bg: '#E8EAF6' },
  file: { label: 'File', icon: 'file-document', color: '#FF9800', bg: '#FFF3E0' },
};

// Skeleton Pulse Component
const SkeletonPulse = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: colors.grey[200], borderRadius: 6 }, style, { opacity }]} />;
};

// Skeleton Quick Reply Card
const QuickReplyCardSkeleton = () => (
  <View style={skeletonStyles.replyCard}>
    {/* Top Row: Shortcut + Type */}
    <View style={skeletonStyles.topRow}>
      <SkeletonPulse style={{ width: 140, height: 28, borderRadius: 6 }} />
      <SkeletonPulse style={{ width: 70, height: 24, borderRadius: 6 }} />
    </View>
    {/* Bottom Row: Meta + Actions */}
    <View style={skeletonStyles.bottomRow}>
      <View style={skeletonStyles.metaRow}>
        <SkeletonPulse style={{ width: 90, height: 16, borderRadius: 4 }} />
        <SkeletonPulse style={{ width: 70, height: 16, borderRadius: 4 }} />
      </View>
      <View style={skeletonStyles.actionsRow}>
        <SkeletonPulse style={{ width: 34, height: 34, borderRadius: 8 }} />
        <SkeletonPulse style={{ width: 34, height: 34, borderRadius: 8 }} />
        <SkeletonPulse style={{ width: 34, height: 34, borderRadius: 8 }} />
      </View>
    </View>
  </View>
);

// Full Skeleton
const QuickRepliesSkeleton = () => (
  <View style={skeletonStyles.container}>
    {/* Info Banner */}
    <View style={skeletonStyles.infoBanner}>
      <SkeletonPulse style={{ width: 16, height: 16, borderRadius: 4 }} />
      <SkeletonPulse style={{ flex: 1, height: 13, borderRadius: 4 }} />
    </View>
    {/* Search Bar */}
    <View style={skeletonStyles.searchBar}>
      <SkeletonPulse style={{ flex: 1, height: 48, borderRadius: 12 }} />
    </View>
    {/* Cards */}
    <View style={skeletonStyles.list}>
      <QuickReplyCardSkeleton />
      <QuickReplyCardSkeleton />
      <QuickReplyCardSkeleton />
      <QuickReplyCardSkeleton />
      <QuickReplyCardSkeleton />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  replyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

export default function QuickRepliesScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60 + insets.bottom;
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef(null);

  // Pagination state
  const [localReplies, setLocalReplies] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreReplies, setHasMoreReplies] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Cache-first state
  const { settings, getSettingsStatus, updateSettingsStatus, deleteSettingsStatus } = useSelector(
    (state) => state.settings
  );
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const fetchSucceeded = useRef(false);
  const cachedBaseReplies = useRef({ items: [], totalCount: 0 });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Form state
  const [replyToEdit, setReplyToEdit] = useState(null);
  const [replyToDelete, setReplyToDelete] = useState(null);
  const [previewReply, setPreviewReply] = useState(null);

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isLoading = getSettingsStatus === 'loading';
  const isSaving = updateSettingsStatus === 'loading';
  const isDeleting = deleteSettingsStatus === 'loading';
  const isRefreshing = isLoading && localReplies.length > 0 && !isLoadingMore && initialLoadDone.current;

  // Set header count badge
  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerRight: () => (
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>
            {totalCount} {totalCount === 1 ? 'reply' : 'replies'}
          </Text>
        </View>
      ),
    });
  }, [navigation, totalCount]);

  // Initial load — read cache locally for instant display, then fetch fresh from API
  useEffect(() => {
    isLoadingRef.current = true;
    fetchSucceeded.current = false;

    // Read cache locally for instant display while API loads
    cacheManager.getAppSetting('quickReplies').then((cached) => {
      if (cached && cached.items && cached.items.length > 0) {
        setLocalReplies(cached.items);
        setTotalCount(cached.totalCount || 0);
        setHasMoreReplies(cached.items.length < (cached.totalCount || 0));
        cachedBaseReplies.current = { items: cached.items, totalCount: cached.totalCount || 0 };
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Always fetch fresh from API to pick up changes made on web
    dispatch(fetchQuickRepliesWithCache({ forceRefresh: true }))
      .unwrap()
      .then((result) => {
        fetchSucceeded.current = true;
        const data = result.data?.quickReplies || result.quickReplies || {};
        const items = data.items || [];
        const total = data.totalCount || 0;
        setLocalReplies(items);
        setTotalCount(total);
        setHasMoreReplies(items.length < total);
        initialLoadDone.current = true;
        cachedBaseReplies.current = { items, totalCount: total };
      })
      .catch(() => {})
      .finally(() => {
        isLoadingRef.current = false;
        setIsInitialLoading(false);
      });

    // Cleanup debounce timer on unmount
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Network recovery — re-fetch when connectivity restored and data never loaded
  useEffect(() => {
    if (isNetworkAvailable && !initialLoadDone.current && !isLoadingRef.current) {
      isLoadingRef.current = true;
      fetchSucceeded.current = false;
      setIsInitialLoading(true);
      dispatch(fetchQuickRepliesWithCache({ forceRefresh: true }))
        .unwrap()
        .then((result) => {
          fetchSucceeded.current = true;
          const data = result.data?.quickReplies || result.quickReplies || {};
          const items = data.items || [];
          const total = data.totalCount || 0;
          setLocalReplies(items);
          setTotalCount(total);
          setHasMoreReplies(items.length < total);
          initialLoadDone.current = true;
          cachedBaseReplies.current = { items, totalCount: total };
        })
        .catch(() => {})
        .finally(() => {
          isLoadingRef.current = false;
          setIsInitialLoading(false);
        });
    }
  }, [isNetworkAvailable]);

  // Sync settings.quickReplies → localReplies on initial load only
  useEffect(() => {
    if (settings.quickReplies && !initialLoadDone.current && !isInitialLoading && fetchSucceeded.current) {
      const items = settings.quickReplies.items || [];
      const total = settings.quickReplies.totalCount || 0;
      setLocalReplies(items);
      setTotalCount(total);
      setHasMoreReplies(items.length < total);
      initialLoadDone.current = true;
      cachedBaseReplies.current = { items, totalCount: total };
    }
  }, [settings.quickReplies, isInitialLoading]);

  // Re-fetch when screen regains focus (picks up web app changes)
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current || isOffline) return;

      initialLoadDone.current = false;
      fetchSucceeded.current = false;
      dispatch(fetchQuickRepliesWithCache({ forceRefresh: true }))
        .unwrap()
        .then((result) => {
          fetchSucceeded.current = true;
          const data = result.data?.quickReplies || result.quickReplies || {};
          const items = data.items || [];
          const total = data.totalCount || 0;
          setLocalReplies(items);
          setTotalCount(total);
          setHasMoreReplies(items.length < total);
          initialLoadDone.current = true;
          cachedBaseReplies.current = { items, totalCount: total };
        })
        .catch(() => { initialLoadDone.current = true; });
    }, [isOffline])
  );

  // Load replies from API — used for pagination and search only
  const loadReplies = useCallback(async ({ reset = false, search = '' } = {}) => {
    const skip = reset ? 0 : localReplies.length;

    let queryString = `quickReplies&skip=${skip}&limit=${PAGE_SIZE}&order=-1`;

    if (search && search.trim()) {
      queryString += `&field=shortcut&value=${encodeURIComponent(search.trim())}`;
    }

    try {
      const result = await dispatch(getSettings(queryString)).unwrap();
      const data = result.data || result;
      const repliesData = data.quickReplies || data;
      const newReplies = repliesData.items || [];
      const total = repliesData.totalCount || 0;

      setTotalCount(total);

      if (reset) {
        setLocalReplies(newReplies);
        setHasMoreReplies(newReplies.length < total);
      } else {
        const existingIds = new Set(localReplies.map(reply => reply._id));
        const uniqueNewReplies = newReplies.filter(reply => reply._id && !existingIds.has(reply._id));
        const allReplies = [...localReplies, ...uniqueNewReplies];
        setLocalReplies(allReplies);
        setHasMoreReplies(allReplies.length < total);

        // Update cache and base replies with accumulated data (only for non-search pagination)
        if (!search) {
          cachedBaseReplies.current = { items: allReplies, totalCount: total };
          cacheManager.saveAppSetting('quickReplies', { items: allReplies, totalCount: total }).catch(() => {});
        }
      }
    } catch (error) {
      showSnackbar('Failed to load quick replies');
    }
  }, [dispatch, localReplies]);

  const onRefresh = useCallback(() => {
    if (isOffline) return;
    setSearchQuery('');
    setHasMoreReplies(true);
    initialLoadDone.current = false;
    fetchSucceeded.current = false;
    isLoadingRef.current = true;
    // Clear cache so fresh data is fetched from API
    cacheManager.saveAppSetting('quickReplies', null).catch(() => {});
    cachedBaseReplies.current = { items: [], totalCount: 0 };
    dispatch(fetchQuickRepliesWithCache({ forceRefresh: true }))
      .unwrap()
      .then((result) => {
        fetchSucceeded.current = true;
        const data = result.data?.quickReplies || result.quickReplies || {};
        const items = data.items || [];
        const total = data.totalCount || 0;
        setLocalReplies(items);
        setTotalCount(total);
        setHasMoreReplies(items.length < total);
        initialLoadDone.current = true;
        cachedBaseReplies.current = { items, totalCount: total };
      })
      .catch(() => {})
      .finally(() => { isLoadingRef.current = false; });
  }, [dispatch, isOffline]);

  // Debounced search handler
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // When search is cleared, restore base replies instantly (no API needed)
    if (!text.trim()) {
      const { items, totalCount: total } = cachedBaseReplies.current;
      setLocalReplies(items);
      setTotalCount(total);
      setHasMoreReplies(items.length < total);
      return;
    }

    // Offline: local filter only (filteredReplies handles it)
    if (isOffline) return;

    // Online: debounce, check local matches first — only hit API if not found in cache
    searchDebounceRef.current = setTimeout(() => {
      const query = text.toLowerCase().trim();
      const localMatches = cachedBaseReplies.current.items.filter(reply => {
        const shortcut = reply.shortcut?.toLowerCase() || '';
        return shortcut.includes(query);
      });

      if (localMatches.length === 0) {
        loadReplies({ reset: true, search: text });
      }
    }, 500);
  }, [loadReplies, isOffline]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (!initialLoadDone.current || isLoading || isLoadingMore || !hasMoreReplies || isOffline) return;

    setIsLoadingMore(true);
    await loadReplies({ reset: false, search: searchQuery });
    setIsLoadingMore(false);
  }, [isLoading, isLoadingMore, hasMoreReplies, loadReplies, searchQuery, isOffline]);

  // Filter replies locally for instant search feedback
  const filteredReplies = localReplies.filter((reply) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const shortcut = reply.shortcut?.toLowerCase() || '';
    return shortcut.includes(query);
  });

  const showSnackbar = (msg) => {
    setSnackbarMessage(msg);
    setSnackbarVisible(true);
  };

  const handleAddReply = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleEditReply = useCallback((reply) => {
    setReplyToEdit(reply);
    setShowEditModal(true);
  }, []);

  const handlePreviewReply = useCallback((reply) => {
    setPreviewReply(reply);
    setShowPreviewModal(true);
  }, []);

  const handleDeleteReply = useCallback((reply) => {
    setReplyToDelete(reply);
    setShowDeleteModal(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setShowPreviewModal(false);
    setPreviewReply(null);
  }, []);

  const handleSaveNewReply = async (replyData) => {
    try {
      const data = {
        key: 'quickReplies',
        data: [replyData],
      };

      await dispatch(updateSettings(data)).unwrap();
      showSnackbar('Quick reply created successfully');
      setShowAddModal(false);
      // Reload fresh data after CRUD operation
      loadReplies({ reset: true, search: searchQuery });
      return true;
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to save quick reply';
      showSnackbar(`Error: ${errorMessage}`);
      return false;
    }
  };

  const handleSaveEditReply = async (replyData) => {
    try {
      const data = {
        key: 'quickReplies',
        data: [{
          _id: replyData._id,
          shortcut: replyData.shortcut,
          type: replyData.type,
          message: replyData.message,
          ...(replyData.headerFileURL && { headerFileURL: replyData.headerFileURL }),
          ...(replyData.fileName && { fileName: replyData.fileName }),
        }],
        shouldUpdate: true,
      };

      await dispatch(updateSettings(data)).unwrap();
      showSnackbar('Quick reply updated successfully');
      setShowEditModal(false);
      setReplyToEdit(null);
      loadReplies({ reset: true, search: searchQuery });
      return true;
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update quick reply';
      showSnackbar(`Error: ${errorMessage}`);
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!replyToDelete) return;

    try {
      await dispatch(deleteSettings({ key: 'quickReplies', ids: [replyToDelete._id] })).unwrap();
      showSnackbar('Quick reply deleted successfully');
      setShowDeleteModal(false);
      setReplyToDelete(null);
      loadReplies({ reset: true, search: searchQuery });
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete quick reply';
      showSnackbar(`Error: ${errorMessage}`);
    }
  };

  const getTypeConfig = (type) => {
    return MESSAGE_TYPES[type] || MESSAGE_TYPES.text;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  // Quick Reply Card
  const renderReplyCard = ({ item }) => {
    const typeConfig = getTypeConfig(item.type);
    const date = formatDate(item.createdAt);

    return (
      <View style={styles.replyCard}>
        <View style={styles.cardContent}>
          {/* Top Row: Shortcut and Type */}
          <View style={styles.cardTopRow}>
            <View style={styles.shortcutBadge}>
              <Text style={styles.shortcutText} numberOfLines={1}>/{item.shortcut}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
              <Icon name={typeConfig.icon} size={14} color={typeConfig.color} />
              <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
            </View>
          </View>

          {/* Bottom Row: Date, Creator, and Actions */}
          <View style={styles.cardBottomRow}>
            <View style={styles.metaInfo}>
              {date && (
                <View style={styles.metaBadge}>
                  <Icon name="calendar-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.metaText}>{date}</Text>
                </View>
              )}
              {item.createdBy && (
                <View style={styles.metaBadge}>
                  <Icon name="account-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.createdBy}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handlePreviewReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="eye-outline" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleEditReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDeleteReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="trash-can-outline" size={18} color={colors.error.main} />
              </TouchableOpacity>
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
        <Icon name="lightning-bolt-outline" size={64} color="#FF9800" />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No quick replies found' : 'No quick replies yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search criteria'
          : 'Create quick replies to save time when chatting'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddReply}>
          <Icon name="plus" size={20} color={colors.common.white} />
          <Text style={styles.emptyAddBtnText}>Add Quick Reply</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Footer Component
  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.footerLoaderText}>Loading more...</Text>
        </View>
      );
    }

    if (!hasMoreReplies && localReplies.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>
            Showing all {localReplies.length} quick replies
          </Text>
        </View>
      );
    }

    return <View style={styles.listFooterSpace} />;
  };

  // Preview Bottom Sheet with Message Bubble Style
  const renderPreviewModal = () => {
    if (!previewReply) return null;

    const typeConfig = getTypeConfig(previewReply.type);
    const createdDate = formatDate(previewReply.createdAt);
    const updatedDate = formatDate(previewReply.updatedAt);
    const messageLength = previewReply.message?.length || 0;

    return (
      <Modal
        isVisible={showPreviewModal}
        onBackdropPress={handleClosePreview}
        onSwipeComplete={handleClosePreview}
        swipeDirection={['down']}
        style={styles.bottomModal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.previewSheet}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <View style={[styles.previewHeaderIcon, { backgroundColor: typeConfig.bg }]}>
                <Icon name={typeConfig.icon} size={24} color={typeConfig.color} />
              </View>
              <View style={styles.previewHeaderInfo}>
                <Text style={styles.previewHeaderTitle}>Quick Reply Details</Text>
                <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg, alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Icon name={typeConfig.icon} size={12} color={typeConfig.color} />
                  <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClosePreview}
              style={styles.previewCloseBtn}
            >
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Message Bubble Preview */}
          <ScrollView
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Reply Info Card */}
            <View style={styles.previewInfoCard}>
              {/* Shortcut - Prominent Display */}
              <View style={styles.previewShortcutCard}>
                <View style={styles.previewShortcutIconContainer}>
                  <Icon name="lightning-bolt" size={20} color={colors.primary.main} />
                </View>
                <View style={styles.previewShortcutContent}>
                  <Text style={styles.previewShortcutTitle}>Shortcut Command</Text>
                  <Text style={styles.previewShortcutCommand} numberOfLines={1}>/{previewReply.shortcut}</Text>
                </View>
              </View>

              {/* Info Grid */}
              <View style={styles.previewInfoGrid}>
                {/* Created Date */}
                {createdDate && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="calendar-plus" size={16} color={colors.success.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Created</Text>
                      <Text style={styles.previewInfoValue}>{createdDate}</Text>
                    </View>
                  </View>
                )}

                {/* Updated Date */}
                {updatedDate && updatedDate !== createdDate && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="calendar-edit" size={16} color={colors.warning.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Updated</Text>
                      <Text style={styles.previewInfoValue}>{updatedDate}</Text>
                    </View>
                  </View>
                )}

                {/* Created By */}
                {previewReply.createdBy && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="account" size={16} color={colors.info.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Created By</Text>
                      <Text style={styles.previewInfoValue} numberOfLines={1}>{previewReply.createdBy}</Text>
                    </View>
                  </View>
                )}

                {/* Has Media */}
                {previewReply.type !== 'text' && previewReply.headerFileURL && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="attachment" size={16} color={colors.secondary.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Media</Text>
                      <Text style={styles.previewInfoValue}>Attached</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Section Title */}
            <View style={styles.previewSectionHeader}>
              <Icon name="message-text-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.previewSectionTitle}>Message Preview</Text>
            </View>

            {/* Message Bubble Preview */}
            <MessagePreviewBubble
              mode="regular"
              regularMessageType={previewReply.type || 'text'}
              message={previewReply.message || ''}
              fileUrl={previewReply.headerFileURL || ''}
              fileName={previewReply.fileName || ''}
              useNativeMediaControls={true}
              showTypeBadge={false}
            />

            {/* Full Message Content - Show complete text for long messages */}
            {previewReply.message && messageLength > 100 && (
              <>
                <View style={[styles.previewSectionHeader, { marginTop: 20 }]}>
                  <Icon name="text-box-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.previewSectionTitle}>Full Message Content</Text>
                </View>
                <View style={styles.fullMessageContainer}>
                  <Text style={styles.fullMessageText} selectable>
                    {previewReply.message}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.previewActionContainer}>
            <TouchableOpacity
              style={styles.previewEditBtn}
              onPress={() => {
                handleClosePreview();
                setTimeout(() => handleEditReply(previewReply), 300);
              }}
              activeOpacity={0.7}
            >
              <Icon name="pencil-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.previewEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewDeleteBtn}
              onPress={() => {
                handleClosePreview();
                setTimeout(() => handleDeleteReply(previewReply), 300);
              }}
              activeOpacity={0.7}
            >
              <Icon name="trash-can-outline" size={18} color={colors.error.main} />
              <Text style={styles.previewDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Delete Modal
  const renderDeleteModal = () => (
    <Modal
      isVisible={showDeleteModal}
      onBackdropPress={() => !isDeleting && setShowDeleteModal(false)}
      style={styles.centerModal}
      backdropOpacity={0.5}
      animationIn="zoomIn"
      animationOut="zoomOut"
    >
      <View style={styles.deleteContainer}>
        <View style={styles.deleteIconCircle}>
          <Icon name="trash-can-outline" size={28} color={colors.error.main} />
        </View>
        <Text style={styles.deleteTitle}>Delete Quick Reply</Text>
        <Text style={styles.deleteMessage}>
          Are you sure you want to delete "/{replyToDelete?.shortcut}"?
        </Text>
        <Text style={styles.deleteSubtext}>
          This action cannot be undone.
        </Text>
        <View style={styles.deleteButtonRow}>
          <TouchableOpacity
            style={styles.deleteCancelBtn}
            onPress={() => setShowDeleteModal(false)}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, isDeleting && styles.deleteConfirmBtnDisabled]}
            onPress={confirmDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.common.white} />
            ) : (
              <Text style={styles.deleteConfirmText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Offline with no data
  if (isOffline && !initialLoadDone.current && localReplies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load quick replies.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Loading State - Initial load (skeleton instead of spinner)
  if (isInitialLoading && localReplies.length === 0 && !isOffline) {
    return <QuickRepliesSkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <InfoBanner
        message='Type "/" in chat to use quick replies'
        style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4 }}
      />

      {/* Search */}
      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by shortcut..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredReplies}
        renderItem={renderReplyCard}
        keyExtractor={(item, index) => item._id ? `qr-${item._id}` : `qr-index-${index}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + 80 }]}
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
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: TAB_BAR_HEIGHT + 16 }]} onPress={handleAddReply} activeOpacity={0.8}>
        <Icon name="plus" size={26} color={colors.common.white} />
      </TouchableOpacity>

      {/* Modals - Separate Add and Edit */}
      <AddQuickReplyModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewReply}
        isSaving={isSaving}
        showSnackbar={showSnackbar}
      />

      <EditQuickReplyModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setReplyToEdit(null);
        }}
        onSave={handleSaveEditReply}
        isSaving={isSaving}
        showSnackbar={showSnackbar}
        replyToEdit={replyToEdit}
      />

      {renderPreviewModal()}
      {renderDeleteModal()}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
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

  // Header Count Badge
  headerCountBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 16,
  },
  headerCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    flexGrow: 1,
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
    height: 20,
  },

  // Card
  replyCard: {
    ...cardStyles.card,
  },
  cardContent: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  shortcutBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flexShrink: 1,
  },
  shortcutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.text.tertiary,
    maxWidth: 80,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.common.white,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Offline State
  offlineBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  offlineIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  offlineSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Base Styles
  bottomModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  centerModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Preview Sheet
  previewSheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  previewHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeaderInfo: {
    flex: 1,
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewScrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  previewScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // Preview Info Card
  previewInfoCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  previewShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  previewShortcutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewShortcutContent: {
    flex: 1,
  },
  previewShortcutTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewShortcutCommand: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.darker,
  },
  previewInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  previewInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  previewInfoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewInfoContent: {
    flex: 1,
  },
  previewInfoLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 1,
  },
  previewInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Full Message Content
  fullMessageContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  fullMessageText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.primary,
  },

  // Preview Actions
  previewActionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  previewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
    gap: 6,
  },
  previewEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error.lighter,
    gap: 6,
  },
  previewDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error.main,
  },

  // Delete Modal
  deleteContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteSubtext: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
    marginBottom: 20,
  },
  deleteButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  deleteConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error.main,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.6,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },
});
