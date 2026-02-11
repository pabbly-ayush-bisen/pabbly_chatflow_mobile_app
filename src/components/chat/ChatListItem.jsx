import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors, getAvatarColor } from '../../theme/colors';
import { getMessageStatus } from '../../utils/messageHelpers';

// List of supported message types for inbox preview
const SUPPORTED_MESSAGE_TYPES = [
  'text', 'image', 'sticker', 'video', 'audio', 'document', 'file',
  'location', 'interactive', 'button_reply', 'list_reply', 'template',
  'order', 'contacts', 'contact', 'reaction', 'system'
];

const ChatListItem = ({ chat, onPress, isSelected }) => {
  const contact = chat?.contact || {};
  const contactName = contact.name || contact.phoneNumber || 'Unknown';
  const phoneNumber = contact.phoneNumber || '';
  const lastMessage = chat?.lastMessage;
  const unreadCount = chat?.unreadCount || 0;

  // Get initials for avatar (handles multiple spaces between names)
  const getInitials = (name) => {
    if (!name) return 'U';
    // Split by any whitespace and filter out empty strings
    const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length >= 2) {
      // First letter of first name + first letter of last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Single name - return first 2 characters
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Format timestamp to WhatsApp style
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) {
      return 'Yesterday';
    }
    if (days < 7) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return weekdays[date.getDay()];
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Get message preview - show actual message text like web app
  const getDisplayMessage = () => {
    if (!lastMessage) return { icon: null, text: 'No messages yet' };

    const messageType = lastMessage.type;

    // Check for unsupported message types FIRST (like web app)
    // Any type not in supported list OR explicit unsupported types
    if (
      messageType === 'unsupported' ||
      messageType === 'unknown' ||
      messageType === 'fallback' ||
      (messageType && !SUPPORTED_MESSAGE_TYPES.includes(messageType))
    ) {
      return { icon: null, text: 'Unsupported Message' };
    }

    // For text messages, show the actual message body (like web app)
    if (messageType === 'text') {
      const messageText =
        lastMessage?.message?.body?.text ||
        lastMessage?.message?.body ||
        lastMessage?.text ||
        lastMessage?.body ||
        '';
      return { icon: null, text: messageText || 'Message' };
    }

    // For non-text messages, show type icon + label like WhatsApp
    switch (messageType) {
      case 'system':
        return { icon: 'shield-lock-outline', text: 'System Message' };
      case 'reaction':
        return { icon: 'emoticon-outline', text: 'Reaction Message' };
      case 'image':
        return { icon: 'image-outline', text: 'Image Message' };
      case 'sticker':
        return { icon: 'sticker-emoji', text: 'Sticker Message' };
      case 'video':
        return { icon: 'video-outline', text: 'Video Message' };
      case 'audio':
        return { icon: "microphone-outline", text: "Audio Message" };
      case 'document':
      case 'file':
        return { icon: "file-document-outline", text: "Document Message" };
      case 'location':
        return { icon: "map-marker-outline", text: "Location Message" };
      case 'interactive':
      case 'button_reply':
      case 'list_reply':
        return { icon: "gesture-tap", text: "Interactive Message" };
      case 'template':
        return { icon: "file-document-outline", text: "Template Message" };
      case 'order':
        return { icon: "cart-outline", text: "Order Message" };
      case 'contacts':
      case 'contact':
        return { icon: "account-outline", text: "Contact Message" };
      default:
        return { icon: null, text: 'Unsupported Message' };
    }
  };

  const messagePreview = getDisplayMessage();

  // Get message status icon - use status field directly like web app
  const getStatusIcon = () => {
    if (!lastMessage) return null;

    // Only show status for outgoing messages
    const isOutgoing = lastMessage.sentBy === 'user' || lastMessage.direction === 'outgoing';
    if (!isOutgoing) return null;

    // Use status field directly (like web app) instead of deriving from timestamps
    const status = lastMessage.status || getMessageStatus(lastMessage);

    switch (status) {
      case 'failed':
        return { icon: 'alert-circle', color: '#FF5630' }; // Match web app red
      case 'sent':
        return { icon: 'check', color: chatColors.tickGrey };
      case 'delivered':
        return { icon: 'check-all', color: chatColors.tickGrey };
      case 'read':
        return { icon: 'check-all', color: '#007BFF' }; // Match web app blue
      default:
        return { icon: 'clock-outline', color: chatColors.tickGrey };
    }
  };

  const statusIcon = getStatusIcon();
  const avatarColor = getAvatarColor(contactName);
  const timestamp = lastMessage?.timestamp || lastMessage?.createdAt || chat?.lastMessageTime || chat?.updatedAt;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(chat)}
      style={[styles.container, isSelected && styles.selectedContainer]}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{getInitials(contactName)}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: Name and Time */}
        <View style={styles.topRow}>
          <Text
            style={[styles.contactName, unreadCount > 0 && styles.unreadName]}
            numberOfLines={1}
          >
            {contactName}
          </Text>
          <Text style={[styles.timestamp, unreadCount > 0 && styles.unreadTimestamp]}>
            {formatTimestamp(timestamp)}
          </Text>
        </View>

        {/* Bottom row: Message preview and Badge */}
        <View style={styles.bottomRow}>
          <View style={styles.messagePreviewContainer}>
            {/* Status icon for outgoing messages */}
            {statusIcon && (
              <Icon
                name={statusIcon.icon}
                size={16}
                color={statusIcon.color}
                style={styles.statusIcon}
              />
            )}
            {/* Message type icon */}
            {messagePreview.icon && (
              <Icon
                name={messagePreview.icon}
                size={16}
                color={colors.text.secondary}
                style={styles.typeIcon}
              />
            )}
            <Text
              style={[styles.messagePreview, unreadCount > 0 && styles.unreadPreview]}
              numberOfLines={1}
            >
              {messagePreview.text}
            </Text>
          </View>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <Badge style={styles.unreadBadge} size={20}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.common.white,
    borderBottomWidth: 0,
  },
  selectedContainer: {
    backgroundColor: '#F0F2F5',
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: colors.common.white,
    fontSize: 20,
    fontWeight: '600',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  unreadName: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.secondary,
    flexShrink: 0,
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  unreadTimestamp: {
    color: chatColors.unreadBadge,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusIcon: {
    marginRight: 3,
  },
  typeIcon: {
    marginRight: 4,
  },
  messagePreview: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
    flex: 1,
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  unreadPreview: {
    color: colors.text.primary,
    fontWeight: '400',
  },
  unreadBadge: {
    backgroundColor: chatColors.unreadBadge,
    color: colors.common.white,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
  },
});

export default memo(ChatListItem);
