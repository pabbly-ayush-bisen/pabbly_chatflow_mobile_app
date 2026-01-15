import React, { memo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Linking, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';
import PaymentMessage from './messages/PaymentMessage';
import {
  getMessageText,
  getMessageCaption,
  getMediaUrl,
  getFilename,
  getTemplateData,
  getInteractiveData,
  getLocationData,
  getContactData,
  getOrderData,
  isOutgoingMessage,
  getMessageStatus,
  hasFileSizeError,
  getFileSizeLimit,
  getActualMediaType,
  isEmojiOnly,
  getErrorInfo,
} from '../../utils/messageHelpers';

const MessageBubble = ({ message, onImagePress, onReplyPress, onLongPress }) => {
  const [imageError, setImageError] = useState(false);

  // Get reactions if present
  const reactions = message.reactions || [];

  const isOutgoing = isOutgoingMessage(message);
  const messageType = message.type || 'text';
  const messageText = getMessageText(message);
  const caption = getMessageCaption(message);
  const timestamp = message.timestamp || message.createdAt;
  const status = getMessageStatus(message);
  const errorInfo = getErrorInfo(message);

  // Check for file size error from WhatsApp Business App
  const isFileSizeErr = hasFileSizeError(message);

  // Format time
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get status icon - WhatsApp style ticks
  const getStatusIcon = () => {
    if (!isOutgoing) return null;

    switch (status) {
      case 'failed':
        return <Icon name="alert-circle" size={14} color={colors.error.main} />;
      case 'sent':
        return <Icon name="check" size={14} color={chatColors.tickGrey} />;
      case 'delivered':
        return <Icon name="check-all" size={14} color={chatColors.tickGrey} />;
      case 'read':
        return <Icon name="check-all" size={14} color={chatColors.tickBlue} />;
      default:
        return <Icon name="clock-outline" size={14} color={chatColors.tickGrey} />;
    }
  };

  // Render error message for failed media
  const renderErrorMessage = (errorText, type) => (
    <View style={styles.errorContainer}>
      <Icon name="alert-circle-outline" size={24} color={colors.error.main} />
      <Text style={styles.errorText}>
        {errorText || `Unable to display ${type}`}
      </Text>
    </View>
  );

  // Render file size error message
  const renderFileSizeError = () => {
    const actualType = getActualMediaType(message);
    const maxSize = getFileSizeLimit(actualType);
    const mediaTypeLabels = {
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      document: 'File',
    };
    const label = mediaTypeLabels[actualType] || 'Media';

    return (
      <View style={styles.fileSizeErrorContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
        <View style={styles.fileSizeErrorContent}>
          <Text style={styles.fileSizeErrorTitle}>
            {label} file exceeds size limit
          </Text>
          <Text style={styles.fileSizeErrorSubtitle}>
            Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  };

  // Render text message
  const renderTextMessage = () => {
    const text = messageText || 'Message';
    const isEmoji = isEmojiOnly(text);

    return (
      <Text
        style={[
          isEmoji ? styles.emojiText : styles.messageText,
          isOutgoing && styles.outgoingText,
        ]}
      >
        {text}
      </Text>
    );
  };

  // Render sticker message (like web app)
  const renderStickerMessage = () => {
    const stickerUrl = getMediaUrl(message);

    if (!stickerUrl) {
      return renderErrorMessage('Sticker not available', 'sticker');
    }

    return (
      <TouchableOpacity onPress={() => onImagePress?.(stickerUrl)}>
        <Image
          source={{ uri: stickerUrl }}
          style={styles.stickerImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      </TouchableOpacity>
    );
  };

  // Render image message
  const renderImageMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    const imageUrl = getMediaUrl(message);

    if (!imageUrl) {
      return renderErrorMessage('Image not available', 'image');
    }

    if (imageError) {
      return renderErrorMessage('Failed to load image', 'image');
    }

    return (
      <View>
        <TouchableOpacity onPress={() => onImagePress?.(imageUrl)}>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.imageMessage, caption ? styles.imageWithCaption : null]}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </TouchableOpacity>
        {caption ? (
          <Text style={[styles.caption, isOutgoing && styles.outgoingText]}>
            {caption}
          </Text>
        ) : null}
      </View>
    );
  };

  // Render video message
  const renderVideoMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    const videoUrl = getMediaUrl(message);

    if (!videoUrl) {
      return renderErrorMessage('Video not available', 'video');
    }

    return (
      <View>
        <TouchableOpacity
          style={styles.videoContainer}
          onPress={() => Linking.openURL(videoUrl)}
        >
          <View style={styles.videoOverlay}>
            <Icon name="play-circle" size={48} color={colors.common.white} />
          </View>
          <View style={styles.videoPlaceholder}>
            <Icon name="video" size={40} color={colors.grey[400]} />
          </View>
        </TouchableOpacity>
        {caption ? (
          <Text style={[styles.caption, isOutgoing && styles.outgoingText]}>
            {caption}
          </Text>
        ) : null}
      </View>
    );
  };

  // Render audio message
  const renderAudioMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    const audioUrl = getMediaUrl(message);

    if (!audioUrl) {
      return renderErrorMessage('Audio not available', 'audio');
    }

    return (
      <TouchableOpacity
        style={styles.audioContainer}
        onPress={() => Linking.openURL(audioUrl)}
      >
        <Icon
          name="play-circle"
          size={36}
          color={chatColors.primary}
        />
        <View style={styles.audioWaveform}>
          {[...Array(15)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.audioBar,
                { height: Math.random() * 20 + 5 },
                isOutgoing && styles.audioBarOutgoing,
              ]}
            />
          ))}
        </View>
        <Text style={[styles.audioDuration, isOutgoing && styles.outgoingText]}>
          0:00
        </Text>
      </TouchableOpacity>
    );
  };

  // Render document message
  const renderDocumentMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    const fileName = getFilename(message);
    const fileUrl = getMediaUrl(message);

    return (
      <TouchableOpacity
        style={styles.documentContainer}
        onPress={() => fileUrl && Linking.openURL(fileUrl)}
      >
        <View style={[styles.documentIcon, isOutgoing && styles.documentIconOutgoing]}>
          <Icon
            name="file-document"
            size={24}
            color={isOutgoing ? chatColors.primary : colors.grey[600]}
          />
        </View>
        <View style={styles.documentInfo}>
          <Text
            style={[styles.documentName, isOutgoing && styles.outgoingText]}
            numberOfLines={1}
          >
            {fileName}
          </Text>
          <Text style={[styles.documentMeta, isOutgoing && styles.outgoingTextSecondary]}>
            Document
          </Text>
        </View>
        <Icon
          name="download"
          size={20}
          color={colors.grey[500]}
        />
      </TouchableOpacity>
    );
  };

  // Render template message (aligned with web app)
  const renderTemplateMessage = () => {
    const templateData = getTemplateData(message);

    if (!templateData) {
      return renderErrorMessage('Template data is missing', 'template');
    }

    const { templateName, type } = templateData;
    const mediaUrl = getMediaUrl(message);

    return (
      <View style={styles.templateContainer}>
        {/* Template header with media if present */}
        {type === 'image' && mediaUrl && (
          <TouchableOpacity onPress={() => onImagePress?.(mediaUrl)}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.templateMedia}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        {type === 'video' && mediaUrl && (
          <TouchableOpacity
            style={styles.templateVideoContainer}
            onPress={() => Linking.openURL(mediaUrl)}
          >
            <View style={styles.videoOverlay}>
              <Icon name="play-circle" size={36} color={colors.common.white} />
            </View>
            <View style={styles.templateVideoPlaceholder}>
              <Icon name="video" size={30} color={colors.grey[400]} />
            </View>
          </TouchableOpacity>
        )}
        {type === 'document' && mediaUrl && (
          <TouchableOpacity
            style={styles.templateDocContainer}
            onPress={() => Linking.openURL(mediaUrl)}
          >
            <Icon name="file-document" size={20} color={colors.grey[600]} />
            <Text style={styles.templateDocText}>Document</Text>
          </TouchableOpacity>
        )}

        {/* Template body */}
        <View style={styles.templateBody}>
          <Icon
            name="file-document-outline"
            size={16}
            color={colors.grey[500]}
            style={styles.templateIcon}
          />
          <Text style={[styles.messageText, isOutgoing && styles.outgoingText]}>
            {templateName}
          </Text>
        </View>
      </View>
    );
  };

  // Render interactive message (aligned with web app)
  const renderInteractiveMessage = () => {
    const interactiveData = getInteractiveData(message);
    const { type, body, buttons, sections, header, footer } = interactiveData;

    // Validate interactive message
    if (!type) {
      return renderErrorMessage('Interactive message type is missing', 'interactive');
    }

    const bodyText = typeof body === 'string' ? body : 'Interactive message';

    return (
      <View style={styles.interactiveContainer}>
        {/* Header if present */}
        {header?.text && (
          <Text style={[styles.interactiveHeader, isOutgoing && styles.outgoingText]}>
            {header.text}
          </Text>
        )}

        {/* Body text */}
        <Text style={[styles.messageText, isOutgoing && styles.outgoingText]}>
          {bodyText}
        </Text>

        {/* Footer if present */}
        {footer && (
          <Text style={[styles.interactiveFooter, isOutgoing && styles.outgoingTextSecondary]}>
            {footer}
          </Text>
        )}

        {/* Buttons for button type */}
        {(type === 'button' || type === 'cta_url') && buttons.length > 0 && (
          <View style={styles.interactiveButtons}>
            {buttons.map((btn, index) => (
              <TouchableOpacity key={index} style={styles.interactiveButton}>
                <Text style={styles.interactiveButtonText}>
                  {btn.reply?.title || btn.title || 'Button'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* List indicator for list type */}
        {type === 'list' && sections.length > 0 && (
          <View style={styles.listIndicator}>
            <Icon name="menu" size={16} color={chatColors.primary} />
            <Text style={styles.listIndicatorText}>
              View options ({sections.reduce((acc, s) => acc + (s.rows?.length || 0), 0)} items)
            </Text>
          </View>
        )}

        {/* Product indicator */}
        {(type === 'product' || type === 'product_list') && (
          <View style={styles.productIndicator}>
            <Icon name="shopping" size={16} color={chatColors.primary} />
            <Text style={styles.productIndicatorText}>View products</Text>
          </View>
        )}

        {/* Catalog indicator */}
        {type === 'catalog_message' && (
          <View style={styles.catalogIndicator}>
            <Icon name="store" size={16} color={chatColors.primary} />
            <Text style={styles.catalogIndicatorText}>View catalog</Text>
          </View>
        )}
      </View>
    );
  };

  // Render location message
  const renderLocationMessage = () => {
    const locationData = getLocationData(message);
    const { latitude, longitude, name, address } = locationData;

    if (!latitude || !longitude) {
      return renderErrorMessage('Invalid location coordinates', 'location');
    }

    return (
      <TouchableOpacity
        style={styles.locationContainer}
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)}
      >
        <View style={styles.locationMap}>
          <Icon name="map-marker" size={40} color={colors.error.main} />
        </View>
        <Text style={[styles.locationName, isOutgoing && styles.outgoingText]}>
          {name}
        </Text>
        {address ? (
          <Text style={[styles.locationAddress, isOutgoing && styles.outgoingTextSecondary]}>
            {address}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Render order message (aligned with web app)
  const renderOrderMessage = () => {
    const orderData = getOrderData(message);

    if (!orderData) {
      return renderErrorMessage('Order data is missing', 'order');
    }

    const { productItems, totalAmount, totalItems, currency } = orderData;

    return (
      <View style={styles.orderContainer}>
        <View style={styles.orderHeader}>
          <Icon name="shopping" size={24} color={chatColors.primary} />
          <View style={styles.orderInfo}>
            <Text style={[styles.orderTitle, isOutgoing && styles.outgoingText]}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </Text>
            <Text style={[styles.orderTotal, isOutgoing && styles.outgoingTextSecondary]}>
              {currency} {totalAmount.toLocaleString()} (estimated)
            </Text>
          </View>
        </View>
        <View style={styles.orderDivider} />
        <TouchableOpacity style={styles.orderAction}>
          <Text style={styles.orderActionText}>View sent cart</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render contacts message (aligned with web app)
  const renderContactsMessage = () => {
    const contacts = getContactData(message);

    if (!contacts || contacts.length === 0) {
      return renderErrorMessage('Contact data is missing', 'contacts');
    }

    const getInitials = (name) => {
      if (!name) return '?';
      return name.match(/\b\w/g)?.join('')?.slice(0, 2)?.toUpperCase() || '?';
    };

    if (contacts.length === 1) {
      const contact = contacts[0];
      return (
        <View style={styles.contactContainer}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>{getInitials(contact.name)}</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, isOutgoing && styles.outgoingText]}>
              {contact.name}
            </Text>
            {contact.phones.length > 0 ? (
              contact.phones.map((phone, idx) => (
                <Text
                  key={idx}
                  style={[styles.contactPhone, isOutgoing && styles.outgoingTextSecondary]}
                >
                  {phone.phone || 'N/A'}
                </Text>
              ))
            ) : (
              <Text style={[styles.contactPhone, isOutgoing && styles.outgoingTextSecondary]}>
                No phone number
              </Text>
            )}
          </View>
        </View>
      );
    }

    // Multiple contacts
    const primaryName = contacts[0].name;
    const otherCount = contacts.length - 1;

    return (
      <View style={styles.multiContactContainer}>
        <View style={styles.multiContactAvatars}>
          {contacts.slice(0, 3).map((contact, idx) => (
            <View
              key={idx}
              style={[styles.multiContactAvatar, { marginLeft: idx > 0 ? -12 : 0 }]}
            >
              <Text style={styles.contactAvatarText}>{getInitials(contact.name)}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.multiContactText, isOutgoing && styles.outgoingText]}>
          {primaryName} {otherCount > 0 ? `and ${otherCount} other contacts` : ''}
        </Text>
      </View>
    );
  };

  // Render payment message (READ-ONLY)
  const renderPaymentMessage = () => {
    const paymentData = message.payment || message.order?.payment || message;

    return (
      <PaymentMessage
        payment={paymentData}
        isOutgoing={isOutgoing}
      />
    );
  };

  // Render reactions below message
  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      const emoji = reaction.emoji || reaction;
      if (!acc[emoji]) {
        acc[emoji] = { emoji, count: 0 };
      }
      acc[emoji].count += 1;
      return acc;
    }, {});

    const reactionList = Object.values(groupedReactions);

    return (
      <View style={[styles.reactionsContainer, isOutgoing && styles.reactionsOutgoing]}>
        {reactionList.map((reaction, index) => (
          <View key={index} style={styles.reactionBadge}>
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render unsupported message
  const renderUnsupportedMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    return (
      <View style={styles.unsupportedContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
        <Text style={styles.unsupportedText}>
          WhatsApp Cloud API does not support this message type
        </Text>
      </View>
    );
  };

  // Render system message
  const renderSystemMessage = () => (
    <View style={styles.systemMessageContainer}>
      <Text style={styles.systemMessageText}>
        {messageText || 'System message'}
      </Text>
    </View>
  );

  // Render message content based on type
  const renderMessageContent = () => {
    if (messageType === 'system') {
      return renderSystemMessage();
    }

    switch (messageType) {
      case 'sticker':
        return renderStickerMessage();
      case 'image':
        return renderImageMessage();
      case 'video':
        return renderVideoMessage();
      case 'audio':
        return renderAudioMessage();
      case 'document':
      case 'file':
        return renderDocumentMessage();
      case 'template':
        return renderTemplateMessage();
      case 'interactive':
        return renderInteractiveMessage();
      case 'location':
        return renderLocationMessage();
      case 'order':
        return renderOrderMessage();
      case 'contact':
      case 'contacts':
        return renderContactsMessage();
      case 'payment':
        return renderPaymentMessage();
      case 'unsupported':
        return renderUnsupportedMessage();
      default:
        return renderTextMessage();
    }
  };

  // System messages have different styling
  if (messageType === 'system') {
    return (
      <View style={styles.systemMessageWrapper}>
        {renderSystemMessage()}
      </View>
    );
  }

  // Handle long press
  const handleLongPress = () => {
    if (onLongPress && messageType !== 'system') {
      onLongPress(message);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
      ]}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          pressed && styles.bubblePressed,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            messageType === 'sticker' && styles.stickerBubble,
          ]}
        >
          {/* Reply reference */}
          {message.context?.id && (
            <TouchableOpacity
              style={styles.replyReference}
              onPress={() => onReplyPress?.(message.context.id)}
            >
              <View style={styles.replyBar} />
              <Text style={styles.replyText} numberOfLines={1}>
                Replying to message
              </Text>
            </TouchableOpacity>
          )}

          {/* Message content */}
          {renderMessageContent()}

          {/* Error info banner */}
          {status === 'failed' && errorInfo && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={12} color={colors.error.main} />
              <Text style={styles.errorBannerText} numberOfLines={2}>
                {typeof errorInfo === 'object' ? errorInfo.errorMessage || 'Message failed' : errorInfo}
              </Text>
            </View>
          )}

          {/* Time and status */}
          <View style={styles.metaContainer}>
            <Text style={[styles.timestamp, isOutgoing && styles.outgoingTimestamp]}>
              {formatTime(timestamp)}
            </Text>
            {getStatusIcon()}
          </View>
        </View>
      </Pressable>

      {/* Reactions */}
      {renderReactions()}
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
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  outgoingBubble: {
    backgroundColor: chatColors.outgoing,
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 2,
  },
  incomingBubble: {
    backgroundColor: chatColors.incoming,
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 2,
    shadowColor: colors.common.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  stickerBubble: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text.primary,
  },
  emojiText: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  outgoingText: {
    color: colors.text.primary,
  },
  outgoingTextSecondary: {
    color: colors.text.secondary,
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
    color: 'rgba(0,0,0,0.45)',
  },
  outgoingTimestamp: {
    color: 'rgba(0,0,0,0.45)',
  },

  // Error styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.error.main,
    flex: 1,
  },
  fileSizeErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.warning.lighter,
    borderRadius: 8,
    gap: 8,
  },
  fileSizeErrorContent: {
    flex: 1,
  },
  fileSizeErrorTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning.dark,
  },
  fileSizeErrorSubtitle: {
    fontSize: 11,
    color: colors.warning.main,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  errorBannerText: {
    fontSize: 10,
    color: colors.error.main,
    flex: 1,
  },

  // Sticker styles
  stickerImage: {
    width: 120,
    height: 120,
  },

  // Image styles
  imageMessage: {
    width: 220,
    height: 220,
    borderRadius: 8,
  },
  imageWithCaption: {
    borderRadius: 4,
  },
  caption: {
    marginTop: 6,
    fontSize: 14,
    color: colors.text.primary,
  },

  // Video styles
  videoContainer: {
    width: 220,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: colors.grey[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },

  // Audio styles
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    gap: 2,
  },
  audioBar: {
    width: 3,
    backgroundColor: colors.grey[400],
    borderRadius: 2,
  },
  audioBarOutgoing: {
    backgroundColor: chatColors.primary,
  },
  audioDuration: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  // Document styles
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 200,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  documentIconOutgoing: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  documentMeta: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  // Template styles
  templateContainer: {
    minWidth: 200,
  },
  templateMedia: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  templateVideoContainer: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  templateVideoPlaceholder: {
    flex: 1,
    backgroundColor: colors.grey[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateDocContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  templateDocText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  templateBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  templateIcon: {
    marginRight: 6,
    marginTop: 2,
  },

  // Interactive styles
  interactiveContainer: {
    minWidth: 200,
  },
  interactiveHeader: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.text.primary,
  },
  interactiveFooter: {
    fontSize: 12,
    marginTop: 4,
    color: colors.text.secondary,
  },
  interactiveButtons: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },
  interactiveButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  interactiveButtonText: {
    color: chatColors.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  listIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  listIndicatorText: {
    color: chatColors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  productIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  productIndicatorText: {
    color: chatColors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  catalogIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  catalogIndicatorText: {
    color: chatColors.primary,
    fontSize: 13,
    fontWeight: '500',
  },

  // Location styles
  locationContainer: {
    width: 220,
  },
  locationMap: {
    height: 120,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationName: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Order styles
  orderContainer: {
    minWidth: 220,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  orderTotal: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  orderDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 8,
  },
  orderAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderActionText: {
    color: chatColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Contact styles
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  contactAvatarText: {
    color: colors.common.white,
    fontSize: 14,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  contactPhone: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  multiContactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  multiContactAvatars: {
    flexDirection: 'row',
    marginRight: 12,
  },
  multiContactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.common.white,
  },
  multiContactText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
  },

  // Unsupported styles
  unsupportedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  unsupportedText: {
    fontSize: 13,
    color: colors.warning.dark,
    flex: 1,
  },

  // System message styles
  systemMessageWrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageContainer: {
    backgroundColor: chatColors.systemMessage,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Reply reference styles
  replyReference: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  replyBar: {
    width: 3,
    height: 20,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },

  // Pressed state
  bubblePressed: {
    opacity: 0.8,
  },

  // Reactions styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    marginLeft: 8,
    gap: 4,
  },
  reactionsOutgoing: {
    justifyContent: 'flex-end',
    marginLeft: 0,
    marginRight: 8,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    shadowColor: colors.common.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});

export default memo(MessageBubble);
