import React, { memo, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';
import {
  isOutgoingMessage,
  getMessageStatus,
  getErrorInfo,
  getMessageText,
  getMessageCaption,
  getInteractiveData,
} from '../../utils/messageHelpers';

// Import individual message components
import TextMessage from './messages/TextMessage';
import ImageMessage from './messages/ImageMessage';
import VideoMessage from './messages/VideoMessage';
import AudioMessage from './messages/AudioMessage';
import DocumentMessage from './messages/DocumentMessage';
import StickerMessage from './messages/StickerMessage';
import LocationMessage from './messages/LocationMessage';
import ContactsMessage from './messages/ContactsMessage';
import TemplateMessage from './messages/TemplateMessage';
import OrderMessage from './messages/OrderMessage';
import UnsupportedMessage from './messages/UnsupportedMessage';
import { InteractiveMessage } from './messages/interactive';

/**
 * ChatMessageItem Component
 * Main component for rendering all message types in the chat inbox
 * Routes to appropriate message component based on message.type
 *
 * Supported message types:
 * - text: Regular text messages
 * - image: Image messages with optional caption
 * - video: Video messages with optional caption
 * - audio: Audio/voice messages
 * - document: File/document messages
 * - sticker: Sticker messages
 * - location: Location sharing messages
 * - contacts: Contact card messages
 * - template: WhatsApp template messages
 * - interactive: Interactive messages (buttons, lists, products, etc.)
 * - order: Order/cart messages
 * - reaction: Reaction messages
 * - unsupported: Unsupported message types
 * - system: System messages (assignment changes, etc.)
 */
const ChatMessageItem = ({
  message,
  onImagePress,
  onReplyPress,
  onSwipeReply,
  scrollToMessage,
  originalMessage, // The message being replied to (for reply preview)
}) => {
  const isOutgoing = isOutgoingMessage(message);
  const messageType = message?.type || 'text';
  const status = getMessageStatus(message);
  const errorInfo = getErrorInfo(message);

  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const timestamp = message?.timestamp || message?.createdAt;

  // Get reply preview text based on original message type
  const getReplyPreviewText = useMemo(() => {
    if (!originalMessage) return 'Replying to message';

    const origType = originalMessage?.type || 'text';

    switch (origType) {
      case 'text':
        const text = getMessageText(originalMessage);
        return text ? text.substring(0, 50) + (text.length > 50 ? '...' : '') : 'Text message';
      case 'image':
        return getMessageCaption(originalMessage) || '📷 Photo';
      case 'video':
        return getMessageCaption(originalMessage) || '🎥 Video';
      case 'audio':
        return '🎵 Voice message';
      case 'document':
      case 'file':
        return '📄 Document';
      case 'sticker':
        return '🎨 Sticker';
      case 'location':
        return '📍 Location';
      case 'contact':
      case 'contacts':
        return '👤 Contact';
      case 'template':
        return '📋 Template message';
      case 'interactive':
        const interactiveData = getInteractiveData(originalMessage);
        return interactiveData?.body || '📱 Interactive message';
      case 'order':
        return '🛒 Order';
      default:
        return 'Message';
    }
  }, [originalMessage]);

  // Get status icon
  const renderStatusIcon = () => {
    if (!isOutgoing) return null;

    switch (status) {
      case 'failed':
        return <Icon name="alert-circle" size={14} color={colors.error.main} />;
      case 'sent':
        return <Icon name="check" size={14} color="rgba(255,255,255,0.7)" />;
      case 'delivered':
        return <Icon name="check-all" size={14} color="rgba(255,255,255,0.7)" />;
      case 'read':
        return <Icon name="check-all" size={14} color={chatColors.tickBlue} />;
      default:
        return <Icon name="clock-outline" size={14} color="rgba(255,255,255,0.7)" />;
    }
  };

  // Render reply reference card
  const renderReplyReference = () => {
    if (!message?.replyToWamid && !message?.context?.id) return null;

    const replyId = message?.replyToWamid || message?.context?.id;
    const isOriginalOutgoing = originalMessage ? isOutgoingMessage(originalMessage) : false;

    return (
      <TouchableOpacity
        style={[
          styles.replyReference,
          isOutgoing ? styles.replyReferenceOutgoing : styles.replyReferenceIncoming,
        ]}
        onPress={() => scrollToMessage?.(replyId)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.replyBar,
          isOriginalOutgoing ? styles.replyBarOutgoing : styles.replyBarIncoming,
        ]} />
        <View style={styles.replyContent}>
          <Text
            style={[
              styles.replyAuthor,
              isOutgoing ? styles.replyAuthorOutgoing : styles.replyAuthorIncoming,
            ]}
            numberOfLines={1}
          >
            {isOriginalOutgoing ? 'You' : 'Contact'}
          </Text>
          <Text
            style={[
              styles.replyText,
              isOutgoing ? styles.replyTextOutgoing : styles.replyTextIncoming,
            ]}
            numberOfLines={1}
          >
            {getReplyPreviewText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render message content based on type
  const renderMessageContent = () => {
    // Handle reaction messages
    if (messageType === 'reaction') {
      const emoji = message?.message?.emoji || message?.reaction?.emoji || '👍';
      return (
        <View style={styles.reactionContainer}>
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={[styles.reactionText, isOutgoing && styles.reactionTextOutgoing]}>
            Reacted with {emoji}
          </Text>
        </View>
      );
    }

    switch (messageType) {
      case 'text':
        return <TextMessage message={message} isOutgoing={isOutgoing} />;

      case 'image':
        return (
          <ImageMessage
            message={message}
            isOutgoing={isOutgoing}
            onImagePress={onImagePress}
          />
        );

      case 'video':
        return <VideoMessage message={message} isOutgoing={isOutgoing} />;

      case 'audio':
        return <AudioMessage message={message} isOutgoing={isOutgoing} />;

      case 'document':
      case 'file':
        return <DocumentMessage message={message} isOutgoing={isOutgoing} />;

      case 'sticker':
        return (
          <StickerMessage message={message} onImagePress={onImagePress} />
        );

      case 'location':
        return <LocationMessage message={message} isOutgoing={isOutgoing} />;

      case 'contact':
      case 'contacts':
        return <ContactsMessage message={message} isOutgoing={isOutgoing} />;

      case 'template':
        return (
          <TemplateMessage
            message={message}
            isOutgoing={isOutgoing}
            onImagePress={onImagePress}
          />
        );

      case 'interactive':
        return (
          <InteractiveMessage
            message={message}
            isOutgoing={isOutgoing}
            onImagePress={onImagePress}
          />
        );

      case 'order':
        return <OrderMessage message={message} isOutgoing={isOutgoing} />;

      case 'unsupported':
        return <UnsupportedMessage message={message} isOutgoing={isOutgoing} />;

      case 'system':
        return null; // System messages rendered differently

      default:
        // Fallback to text message for unknown types
        return <TextMessage message={message} isOutgoing={isOutgoing} />;
    }
  };

  // Render system message (centered, different styling)
  if (messageType === 'system' || message?.from?.type === 'system') {
    const systemText =
      message?.message?.body?.text ||
      (typeof message?.message?.body === 'string' ? message?.message?.body : null) ||
      message?.text ||
      'System message';

    return (
      <View style={styles.systemMessageWrapper}>
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{systemText}</Text>
        </View>
      </View>
    );
  }

  // Sticker messages have transparent bubble
  const isStickerMessage = messageType === 'sticker';

  // Reaction messages are rendered as small bubbles
  const isReactionMessage = messageType === 'reaction';

  return (
    <View
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
          isStickerMessage && styles.stickerBubble,
          isReactionMessage && styles.reactionBubble,
        ]}
      >
        {/* Reply reference */}
        {renderReplyReference()}

        {/* Message content */}
        {renderMessageContent()}

        {/* Error banner for failed messages */}
        {status === 'failed' && errorInfo && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={12} color={colors.error.main} />
            <Text style={styles.errorBannerText} numberOfLines={2}>
              {typeof errorInfo === 'object' ? errorInfo.errorMessage || 'Message failed' : errorInfo}
            </Text>
          </View>
        )}

        {/* Timestamp and status (not shown for stickers) */}
        {!isStickerMessage && (
          <View style={styles.metaContainer}>
            <Text style={[styles.timestamp, isOutgoing && styles.outgoingTimestamp]}>
              {formatTime(timestamp)}
            </Text>
            {renderStatusIcon()}
          </View>
        )}
      </View>

      {/* Sticker timestamp shown outside bubble */}
      {isStickerMessage && (
        <View style={[styles.stickerMeta, isOutgoing && styles.stickerMetaOutgoing]}>
          <Text style={styles.stickerTimestamp}>{formatTime(timestamp)}</Text>
          {renderStatusIcon()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    marginHorizontal: 8,
  },
  outgoingContainer: {
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  outgoingBubble: {
    backgroundColor: chatColors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: chatColors.incoming,
    borderBottomLeftRadius: 4,
    shadowColor: colors.common.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  stickerBubble: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  reactionBubble: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  outgoingTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  stickerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  stickerMetaOutgoing: {
    alignSelf: 'flex-end',
  },
  stickerTimestamp: {
    fontSize: 11,
    color: colors.text.secondary,
  },

  // Reply reference styles
  replyReference: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  replyReferenceIncoming: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  replyReferenceOutgoing: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyBar: {
    width: 3,
    height: '100%',
    minHeight: 32,
    borderRadius: 2,
    marginRight: 8,
  },
  replyBarIncoming: {
    backgroundColor: chatColors.primary,
  },
  replyBarOutgoing: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  replyContent: {
    flex: 1,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyAuthorIncoming: {
    color: chatColors.primary,
  },
  replyAuthorOutgoing: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  replyText: {
    fontSize: 12,
  },
  replyTextIncoming: {
    color: colors.text.secondary,
  },
  replyTextOutgoing: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Error banner styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  errorBannerText: {
    fontSize: 10,
    color: colors.error.main,
    flex: 1,
  },

  // System message styles
  systemMessageWrapper: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemMessageContainer: {
    backgroundColor: chatColors.systemMessage,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Reaction message styles
  reactionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  reactionTextOutgoing: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default memo(ChatMessageItem);
