import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking, Clipboard } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { colors, chatColors } from '../../../theme/colors';
import { getTemplateData, getMediaUrl } from '../../../utils/messageHelpers';

// Ported from web app template-preview-card.jsx — parses GMT offset from timezone string
function getTimezoneUnixMs(timezoneString) {
  const match = timezoneString?.match(/\(GMT([+-])(\d{2}):(\d{2})\)/);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  return (parseInt(hours, 10) * 3600000 + parseInt(minutes, 10) * 60000) * (sign === '-' ? -1 : 1);
}

// Ported from web app template-preview-card.jsx — converts LTO expiration to human-readable countdown
function convertFromNowToDHMS(unixMs, date, time, timeZone) {
  const now = Date.now();
  const offset = timeZone ? getTimezoneUnixMs(timeZone) : 0;
  const adjusted = unixMs - offset;
  const diff = adjusted - now;

  if (diff < 0) return { time: 'Offer ended', isUnder24Hours: false };

  const target = new Date(adjusted);
  const nowDate = new Date(now);

  if (nowDate.toDateString() === target.toDateString()) {
    const h = target.getHours();
    const m = target.getMinutes();
    return {
      time: `Today at ${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`,
      isUnder24Hours: true,
    };
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  if (days === 0) return { time: `${hours} hours ${mins} mins`, isUnder24Hours: true };
  return { time: `${days || 1} days`, isUnder24Hours: false };
}

// Button icon mapping for all template button types (matching web app and BUTTON_CONFIG)
const BUTTON_ICON_MAP = {
  URL: 'open-in-new',
  PHONE_NUMBER: 'phone',
  QUICK_REPLY: 'reply',
  COPY_CODE: 'content-copy',
  FLOW: 'sitemap',
  CATALOG: 'shopping',
  MPM: 'package-variant',
  SPM: 'package',
  VOICE_CALL: 'phone-outgoing',
  OTP: 'shield-key',
};

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

  const { templateName, type, bodyParams: rawBodyParams, headerParams: rawHeaderParams, link,
    components: templateDataComponents, ltoFields, copyCodeParam } = templateData;

  // Convert params to arrays if they are objects (web app does Object.values() in TemplatePreviewcard)
  // Server sends params as objects like { "1": "John", "2": "Order123" }, not arrays
  const bodyParams = Array.isArray(rawBodyParams) ? rawBodyParams
    : (rawBodyParams && typeof rawBodyParams === 'object' ? Object.values(rawBodyParams) : []);
  const headerParams = Array.isArray(rawHeaderParams) ? rawHeaderParams
    : (rawHeaderParams && typeof rawHeaderParams === 'object' ? Object.values(rawHeaderParams) : []);

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
    let headerType = type?.toLowerCase() || headerComponent?.format?.toLowerCase();
    // For LTO templates, the type is 'lto' but the actual header media is in components[0].format
    if (headerType === 'lto' && headerComponent?.format) {
      headerType = headerComponent.format.toLowerCase();
    }
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

  // Render LTO (Limited-Time Offer) section — matching web app template-preview-card.jsx case 'LTO'
  const renderLtoSection = () => {
    const ltoComponent = components.find(c => c.limited_time_offer) || components[1];
    const offerText = ltoComponent?.limited_time_offer?.text || '';
    const hasExpiration = ltoComponent?.limited_time_offer?.has_expiration;

    // Get copy code from buttons or from copyCodeParam
    const copyCode = buttonsComponent?.buttons?.find(
      b => b.type?.toUpperCase() === 'COPY_CODE'
    )?.code || copyCodeParam;

    // Calculate countdown
    let countdown = null;
    if (hasExpiration && ltoFields?.unixTimestamp) {
      countdown = convertFromNowToDHMS(
        ltoFields.unixTimestamp, ltoFields.date, ltoFields.time, ltoFields.timeZone
      );
    }

    return (
      <View style={styles.ltoSection}>
        <View style={styles.ltoRow}>
          <View style={styles.ltoGiftCircle}>
            <Icon name="gift" size={22} color="#7D6ADB" />
          </View>
          <View style={styles.ltoTextContainer}>
            {offerText ? (
              <Text style={styles.ltoOfferText}>{offerText}</Text>
            ) : null}
            {countdown && (
              <Text style={[
                styles.ltoCountdown,
                countdown.isUnder24Hours && styles.ltoCountdownUrgent,
              ]}>
                Expires In: {countdown.time}
              </Text>
            )}
            {copyCode ? (
              <Text style={styles.ltoCopyCode}>Code: {copyCode}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  // Render buttons - handles all button types matching web app implementation
  const renderButtons = () => {
    const buttons = buttonsComponent?.buttons || [];
    if (buttons.length === 0) return null;

    const isLto = type?.toLowerCase() === 'lto';

    return (
      <View style={styles.buttonsContainer}>
        {buttons.map((button, index) => {
          const buttonType = button.type?.toUpperCase();
          const iconName = BUTTON_ICON_MAP[buttonType] || 'reply';

          return (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => {
                if (buttonType === 'URL' && button.url) {
                  Linking.openURL(button.url);
                } else if (buttonType === 'PHONE_NUMBER' && button.phone_number) {
                  Linking.openURL(`tel:${button.phone_number}`);
                } else if (buttonType === 'COPY_CODE') {
                  const code = button.code || copyCodeParam || button.text;
                  if (code) Clipboard.setString(code);
                }
              }}
              activeOpacity={0.7}
            >
              <Icon name={iconName} size={16} color={chatColors.primary} style={styles.buttonIcon} />
              <Text style={styles.buttonText} numberOfLines={1}>
                {(buttonType === 'COPY_CODE' && isLto) ? 'Copy offer code' : button.text}
              </Text>
            </TouchableOpacity>
          );
        })}
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
        <Text style={styles.templateBadgeText} numberOfLines={1}>
          Template: {templateName}
        </Text>
      </View>

      {/* Header */}
      {renderHeader()}

      {/* LTO offer section — only for LTO templates */}
      {type?.toLowerCase() === 'lto' && renderLtoSection()}

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
    width: '100%',
    minWidth: 200,
    maxWidth: 280,
    overflow: 'hidden',
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
    width: '100%',
  },
  templateBadgeText: {
    fontSize: 11,
    color: colors.grey[500],
    fontStyle: 'italic',
    flex: 1,
    flexShrink: 1,
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
    width: '100%',
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
    width: '100%',
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center',
  },
  // LTO (Limited-Time Offer) styles
  ltoSection: {
    marginBottom: 8,
  },
  ltoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ltoGiftCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(142, 51, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ltoTextContainer: {
    flex: 1,
  },
  ltoOfferText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  ltoCountdown: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  ltoCountdownUrgent: {
    color: colors.error.main,
  },
  ltoCopyCode: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
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
