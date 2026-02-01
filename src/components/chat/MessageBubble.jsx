import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Linking, Pressable, PanResponder, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useSelector } from 'react-redux';
import { colors, chatColors } from '../../theme/colors';
import PaymentMessage from './messages/PaymentMessage';
import TemplateMessage from './messages/TemplateMessage';
import WebFormTableMessage from './messages/WebFormTableMessage';
import AskAddressReplyMessage from './messages/AskAddressReplyMessage';
import InteractiveMessage from './messages/interactive/InteractiveMessage';
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
  getSenderInfo,
} from '../../utils/messageHelpers';

const MessageBubble = ({ message, originalMessage, onImagePress, onReplyPress, onLongPress, onContactPress }) => {
  const [imageError, setImageError] = useState(false);
  const [generatedVideoThumbnail, setGeneratedVideoThumbnail] = useState(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Get assistants and flows from Redux for sender name lookup
  const assistants = useSelector((state) => state.assistant?.assistants || []);
  const flows = useSelector((state) => state.assistant?.flows || []);

  // Determine if outgoing message (used for animation direction)
  const isOutgoing = isOutgoingMessage(message);

  // Check if message is new (created within last 3 seconds) for animation
  const isNewMessage = useRef(() => {
    if (message.isOptimistic) return true;
    const messageTime = new Date(message.timestamp || message.createdAt).getTime();
    const now = Date.now();
    // Animate if message is less than 3 seconds old
    return (now - messageTime) < 3000;
  }).current;

  const shouldAnimate = isNewMessage();

  // Animation values for new message appearance (WhatsApp-style)
  // Outgoing: scale + slide up, Incoming: slide from left
  const scaleAnim = useRef(new Animated.Value(shouldAnimate ? (isOutgoing ? 0.3 : 0.8) : 1)).current;
  const translateYAnim = useRef(new Animated.Value(shouldAnimate ? (isOutgoing ? 20 : 10) : 0)).current;
  const translateXAnim = useRef(new Animated.Value(shouldAnimate ? (isOutgoing ? 0 : -30) : 0)).current;
  const opacityAnim = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  // Run entrance animation for new messages (both sent and received)
  useEffect(() => {
    if (shouldAnimate) {
      // WhatsApp-style entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 7,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(translateXAnim, {
          toValue: 0,
          friction: 7,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []); // Run only once on mount

  // Get reactions if present
  const reactions = message.reactions || [];

  // Some incoming WhatsApp interactive replies come as:
  // { type: 'interactive', interactive: { type: 'button_reply' | 'list_reply', ... } }
  // or in some cases `type` may be missing but `interactive` is present.
  const messageType = message?.type || (message?.interactive ? 'interactive' : 'text');
  const messageText = getMessageText(message);
  const caption = getMessageCaption(message);
  const timestamp = message.timestamp || message.createdAt;
  const status = getMessageStatus(message);
  const errorInfo = getErrorInfo(message);

  // Check for file size error from WhatsApp Business App
  const isFileSizeErr = hasFileSizeError(message);

  // Check for nfm_reply message type (Node Flow Message reply)
  // Check both message.message.type and message.type for compatibility
  const isNfmReply = message?.message?.type === 'nfm_reply' || message?.type === 'nfm_reply';
  let nfmReplyObject = null;
  let nfmReplyName = null;
  if (isNfmReply) {
    // Try to get payload from message.message.payload first, then message.payload
    const payload = message?.message?.payload || message?.payload;
    if (payload) {
      nfmReplyName = payload.name;
      try {
        const responseJson = payload.response_json;
        if (responseJson) {
          nfmReplyObject = typeof responseJson === 'string' 
            ? JSON.parse(responseJson) 
            : responseJson;
        }
      } catch (error) {
        // Warn:('[MessageBubble] Failed to parse nfm_reply response_json:', error);
      }
    }
  }

  // Swipe-to-reply (WhatsApp-style right swipe)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Horizontal movement more than vertical, small threshold
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        // Right swipe threshold → trigger reply
        if (dx > 40) {
          onReplyPress?.(message._id || message.wamid);
        }
      },
    })
  ).current;

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

  // Get sender info for outgoing messages (team member, AI assistant, flow, broadcast, etc.)
  // Pass assistants and flows for name lookup (like web app)
  const senderInfo = useMemo(
    () => getSenderInfo(message, { assistants, flows }),
    [message, assistants, flows]
  );

  // Render sender badge with icon and name
  const renderSenderBadge = () => {
    if (!senderInfo || !isOutgoing) return null;

    // Determine icon color based on outgoing message style
    const iconColor = 'rgba(0,0,0,0.45)';
    const textColor = 'rgba(0,0,0,0.45)';

    return (
      <View style={styles.senderBadge}>
        <Icon name={senderInfo.icon} size={12} color={iconColor} />
        <Text
          style={[styles.senderName, { color: textColor }]}
          numberOfLines={1}
        >
          {senderInfo.name}
        </Text>
      </View>
    );
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

  // Generate a thumbnail from the video on the device if backend did not provide one
  useEffect(() => {
    const generateThumbnail = async () => {
      try {
        const videoUrl = getMediaUrl(message);
        if (!videoUrl) return;

        // Skip if backend already provided a thumbnail
        const backendThumbnail =
          message?.message?.thumbnail ||
          message?.thumbnail ||
          message?.waResponse?.video?.thumbnail ||
          null;

        if (backendThumbnail) return;

        setIsGeneratingThumbnail(true);
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
          time: 1000, // 1 second into the video
        });
        setGeneratedVideoThumbnail(uri);
      } catch (e) {
        // Warn:('[MessageBubble] Failed to generate video thumbnail', e);
      } finally {
        setIsGeneratingThumbnail(false);
      }
    };

    if (messageType === 'video') {
      generateThumbnail();
    }
  }, [message, messageType]);

  // Render video message with thumbnail
  const renderVideoMessage = () => {
    if (isFileSizeErr) {
      return renderFileSizeError();
    }

    const videoUrl = getMediaUrl(message);
    const hasCaption = Boolean(caption);

    if (!videoUrl) {
      return renderErrorMessage('Video not available', 'video');
    }

    // Get thumbnail URL if available from backend or generated on device
    const thumbnailUrl =
      message?.message?.thumbnail ||
      message?.thumbnail ||
      message?.waResponse?.video?.thumbnail ||
      generatedVideoThumbnail ||
      null;

    return (
      <View>
        <TouchableOpacity
          style={[
            styles.videoContainer,
            hasCaption ? styles.videoWithCaption : styles.videoWithoutCaption,
          ]}
          onPress={() => Linking.openURL(videoUrl)}
          activeOpacity={0.9}
        >
          {/* Video thumbnail or placeholder */}
          {thumbnailUrl && !imageError ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.videoThumbnail}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Icon name="video" size={40} color={colors.grey[400]} />
            </View>
          )}

          {/* Play button overlay */}
          <View style={styles.videoOverlay}>
            <View style={styles.playButtonCircle}>
              <Icon name="play" size={32} color={colors.common.white} />
            </View>
          </View>

          {/* Duration badge if available */}
          {message?.message?.duration && (
            <View style={styles.videoDurationBadge}>
              <Text style={styles.videoDurationText}>
                {formatVideoDuration(message.message.duration)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {caption ? (
          <Text style={[styles.caption, isOutgoing && styles.outgoingText]}>
            {caption}
          </Text>
        ) : null}
      </View>
    );
  };

  // Format video duration
  const formatVideoDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Render template message using dedicated component (header, body, footer, buttons)
  const renderTemplateMessage = () => (
    <TemplateMessage
      message={message}
      isOutgoing={isOutgoing}
      onImagePress={onImagePress}
    />
  );

  // Render interactive message using dedicated component (aligned with web app)
  // Routes to specialized components: ButtonMessage, ListMessage, AddressMessage, etc.
  const renderInteractiveMessage = () => (
    <InteractiveMessage
      message={message}
      isOutgoing={isOutgoing}
      onImagePress={onImagePress}
    />
  );

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

    // Both single and multiple contacts: pass full array to parent so modal can show all
    const primaryName = contacts[0].name;
    const otherCount = contacts.length - 1;

    if (contacts.length === 1) {
      const contact = contacts[0];
      return (
        <TouchableOpacity
          style={styles.contactContainer}
          activeOpacity={0.7}
          onPress={() => onContactPress?.(contacts)}
        >
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
        </TouchableOpacity>
      );
    }

    // Multiple contacts
    return (
      <TouchableOpacity
        style={styles.multiContactContainer}
        activeOpacity={0.7}
        onPress={() => onContactPress?.(contacts)}
      >
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
      </TouchableOpacity>
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
        <Icon name="alert-circle-outline" size={20} color="#FF5630" />
        <View style={styles.unsupportedTextContainer}>
          <Text style={[styles.unsupportedText, isOutgoing && styles.unsupportedTextOutgoing]}>
            WhatsApp Cloud API does not support this message type. Try using a different format.
          </Text>
        </View>
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

  // Reply preview content (for replied-to messages) - aligned with web behavior
  const renderReplyPreviewContent = () => {
    if (!originalMessage) {
      return (
        <Text style={styles.replyText} numberOfLines={1}>
          Replying to message
        </Text>
      );
    }

    const origType = originalMessage?.type || 'text';

    // Text-like preview for many types
    const baseText = () => {
      const text = getMessageText(originalMessage) || getMessageCaption(originalMessage);
      if (!text) return null;
      const trimmed = text.length > 60 ? `${text.slice(0, 57)}...` : text;
      return trimmed;
    };

    switch (origType) {
      case 'text': {
        const text = baseText() || 'Text message';
        return (
          <Text style={styles.replyText} numberOfLines={1}>
            {text}
          </Text>
        );
      }
      case 'image': {
        const imgUrl = getMediaUrl(originalMessage);
        if (!imgUrl) {
          const text = getMessageCaption(originalMessage) || 'Image';
          return (
            <Text style={styles.replyText} numberOfLines={1}>
              {text}
            </Text>
          );
        }
        return (
          <View style={styles.replyMediaRow}>
            <Image
              source={{ uri: imgUrl }}
              style={styles.replyImageThumb}
              resizeMode="cover"
            />
            <Text style={styles.replyText} numberOfLines={1}>
              Image
            </Text>
          </View>
        );
      }
      case 'video': {
        return (
          <View style={styles.replyMediaRow}>
            <View style={styles.replyVideoThumb}>
              <Icon name="play-circle" size={18} color={colors.common.white} />
            </View>
            <Text style={styles.replyText} numberOfLines={1}>
              Video
            </Text>
          </View>
        );
      }
      case 'audio': {
        return (
          <View style={styles.replyMediaRow}>
            <Icon name="music" size={16} color={colors.grey[600]} />
            <Text style={styles.replyText} numberOfLines={1}>
              Audio
            </Text>
          </View>
        );
      }
      case 'document':
      case 'file': {
        const fileName = getFilename(originalMessage);
        return (
          <View style={styles.replyMediaRow}>
            <Icon name="file-document" size={16} color={colors.grey[700]} />
            <Text style={styles.replyText} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        );
      }
      case 'location':
        return (
          <View style={styles.replyMediaRow}>
            <Icon name="map-marker" size={16} color={colors.error.main} />
            <Text style={styles.replyText} numberOfLines={1}>
              Location
            </Text>
          </View>
        );
      case 'contact':
      case 'contacts':
        return (
          <View style={styles.replyMediaRow}>
            <Icon name="account" size={16} color={colors.grey[700]} />
            <Text style={styles.replyText} numberOfLines={1}>
              Contact
            </Text>
          </View>
        );
      case 'template': {
        const tpl = getTemplateData(originalMessage);
        const name = tpl?.templateName || 'Template message';
        return (
          <Text style={styles.replyText} numberOfLines={1}>
            {name}
          </Text>
        );
      }
      case 'interactive': {
        // Match web app behavior: prefer header/body depending on interactive subtype,
        // and handle flow interactive messages.
        const getInteractiveReplyText = () => {
          if (originalMessage?.from?.type === 'flow') {
            return (
              originalMessage?.message?.header?.text ||
              originalMessage?.message?.body?.text ||
              'Flow Interactive Message'
            );
          }

          const t = originalMessage?.message?.type || originalMessage?.interactive?.type;

          switch (t) {
            case 'button':
              return originalMessage?.message?.body?.text || 'Button Message';
            case 'list':
              return (
                originalMessage?.message?.header?.text ||
                originalMessage?.message?.body?.text ||
                'List Message'
              );
            case 'product':
              return originalMessage?.message?.body?.text || 'Product Message';
            case 'product_list':
              return originalMessage?.message?.body?.text || 'Product List Message';
            case 'catalog_message':
              return originalMessage?.message?.body?.text || 'Catalog Message';
            case 'address_message':
              return originalMessage?.message?.body?.text || 'Address Message';
            case 'button_reply':
            case 'list_reply': {
              const interactive = getInteractiveData(originalMessage);
              return interactive?.body || 'Interactive reply';
            }
            default: {
              const interactive = getInteractiveData(originalMessage);
              return interactive?.body || originalMessage?.message?.body?.text || 'Interactive Message';
            }
          }
        };

        const text = getInteractiveReplyText();
        return (
          <Text style={styles.replyText} numberOfLines={1}>
            {text}
          </Text>
        );
      }
      case 'order':
        return (
          <Text style={styles.replyText} numberOfLines={1}>
            Order
          </Text>
        );
      default: {
        const text = baseText() || 'Message';
        return (
          <Text style={styles.replyText} numberOfLines={1}>
            {text}
          </Text>
        );
      }
    }
  };

  // Get message type label (like web app)
  const getMessageTypeLabel = () => {
    if (messageType === 'system') return null; // Don't show label for system messages
    if (isNfmReply) return null; // Don't show label for nfm_reply messages (they have their own UI)

    const typeLabels = {
      image: 'Image Message',
      sticker: 'Sticker Message',
      video: 'Video Message',
      audio: 'Audio Message',
      document: 'File Message',
      file: 'File Message',
      location: 'Location Message',
      interactive: 'Interactive Message',
      template: 'Template Message',
      order: 'Order Message',
      contact: 'Contact Message',
      contacts: 'Contact Message',
      payment: 'Payment Message',
      unsupported: 'Unsupported Message',
      text: 'Text Message',
    };

    return typeLabels[messageType] || null;
  };

  // Render nfm_reply message (Node Flow Message reply)
  const renderNfmReplyMessage = () => {
    if (!isNfmReply || !nfmReplyObject) {
      return renderTextMessage();
    }

    // Render based on payload name
    if (nfmReplyName === 'flow') {
      return <WebFormTableMessage message={nfmReplyObject} />;
    } else {
      // For ask_address or other nfm_reply types
      return <AskAddressReplyMessage message={nfmReplyObject} />;
    }
  };

  // Render message content based on type
  const renderMessageContent = () => {
    if (messageType === 'system') {
      return renderSystemMessage();
    }

    // Handle nfm_reply messages first
    if (isNfmReply) {
      return renderNfmReplyMessage();
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

  const messageTypeLabel = getMessageTypeLabel();
  const replyId = message?.replyToWamid || message?.context?.id;
  const isOriginalOutgoing = originalMessage ? isOutgoingMessage(originalMessage) : false;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
        // Apply animation transforms for new messages
        {
          opacity: opacityAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
            { translateX: translateXAnim },
          ],
        },
      ]}
    >
      {/* Message type label above bubble (like web app) */}
      {messageTypeLabel && (
        <Text
          style={[
            styles.messageTypeLabel,
            isOutgoing && styles.messageTypeLabelOutgoing,
          ]}
        >
          {messageTypeLabel}
        </Text>
      )}

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
          {/* Reply reference (rich preview like web) */}
          {replyId && (
            <TouchableOpacity
              style={styles.replyReference}
              onPress={() => onReplyPress?.(replyId)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.replyBar,
                  isOriginalOutgoing ? styles.replyBarOutgoing : styles.replyBarIncoming,
                ]}
              />
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
                {renderReplyPreviewContent()}
              </View>
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

          {/* Sender info, time and status */}
          <View style={[
            styles.metaContainer,
            senderInfo && isOutgoing && styles.metaContainerWithSender,
          ]}>
            {renderSenderBadge()}
            <View style={styles.timestampContainer}>
              <Text style={[styles.timestamp, isOutgoing && styles.outgoingTimestamp]}>
                {formatTime(timestamp)}
              </Text>
              {getStatusIcon()}
            </View>
          </View>
        </View>
      </Pressable>

      {/* Reactions */}
      {renderReactions()}
    </Animated.View>
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
    gap: 8,
  },
  metaContainerWithSender: {
    justifyContent: 'space-between',
  },
  senderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    maxWidth: '60%',
  },
  senderName: {
    fontSize: 10,
    fontWeight: '400',
    flexShrink: 1,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
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

  // Message type label
  messageTypeLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 4,
    marginLeft: 8,
  },
  messageTypeLabelOutgoing: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 8,
  },
  // Video styles
  videoContainer: {
    width: 220,
    height: 150,
    overflow: 'hidden',
    position: 'relative',
  },
  videoWithCaption: {
    borderRadius: 4,
  },
  videoWithoutCaption: {
    borderRadius: 8,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
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
  playButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // Offset play icon for visual center
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 2,
  },
  videoDurationText: {
    fontSize: 11,
    color: colors.common.white,
    fontWeight: '500',
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
    alignItems: 'flex-start',
    paddingVertical: 4,
    minWidth: 200,
  },
  unsupportedTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  unsupportedText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.text.primary,
  },
  unsupportedTextOutgoing: {
    color: colors.common.white,
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
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  replyBar: {
    width: 3,
    height: '100%',
    minHeight: 24,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyBarIncoming: {
    backgroundColor: chatColors.primary,
  },
  replyBarOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(0,0,0,0.8)',
  },
  replyText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  replyMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyImageThumb: {
    width: 34,
    height: 34,
    borderRadius: 5,
    backgroundColor: colors.grey[200],
  },
  replyVideoThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.grey[600],
    justifyContent: 'center',
    alignItems: 'center',
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
