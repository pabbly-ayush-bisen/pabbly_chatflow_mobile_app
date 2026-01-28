import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { colors, chatColors } from '../../../theme/colors';
import { getTemplateData, getMediaUrl } from '../../../utils/messageHelpers';

/**
 * TemplateMessage Component
 * Renders WhatsApp template messages with header, body, footer, and buttons
 * Aligned with web app TemplatePreviewcard component
 *
 * Supported template types:
 * - text: Text-only template
 * - image: Template with image header
 * - video: Template with video header
 * - document: Template with document header
 * - location: Template with location header
 * - carousel: Multi-card carousel template
 * - lto: Limited-time offer template
 * - catalog: Catalog template
 */
const TemplateMessage = ({ message, isOutgoing, onImagePress }) => {
  const [imageError, setImageError] = useState(false);
  const [videoThumbnailError, setVideoThumbnailError] = useState(false);

  // Get templates from Redux store to look up full template data
  const { templates } = useSelector((state) => state.template);

  const templateData = getTemplateData(message);
  const mediaUrl = getMediaUrl(message);

  // Render error state
  if (!templateData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="file-document-alert-outline" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Template not available</Text>
      </View>
    );
  }

  const { templateName, type, bodyParams, headerParams, link, components: templateDataComponents } = templateData;

  // Get template components from raw message data first, then from templateData, then from Redux
  let components = message?.message?.template?.components || templateDataComponents || [];

  // If components are not in the message, look up from Redux store using templateName or templateId
  if (components.length === 0 && templates && templates.length > 0) {
    const templateId = message?.message?.template?.templateId || message?.message?.templateId;
    const fullTemplate = templates.find(
      (t) => t._id === templateId || t.name === templateName || t.templateName === templateName
    );
    if (fullTemplate?.components) {
      components = fullTemplate.components;
    }
  }
  const headerComponent = components.find(c => c.type === 'HEADER');
  const bodyComponent = components.find(c => c.type === 'BODY');
  const footerComponent = components.find(c => c.type === 'FOOTER');
  const buttonsComponent = components.find(c => c.type === 'BUTTONS');

  // Get body text with parameter substitution
  const getBodyText = () => {
    let text = bodyComponent?.text || '';
    if (bodyParams && bodyParams.length > 0) {
      bodyParams.forEach((param, index) => {
        text = text.replace(`{{${index + 1}}}`, param);
      });
    }
    return text;
  };

  // Get header text with parameter substitution
  const getHeaderText = () => {
    if (headerComponent?.format === 'TEXT') {
      let text = headerComponent?.text || '';
      if (headerParams && headerParams.length > 0) {
        headerParams.forEach((param, index) => {
          text = text.replace(`{{${index + 1}}}`, param);
        });
      }
      return text;
    }
    return null;
  };

  // Render header based on type
  const renderHeader = () => {
    const headerType = type?.toLowerCase() || headerComponent?.format?.toLowerCase();
    const headerText = getHeaderText();

    if (headerText) {
      return (
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerText, isOutgoing && styles.headerTextOutgoing]}>
            {headerText}
          </Text>
        </View>
      );
    }

    if (headerType === 'image' && (mediaUrl || link)) {
      const imageSource = mediaUrl || link;
      if (imageError) {
        return (
          <View style={styles.mediaPlaceholder}>
            <Icon name="image-off" size={32} color={colors.grey[400]} />
          </View>
        );
      }
      return (
        <TouchableOpacity
          onPress={() => onImagePress?.(imageSource)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: imageSource }}
            style={styles.headerImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </TouchableOpacity>
      );
    }

    if (headerType === 'video' && (mediaUrl || link)) {
      const videoSource = mediaUrl || link;
      // Get video thumbnail URL - check multiple possible locations
      const videoThumbnailUrl =
        message?.message?.thumbnail ||
        message?.thumbnail ||
        message?.message?.template?.thumbnail ||
        null;

      return (
        <TouchableOpacity
          style={styles.headerVideo}
          onPress={() => Linking.openURL(videoSource)}
          activeOpacity={0.9}
        >
          {/* Video thumbnail or placeholder */}
          {videoThumbnailUrl && !videoThumbnailError ? (
            <Image
              source={{ uri: videoThumbnailUrl }}
              style={styles.videoThumbnail}
              resizeMode="cover"
              onError={() => setVideoThumbnailError(true)}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Icon name="video" size={32} color={colors.grey[400]} />
            </View>
          )}
          {/* Play button overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Icon name="play" size={28} color={colors.common.white} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (headerType === 'document' && (mediaUrl || link)) {
      const docSource = mediaUrl || link;
      return (
        <TouchableOpacity
          style={styles.headerDocument}
          onPress={() => Linking.openURL(docSource)}
          activeOpacity={0.7}
        >
          <Icon name="file-document" size={24} color={chatColors.primary} />
          <Text style={styles.headerDocText}>View Document</Text>
        </TouchableOpacity>
      );
    }

    if (headerType === 'location') {
      const locationData = message?.message?.location || {};
      return (
        <TouchableOpacity
          style={styles.headerLocation}
          onPress={() => {
            if (locationData.latitude && locationData.longitude) {
              Linking.openURL(`https://maps.google.com/?q=${locationData.latitude},${locationData.longitude}`);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.locationMapPlaceholder}>
            <Icon name="map-marker" size={32} color={colors.error.main} />
          </View>
          {locationData.name && (
            <Text style={styles.locationName} numberOfLines={1}>{locationData.name}</Text>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  };

  // Render buttons
  const renderButtons = () => {
    const buttons = buttonsComponent?.buttons || [];
    if (buttons.length === 0) return null;

    return (
      <View style={styles.buttonsContainer}>
        {buttons.map((button, index) => (
          <TouchableOpacity
            key={index}
            style={styles.button}
            onPress={() => {
              if (button.type === 'URL' && button.url) {
                Linking.openURL(button.url);
              } else if (button.type === 'PHONE_NUMBER' && button.phone_number) {
                Linking.openURL(`tel:${button.phone_number}`);
              }
            }}
            activeOpacity={0.7}
          >
            {button.type === 'URL' && (
              <Icon name="open-in-new" size={16} color={chatColors.primary} style={styles.buttonIcon} />
            )}
            {button.type === 'PHONE_NUMBER' && (
              <Icon name="phone" size={16} color={chatColors.primary} style={styles.buttonIcon} />
            )}
            {button.type === 'QUICK_REPLY' && (
              <Icon name="reply" size={16} color={chatColors.primary} style={styles.buttonIcon} />
            )}
            {button.type === 'COPY_CODE' && (
              <Icon name="content-copy" size={16} color={chatColors.primary} style={styles.buttonIcon} />
            )}
            <Text style={styles.buttonText}>{button.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const bodyText = getBodyText();
  const footerText = footerComponent?.text || '';

  return (
    <View style={styles.container}>
      {/* Template indicator */}
      <View style={styles.templateBadge}>
        <Icon
          name="file-document-outline"
          size={12}
          color={colors.grey[500]}
        />
        <Text style={styles.templateBadgeText}>
          Template: {templateName}
        </Text>
      </View>

      {/* Header */}
      {renderHeader()}

      {/* Body */}
      {bodyText && (
        <Text style={styles.bodyText}>
          {bodyText}
        </Text>
      )}

      {/* Footer */}
      {footerText && (
        <Text style={styles.footerText}>
          {footerText}
        </Text>
      )}

      {/* Buttons */}
      {renderButtons()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    maxWidth: 280,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  templateBadgeText: {
    fontSize: 11,
    color: colors.grey[500],
    fontStyle: 'italic',
  },
  headerTextContainer: {
    marginBottom: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerVideo: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
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
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  headerDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  headerDocText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
  },
  headerLocation: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  locationMapPlaceholder: {
    height: 80,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 13,
    color: colors.text.primary,
    padding: 8,
    backgroundColor: colors.common.white,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  buttonsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 4,
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});

export default memo(TemplateMessage);
