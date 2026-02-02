import { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import Modal from 'react-native-modal';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors, getAvatarColor } from '../../theme/colors';
import { format, formatDistanceToNow } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ContactBottomSheet = ({
  visible,
  onClose,
  contact,
  onOpenChat,
  isOpeningChat = false,
}) => {
  if (!contact) return null;

  // Extract contact data
  const hasName = contact.name && contact.name.trim().length > 0;
  const displayName = hasName ? contact.name : 'No Name';

  // Use mobile field like web app
  const mobile = contact.mobile || '';
  const countryCode = contact.countryCode || '';
  const phoneNumber = mobile
    ? (countryCode && mobile.startsWith(countryCode)
        ? `${countryCode} ${mobile.slice(countryCode.length)}`
        : mobile)
    : '';

  const email = contact.email || '';
  const tags = contact.tags || [];
  const attributes = contact.attributes || contact.customAttributes || {};
  const optInStatus = contact.optIn?.status || contact.optin;
  const incomingBlocked = contact.incomingBlocked;
  const lastActive = contact.lastActive;
  const createdAt = contact.createdAt;
  const listName = contact.listname || contact.listName || '';
  const source = contact.source || '';

  // Source mapping like web app
  const sourceMapping = {
    manual: 'Added Manually',
    csv: 'Imported from CSV',
    api: 'Added via API',
    user: 'Added by User',
    sync: 'Synchronized Contact',
    wa: 'Added by Message',
  };

  // Get initials (handles multiple spaces)
  const getInitials = () => {
    if (hasName) {
      const parts = contact.name.trim().split(/\s+/).filter(part => part.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
      }
    }
    if (phoneNumber) {
      return phoneNumber.slice(-2);
    }
    return 'NA';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return null;
    }
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return null;
    }
  };

  // Format last active
  const formatLastActive = (dateString) => {
    if (!dateString) return 'No recent activity';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  // Get opt-in status config
  const getOptInConfig = (status) => {
    if (status === true || status?.toLowerCase() === 'opted_in' || status?.toLowerCase() === 'active') {
      return { color: colors.success.main, bg: colors.success.lighter, label: 'Opted In', icon: 'check-circle' };
    }
    if (status === false || status?.toLowerCase() === 'opted_out' || status?.toLowerCase() === 'inactive') {
      return { color: colors.error.main, bg: colors.error.lighter, label: 'Opted Out', icon: 'close-circle' };
    }
    return { color: colors.grey[500], bg: colors.grey[100], label: 'Not Set', icon: 'minus-circle' };
  };

  // Get incoming blocked status config
  const getBlockedConfig = (blocked) => {
    if (blocked === true) {
      return { color: colors.error.main, bg: colors.error.lighter, label: 'Blocked', icon: 'block-helper' };
    }
    if (blocked === false) {
      return { color: colors.success.main, bg: colors.success.lighter, label: 'Allowed', icon: 'check-circle-outline' };
    }
    return null; // Don't show badge if status is unknown
  };

  const optInConfig = getOptInConfig(optInStatus);
  const blockedConfig = getBlockedConfig(incomingBlocked);
  const avatarColor = getAvatarColor(hasName ? contact.name : phoneNumber || 'default');

  // For scroll handling with modal swipe
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

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe={true}
      scrollTo={handleScrollTo}
      scrollOffset={scrollOffset}
      scrollOffsetMax={400}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.container}>
        {/* Handle Bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, !hasName && styles.noNameText]} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.phoneRow}>
              <Icon name="whatsapp" size={16} color={phoneNumber ? "#25D366" : colors.text.tertiary} />
              <Text style={[styles.phone, !phoneNumber && styles.noPhoneText]} numberOfLines={1}>
                {phoneNumber || 'No phone number'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Status Badges */}
        <View style={styles.statusRow}>
          {/* Opt-in Status */}
          <View style={[styles.statusBadge, { backgroundColor: optInConfig.bg }]}>
            <Icon name={optInConfig.icon} size={14} color={optInConfig.color} />
            <Text style={[styles.statusText, { color: optInConfig.color }]}>
              {optInConfig.label}
            </Text>
          </View>
          {/* Blocked/Allowed Status */}
          {blockedConfig && (
            <View style={[styles.statusBadge, { backgroundColor: blockedConfig.bg }]}>
              <Icon name={blockedConfig.icon} size={14} color={blockedConfig.color} />
              <Text style={[styles.statusText, { color: blockedConfig.color }]}>
                {blockedConfig.label}
              </Text>
            </View>
          )}
        </View>
        {/* Source and List Badges */}
        <View style={styles.statusRow}>
          {source && (
            <View style={styles.sourceBadge}>
              <Icon name="source-branch" size={14} color={colors.info.main} />
              <Text style={styles.sourceText} numberOfLines={1}>
                {sourceMapping[source] || source}
              </Text>
            </View>
          )}
          {listName ? (
            <View style={styles.listBadge}>
              <Icon name="folder-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.listText} numberOfLines={1}>{listName}</Text>
            </View>
          ) : null}
        </View>

        {/* Message Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.messageActionButton, !phoneNumber && styles.messageActionDisabled]}
            onPress={() => onOpenChat && onOpenChat(contact)}
            disabled={!phoneNumber || isOpeningChat}
            activeOpacity={0.7}
          >
            {isOpeningChat ? (
              <Text style={styles.messageActionText}>Opening...</Text>
            ) : (
              <>
                <Icon name="whatsapp" size={20} color={colors.common.white} />
                <Text style={styles.messageActionText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          onScroll={handleOnScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled={true}
        >
          {/* Contact Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="account-circle-outline" size={20} color={colors.primary.main} />
              <Text style={styles.sectionTitle}>Contact Information</Text>
            </View>
            <View style={styles.infoCard}>
              {/* WhatsApp Number */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Icon name="whatsapp" size={18} color="#25D366" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>WhatsApp Number</Text>
                  <Text style={[styles.infoValue, !phoneNumber && styles.infoValueEmpty]}>
                    {phoneNumber || 'Not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoSeparator} />

              {/* Email */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Icon name="email-outline" size={18} color={colors.info.main} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={[styles.infoValue, !email && styles.infoValueEmpty]}>
                    {email || 'Not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoSeparator} />

              {/* Source */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Icon name="source-branch" size={18} color={colors.warning.main} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Source</Text>
                  <Text style={styles.infoValue}>
                    {sourceMapping[source] || source || 'Unknown'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoSeparator} />

              {/* Last Active */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Icon name="clock-outline" size={18} color={colors.success.main} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Last Active</Text>
                  <Text style={styles.infoValue}>{formatLastActive(lastActive)}</Text>
                  {lastActive && (
                    <Text style={styles.infoSubtext}>
                      {formatDate(lastActive)} at {formatTime(lastActive)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.infoSeparator} />

              {/* Created At */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Icon name="calendar-plus" size={18} color={colors.primary.main} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Created</Text>
                  <Text style={styles.infoValue}>
                    {createdAt ? `${formatDate(createdAt)} at ${formatTime(createdAt)}` : 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tags Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="tag-multiple" size={20} color={colors.primary.main} />
              <Text style={styles.sectionTitle}>Tags</Text>
              {tags.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{tags.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.tagsCard}>
              {tags.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {tags.map((tag, index) => {
                    const tagName = typeof tag === 'string' ? tag : tag.name || tag;
                    const tagColor = typeof tag === 'object' ? tag.color : null;
                    return (
                      <View
                        key={tag._id || index}
                        style={[
                          styles.tagChip,
                          tagColor ? { backgroundColor: `${tagColor}15`, borderColor: `${tagColor}40` } : {},
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            tagColor ? { color: tagColor } : {},
                          ]}
                          numberOfLines={1}
                        >
                          {tagName}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="tag-off-outline" size={32} color={colors.grey[300]} />
                  <Text style={styles.emptyText}>No tags assigned</Text>
                </View>
              )}
            </View>
          </View>

          {/* Custom Fields Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="form-textbox" size={20} color={colors.primary.main} />
              <Text style={styles.sectionTitle}>Custom Fields</Text>
              {Object.keys(attributes).length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{Object.keys(attributes).length}</Text>
                </View>
              )}
            </View>
            <View style={styles.attributesCard}>
              {Object.keys(attributes).length > 0 ? (
                <View style={styles.attributesList}>
                  {Object.entries(attributes).map(([key, value], index) => (
                    <View key={index}>
                      <View style={styles.attributeRow}>
                        <Text style={styles.attributeKey} numberOfLines={1}>{key}</Text>
                        <Text style={styles.attributeValue} numberOfLines={2}>
                          {value !== null && value !== undefined && value !== ''
                            ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
                            : '-'}
                        </Text>
                      </View>
                      {index < Object.entries(attributes).length - 1 && (
                        <View style={styles.attributeSeparator} />
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="form-textbox" size={32} color={colors.grey[300]} />
                  <Text style={styles.emptyText}>No custom fields</Text>
                </View>
              )}
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  container: {
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.common.white,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  noNameText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phone: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  noPhoneText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info.lighter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 180,
  },
  sourceText: {
    fontSize: 12,
    color: colors.info.main,
    fontWeight: '500',
  },
  listBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 150,
  },
  listText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // Message Action
  actionContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  messageActionDisabled: {
    backgroundColor: colors.grey[300],
  },
  messageActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.common.white,
  },

  // Scroll Content
  scrollContent: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
    paddingTop: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  infoValueEmpty: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
    fontWeight: '400',
  },
  infoSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  infoSeparator: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginVertical: 12,
    marginLeft: 48,
  },

  // Tags Card
  tagsCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    minHeight: 80,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: colors.info.lighter,
    borderWidth: 1,
    borderColor: colors.info.light,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.info.dark,
  },

  // Attributes Card
  attributesCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    minHeight: 80,
  },
  attributesList: {},
  attributeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  attributeKey: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
    marginRight: 16,
  },
  attributeValue: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  attributeSeparator: {
    height: 1,
    backgroundColor: colors.grey[200],
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
});

export default ContactBottomSheet;
