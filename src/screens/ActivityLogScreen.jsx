import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import { colors } from '../theme/colors';
import { useNetwork } from '../contexts/NetworkContext';
import { getActivityLogs } from '../redux/slices/settingsSlice';
import { InfoBanner, ShadowCard } from '../components/common';
import { showSuccess, showError, showWarning } from '../utils/toast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 20;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 70;

// Action type → display mapping (soft pastel chips)
const ACTION_MAP = {
  POST: { label: 'Created', color: '#166534', bgColor: '#DCFCE7' },
  PUT: { label: 'Updated', color: '#92400E', bgColor: '#FEF3C7' },
  DELETE: { label: 'Deleted', color: '#991B1B', bgColor: '#FEE2E2' },
};

const formatDateTime = (dateString) => {
  if (!dateString) return { date: 'N/A', time: '' };
  try {
    const d = new Date(dateString);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  } catch {
    return { date: 'N/A', time: '' };
  }
};

const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function ActivityLogScreen() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetwork();

  // Redux state
  const activityLogsStatus = useSelector((state) => state.settings.activityLogsStatus);
  const totalCount = useSelector(
    (state) => state.settings.settings?.activityLogs?.totalCount || 0
  );

  // Local state
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isSimpleView, setIsSimpleView] = useState(true);
  const [selectedAction, setSelectedAction] = useState('all');
  const [filterTotalCount, setFilterTotalCount] = useState(0);
  const [filterCounts, setFilterCounts] = useState({ all: 0, POST: 0, PUT: 0, DELETE: 0 });
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const filterListRef = useRef(null);

  const isInitialLoad =
    activityLogsStatus === 'idle' ||
    (activityLogsStatus === 'loading' && items.length === 0);

  // Fetch activity logs for a given page + optional action filter
  const fetchLogs = useCallback(
    async (pageNum = 0, isRefresh = false, action = null) => {
      if (isOffline) return;
      const skip = pageNum * PAGE_SIZE;
      let queries = `skip=${skip}&limit=${PAGE_SIZE}&actorType=user`;
      if (action && action !== 'all') {
        queries += `&action=${action}`;
      }

      try {
        const result = await dispatch(getActivityLogs({ queries })).unwrap();
        const data = result?.data || result;
        const newItems = data?.items || [];
        const newTotalCount = data?.totalCount || 0;

        setFilterTotalCount(newTotalCount);

        if (isRefresh || pageNum === 0) {
          setItems(newItems);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }

        return newTotalCount;
      } catch {
        showError('Failed to load activity logs.', 'Error');
        return 0;
      }
    },
    [dispatch, isOffline]
  );

  // Fetch counts for all action types (pass allTotal to avoid Redux overwrite race)
  const fetchFilterCounts = useCallback(async (allTotal) => {
    if (isOffline) return;
    const actions = ['POST', 'PUT', 'DELETE'];
    try {
      const results = await Promise.all(
        actions.map((action) => {
          const queries = `skip=0&limit=1&actorType=user&action=${action}`;
          return dispatch(getActivityLogs({ queries })).unwrap();
        })
      );
      const counts = { all: allTotal };
      actions.forEach((action, i) => {
        const data = results[i]?.data || results[i];
        counts[action] = data?.totalCount || 0;
      });
      setFilterCounts(counts);
    } catch {
      // Silently fail — counts will show 0
    }
  }, [dispatch, isOffline]);

  // Initial fetch + counts
  useEffect(() => {
    fetchLogs(0).then((allTotal) => {
      setFilterCounts((prev) => ({ ...prev, all: allTotal }));
      fetchFilterCounts(allTotal);
    });
  }, []);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (isOffline) {
      showWarning('Please check your internet connection.', "You're Offline");
      return;
    }
    setIsRefreshing(true);
    setPage(0);
    const refreshedTotal = await fetchLogs(0, true, selectedAction);
    if (selectedAction === 'all') {
      fetchFilterCounts(refreshedTotal);
    }
    setIsRefreshing(false);
  }, [fetchLogs, isOffline, selectedAction, fetchFilterCounts]);

  // Infinite scroll — load more
  const onLoadMore = useCallback(() => {
    if (isLoadingMore || isOffline || items.length >= filterTotalCount) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, false, selectedAction).finally(() => setIsLoadingMore(false));
  }, [page, fetchLogs, isLoadingMore, isOffline, items.length, filterTotalCount, selectedAction]);

  // Drawer handlers
  const openDrawer = useCallback((item) => {
    setSelectedLog(item);
    setShowDrawer(true);
    setIsSimpleView(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setShowDrawer(false);
    setSelectedLog(null);
  }, []);

  // Copy JSON to clipboard
  const copyJson = useCallback(() => {
    if (!selectedLog?.data) return;
    try {
      const parsed = safeParse(selectedLog.data);
      Clipboard.setString(JSON.stringify(parsed, null, 2));
      showSuccess('JSON copied to clipboard.', 'Copied');
    } catch {
      showError('Failed to copy JSON.', 'Error');
    }
  }, [selectedLog, safeParse]);

  // Safely parse data — handles both string and object forms
  const safeParse = useCallback((data) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }, []);

  // Parse JSON data into flat key-value pairs for simple view
  const parseSimpleData = useCallback((data) => {
    const parsed = safeParse(data);
    const entries = [];

    const flatten = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix} > ${capitalize(key)}` : capitalize(key);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value, fullKey);
        } else if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === 'object' && item !== null) {
              flatten(item, `${fullKey}[${i}]`);
            } else {
              entries.push({ key: `${fullKey}[${i}]`, value: String(item ?? '') });
            }
          });
        } else {
          entries.push({ key: fullKey, value: String(value ?? '') });
        }
      });
    };

    flatten(parsed);
    return entries.length > 0 ? entries : [{ key: 'Data', value: 'No data available' }];
  }, [safeParse]);

  // ─── Filter Pills ─────────────────────────────────────────────────

  // Filter pills config matching AI Assistant pattern (using theme colors)
  const filterPills = useMemo(() => [
    { key: 'all', label: 'All', count: filterCounts.all, icon: 'format-list-bulleted', color: colors.primary.main },
    { key: 'POST', label: 'Created', count: filterCounts.POST, icon: 'plus-circle-outline', color: colors.success.main },
    { key: 'PUT', label: 'Updated', count: filterCounts.PUT, icon: 'pencil-outline', color: colors.warning.main },
    { key: 'DELETE', label: 'Deleted', count: filterCounts.DELETE, icon: 'trash-can-outline', color: colors.error.main },
  ], [filterCounts]);

  const handleActionFilter = useCallback((key) => {
    if (key === selectedAction) return;
    setSelectedAction(key);
    setPage(0);
    setItems([]);
    setIsFilterLoading(true);
    fetchLogs(0, true, key).finally(() => setIsFilterLoading(false));

    // Scroll filter list to bring selected pill into view
    const index = filterPills.findIndex((p) => p.key === key);
    if (index >= 0 && filterListRef.current) {
      filterListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  }, [selectedAction, fetchLogs, filterPills]);

  // ─── Render Helpers ──────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }) => {
      const action = ACTION_MAP[item.action] || {
        label: item.action || 'Unknown',
        color: '#6B7280',
        bgColor: '#F3F4F6',
      };
      const { date, time } = formatDateTime(item.createdAt);
      const actionIcon =
        item.action === 'POST' ? 'plus' :
        item.action === 'DELETE' ? 'trash-can-outline' : 'pencil-outline';

      return (
        <ShadowCard variant="flat" style={styles.logCard}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openDrawer(item)}
            style={styles.logCardInner}
          >
            <View style={styles.logCardRow}>
              {/* Left: Action Icon */}
              <View style={[styles.logIconBox, { backgroundColor: action.bgColor }]}>
                <Icon name={actionIcon} size={20} color={action.color} />
              </View>

              {/* Middle: Content */}
              <View style={styles.logContent}>
                {/* Title row: Module + Badge */}
                <View style={styles.logTitleRow}>
                  <Text style={styles.logTitle} numberOfLines={1}>
                    {capitalize(item.moduleName || 'Unknown')}
                  </Text>
                  <View style={[styles.actionBadge, { backgroundColor: action.bgColor }]}>
                    <Text style={[styles.actionBadgeText, { color: action.color }]}>
                      {action.label}
                    </Text>
                  </View>
                </View>

                {/* Actor */}
                <Text style={styles.logActor} numberOfLines={1}>
                  {item.actorName || 'Unknown'}
                  {item.actorEmail ? ` · ${item.actorEmail}` : ''}
                </Text>

                {/* Meta row: Date + Source + WhatsApp */}
                <View style={styles.logMetaRow}>
                  <View style={styles.logMetaItem}>
                    <Icon name="clock-outline" size={12} color={colors.text.tertiary} />
                    <Text style={styles.logMetaText}>{date} {time}</Text>
                  </View>
                  {item.eventSource ? (
                    <View style={styles.logMetaItem}>
                      <Icon name="source-branch" size={12} color={colors.text.tertiary} />
                      <Text style={styles.logMetaText}>{item.eventSource.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  {item.whatsappNumberUsed ? (
                    <View style={styles.logMetaItem}>
                      <Icon name="whatsapp" size={12} color="#25D366" />
                      <Text style={styles.logMetaText}>+{item.whatsappNumberUsed}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Right: Chevron */}
              <Icon name="chevron-right" size={22} color={colors.grey[400]} />
            </View>
          </TouchableOpacity>
        </ShadowCard>
      );
    },
    [openDrawer]
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ShadowCard key={i} variant="flat" style={styles.logCard}>
          <View style={styles.logCardInner}>
            <View style={styles.logCardRow}>
              {/* Icon box */}
              <View style={[styles.skeletonBox, { width: 42, height: 42, borderRadius: 12 }]} />
              {/* Content */}
              <View style={styles.logContent}>
                {/* Title row: module name + badge */}
                <View style={[styles.logTitleRow]}>
                  <View style={[styles.skeletonBox, { width: '55%', height: 15 }]} />
                  <View style={[styles.skeletonBox, { width: 58, height: 20, borderRadius: 12 }]} />
                </View>
                {/* Actor line */}
                <View style={[styles.skeletonBox, { width: '70%', height: 13, marginBottom: 6 }]} />
                {/* Meta row */}
                <View style={styles.logMetaRow}>
                  <View style={[styles.skeletonBox, { width: 110, height: 12 }]} />
                  <View style={[styles.skeletonBox, { width: 40, height: 12 }]} />
                  <View style={[styles.skeletonBox, { width: 80, height: 12 }]} />
                </View>
              </View>
              {/* Chevron */}
              <View style={[styles.skeletonBox, { width: 22, height: 22, borderRadius: 11 }]} />
            </View>
          </View>
        </ShadowCard>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="clipboard-text-clock-outline" size={64} color={colors.grey[300]} />
      <Text style={styles.emptyTitle}>No Activity Logs</Text>
      <Text style={styles.emptySubtitle}>
        Activity logs will appear here once actions are performed in your account.
      </Text>
    </View>
  );

  const renderOffline = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.offlineIconCircle}>
        <Icon name="wifi-off" size={48} color={colors.error.main} />
      </View>
      <Text style={styles.emptyTitle}>You're Offline</Text>
      <Text style={styles.emptySubtitle}>
        Activity logs require an internet connection. Please check your connection and try again.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore)
      return <View style={{ height: TAB_BAR_HEIGHT + insets.bottom + 24 }} />;
    return (
      <View style={[styles.footerLoader, { marginBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}>
        <ActivityIndicator size="small" color={colors.primary.main} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const renderFilterPill = useCallback(({ item }) => {
    const isSelected = selectedAction === item.key;
    return (
      <TouchableOpacity
        onPress={() => handleActionFilter(item.key)}
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
            {item.count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [selectedAction, handleActionFilter]);

  const renderFilterBar = () => (
    <View>
      <View style={styles.headerContainer}>
        <InfoBanner message="Activity Log captures all notable actions within the last 7 days." />
      </View>
      <View style={styles.filtersContainer}>
        <FlatList
          ref={filterListRef}
          data={filterPills}
          renderItem={renderFilterPill}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          onScrollToIndexFailed={() => {}}
        />
      </View>
    </View>
  );

  // ─── Detail Bottom Sheet Content ─────────────────────────────────

  const renderDrawerContent = () => {
    if (!selectedLog) return null;

    const action = ACTION_MAP[selectedLog.action] || {
      label: selectedLog.action || 'Unknown',
      color: '#6B7280',
      bgColor: '#F3F4F6',
    };
    const { date, time } = formatDateTime(selectedLog.createdAt);
    const simpleData = parseSimpleData(selectedLog.data);

    const parsedData = safeParse(selectedLog.data);
    const jsonString = JSON.stringify(parsedData, null, 2);

    return (
      <View style={styles.drawerContainer}>
        {/* Handle Bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerHeaderLeft}>
            <View style={[styles.drawerIconCircle, { backgroundColor: action.bgColor }]}>
              <Icon
                name={
                  selectedLog.action === 'POST' ? 'plus' :
                  selectedLog.action === 'DELETE' ? 'trash-can-outline' : 'pencil-outline'
                }
                size={20}
                color={action.color}
              />
            </View>
            <View style={styles.drawerHeaderText}>
              <View style={styles.drawerTitleRow}>
                <Text style={styles.drawerTitle}>Activity Detail</Text>
                <View style={[styles.actionBadgeSmall, { backgroundColor: action.bgColor }]}>
                  <Text style={[styles.actionBadgeTextSmall, { color: action.color }]}>
                    {action.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.drawerSubtitle}>{date} at {time}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
            <Icon name="close" size={22} color={colors.grey[500]} />
          </TouchableOpacity>
        </View>

        {/* Meta Info — 2-col top row, full-width below */}
        <View style={styles.metaSection}>
          {/* Actor + Section side by side */}
          <View style={styles.metaColumnRow}>
            <View style={styles.metaCard}>
              <View style={styles.metaIconBox}>
                <Icon name="account-outline" size={14} color={colors.primary.main} />
              </View>
              <View style={styles.metaCardContent}>
                <Text style={styles.metaLabel}>Actor</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {selectedLog.actorName || 'Unknown'}
                </Text>
                {selectedLog.actorEmail ? (
                  <Text style={styles.metaHint} numberOfLines={1}>{selectedLog.actorEmail}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.metaCard}>
              <View style={styles.metaIconBox}>
                <Icon name="layers-outline" size={14} color={colors.warning.main} />
              </View>
              <View style={styles.metaCardContent}>
                <Text style={styles.metaLabel}>Section</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {capitalize(selectedLog.moduleName || 'Unknown')}
                </Text>
                {selectedLog.eventSource ? (
                  <Text style={styles.metaHint}>{selectedLog.eventSource.toUpperCase()}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* WhatsApp + Activity ID side by side */}
          <View style={styles.metaColumnRow}>
            {selectedLog.whatsappNumberUsed ? (
              <View style={styles.metaCard}>
                <View style={styles.metaIconBox}>
                  <Icon name="whatsapp" size={14} color={colors.success.main} />
                </View>
                <View style={styles.metaCardContent}>
                  <Text style={styles.metaLabel}>WhatsApp</Text>
                  <Text style={styles.metaValue}>+{selectedLog.whatsappNumberUsed}</Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.metaCard, !selectedLog.whatsappNumberUsed && { flex: 1 }]}>
              <View style={styles.metaIconBox}>
                <Icon name="identifier" size={14} color={colors.grey[500]} />
              </View>
              <View style={styles.metaCardContent}>
                <Text style={styles.metaLabel}>Activity ID</Text>
                <Text style={styles.metaIdValue} numberOfLines={1} selectable>
                  {selectedLog._id}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.drawerDataSection}>
          {/* Segmented Toggle + Copy */}
          <View style={styles.drawerDataHeader}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                onPress={() => setIsSimpleView(true)}
                style={[styles.segmentBtn, isSimpleView && styles.segmentBtnActive]}
              >
                <Icon
                  name="format-list-bulleted"
                  size={14}
                  color={isSimpleView ? colors.primary.main : colors.grey[500]}
                />
                <Text style={[styles.segmentText, isSimpleView && styles.segmentTextActive]}>
                  Simple
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsSimpleView(false)}
                style={[styles.segmentBtn, !isSimpleView && styles.segmentBtnActive]}
              >
                <Icon
                  name="code-braces"
                  size={14}
                  color={!isSimpleView ? colors.primary.main : colors.grey[500]}
                />
                <Text style={[styles.segmentText, !isSimpleView && styles.segmentTextActive]}>
                  JSON
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={copyJson} style={styles.copyButton}>
              <Icon name="content-copy" size={16} color={colors.grey[600]} />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Data Content */}
          <ScrollView
            style={styles.drawerDataContent}
            contentContainerStyle={styles.drawerDataContentInner}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {isSimpleView ? (
              simpleData.length > 0 ? (
                simpleData.map((entry, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dataRow,
                      index % 2 === 0 && styles.dataRowAlt,
                      index === simpleData.length - 1 && styles.dataRowLast,
                    ]}
                  >
                    <Text style={styles.dataKey} numberOfLines={2}>
                      {entry.key}
                    </Text>
                    <Text style={styles.dataValue} selectable>
                      {entry.value}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="database-off-outline" size={32} color={colors.grey[300]} />
                  <Text style={styles.noData}>No data available</Text>
                </View>
              )
            ) : (
              <Text style={styles.jsonText} selectable>
                {jsonString}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────

  // Get the active filter pill's color for empty state
  const activeFilterColor = useMemo(() => {
    const pill = filterPills.find((p) => p.key === selectedAction);
    return pill?.color || colors.primary.main;
  }, [selectedAction, filterPills]);

  const renderContent = () => {
    if (isOffline && items.length === 0) {
      return renderOffline();
    }

    if (isInitialLoad || isFilterLoading) {
      return (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSkeleton()}
        </ScrollView>
      );
    }

    if (items.length === 0 && selectedAction === 'all') {
      return renderEmpty();
    }

    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.filterEmptyContainer}>
            <View style={[styles.filterEmptyIconCircle, { backgroundColor: `${activeFilterColor}15` }]}>
              <Icon name="history" size={40} color={activeFilterColor} />
            </View>
            <Text style={styles.filterEmptyText}>
              No {ACTION_MAP[selectedAction]?.label?.toLowerCase() || ''} activities found
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderFilterBar()}
      {renderContent()}

      {/* Detail Bottom Sheet */}
      <Modal
        isVisible={showDrawer}
        onBackdropPress={closeDrawer}
        onSwipeComplete={closeDrawer}
        swipeDirection={['down']}
        style={styles.modal}
        propagateSwipe
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        {renderDrawerContent()}
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },

  // ── Filter Pills ──
  filtersContainer: {
    paddingTop: 8,
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
    gap: 6,
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
  filterEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  filterEmptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterEmptyText: {
    fontSize: 14,
    color: colors.grey[500],
  },

  // ── Log Card ──
  logCard: {
    marginBottom: 10,
    borderRadius: 12,
  },
  logCardInner: {
    padding: 14,
  },
  logCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logActor: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  logMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetaText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // ── Skeleton ──
  skeletonContainer: {
    gap: 0,
  },
  skeletonBox: {
    backgroundColor: colors.grey[200],
    borderRadius: 4,
  },
  // ── Empty / Offline States ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.grey[700],
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.grey[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  offlineIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  // ── Footer ──
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  // ── Bottom Sheet / Drawer ──
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  drawerContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // ── Drawer Header ──
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  drawerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  drawerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerHeaderText: {
    flex: 1,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  drawerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  actionBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Meta Info Section ──
  metaSection: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 10,
  },
  metaColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[100],
    padding: 10,
    gap: 10,
  },
  metaCardContent: {
    flex: 1,
  },
  metaIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  metaHint: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  metaIdValue: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary.main,
  },

  // ── Drawer Data Section ──
  drawerDataSection: {
    flexShrink: 1,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  drawerDataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.grey[100],
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: colors.common.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.grey[500],
  },
  segmentTextActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
  },
  copyText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.grey[600],
  },

  // ── Data Content ──
  drawerDataContent: {
    flexShrink: 1,
    backgroundColor: colors.grey[50],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  drawerDataContentInner: {
    padding: 4,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dataRowAlt: {
    backgroundColor: colors.common.white,
  },
  dataRowLast: {
    borderBottomWidth: 0,
  },
  dataKey: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    width: '38%',
    paddingRight: 8,
  },
  dataValue: {
    fontSize: 13,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  noData: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  jsonText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.primary,
    lineHeight: 20,
    padding: 12,
  },
});
