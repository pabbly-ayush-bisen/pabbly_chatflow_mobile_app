import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings } from '../../redux/slices/settingsSlice';
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

export default function ChatRulesScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Local state for data
  const [chatStatusRules, setChatStatusRules] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all rules data
  const loadRulesData = useCallback(async () => {
    try {
      // Fetch chat status rules
      const statusResult = await dispatch(getSettings('chatStatusRules')).unwrap();
      const statusData = statusResult.data || statusResult;

      // Extract rules from the nested structure: chatStatusRules.items[0] contains status keys
      const rulesObj = statusData?.chatStatusRules?.items?.[0] || statusData?.chatStatusRules || {};

      // Convert to array of active rules
      const activeRules = [];
      Object.entries(rulesObj).forEach(([key, value]) => {
        // Skip numeric keys and check if rule has valid data
        if (!/^\d+$/.test(key) && value && typeof value === 'object') {
          const { toStatus, days, _id } = value;
          // Only include rules that are configured (have toStatus and days > 0)
          if (toStatus && days && parseInt(days) > 0) {
            activeRules.push({
              fromStatus: key,
              toStatus,
              days: parseInt(days),
              _id,
            });
          }
        }
      });
      setChatStatusRules(activeRules);

      // Fetch team members for chat assignment rules - fetch all with high limit
      const teamResult = await dispatch(getSettings('teamMembers&skip=0&limit=100&order=-1')).unwrap();
      const teamData = teamResult.data || teamResult;
      const teamItems = teamData?.teamMembers?.items || [];

      // Show all team members (both active and inactive)
      setTeamMembers(teamItems);
    } catch (error) {
      // Log:('Error loading chat rules:', error);
      showSnackbar('Failed to load chat rules');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadRulesData();
  }, [loadRulesData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRulesData();
    setIsRefreshing(false);
  }, [loadRulesData]);

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

  // Loading State
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading chat rules...</Text>
        </View>
      </View>
    );
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
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

  bottomSpacing: {
    height: 20,
  },
});
