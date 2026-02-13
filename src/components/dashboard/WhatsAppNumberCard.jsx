import { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Format large numbers - show exact number up to 10 lakh, scientific notation above
 * @param {number|string} num - The number to format
 * @returns {string} Formatted number string
 */
const formatLargeNumber = (num) => {
  if (num === null || num === undefined) return '0';

  const parsed = parseFloat(String(num));
  if (!isFinite(parsed)) return '0';

  const absNum = Math.abs(parsed);

  // For numbers > 10 lakh (1,000,000), show scientific notation only
  if (absNum > 1e6) {
    const exponent = Math.floor(Math.log10(absNum));
    const mantissa = absNum / Math.pow(10, exponent);
    const sign = parsed < 0 ? '-' : '';
    return `${sign}${mantissa.toFixed(1)}e+${exponent}`;
  }

  // For numbers up to 10 lakh, show exact number with commas
  return parsed.toLocaleString();
};

/**
 * Avatar color palette (same as web app)
 */
const AVATAR_COLORS = [
  '#F9F7D6', '#F8E3D7', '#F7D1E0', '#F4D2C4', '#F7E2B5',
  '#D9E4D1', '#A9E0D1', '#A7E3D8', '#C9DFF1', '#A1C9F0',
  '#D6A8F3', '#F2C5E4', '#F4D1D5', '#B7C6C5', '#D1C7A9',
  '#D6D8D3', '#B1C7C7', '#F1E1B5', '#D1D1A7', '#BCCBCB',
];

/**
 * Get initials from name (same as web app)
 */
const getInitials = (name) => {
  if (!name) return '?';
  const nameParts = name.trim().split(/\s+/).filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }
  const firstInitial = nameParts[0].charAt(0).toUpperCase();
  const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  return firstInitial + lastInitial;
};

/**
 * Get color by initial (same as web app)
 */
const getColorByInitial = (initial) => {
  if (!initial) return AVATAR_COLORS[0];
  const char = initial.toUpperCase();
  let index;
  if (char >= 'A' && char <= 'Z') {
    index = char.charCodeAt(0) - 'A'.charCodeAt(0);
  } else if (char >= '0' && char <= '9') {
    index = char.charCodeAt(0) - '0'.charCodeAt(0) + 26;
  } else {
    return AVATAR_COLORS[0];
  }
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

/**
 * Messaging tier label mapping
 */
const TIER_LABELS = {
  TIER_50: '50/day',
  TIER_250: '250/day',
  TIER_1K: '1K/day',
  TIER_10K: '10K/day',
  TIER_100K: '100K/day',
  TIER_UNLIMITED: 'Unlimited',
};

/**
 * Account status config (account.status)
 * Shows active/inactive badge next to the phone number
 */
const ACCOUNT_STATUS_COLORS = {
  active: '#22C55E',
  inactive: '#EF4444',
  archived: '#94A3B8',
};

/**
 * Quality score colors
 */
const QUALITY_COLORS = {
  GREEN: { bg: '#DCFCE7', text: '#16A34A', label: 'High' },
  YELLOW: { bg: '#FEF9C3', text: '#CA8A04', label: 'Medium' },
  RED: { bg: '#FEE2E2', text: '#DC2626', label: 'Low' },
};

/**
 * Meta connection status config (waPhoneNumberInfo.status)
 * Colors and labels match the web app implementation
 */
const META_STATUS_CONFIG = {
  CONNECTED: { bg: '#DCFCE7', text: '#16A34A', dot: '#22C55E', label: 'Connected' },
  DISCONNECTED: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Disconnected' },
  PENDING: { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6', label: 'Pending' },
  UNVERIFIED: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Unverified' },
  BANNED: { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444', label: 'Banned' },
  DELETED: { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444', label: 'Deleted' },
  FLAGGED: { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444', label: 'Flagged' },
  MIGRATED: { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6', label: 'Migrated' },
  RATE_LIMITED: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Rate Limited' },
  RESTRICTED: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Restricted' },
  UNKNOWN: { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8', label: 'Unknown' },
};

/**
 * Display name status config (waPhoneNumberInfo.name_status)
 * Colors and labels match the web app implementation
 */
const NAME_STATUS_CONFIG = {
  APPROVED: { bg: '#DCFCE7', text: '#16A34A', label: 'Approved' },
  PENDING_REVIEW: { bg: '#E0F7FA', text: '#0097A7', label: 'Pending Review' },
  NON_EXISTS: { bg: '#F1F5F9', text: '#64748B', label: 'Does Not Exist' },
  DECLINED: { bg: '#FEE2E2', text: '#DC2626', label: 'Declined' },
  AVAILABLE_WITHOUT_REVIEW: { bg: '#FFF8E1', text: '#F57F17', label: 'Available Without Review' },
};

/**
 * WhatsAppNumberCard component for displaying WhatsApp business number details
 * Features:
 * - Profile picture with WhatsApp badge overlay (same as web app)
 * - No expandable section (all info shown inline)
 * - Beautiful modern card design
 */
const WhatsAppNumberCard = ({
  number,
  isAccessed = false,
  isLoading = false,
  isSyncing = false,
  totalQuota = 0,
  onAccess,
  onSync,
  style,
}) => {
  const account = number.account || {};
  const waPhoneInfo = account.waPhoneNumberInfo || {};
  const waBusinessProfile = account.waBusinessProfile || {};

  // Sync cooldown state (5 minutes same as web app)
  const [isSyncDisabled, setIsSyncDisabled] = useState(false);

  // Check if sync was done recently (within 5 minutes)
  useEffect(() => {
    let syncedAt = account.waBusinessInfoSyncedAt;
    if (syncedAt && !(syncedAt instanceof Date)) {
      syncedAt = new Date(syncedAt);
    }
    const syncedTimestamp =
      syncedAt instanceof Date && !isNaN(syncedAt.getTime()) ? syncedAt.getTime() : null;
    const fiveMinutesAgo = new Date().getTime() - 5 * 60 * 1000;
    setIsSyncDisabled(syncedTimestamp && syncedTimestamp > fiveMinutesAgo);
  }, [account.waBusinessInfoSyncedAt]);

  // Extract data
  const isActive = account.status === 'active';
  const verifiedName = waPhoneInfo.verified_name || 'Unnamed Business';
  const phoneNumber = `${account.countryCode || ''} ${account.waNumber || ''}`.trim() || 'N/A';
  const profilePic = waBusinessProfile.profile_picture_url;
  const qualityScore = waPhoneInfo.quality_score?.score;
  const messagingTier = waPhoneInfo.messaging_limit_tier;
  const metaStatus = waPhoneInfo.status; // CONNECTED, DISCONNECTED, BANNED, etc.
  const nameStatus = waPhoneInfo.name_status; // APPROVED, PENDING_REVIEW, DECLINED, etc.

  // Credits calculation
  const upperCapUsed = number.upperCapUsed || 0;
  const upperCapLimit = number.upperCapLimit;
  const creditsAllotted = upperCapLimit >= 0 ? upperCapLimit : totalQuota;
  const creditsRemaining = Math.max(0, creditsAllotted - upperCapUsed);
  const creditsPercentage = creditsAllotted > 0 ? Math.min(100, (upperCapUsed / creditsAllotted) * 100) : 0;

  // Avatar
  const initials = getInitials(verifiedName);
  const avatarColor = getColorByInitial(initials.charAt(0));

  // Quality
  const quality = QUALITY_COLORS[qualityScore] || QUALITY_COLORS.GREEN;

  // Handle sync press
  const handleSyncPress = () => {
    if (!isSyncDisabled && !isSyncing && onSync) {
      onSync();
    }
  };

  return (
    <Surface style={[styles.container, isAccessed && styles.containerAccessed, style]} elevation={0}>
      {/* Accessed indicator strip */}
      {isAccessed && <View style={styles.accessedStrip} />}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Header: Avatar + Name + Sync Button */}
        <View style={styles.headerRow}>
          {/* Avatar with WhatsApp Badge */}
          <View style={styles.avatarWrapper}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.whatsappBadge}>
              <Icon name="whatsapp" size={12} color="#25D366" />
            </View>
          </View>

          {/* Name + Display Name Status + Phone + Account Status */}
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.businessName} numberOfLines={1}>
                {verifiedName}
              </Text>
              {nameStatus && NAME_STATUS_CONFIG[nameStatus] && (
                <View style={[styles.nameStatusBadge, { backgroundColor: NAME_STATUS_CONFIG[nameStatus].bg }]}>
                  <Text style={[styles.nameStatusText, { color: NAME_STATUS_CONFIG[nameStatus].text }]}>
                    {NAME_STATUS_CONFIG[nameStatus].label}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.phoneRow}>
              <Icon name="phone-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
              {account.status && ACCOUNT_STATUS_COLORS[account.status] && (
                <View style={[styles.accountStatusDot, { backgroundColor: ACCOUNT_STATUS_COLORS[account.status] }]} />
              )}
            </View>
          </View>

          {/* Sync Button */}
          <TouchableOpacity
            style={[
              styles.syncButton,
              (isSyncDisabled || isSyncing) && styles.syncButtonDisabled
            ]}
            onPress={handleSyncPress}
            disabled={isSyncDisabled || isSyncing}
            activeOpacity={0.7}
          >
            {isSyncing ? (
              <ActivityIndicator size={16} color="#0C68E9" />
            ) : (
              <Icon
                name="sync"
                size={18}
                color={isSyncDisabled ? '#CBD5E1' : '#0C68E9'}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Quality, Tier & Meta Status Row */}
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: quality.bg }]}>
            <Icon name="shield-check" size={12} color={quality.text} />
            <Text style={[styles.badgeText, { color: quality.text }]}>{quality.label}</Text>
          </View>
          <View style={[styles.badge, styles.tierBadge]}>
            <Icon name="speedometer" size={12} color="#6366F1" />
            <Text style={[styles.badgeText, { color: '#6366F1' }]}>
              {TIER_LABELS[messagingTier] || 'N/A'}
            </Text>
          </View>
          {metaStatus && META_STATUS_CONFIG[metaStatus] && (
            <View style={[styles.badge, { backgroundColor: META_STATUS_CONFIG[metaStatus].bg }]}>
              <View style={[styles.statusDot, { backgroundColor: META_STATUS_CONFIG[metaStatus].dot }]} />
              <Text style={[styles.badgeText, { color: META_STATUS_CONFIG[metaStatus].text }]}>
                {META_STATUS_CONFIG[metaStatus].label}
              </Text>
            </View>
          )}
        </View>

        {/* Credits Section */}
        <View style={styles.creditsSection}>
          <View style={styles.creditsHeader}>
            <Text style={styles.creditsTitle}>Credits Usage</Text>
            <Text style={styles.creditsValue}>
              <Text style={styles.creditsUsed}>{formatLargeNumber(upperCapUsed)}</Text>
              <Text style={styles.creditsSeparator}> / </Text>
              <Text style={styles.creditsTotal}>{formatLargeNumber(creditsAllotted)}</Text>
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${creditsPercentage}%`,
                    backgroundColor: creditsPercentage > 80 ? '#EF4444' : creditsPercentage > 50 ? '#F59E0B' : '#22C55E'
                  }
                ]}
              />
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <View style={[styles.statIconBox, { backgroundColor: '#DBEAFE' }]}>
                <Icon name="chart-bar" size={14} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.statLabel}>Used</Text>
                <Text style={styles.statNumber}>{formatLargeNumber(upperCapUsed)}</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <View style={[styles.statIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Icon name="wallet-outline" size={14} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.statLabel}>Remaining</Text>
                <Text style={[styles.statNumber, creditsRemaining < 100 && styles.lowCredits]}>
                  {formatLargeNumber(creditsRemaining)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <Button
          mode="contained"
          onPress={onAccess}
          disabled={!isActive || isAccessed || isLoading}
          loading={isLoading}
          style={[
            styles.actionBtn,
            isAccessed && styles.actionBtnAccessing,
          ]}
          labelStyle={styles.actionBtnLabel}
          buttonColor={isAccessed ? '#22C55E' : isLoading ? colors.primary.main : colors.primary.main}
          contentStyle={styles.actionBtnContent}
          icon={isAccessed ? 'check-circle' : isLoading ? undefined : 'inbox-arrow-down'}
        >
          {isLoading ? 'Accessing...' : isAccessed ? 'Accessing' : 'Access Inbox'}
        </Button>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  containerAccessed: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  accessedStrip: {
    height: 4,
    backgroundColor: '#22C55E',
  },
  content: {
    padding: 16,
  },

  // Header Row: Avatar + Name/Phone + Sync
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C252E',
  },
  whatsappBadge: {
    position: 'absolute',
    bottom: -2,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  nameStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  nameStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phoneNumber: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  accountStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#F8FAFC',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Quality, Tier & Meta Status Badges
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tierBadge: {
    backgroundColor: '#EEF2FF',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Credits Section
  creditsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  creditsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  creditsValue: {
    fontSize: 14,
  },
  creditsUsed: {
    fontWeight: '700',
    color: '#1E293B',
  },
  creditsSeparator: {
    color: '#94A3B8',
  },
  creditsTotal: {
    fontWeight: '600',
    color: '#64748B',
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 14,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  lowCredits: {
    color: '#EF4444',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },

  // Action Button
  actionBtn: {
    borderRadius: 14,
    elevation: 0,
  },
  actionBtnAccessing: {
    backgroundColor: '#22C55E',
  },
  actionBtnContent: {
    paddingVertical: 8,
  },
  actionBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default WhatsAppNumberCard;
