/**
 * TemplateContent - Renders template message content inside a WhatsApp-style chat bubble.
 *
 * Handles: template name badge, header (TEXT/IMAGE/VIDEO/DOCUMENT/LOCATION),
 * body text with parameter substitution, footer, and buttons.
 *
 * Supports two modes for media headers:
 * - showActualMedia=true (default): renders actual Image/Video/Document components
 * - showActualMedia=false: renders icon placeholders (lighter weight)
 *
 * Supports two modes for buttons:
 * - buttonsInsideBubble=true (default): buttons rendered inside the bubble
 * - buttonsInsideBubble=false: buttons rendered outside in separate containers
 */
import React, { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import styles from './messagePreviewStyles';
import {
  BUTTON_CONFIG,
  substituteBodyParams,
  substituteHeaderParams,
} from './messagePreviewUtils';

let VideoThumbnails;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (e) {
  // expo-video-thumbnails not available
}

// Video header with thumbnail extraction
const VideoHeader = ({ videoUrl }) => {
  const [thumbnail, setThumbnail] = useState(null);

  useEffect(() => {
    if (videoUrl && VideoThumbnails) {
      VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000 })
        .then((result) => setThumbnail(result.uri))
        .catch(() => setThumbnail(null));
    }
  }, [videoUrl]);

  return (
    <TouchableOpacity
      style={styles.templateHeaderVideo}
      onPress={() => videoUrl && Linking.openURL(videoUrl)}
      activeOpacity={0.9}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={styles.templateVideoThumbnail}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.templatePlayButtonOverlay}>
        <View style={styles.templatePlayButton}>
          <Icon name="play" size={24} color="#FFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const TemplateContent = ({
  templateData = null,
  templateName = '',
  bodyParams = {},
  headerParams = {},
  headerFileUrl = '',
  showActualMedia = true,
  buttonsInsideBubble = true,
  preservePlaceholders = false,
}) => {
  if (!templateData) {
    return null;
  }

  const components = templateData?.components || [];
  const headerComponent = components.find(
    (c) => c.type === 'HEADER' || c.type === 'header'
  );
  const bodyComponent = components.find(
    (c) => c.type === 'BODY' || c.type === 'body'
  );
  const footerComponent = components.find(
    (c) => c.type === 'FOOTER' || c.type === 'footer'
  );
  const buttonsComponent = components.find(
    (c) => c.type === 'BUTTONS' || c.type === 'buttons'
  );

  const headerType = headerComponent?.format?.toLowerCase();
  const headerMediaUrl =
    headerFileUrl || headerComponent?.example?.header_handle?.[0];

  // Body text — preserve raw {{1}}, {{2}} or substitute with values
  const bodyText = preservePlaceholders
    ? (bodyComponent?.text || '')
    : substituteBodyParams(
        bodyComponent?.text || '',
        bodyParams,
        bodyComponent?.example?.body_text?.[0] || []
      );

  // Header text — preserve raw {{1}} or substitute with values
  const headerText =
    headerComponent?.format === 'TEXT'
      ? (preservePlaceholders
          ? (headerComponent?.text || '')
          : substituteHeaderParams(headerComponent?.text || '', headerParams))
      : null;

  const footerText = footerComponent?.text || '';
  const buttons = buttonsComponent?.buttons || [];

  const renderHeader = () => {
    if (!headerComponent || !headerComponent.format) return null;

    // Placeholder mode matching inbox TemplateMessage style
    if (!showActualMedia && headerComponent.format.toUpperCase() !== 'TEXT') {
      const format = headerComponent.format.toUpperCase();

      // Image placeholder — matching inbox mediaPlaceholder style
      if (format === 'IMAGE') {
        return (
          <View style={styles.templateMediaPlaceholder}>
            <Icon name="image" size={32} color={colors.grey[400]} />
          </View>
        );
      }

      // Video placeholder — matching inbox video style with play overlay
      if (format === 'VIDEO') {
        return (
          <View style={styles.templateVideoPlaceholderContainer}>
            <View style={styles.templateVideoPlaceholderBg}>
              <Icon name="video" size={32} color={colors.grey[400]} />
            </View>
            <View style={styles.templateVideoPlayOverlay}>
              <View style={styles.templateVideoPlayBtn}>
                <Icon name="play" size={28} color="#FFF" />
              </View>
            </View>
          </View>
        );
      }

      // Location placeholder — matching inbox location style
      if (format === 'LOCATION') {
        return (
          <View style={styles.templateLocationPlaceholder}>
            <Icon name="map-marker" size={32} color={colors.error.main} />
          </View>
        );
      }

      // Document placeholder — matching inbox document row style
      if (format === 'DOCUMENT') {
        return (
          <View style={styles.templateDocPlaceholder}>
            <Icon name="file-document" size={24} color={chatColors.primary} />
            <Text style={styles.templateDocPlaceholderText}>Document</Text>
          </View>
        );
      }

      // Carousel / fallback
      return (
        <View style={styles.templateMediaPlaceholder}>
          <Icon
            name={format === 'CAROUSEL' ? 'view-carousel' : 'file-document-outline'}
            size={32}
            color={colors.grey[400]}
          />
        </View>
      );
    }

    // Actual media mode (InboxSettings/OptIn style)
    if (headerType === 'image' && headerMediaUrl) {
      return (
        <View style={styles.mediaWrapper}>
          <Image
            source={{ uri: headerMediaUrl }}
            style={styles.templateHeaderImage}
            resizeMode="cover"
          />
        </View>
      );
    }

    if (headerType === 'video' && headerMediaUrl) {
      return (
        <VideoHeader videoUrl={headerMediaUrl} />
      );
    }

    if (headerType === 'document' && headerMediaUrl) {
      return (
        <TouchableOpacity
          style={styles.templateHeaderDocument}
          onPress={() => headerMediaUrl && Linking.openURL(headerMediaUrl)}
          activeOpacity={0.7}
        >
          <View style={styles.templateDocIconBox}>
            <Icon name="file-document" size={24} color={chatColors.primary} />
          </View>
          <View style={styles.templateDocInfo}>
            <Text style={styles.templateDocName} numberOfLines={1}>
              Document
            </Text>
            <Text style={styles.templateDocType}>PDF/Document</Text>
          </View>
          <Icon name="download" size={18} color={colors.grey[400]} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderButtons = () => {
    if (buttons.length === 0) return null;

    if (buttonsInsideBubble) {
      return (
        <View style={styles.templateButtonsContainer}>
          {buttons.map((button, index) => {
            const buttonType = button.type?.toUpperCase();
            const buttonConfig = BUTTON_CONFIG[buttonType] || BUTTON_CONFIG.QUICK_REPLY;
            // For COPY_CODE and OTP, show "Copy offer code" like web app
            const displayText = ['COPY_CODE', 'OTP'].includes(buttonType)
              ? (button.text || 'Copy offer code')
              : button.text;

            return (
              <TouchableOpacity
                key={index}
                style={styles.templateButton}
                activeOpacity={0.7}
              >
                <Icon name={buttonConfig.icon} size={14} color={chatColors.primary} />
                <Text style={styles.templateButtonText} numberOfLines={1}>{displayText}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Outside bubble (TemplatesScreen style)
    return null; // Rendered by MessagePreviewBubble after the bubble
  };

  return (
    <>
      {/* Template Name Badge */}
      {templateName ? (
        <View style={styles.templateBadgeInBubble}>
          <Icon name="file-document-outline" size={12} color={colors.grey[500]} />
          <Text style={styles.templateBadgeText} numberOfLines={1}>Template: {templateName}</Text>
        </View>
      ) : null}

      {/* Header */}
      {renderHeader()}

      {/* Header Text */}
      {headerText ? (
        <View style={styles.templateHeaderTextContainer}>
          <Text style={styles.templateHeaderText}>{headerText}</Text>
        </View>
      ) : null}

      {/* Body Text */}
      {bodyText ? (
        <Text style={styles.templateBodyText}>{bodyText}</Text>
      ) : !showActualMedia ? (
        <Text style={[styles.templateBodyText, { color: colors.text.tertiary, fontStyle: 'italic' }]}>
          No message content
        </Text>
      ) : null}

      {/* Footer Text */}
      {footerText ? (
        <Text style={styles.templateFooterText}>{footerText}</Text>
      ) : null}

      {/* Buttons (inside bubble mode only) */}
      {buttonsInsideBubble ? renderButtons() : null}
    </>
  );
};

// Export a helper to get buttons for outside-bubble rendering
export const getButtonsForOutsideRender = (templateData) => {
  if (!templateData?.components) return [];
  const buttonsComponent = templateData.components.find(
    (c) => c.type === 'BUTTONS' || c.type === 'buttons'
  );
  return buttonsComponent?.buttons || [];
};

export default TemplateContent;
