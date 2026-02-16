/**
 * MessagePreviewBubble - Unified WhatsApp-style message preview component.
 *
 * Renders a consistent message bubble preview that can display either
 * template messages or regular messages (text/image/video/audio/file).
 *
 * Used across: InboxSettingsScreen, OptInManagementScreen, TemplatesScreen, QuickRepliesScreen
 */
import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import styles from './messagePreviewStyles';
import { MESSAGE_TYPE_CONFIG, getEffectiveMessageType, BUTTON_CONFIG } from './messagePreviewUtils';
import TemplateContent, { getButtonsForOutsideRender } from './TemplateContent';
import RegularMessageContent from './RegularMessageContent';
import CarouselPreview from './CarouselPreview';
import { getCarouselCards, getLimitedTimeOffer } from './messagePreviewUtils';

const MessagePreviewBubble = ({
  // Mode
  mode = 'template', // 'template' | 'regular'

  // State handling
  enabled = true,
  disabledTitle = 'Message Disabled',
  disabledHint = 'Enable in web app to activate',
  disabledIcon = 'message-off-outline',
  disabledIconColor = colors.grey[400],
  disabledIconBg,
  showTypeBadge = true,
  emptyTitle = 'No Message Configured',
  emptyHint = 'Set up message in web app',

  // Template mode props
  templateData = null,
  templateName = '',
  bodyParams = {},
  headerParams = {},
  headerFileUrl = '',
  showActualMedia = true,
  buttonsInsideBubble = true,
  showCarousel = false,
  showLTO = false,
  preservePlaceholders = false,

  // Regular message mode props
  regularMessageType = 'text',
  message = '',
  fileUrl = '',
  fileName = '',
  useNativeMediaControls = false,

  // For determining empty state (InboxSettings/OptIn)
  messageType = '',

  // Styling
  style,
  bubbleStyle,
}) => {
  // Render type badge
  const renderTypeBadge = () => {
    const effectiveType =
      mode === 'template'
        ? 'template'
        : getEffectiveMessageType(messageType, regularMessageType);
    const config = MESSAGE_TYPE_CONFIG[effectiveType] || MESSAGE_TYPE_CONFIG.text;

    return (
      <View style={[styles.typeBadge, { backgroundColor: config.color + '15' }]}>
        <Icon name={config.icon} size={12} color={config.color} />
        <Text style={[styles.typeBadgeText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  // Disabled state
  if (!enabled) {
    return (
      <View style={styles.previewDisabled}>
        <View style={[styles.previewDisabledIcon, disabledIconBg && { width: 56, height: 56, borderRadius: 14, backgroundColor: disabledIconBg }]}>
          <Icon name={disabledIcon} size={disabledIconBg ? 28 : 24} color={disabledIconColor} />
        </View>
        <Text style={styles.previewDisabledTitle}>{disabledTitle}</Text>
        <Text style={styles.previewDisabledHint}>{disabledHint}</Text>
      </View>
    );
  }

  // Empty state (for settings screens)
  if (
    mode === 'template' &&
    !messageType &&
    !message &&
    !templateName &&
    !templateData
  ) {
    return (
      <View style={styles.previewEmpty}>
        <View style={styles.previewEmptyIcon}>
          <Icon name="message-plus-outline" size={24} color={colors.grey[400]} />
        </View>
        <Text style={styles.previewEmptyTitle}>{emptyTitle}</Text>
        <Text style={styles.previewEmptyHint}>{emptyHint}</Text>
      </View>
    );
  }

  // Template mode
  if (mode === 'template') {
    const carouselCards = showCarousel ? getCarouselCards(templateData) : [];
    const limitedTimeOffer = showLTO ? getLimitedTimeOffer(templateData) : null;
    const outsideButtons =
      !buttonsInsideBubble ? getButtonsForOutsideRender(templateData) : [];

    return (
      <View style={[styles.previewContainer, style]}>
        {/* Type Badge */}
        {showTypeBadge && (
          <View style={styles.previewHeader}>{renderTypeBadge()}</View>
        )}

        {/* Chat Bubble */}
        <View style={styles.chatArea}>
          <View style={[styles.chatBubble, bubbleStyle]}>
            <TemplateContent
              templateData={templateData}
              templateName={templateName}
              bodyParams={bodyParams}
              headerParams={headerParams}
              headerFileUrl={headerFileUrl}
              showActualMedia={showActualMedia}
              buttonsInsideBubble={buttonsInsideBubble}
              preservePlaceholders={preservePlaceholders}
            />

            {/* Timestamp + Ticks */}
            <View style={styles.messageFooter}>
              <Text style={styles.timeText}>
                {new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Icon name="check-all" size={14} color={chatColors.tickBlue} />
            </View>
          </View>

          {/* Buttons outside bubble (TemplatesScreen style) */}
          {!buttonsInsideBubble && outsideButtons.length > 0 && (
            <View style={styles.buttonsBox}>
              {outsideButtons.map((btn, idx) => {
                const buttonType = btn.type?.toUpperCase();
                const buttonConfig =
                  BUTTON_CONFIG[buttonType] || BUTTON_CONFIG.QUICK_REPLY;
                // For COPY_CODE and OTP, show "Copy offer code" like web app
                const displayText = ['COPY_CODE', 'OTP'].includes(buttonType)
                  ? (btn.text || 'Copy offer code')
                  : btn.text;
                return (
                  <View key={idx} style={styles.buttonItem}>
                    <Icon
                      name={buttonConfig.icon}
                      size={16}
                      color={chatColors.linkColor}
                    />
                    <Text style={styles.buttonText}>{displayText}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Carousel Cards */}
          {showCarousel && carouselCards.length > 0 && (
            <CarouselPreview cards={carouselCards} />
          )}

          {/* Limited Time Offer */}
          {showLTO && limitedTimeOffer && (
            <View style={styles.limitedOfferBox}>
              <Icon name="clock-alert-outline" size={18} color="#F59E0B" />
              <Text style={styles.limitedOfferText}>
                Limited Time Offer Template
              </Text>
            </View>
          )}
        </View>

        {/* Template Not Found Hint */}
        {mode === 'template' && templateName && !templateData && (
          <View style={styles.templateNotFoundHint}>
            <Icon
              name="information-outline"
              size={14}
              color={colors.text.tertiary}
            />
            <Text style={styles.templateNotFoundText}>
              Template preview loading...
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Regular message mode
  return (
    <View style={[styles.previewContainer, style]}>
      {/* Type Badge */}
      {showTypeBadge && (
        <View style={styles.previewHeader}>{renderTypeBadge()}</View>
      )}

      {/* Chat Bubble */}
      <View style={styles.chatArea}>
        <View style={[styles.chatBubble, bubbleStyle]}>
          <RegularMessageContent
            type={regularMessageType}
            message={message}
            fileUrl={fileUrl}
            fileName={fileName}
            useNativeMediaControls={useNativeMediaControls}
          />

          {/* Timestamp + Ticks */}
          <View style={styles.messageFooter}>
            <Text style={styles.timeText}>
              {new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Icon name="check-all" size={14} color={chatColors.tickBlue} />
          </View>
        </View>
      </View>
    </View>
  );
};

export default MessagePreviewBubble;
