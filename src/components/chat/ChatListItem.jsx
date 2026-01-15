import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors, getAvatarColor } from '../../theme/colors';
import { getMessagePreview, getMessageStatus } from '../../utils/messageHelpers';

const ChatListItem = ({ chat, onPress, isSelected }) => {
  const contact = chat?.contact || {};
  const contactName = contact.name || contact.phoneNumber || 'Unknown';
  const phoneNumber = contact.phoneNumber || '';
  const lastMessage = chat?.lastMessage;
  const unreadCount = chat?.unreadCount || 0;

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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

  // Get message preview using helper
  const messagePreview = lastMessage ? getMessagePreview(lastMessage) : { icon: null, text: 'No messages yet' };

  // Get message status icon
  const getStatusIcon = () => {
    if (!lastMessage) return null;

    // Only show status for outgoing messages
    const isOutgoing = lastMessage.sentBy === 'user' || lastMessage.direction === 'outgoing';
    if (!isOutgoing) return null;

    const status = getMessageStatus(lastMessage);

    switch (status) {
      case 'failed':
        return { icon: 'alert-circle', color: colors.error.main };
      case 'sent':
        return { icon: 'check', color: chatColors.tickGrey };
      case 'delivered':
        return { icon: 'check-all', color: chatColors.tickGrey };
      case 'read':
        return { icon: 'check-all', color: chatColors.tickBlue };
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
  },
  unreadName: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
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
    color: colors.text.secondary,
    flex: 1,
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
