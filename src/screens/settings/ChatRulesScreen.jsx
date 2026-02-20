import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { fetchChatStatusRulesWithCache, fetchChatTeamMembersWithCache } from '../../redux/cacheThunks';
import { cacheManager } from '../../database/CacheManager';
import { useFocusEffect } from '@react-navigation/native';
import { useNetwork } from '../../contexts/NetworkContext';
import { colors } from '../../theme/colors';

// Status configurations with labels and colors
const STATUS_CONFIG = {
  aiAssistant: {
    label: 'AI Assistant',
    icon: 'robot-outline',
    color: '#9C27B0',
    bg: '#F3E5F5',
  },
  open: {
    label: 'Open',
    icon: 'folder-open-outline',
    color: '#2196F3',
    bg: '#E3F2FD',
  },
  closed: {
    label: 'Closed',
    icon: 'folder-outline',
    color: '#607D8B',
    bg: '#ECEFF1',
  },
  replied: {
    label: 'Replied',
    icon: 'reply-outline',
    color: '#4CAF50',
    bg: '#E8F5E9',
  },
  pending: {
    label: 'Pending',
    icon: 'clock-outline',
    color: '#FF9800',
    bg: '#FFF3E0',
  },
  on_hold: {
    label: 'On Hold',
    icon: 'pause-circle-outline',
    color: '#795548',
    bg: '#EFEBE9',
  },
  resolved: {
    label: 'Resolved',
    icon: 'check-circle-outline',
    color: '#009688',
    bg: '#E0F2F1',
  },
  intervened: {
    label: 'Intervened',
    icon: 'account-switch-outline',
    color: '#E91E63',
    bg: '#FCE4EC',
  },
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

// Skeleton for Chat Status Rules Section
const RuleItemSkeleton = () => (
  <View style={skeletonStyles.ruleItem}>
    <View style={skeletonStyles.statusItem}>
      <SkeletonPulse style={{ width: 32, height: 32, borderRadius: 8 }} />
      <SkeletonPulse style={{ width: 70, height: 14, borderRadius: 4 }} />
    </View>
    <View style={skeletonStyles.arrowSection}>
      <SkeletonPulse style={{ width: 30, height: 20, borderRadius: 6 }} />
      <SkeletonPulse style={{ width: 16, height: 16, borderRadius: 4 }} />
    </View>
    <View style={skeletonStyles.statusItem}>
      <SkeletonPulse style={{ width: 32, height: 32, borderRadius: 8 }} />
      <SkeletonPulse style={{ width: 70, height: 14, borderRadius: 4 }} />
    </View>
  </View>
);

// Skeleton for Team Member Item
const MemberItemSkeleton = () => (
  <View style={skeletonStyles.memberItem}>
    <SkeletonPulse style={{ width: 40, height: 40, borderRadius: 20 }} />
    <View style={{ flex: 1, gap: 6 }}>
      <SkeletonPulse style={{ width: 120, height: 14, borderRadius: 4 }} />
      <SkeletonPulse style={{ width: 160, height: 12, borderRadius: 4 }} />
    </View>
    <SkeletonPulse style={{ width: 70, height: 24, borderRadius: 12 }} />
  </View>
);

// Full Chat Rules Skeleton
const ChatRulesSkeleton = () => (
  <View style={skeletonStyles.container}>
    <View style={skeletonStyles.scrollContent}>
      {/* Info Banner Skeleton */}
      <View style={skeletonStyles.infoBanner}>
        <SkeletonPulse style={{ width: 18, height: 18, borderRadius: 4 }} />
        <SkeletonPulse style={{ flex: 1, height: 14, borderRadius: 4 }} />
      </View>

      {/* Chat Status Rules Section Skeleton */}
      <View style={skeletonStyles.sectionCard}>
        <View style={skeletonStyles.sectionHeader}>
          <SkeletonPulse style={{ width: 44, height: 44, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonPulse style={{ width: 140, height: 16, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 200, height: 12, borderRadius: 4 }} />
          </View>
          <SkeletonPulse style={{ width: 30, height: 24, borderRadius: 12 }} />
        </View>
        <RuleItemSkeleton />
        <RuleItemSkeleton />
        <RuleItemSkeleton />
      </View>

      {/* Chat Assignment Section Skeleton */}
      <View style={skeletonStyles.sectionCard}>
        <View style={skeletonStyles.sectionHeader}>
          <SkeletonPulse style={{ width: 44, height: 44, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonPulse style={{ width: 130, height: 16, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 220, height: 12, borderRadius: 4 }} />
          </View>
          <SkeletonPulse style={{ width: 30, height: 24, borderRadius: 12 }} />
        </View>
        <MemberItemSkeleton />
        <MemberItemSkeleton />
        <MemberItemSkeleton />
      </View>
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  sectionCard: {
    backgroundColor: colors.common.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[50],
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  arrowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[50],
  },
});

export default function ChatRulesScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Local state for data
  const [chatStatusRules, setChatStatusRules] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Refs for cache-first pattern
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const isFirstFocus = useRef(true);

  // Network state
  const { isOffline, isNetworkAvailable } = useNetwork();

  // Process results from cache thunks and update local state
  const processResults = useCallback((rulesResult, membersResult) => {
    const rulesData = rulesResult?.data || rulesResult || [];
    const membersData = membersResult?.data || membersResult || [];
    setChatStatusRules(Array.isArray(rulesData) ? rulesData : []);
    setTeamMembers(Array.isArray(membersData) ? membersData : []);
  }, []);

  // Initial load — read cache locally for instant display, then fetch fresh from API
  useEffect(() => {
    isLoadingRef.current = true;

    // Read cache locally for instant display while API loads
    Promise.all([
      cacheManager.getAppSetting('chatStatusRules'),
      cacheManager.getAppSetting('chatTeamMembers'),
    ]).then(([cachedRules, cachedMembers]) => {
      if ((cachedRules && cachedRules.length > 0) || (cachedMembers && cachedMembers.length > 0)) {
        setChatStatusRules(Array.isArray(cachedRules) ? cachedRules : []);
        setTeamMembers(Array.isArray(cachedMembers) ? cachedMembers : []);
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Always fetch fresh from API to pick up changes made on web
    Promise.all([
      dispatch(fetchChatStatusRulesWithCache({ forceRefresh: true })).unwrap(),
      dispatch(fetchChatTeamMembersWithCache({ forceRefresh: true })).unwrap(),
    ]).then(([rulesResult, membersResult]) => {
      processResults(rulesResult, membersResult);
      initialLoadDone.current = true;
    }).catch(() => {})
      .finally(() => {
        isLoadingRef.current = false;
        setIsInitialLoading(false);
      });
  }, []);

  // Network recovery — re-fetch when connectivity restored and data never loaded
  useEffect(() => {
    if (isNetworkAvailable && !initialLoadDone.current && !isLoadingRef.current) {
      isLoadingRef.current = true;
      setIsInitialLoading(true);
      Promise.all([
        dispatch(fetchChatStatusRulesWithCache({ forceRefresh: true })).unwrap(),
        dispatch(fetchChatTeamMembersWithCache({ forceRefresh: true })).unwrap(),
      ]).then(([rulesResult, membersResult]) => {
        processResults(rulesResult, membersResult);
        initialLoadDone.current = true;
      }).catch(() => {})
        .finally(() => {
          isLoadingRef.current = false;
          setIsInitialLoading(false);
        });
    }
  }, [isNetworkAvailable]);

  // Re-fetch when screen regains focus (picks up web dashboard changes)
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount — the useEffect above already handles the first load
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!initialLoadDone.current || isOffline) return;

      Promise.all([
        dispatch(fetchChatStatusRulesWithCache({ forceRefresh: true })).unwrap(),
        dispatch(fetchChatTeamMembersWithCache({ forceRefresh: true })).unwrap(),
      ]).then(([rulesResult, membersResult]) => {
        processResults(rulesResult, membersResult);
      }).catch(() => {});
    }, [isOffline])
  );

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (isOffline) return;
    setIsRefreshing(true);
    // Clear cache so fresh data is fetched from API
    await Promise.all([
      cacheManager.saveAppSetting('chatStatusRules', null).catch(() => {}),
      cacheManager.saveAppSetting('chatTeamMembers', null).catch(() => {}),
    ]);
    Promise.all([
      dispatch(fetchChatStatusRulesWithCache({ forceRefresh: true })).unwrap(),
      dispatch(fetchChatTeamMembersWithCache({ forceRefresh: true })).unwrap(),
    ]).then(([rulesResult, membersResult]) => {
      processResults(rulesResult, membersResult);
      initialLoadDone.current = true;
    }).catch(() => {
      showSnackbar('Failed to load chat rules');
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [dispatch, isOffline, processResults]);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Get status display info
  const getStatusDisplay = (statusKey) => {
    return STATUS_CONFIG[statusKey] || {
      label: statusKey?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown',
      icon: 'help-circle-outline',
      color: '#9E9E9E',
      bg: '#F5F5F5',
    };
  };

  // Render Chat Status Rule Item
  const renderStatusRuleItem = (rule, index, isLast) => {
    const fromStatus = getStatusDisplay(rule.fromStatus);
    const toStatus = getStatusDisplay(rule.toStatus);

    return (
      <View
        key={rule._id || index}
        style={[styles.ruleItem, !isLast && styles.ruleItemBorder]}
      >
        {/* From Status */}
        <View style={styles.statusItem}>
          <View style={[styles.statusIcon, { backgroundColor: fromStatus.bg }]}>
            <Icon name={fromStatus.icon} size={18} color={fromStatus.color} />
          </View>
          <Text style={styles.statusText} numberOfLines={1}>{fromStatus.label}</Text>
        </View>

        {/* Arrow with Duration */}
        <View style={styles.arrowSection}>
          <View style={styles.daysLabel}>
            <Text style={styles.daysText}>{rule.days}d</Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.grey[400]} />
        </View>

        {/* To Status */}
        <View style={styles.statusItem}>
          <View style={[styles.statusIcon, { backgroundColor: toStatus.bg }]}>
            <Icon name={toStatus.icon} size={18} color={toStatus.color} />
          </View>
          <Text style={styles.statusText} numberOfLines={1}>{toStatus.label}</Text>
        </View>
      </View>
    );
  };

  // Render Team Member Item
  const renderTeamMemberItem = (member, index, isLast) => {
    const memberName = member.name || member.email?.split('@')[0] || 'Unknown';
    const initials = memberName.substring(0, 2).toUpperCase();
    const isActive = member?.chatAssignment?.isActive === true;

    return (
      <View
        key={member._id || index}
        style={[styles.memberItem, !isLast && styles.memberItemBorder]}
      >
        <View style={[styles.memberAvatar, !isActive && styles.memberAvatarInactive]}>
          <Text style={styles.memberInitials}>{initials}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, !isActive && styles.memberNameInactive]} numberOfLines={1}>
            {memberName}
          </Text>
          {member.email && (
            <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
          )}
        </View>
        {isActive ? (
          <View style={styles.activeBadge}>
            <Icon name="check-circle" size={14} color="#16A34A" />
            <Text style={styles.activeText}>Active</Text>
          </View>
        ) : (
          <View style={styles.inactiveBadge}>
            <Icon name="close-circle" size={14} color="#DC2626" />
            <Text style={styles.inactiveText}>Inactive</Text>
          </View>
        )}
      </View>
    );
  };

  // Offline with no data — only show if data was NEVER loaded
  if (isOffline && !initialLoadDone.current && chatStatusRules.length === 0 && teamMembers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load chat rules.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Loading State - Initial load (skeleton instead of spinner)
  if (isInitialLoading && chatStatusRules.length === 0 && teamMembers.length === 0 && !isOffline) {
    return <ChatRulesSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Icon name="information-outline" size={18} color={colors.primary.main} />
          <Text style={styles.infoBannerText}>
            Chat rules are configured from the web dashboard
          </Text>
        </View>

        {/* ============ CHAT STATUS RULES SECTION ============ */}
        <View style={styles.sectionCard}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#E8F5E9' }]}>
              <Icon name="swap-horizontal" size={22} color="#4CAF50" />
            </View>
            <View style={styles.sectionTitleBox}>
              <Text style={styles.sectionTitle}>Chat Status Rules</Text>
              <Text style={styles.sectionSubtitle}>
                Auto-change status after specified days
              </Text>
            </View>
            {chatStatusRules.length > 0 && (
              <View style={styles.countChip}>
                <Text style={styles.countText}>{chatStatusRules.length}</Text>
              </View>
            )}
          </View>

          {/* Section Content */}
          {chatStatusRules.length > 0 ? (
            <View style={styles.sectionContent}>
              {chatStatusRules.map((rule, index) =>
                renderStatusRuleItem(rule, index, index === chatStatusRules.length - 1)
              )}
            </View>
          ) : (
            <View style={styles.emptyContent}>
              <Icon name="swap-horizontal" size={32} color={colors.grey[300]} />
              <Text style={styles.emptyText}>No status rules configured</Text>
            </View>
          )}
        </View>

        {/* ============ CHAT ASSIGNMENT RULES SECTION ============ */}
        <View style={styles.sectionCard}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#E3F2FD' }]}>
              <Icon name="account-multiple-check-outline" size={22} color="#2196F3" />
            </View>
            <View style={styles.sectionTitleBox}>
              <Text style={styles.sectionTitle}>Chat Assignment</Text>
              <Text style={styles.sectionSubtitle}>
                Team members with auto-assignment enabled
              </Text>
            </View>
            {teamMembers.length > 0 && (
              <View style={styles.countChip}>
                <Text style={styles.countText}>{teamMembers.length}</Text>
              </View>
            )}
          </View>

          {/* Section Content */}
          {teamMembers.length > 0 ? (
            <View style={styles.sectionContent}>
              {teamMembers.map((member, index) =>
                renderTeamMemberItem(member, index, index === teamMembers.length - 1)
              )}
            </View>
          ) : (
            <View style={styles.emptyContent}>
              <Icon name="account-off-outline" size={32} color={colors.grey[300]} />
              <Text style={styles.emptyText}>No team members with auto-assignment</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

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
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary.dark,
  },

  // Section Card - Container for each section
  sectionCard: {
    backgroundColor: colors.common.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    marginBottom: 16,
    overflow: 'hidden',
    // Shadow for iOS
    shadowColor: colors.common.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
    gap: 12,
  },
  sectionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitleBox: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  countChip: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionContent: {
    // Items will have their own borders
  },

  // Status Rules Items
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ruleItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[50],
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  arrowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  daysLabel: {
    backgroundColor: colors.warning.lighter,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning.dark,
  },

  // Team Members Items
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  memberItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[50],
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarInactive: {
    backgroundColor: colors.grey[400],
  },
  memberInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.common.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  memberNameInactive: {
    color: colors.text.secondary,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  inactiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },

  // Empty State
  emptyContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 10,
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

  bottomSpacing: {
    height: 20,
  },
});
