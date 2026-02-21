import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Text, Searchbar, ActivityIndicator } from 'react-native-paper';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getAssistants, getAssistant } from '../redux/slices/assistantSlice';
import { fetchAssistantsWithCache, fetchAssistantStatsWithCache } from '../redux/cacheThunks';
import { cacheManager } from '../database/CacheManager';
import { useFocusEffect } from '@react-navigation/native';
import { useNetwork } from '../contexts/NetworkContext';
import { colors } from '../theme/colors';
import { cardStyles } from '../theme/cardStyles';
import { format, formatDistanceToNow } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// OpenAI Model configurations
const MODEL_CONFIG = {
  'gpt-4': { name: 'GPT-4', icon: 'brain', color: '#10A37F' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', icon: 'rocket-launch', color: '#8B5CF6' },
  'gpt-4o': { name: 'GPT-4o', icon: 'lightning-bolt', color: '#F59E0B' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', icon: 'flash', color: '#06B6D4' },
  'gpt-3.5-turbo': { name: 'GPT-3.5', icon: 'speedometer', color: '#3B82F6' },
  default: { name: 'NA', icon: 'robot', color: colors.secondary.main },
};

// Provider configurations with icons and colors
const PROVIDER_CONFIG = {
  openai: { name: 'OpenAI', icon: 'creation', color: '#10A37F', bgColor: '#ECFDF5' },
  anthropic: { name: 'Anthropic', icon: 'alpha-a-circle', color: '#D97706', bgColor: '#FEF3C7' },
  google: { name: 'Google', icon: 'google', color: '#4285F4', bgColor: '#EFF6FF' },
  default: { name: 'AI', icon: 'robot', color: '#6366F1', bgColor: '#EEF2FF' },
};

const getProviderConfig = (provider) => {
  if (!provider) return PROVIDER_CONFIG.default;
  const lower = provider.toLowerCase();
  if (lower.includes('openai')) return PROVIDER_CONFIG.openai;
  if (lower.includes('anthropic')) return PROVIDER_CONFIG.anthropic;
  if (lower.includes('google')) return PROVIDER_CONFIG.google;
  return PROVIDER_CONFIG.default;
};

const getModelConfig = (modelName) => {
  if (!modelName) return MODEL_CONFIG.default;
  const lower = modelName.toLowerCase();
  if (lower.includes('gpt-4o-mini')) return MODEL_CONFIG['gpt-4o-mini'];
  if (lower.includes('gpt-4o')) return MODEL_CONFIG['gpt-4o'];
  if (lower.includes('gpt-4-turbo')) return MODEL_CONFIG['gpt-4-turbo'];
  if (lower.includes('gpt-4')) return MODEL_CONFIG['gpt-4'];
  if (lower.includes('gpt-3.5')) return MODEL_CONFIG['gpt-3.5-turbo'];
  return MODEL_CONFIG.default;
};

// Status configuration
const STATUS_CONFIG = {
  active: { label: 'Active', color: colors.success.main, icon: 'check-circle' },
  inactive: { label: 'Inactive', color: colors.error.main, icon: 'pause-circle' },
};

// Skeleton Components
const SkeletonBox = ({ style }) => <View style={[styles.skeleton, style]} />;

const AssistantCardSkeleton = () => (
  <View style={styles.card}>
    {/* Provider Icon Skeleton */}
    <View style={styles.skeletonProviderIcon}>
      <SkeletonBox style={{ width: 48, height: 48, borderRadius: 12 }} />
    </View>
    <View style={styles.cardContent}>
      <View style={styles.cardTopRow}>
        <SkeletonBox style={{ width: 140, height: 16 }} />
        <SkeletonBox style={{ width: 65, height: 22, borderRadius: 6 }} />
      </View>
      <View style={styles.cardMiddleRow}>
        <SkeletonBox style={{ width: 95, height: 26, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 75, height: 26, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 50, height: 26, borderRadius: 6 }} />
      </View>
      <View style={styles.cardBottomRow}>
        <SkeletonBox style={{ width: 100, height: 14 }} />
        <SkeletonBox style={{ width: 90, height: 14 }} />
      </View>
      <View style={[styles.cardUpdateRow, { borderTopWidth: 0, marginTop: 4 }]}>
        <SkeletonBox style={{ width: 130, height: 12 }} />
      </View>
    </View>
  </View>
);

// Skeleton List for loading state
const SkeletonList = () => (
  <View style={{ paddingHorizontal: 0 }}>
    {[1, 2, 3, 4].map((i) => <AssistantCardSkeleton key={i} />)}
  </View>
);

// Parse assistants API response — handles multiple response structures
const parseAssistantsResponse = (result) => {
  let assistants = [];
  const payload = result;
  const raw = payload?._raw || {};

  if (Array.isArray(payload?.assistants)) {
    assistants = payload.assistants;
  } else if (Array.isArray(raw?.assistants)) {
    assistants = raw.assistants;
  } else if (Array.isArray(payload?.data?.assistants)) {
    assistants = payload.data.assistants;
  } else if (Array.isArray(raw?.data?.assistants)) {
    assistants = raw.data.assistants;
  } else if (Array.isArray(payload?.data)) {
    assistants = payload.data;
  } else if (Array.isArray(raw?.data)) {
    assistants = raw.data;
  } else if (Array.isArray(payload)) {
    assistants = payload;
  }

  const totalResults = payload?.pagination?.totalItems
    || raw?.pagination?.totalItems
    || payload?.data?.pagination?.totalItems
    || assistants.length;

  return { assistants, totalResults };
};

export default function AIAssistantScreen() {
  const dispatch = useDispatch();
  const PAGE_SIZE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Local state for cache-first pattern with pagination
  const [localAssistants, setLocalAssistants] = useState([]);
  const [localStats, setLocalStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreAssistants, setHasMoreAssistants] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Refs for coordinating cache/network state
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const fetchSucceeded = useRef(false);
  const cachedBaseAssistants = useRef([]);
  const searchDebounceRef = useRef(null);
  const currentPageRef = useRef(0);
  const isFirstFocus = useRef(true);

  // Redux selectors — only for detail view
  const { selectedAssistant, assistantStatus, assistantsStatus } = useSelector((state) => state.assistant);
  const { isOffline, isNetworkAvailable } = useNetwork();

  const isLoading = assistantsStatus === 'loading';
  const isLoadingDetails = assistantStatus === 'loading';

  // ── LOCAL FILTERING: Filter from local list for search only ──
  const filteredAssistants = searchQuery.trim()
    ? localAssistants.filter((assistant) => {
        const query = searchQuery.toLowerCase().trim();
        const name = (assistant.name || '').toLowerCase();
        const model = (assistant.modelName || assistant.model || '').toLowerCase();
        const provider = (assistant.modelProvider || '').toLowerCase();
        return name.includes(query) || model.includes(query) || provider.includes(query);
      })
    : localAssistants;

  // ── LOAD ASSISTANTS: Pagination with progressive per-status cache accumulation ──
  const loadAssistants = useCallback(async ({ reset = false, status = 'all', search = '' } = {}) => {
    if (reset) {
      currentPageRef.current = 0;
    }

    const pageToFetch = currentPageRef.current;

    try {
      const result = await dispatch(getAssistants({
        page: pageToFetch,
        limit: PAGE_SIZE,
        status: status !== 'all' ? status : undefined,
        name: search || undefined,
      })).unwrap();

      const parsed = parseAssistantsResponse(result);
      const newAssistants = parsed.assistants;
      const total = parsed.totalResults || 0;

      setTotalCount(total);

      if (reset) {
        setLocalAssistants(newAssistants);
        setHasMoreAssistants(newAssistants.length < total);
        currentPageRef.current = 1;
        // Save to per-status cache
        if (!search) {
          const cacheKey = status === 'all' ? 'assistants' : `assistants_${status}`;
          if (status === 'all') cachedBaseAssistants.current = newAssistants;
          cacheManager.saveAppSetting(cacheKey, { assistants: newAssistants, totalResults: total }).catch(() => {});
        }
      } else {
        // Append with dedup using functional update to avoid stale closure
        setLocalAssistants(prev => {
          const existingIds = new Set(prev.map(a => a._id));
          const uniqueNew = newAssistants.filter(a => !existingIds.has(a._id));
          const allAssistants = [...prev, ...uniqueNew];
          setHasMoreAssistants(allAssistants.length < total);

          // Progressive cache accumulation (per-status)
          if (!search) {
            const cacheKey = status === 'all' ? 'assistants' : `assistants_${status}`;
            if (status === 'all') cachedBaseAssistants.current = allAssistants;
            cacheManager.saveAppSetting(cacheKey, { assistants: allAssistants, totalResults: total }).catch(() => {});
          }

          return allAssistants;
        });
        currentPageRef.current = pageToFetch + 1;
      }
    } catch (error) {
      // Load failed — silently handle
    }
  }, [dispatch]);

  // ── HANDLE LOAD MORE ──
  const handleLoadMore = useCallback(async () => {
    if (!initialLoadDone.current || isLoading || isLoadingMoreRef.current || !hasMoreAssistants || isOffline) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    await loadAssistants({ reset: false, status: selectedStatus, search: searchQuery });
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [isLoading, hasMoreAssistants, loadAssistants, selectedStatus, searchQuery, isOffline]);

  // ── HELPER: Process initial/refresh result ──
  const processInitialResult = useCallback((assistantsResult, statsResult) => {
    const assistantsData = assistantsResult.data || assistantsResult;
    const incomingList = assistantsData.assistants || [];
    const total = assistantsData.totalResults || incomingList.length;

    // Merge with existing local data to preserve paginated items beyond the first page
    const existingList = cachedBaseAssistants.current;
    let finalList = incomingList;
    if (existingList.length > incomingList.length && incomingList.length > 0) {
      const incomingIds = new Set(incomingList.map(a => a._id));
      const beyondIncoming = existingList
        .slice(incomingList.length)
        .filter(a => !incomingIds.has(a._id));
      finalList = [...incomingList, ...beyondIncoming];
    }

    const nextPage = Math.floor(finalList.length / PAGE_SIZE);
    setLocalAssistants(finalList);
    setTotalCount(total);
    setHasMoreAssistants(finalList.length < total);
    cachedBaseAssistants.current = finalList;
    currentPageRef.current = nextPage;

    // Save merged result back to cache so next visit gets the full list
    if (finalList.length > incomingList.length) {
      cacheManager.saveAppSetting('assistants', { assistants: finalList, totalResults: total }).catch(() => {});
    }

    const statsData = statsResult.data || statsResult;
    setLocalStats({
      total: statsData.total || 0,
      active: statsData.active || 0,
      inactive: statsData.inactive || 0,
    });
  }, []);

  // ── INITIAL LOAD: Read cache instantly, then fetch fresh first page ──
  useEffect(() => {
    isLoadingRef.current = true;
    fetchSucceeded.current = false;

    // Step 1: Read cache locally for instant display
    Promise.all([
      cacheManager.getAppSetting('assistants'),
      cacheManager.getAppSetting('assistantStats'),
    ]).then(([cachedAssistants]) => {
      if (cachedAssistants && cachedAssistants.assistants && cachedAssistants.assistants.length > 0) {
        setLocalAssistants(cachedAssistants.assistants);
        setTotalCount(cachedAssistants.totalResults || cachedAssistants.assistants.length);
        setHasMoreAssistants(cachedAssistants.assistants.length < (cachedAssistants.totalResults || 0));
        cachedBaseAssistants.current = cachedAssistants.assistants;
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Step 2: Always fetch fresh first page from API
    Promise.all([
      dispatch(fetchAssistantsWithCache({ forceRefresh: true })).unwrap(),
      dispatch(fetchAssistantStatsWithCache({ forceRefresh: true })).unwrap(),
    ]).then(([assistantsResult, statsResult]) => {
      fetchSucceeded.current = true;
      processInitialResult(assistantsResult, statsResult);
      initialLoadDone.current = true;
    }).catch(() => {}).finally(() => {
      isLoadingRef.current = false;
      setIsInitialLoading(false);
    });

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // ── NETWORK RECOVERY: Re-fetch when connectivity restored ──
  useEffect(() => {
    if (isNetworkAvailable && !initialLoadDone.current && !isLoadingRef.current) {
      isLoadingRef.current = true;
      fetchSucceeded.current = false;
      setIsInitialLoading(true);

      Promise.all([
        dispatch(fetchAssistantsWithCache({ forceRefresh: true })).unwrap(),
        dispatch(fetchAssistantStatsWithCache({ forceRefresh: true })).unwrap(),
      ]).then(([assistantsResult, statsResult]) => {
        fetchSucceeded.current = true;
        processInitialResult(assistantsResult, statsResult);
        initialLoadDone.current = true;
      }).catch(() => {}).finally(() => {
        isLoadingRef.current = false;
        setIsInitialLoading(false);
      });
    }
  }, [isNetworkAvailable]);

  // ── SCREEN REFOCUS: Re-fetch first page when screen regains focus ──
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount — the useEffect above already handles the first load
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }

      if (!initialLoadDone.current || isOffline) {
        return;
      }

      Promise.all([
        dispatch(fetchAssistantsWithCache({ forceRefresh: true })).unwrap(),
        dispatch(fetchAssistantStatsWithCache({ forceRefresh: true })).unwrap(),
      ]).then(([assistantsResult, statsResult]) => {
        processInitialResult(assistantsResult, statsResult);
      }).catch(() => {});
    }, [isOffline])
  );

  // ── PULL TO REFRESH: Clear cache, fetch fresh first page ──
  const onRefresh = useCallback(() => {
    if (isOffline) return;
    setSearchQuery('');
    setSelectedStatus('all');
    setHasMoreAssistants(true);
    isLoadingRef.current = true;
    currentPageRef.current = 0;

    Promise.all([
      cacheManager.saveAppSetting('assistants', null),
      cacheManager.saveAppSetting('assistantStats', null),
      cacheManager.saveAppSetting('assistants_active', null),
      cacheManager.saveAppSetting('assistants_inactive', null),
    ]).catch(() => {});

    cachedBaseAssistants.current = [];

    Promise.all([
      dispatch(fetchAssistantsWithCache({ forceRefresh: true })).unwrap(),
      dispatch(fetchAssistantStatsWithCache({ forceRefresh: true })).unwrap(),
    ]).then(([assistantsResult, statsResult]) => {
      processInitialResult(assistantsResult, statsResult);
    }).catch(() => {}).finally(() => {
      isLoadingRef.current = false;
    });
  }, [dispatch, isOffline]);

  // ── SEARCH: Debounced with local filter + API fallback ──
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // When search is cleared, restore base assistants
    if (!text.trim()) {
      const base = cachedBaseAssistants.current;
      setLocalAssistants(base);
      setTotalCount(localStats.total || base.length);
      setHasMoreAssistants(base.length < (localStats.total || 0));
      currentPageRef.current = Math.floor(base.length / PAGE_SIZE);
      return;
    }

    if (isOffline) return;

    // Debounce: check local matches first, API fallback if none found
    searchDebounceRef.current = setTimeout(() => {
      const query = text.toLowerCase().trim();
      const localMatches = cachedBaseAssistants.current.filter(a => {
        const name = (a.name || '').toLowerCase();
        const model = (a.modelName || a.model || '').toLowerCase();
        const provider = (a.modelProvider || '').toLowerCase();
        return name.includes(query) || model.includes(query) || provider.includes(query);
      });

      if (localMatches.length === 0) {
        loadAssistants({ reset: true, status: selectedStatus, search: text });
      }
    }, 500);
  }, [loadAssistants, isOffline, selectedStatus, localStats]);

  // ── STATUS FILTER: Per-status cache → instant display or skeleton → API ──
  const handleStatusChange = useCallback((status) => {
    setSelectedStatus(status);
    setSearchQuery('');

    if (status === 'all') {
      const base = cachedBaseAssistants.current;
      setLocalAssistants(base);
      setTotalCount(localStats.total || base.length);
      setHasMoreAssistants(base.length < (localStats.total || 0));
      currentPageRef.current = Math.floor(base.length / PAGE_SIZE);
      return;
    }

    if (isOffline) return;

    currentPageRef.current = 0;
    setHasMoreAssistants(true);
    const cacheKey = `assistants_${status}`;

    // Check per-status cache first
    cacheManager.getAppSetting(cacheKey)
      .catch(() => null)
      .then((cached) => {
        if (cached && cached.assistants && cached.assistants.length > 0) {
          setLocalAssistants(cached.assistants);
          setTotalCount(cached.totalResults || cached.assistants.length);
          setHasMoreAssistants(cached.assistants.length < (cached.totalResults || 0));
          currentPageRef.current = Math.floor(cached.assistants.length / PAGE_SIZE);

          // Silently refresh first page in background
          dispatch(getAssistants({ page: 0, limit: PAGE_SIZE, status }))
            .unwrap()
            .then((result) => {
              const parsed = parseAssistantsResponse(result);
              let merged = parsed.assistants;
              if (cached.assistants.length > parsed.assistants.length) {
                const freshIds = new Set(parsed.assistants.map(a => a._id));
                const beyondFirstPage = cached.assistants
                  .slice(parsed.assistants.length)
                  .filter(a => !freshIds.has(a._id));
                merged = [...parsed.assistants, ...beyondFirstPage];
              }
              setLocalAssistants(merged);
              setTotalCount(parsed.totalResults);
              setHasMoreAssistants(merged.length < parsed.totalResults);
              currentPageRef.current = Math.floor(merged.length / PAGE_SIZE);
              cacheManager.saveAppSetting(cacheKey, { assistants: merged, totalResults: parsed.totalResults }).catch(() => {});
            })
            .catch(() => {});
          return;
        }

        // No cache — show skeleton, fetch from API
        setIsFilterLoading(true);
        dispatch(getAssistants({ page: 0, limit: PAGE_SIZE, status }))
          .unwrap()
          .then((result) => {
            const parsed = parseAssistantsResponse(result);
            setLocalAssistants(parsed.assistants);
            setTotalCount(parsed.totalResults);
            setHasMoreAssistants(parsed.assistants.length < parsed.totalResults);
            currentPageRef.current = 1;
            cacheManager.saveAppSetting(cacheKey, { assistants: parsed.assistants, totalResults: parsed.totalResults }).catch(() => {});
          })
          .catch(() => {})
          .finally(() => setIsFilterLoading(false));
      });
  }, [dispatch, isOffline, localStats]);

  const handleAssistantPress = (assistant) => {
    dispatch(getAssistant(assistant._id));
    setDetailsVisible(true);
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return null;
    }
  };

  const formatRelativeDate = (dateString) => {
    if (!dateString) return null;
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return null;
    }
  };

  // Filter Pills Data
  const filterPills = [
    { key: 'all', label: 'All', count: localStats.total, icon: 'robot-outline', color: colors.primary.main },
    { key: 'active', label: 'Active', count: localStats.active, icon: 'check-circle-outline', color: colors.success.main },
    { key: 'inactive', label: 'Inactive', count: localStats.inactive, icon: 'pause-circle-outline', color: colors.error.main },
  ];

  // Filter Pill Component
  const renderFilterPill = ({ item }) => {
    const isSelected = selectedStatus === item.key;
    return (
      <TouchableOpacity
        onPress={() => handleStatusChange(item.key)}
        activeOpacity={0.7}
        style={[styles.filterChip, isSelected && { backgroundColor: item.color, borderColor: item.color }]}
      >
        <Icon
          name={item.icon}
          size={16}
          color={isSelected ? '#FFFFFF' : item.color}
        />
        <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
          {item.label}
        </Text>
        <View style={[styles.filterBadge, isSelected && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, isSelected && styles.filterBadgeTextActive]}>
            {item.count || 0}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Assistant Card - Modern Design with Provider Icon
  const renderCard = ({ item }) => {
    if (!item || !item._id) return null;

    const model = getModelConfig(item.modelName || item.model);
    const provider = getProviderConfig(item.modelProvider);
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.inactive;
    const createdBy = item.createdBy?.name || item.createdBy?.email || 'Unknown';
    const createdDate = formatRelativeDate(item.createdAt);
    const updatedDate = formatRelativeDate(item.updatedAt);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleAssistantPress(item)}
        activeOpacity={0.8}
      >
        {/* Provider Icon - Left Side */}
        <View style={[styles.providerIconContainer, { backgroundColor: provider.bgColor }]}>
          <Icon name={provider.icon} size={24} color={provider.color} />
        </View>

        <View style={styles.cardContent}>
          {/* Top Row: Name and Status */}
          <View style={styles.cardTopRow}>
            <Text style={styles.assistantName} numberOfLines={1}>
              {item.name || 'Unnamed Assistant'}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: statusConfig.color + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusChipText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Middle Row: Model and Provider */}
          <View style={styles.cardMiddleRow}>
            <View style={[styles.modelChip, { backgroundColor: model.color + '12' }]}>
              <Icon name={model.icon} size={14} color={model.color} />
              <Text style={[styles.modelChipText, { color: model.color }]}>
                Used AI/Model : {item.modelName || item.model || model.name}
              </Text>
            </View>
            {item.modelProvider && (
              <View style={[styles.providerChip, { backgroundColor: provider.color + '10' }]}>
                <Icon name={provider.icon} size={12} color={provider.color} />
                <Text style={[styles.providerChipText, { color: provider.color }]}>{provider.name}</Text>
              </View>
            )}
            {item.temperature !== undefined && (
              <View style={styles.tempChip}>
                <Icon name="thermometer" size={12} color={colors.text.tertiary} />
                <Text style={styles.tempChipText}>{item.temperature}</Text>
              </View>
            )}
          </View>

          {/* Bottom Row: Created By, Created At */}
          <View style={styles.cardBottomRow}>
            <View style={styles.metaInfo}>
              <Icon name="account-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.metaText} numberOfLines={1}>{createdBy}</Text>
            </View>
            {createdDate && (
              <View style={styles.metaInfo}>
                <Icon name="calendar-plus-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{createdDate}</Text>
              </View>
            )}
          </View>

          {/* Updated info on separate row if available */}
          {updatedDate && (
            <View style={styles.cardUpdateRow}>
              <Icon name="update" size={13} color={colors.text.tertiary} />
              <Text style={styles.updateText}>Updated {updatedDate}</Text>
            </View>
          )}
        </View>

        {/* Arrow indicator */}
        <View style={styles.cardArrow}>
          <Icon name="chevron-right" size={22} color={colors.grey[300]} />
        </View>
      </TouchableOpacity>
    );
  };

  // Scroll handling for bottom sheet
  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const handleScrollTo = (p) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo(p);
    }
  };

  const handleOnScroll = (event) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  // Details Bottom Sheet
  const renderDetailsBottomSheet = () => {
    if (!selectedAssistant) return null;
    const model = getModelConfig(selectedAssistant.modelName || selectedAssistant.model);
    const provider = getProviderConfig(selectedAssistant.modelProvider);
    const statusConfig = STATUS_CONFIG[selectedAssistant.status] || STATUS_CONFIG.inactive;
    const createdBy = selectedAssistant.createdBy?.name || selectedAssistant.createdBy?.email || 'Unknown';

    return (
      <Modal
        isVisible={detailsVisible}
        onBackdropPress={() => setDetailsVisible(false)}
        onSwipeComplete={() => setDetailsVisible(false)}
        swipeDirection={['down']}
        style={styles.bottomSheet}
        propagateSwipe={true}
        scrollTo={handleScrollTo}
        scrollOffset={scrollOffset}
        scrollOffsetMax={400}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.bottomSheetContainer}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {isLoadingDetails ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.sheetLoadingText}>Loading assistant details...</Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetAvatar, { backgroundColor: provider.bgColor }]}>
                  <Icon name={provider.icon} size={28} color={provider.color} />
                </View>
                <View style={styles.sheetHeaderInfo}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {selectedAssistant.name || 'Unnamed Assistant'}
                  </Text>
                  <View style={styles.sheetProviderRow}>
                    <Icon name={provider.icon} size={14} color={provider.color} />
                    <Text style={[styles.sheetProviderText, { color: provider.color }]}>
                      {provider.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailsVisible(false)}
                  style={styles.sheetCloseButton}
                >
                  <Icon name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Status Badges */}
              <View style={styles.sheetStatusRow}>
                <View style={[styles.sheetStatusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                  <Text style={[styles.sheetStatusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <View style={[styles.sheetModelBadge, { backgroundColor: model.color + '12' }]}>
                  <Icon name={model.icon} size={14} color={model.color} />
                  <Text style={[styles.sheetModelText, { color: model.color }]}>
                    {selectedAssistant.modelName || selectedAssistant.model || model.name}
                  </Text>
                </View>
                {selectedAssistant.temperature !== undefined && (
                  <View style={styles.sheetTempBadge}>
                    <Icon name="thermometer" size={14} color="#F59E0B" />
                    <Text style={styles.sheetTempText}>{selectedAssistant.temperature}</Text>
                  </View>
                )}
              </View>

              <ScrollView
                ref={scrollViewRef}
                style={styles.sheetScrollContent}
                contentContainerStyle={styles.sheetScrollContainer}
                onScroll={handleOnScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                {/* Model Configuration Section */}
                <View style={styles.sheetSection}>
                  <View style={styles.sheetSectionHeader}>
                    <Icon name="chip" size={20} color={colors.primary.main} />
                    <Text style={styles.sheetSectionTitle}>Model Configuration</Text>
                  </View>
                  <View style={styles.sheetInfoCard}>
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name="brain" size={18} color={model.color} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Model</Text>
                        <Text style={styles.sheetInfoValue}>
                          {selectedAssistant.modelName || selectedAssistant.model || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sheetInfoSeparator} />
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name={provider.icon} size={18} color={provider.color} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Provider</Text>
                        <Text style={styles.sheetInfoValue}>
                          {selectedAssistant.modelProvider || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    {selectedAssistant.temperature !== undefined && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="thermometer" size={18} color="#F59E0B" />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Temperature</Text>
                            <Text style={styles.sheetInfoValue}>{selectedAssistant.temperature}</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Instructions Section */}
                {(selectedAssistant.systemPrompt || selectedAssistant.instructionlist) && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="text-box-outline" size={20} color={colors.primary.main} />
                      <Text style={styles.sheetSectionTitle}>System Instructions</Text>
                    </View>
                    <View style={styles.sheetInstructionsCard}>
                      <Text style={styles.sheetInstructionsText} numberOfLines={8}>
                        {selectedAssistant.systemPrompt || selectedAssistant.instructionlist}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Fallback Message */}
                {selectedAssistant.fallbackMessage && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="message-alert-outline" size={20} color="#F59E0B" />
                      <Text style={styles.sheetSectionTitle}>Fallback Message</Text>
                    </View>
                    <View style={styles.sheetFallbackCard}>
                      <Text style={styles.sheetFallbackText}>
                        {selectedAssistant.fallbackMessage}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Knowledge Files */}
                {selectedAssistant.files && selectedAssistant.files.length > 0 && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="folder-open-outline" size={20} color={colors.primary.main} />
                      <Text style={styles.sheetSectionTitle}>Knowledge Base</Text>
                      <View style={styles.sheetCountBadge}>
                        <Text style={styles.sheetCountText}>{selectedAssistant.files.length}</Text>
                      </View>
                    </View>
                    <View style={styles.sheetFilesCard}>
                      {selectedAssistant.files.map((file, idx) => (
                        <View key={idx} style={styles.sheetFileItem}>
                          <Icon name="file-document-outline" size={18} color={colors.primary.main} />
                          <Text style={styles.sheetFileName} numberOfLines={1}>
                            {file.name || `File ${idx + 1}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Details Section */}
                <View style={styles.sheetSection}>
                  <View style={styles.sheetSectionHeader}>
                    <Icon name="information-outline" size={20} color={colors.primary.main} />
                    <Text style={styles.sheetSectionTitle}>Details</Text>
                  </View>
                  <View style={styles.sheetInfoCard}>
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name="account" size={18} color={colors.info.main} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Created By</Text>
                        <Text style={styles.sheetInfoValue}>{createdBy}</Text>
                      </View>
                    </View>
                    {selectedAssistant.createdAt && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="calendar-plus" size={18} color={colors.success.main} />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Created</Text>
                            <Text style={styles.sheetInfoValue}>
                              {formatDate(selectedAssistant.createdAt)}
                            </Text>
                            <Text style={styles.sheetInfoSubtext}>
                              {formatRelativeDate(selectedAssistant.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                    {selectedAssistant.updatedAt && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="calendar-edit" size={18} color={colors.warning.main} />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Last Updated</Text>
                            <Text style={styles.sheetInfoValue}>
                              {formatDate(selectedAssistant.updatedAt)}
                            </Text>
                            <Text style={styles.sheetInfoSubtext}>
                              {formatRelativeDate(selectedAssistant.updatedAt)}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    );
  };

  // Footer Component for load more / showing all
  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.footerLoaderText}>Loading more...</Text>
        </View>
      );
    }

    if (!hasMoreAssistants && localAssistants.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>
            Showing all {localAssistants.length} assistants
          </Text>
        </View>
      );
    }

    return <View style={styles.listFooterSpace} />;
  };

  // Empty State
  const renderEmpty = () => {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary.main + '15' }]}>
          <Icon name="robot-outline" size={64} color={colors.secondary.main} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery ? 'No assistants found' : 'No AI Assistants'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? 'Try adjusting your search criteria'
            : selectedStatus !== 'all'
            ? `No ${selectedStatus} assistants found`
            : 'Create AI assistants from the web dashboard to manage your conversations'}
        </Text>
      </View>
    );
  };

  // ── FIXED HEADER: Search, Filter Pills, Section Header ──
  const renderFixedHeader = () => (
    <>
      {/* Search */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search assistants..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filterPills}
          renderItem={renderFilterPill}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedStatus === 'all' ? 'All Assistants' : selectedStatus === 'active' ? 'Active Assistants' : 'Inactive Assistants'}
        </Text>
        <Text style={styles.sectionCount}>
          {localAssistants.length} of {totalCount} {totalCount === 1 ? 'assistant' : 'assistants'}
        </Text>
      </View>
    </>
  );

  // ── OFFLINE STATE: Show only when offline + no cached data + never loaded ──
  if (isOffline && !initialLoadDone.current && localAssistants.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.emptyTitle}>You're Offline</Text>
          <Text style={styles.emptySubtitle}>
            Connect to the internet to load AI assistants.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // ── SKELETON STATE: Show when initial loading + no cache + online ──
  if (isInitialLoading && localAssistants.length === 0 && !isOffline) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox style={{ height: 48, borderRadius: 12 }} />
        </View>
        <View style={styles.filtersContainer}>
          <View style={[styles.filtersList, { flexDirection: 'row' }]}>
            <SkeletonBox style={{ width: 80, height: 36, borderRadius: 20, marginRight: 8 }} />
            <SkeletonBox style={{ width: 90, height: 36, borderRadius: 20, marginRight: 8 }} />
            <SkeletonBox style={{ width: 100, height: 36, borderRadius: 20 }} />
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <SkeletonBox style={{ width: 120, height: 20 }} />
          <SkeletonBox style={{ width: 80, height: 16 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16 }}>
            {[1, 2, 3, 4].map((i) => <AssistantCardSkeleton key={i} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── MAIN RENDER: Cached data visible at all times (including offline) ──
  return (
    <View style={styles.container}>
      {renderFixedHeader()}
      {isFilterLoading ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonList />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredAssistants}
          renderItem={renderCard}
          keyExtractor={(item, index) => item?._id || `assistant-${index}`}
          contentContainerStyle={[styles.listContent, filteredAssistants.length === 0 && { flex: 1 }]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
              tintColor={colors.primary.main}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}
      {renderDetailsBottomSheet()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  listContent: {
    paddingBottom: 80,
    flexGrow: 1,
  },

  // Header / Search - Matching ContactsScreen
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

  // Filter Pills - Matching TemplatesScreen
  filtersContainer: {
    backgroundColor: colors.background.default,
    paddingBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
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
    marginRight: 8,
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
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
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

  // Card - Modern Design matching TemplatesScreen
  card: {
    ...cardStyles.card,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  assistantName: {
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
  cardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  modelChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.grey[50],
    gap: 4,
  },
  providerChipText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  tempChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.grey[50],
    gap: 4,
  },
  tempChipText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  cardUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  updateText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  cardArrow: {
    paddingRight: 12,
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    gap: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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

  // Skeleton
  skeleton: {
    backgroundColor: colors.grey[200],
    borderRadius: 6,
  },
  skeletonProviderIcon: {
    marginLeft: 14,
    marginRight: 0,
  },

  // Bottom Sheet
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  bottomSheetContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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
  sheetLoading: {
    padding: 60,
    alignItems: 'center',
  },
  sheetLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Sheet Header
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sheetProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetProviderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sheet Status Row
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  sheetStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetModelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetModelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetTempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetTempText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },

  // Sheet Scroll Content
  sheetScrollContent: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  sheetScrollContainer: {
    paddingBottom: 40,
  },

  // Sheet Section
  sheetSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  sheetCountBadge: {
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sheetCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Sheet Info Card
  sheetInfoCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
  },
  sheetInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sheetInfoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetInfoContent: {
    flex: 1,
    paddingTop: 2,
  },
  sheetInfoLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  sheetInfoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  sheetInfoSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  sheetInfoSeparator: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginVertical: 12,
    marginLeft: 48,
  },

  // Sheet Instructions Card
  sheetInstructionsCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  sheetInstructionsText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Sheet Fallback Card
  sheetFallbackCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  sheetFallbackText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  // Sheet Files Card
  sheetFilesCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  sheetFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  sheetFileName: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
