import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData, getMediaUrl } from '../../../../utils/messageHelpers';

/**
 * ButtonMessage Component
 * Renders interactive button messages (text buttons, CTA URL, media buttons)
 * Aligned with web app TextButtonsPreview and MediaButtonsPreview components
 */
const ButtonMessage = ({ message, isOutgoing, onImagePress, hasMediaHeader, mediaType }) => {
  const [imageError, setImageError] = useState(false);

  const interactiveData = getInteractiveData(message);
  const { body, buttons, header, footer } = interactiveData;
  const mediaUrl = getMediaUrl(message) || message?.message?.header?.[mediaType]?.link;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Handle button press
  const handleButtonPress = (button) => {
    if (button.type === 'reply' || button.type === 'QUICK_REPLY') {
      // Quick reply - typically handled by parent
      return;
    }
    if (button.type === 'url' || button.type === 'URL') {
      const url = button.url || button.action?.url;
      if (url) Linking.openURL(url);
    }
    if (button.type === 'phone_number' || button.type === 'PHONE_NUMBER') {
      const phone = button.phone_number || button.action?.phone_number;
      if (phone) Linking.openURL(`tel:${phone}`);
    }
  };

  // Render media header
  const renderMediaHeader = () => {
    if (!hasMediaHeader || !mediaUrl) return null;

    if (mediaType === 'image') {
      if (imageError) {
        return (
          <View style={styles.mediaPlaceholder}>
            <Icon name="image-off" size={32} color={colors.grey[400]} />
          </View>
        );
      }
      return (
        <TouchableOpacity
          onPress={() => onImagePress?.(mediaUrl)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: mediaUrl }}
            style={styles.mediaImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </TouchableOpacity>
      );
    }

    if (mediaType === 'video') {
      return (
        <TouchableOpacity
          style={styles.mediaVideo}
          onPress={() => Linking.openURL(mediaUrl)}
          activeOpacity={0.9}
        >
          <View style={styles.videoPlaceholder}>
            <Icon name="video" size={32} color={colors.grey[400]} />
          </View>
          <View style={styles.playOverlay}>
            <Icon name="play-circle" size={40} color={colors.common.white} />
          </View>
        </TouchableOpacity>
      );
    }

    if (mediaType === 'audio') {
      return (
        <TouchableOpacity
          style={styles.mediaAudio}
          onPress={() => Linking.openURL(mediaUrl)}
          activeOpacity={0.7}
        >
          <Icon name="music-circle" size={32} color={chatColors.primary} />
          <Text style={styles.audioText}>Audio message</Text>
        </TouchableOpacity>
      );
    }

    if (mediaType === 'document') {
      return (
        <TouchableOpacity
          style={styles.mediaDocument}
          onPress={() => Linking.openURL(mediaUrl)}
          activeOpacity={0.7}
        >
          <Icon name="file-document" size={24} color={chatColors.primary} />
          <Text style={styles.documentText}>View Document</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  // Get button icon based on type
  const getButtonIcon = (button) => {
    if (button.type === 'url' || button.type === 'URL' || button.type === 'cta_url') {
      return 'open-in-new';
    }
    if (button.type === 'phone_number' || button.type === 'PHONE_NUMBER') {
      return 'phone';
    }
    if (button.type === 'copy_code' || button.type === 'COPY_CODE') {
      return 'content-copy';
    }
    return 'reply';
  };

  return (
    <View style={styles.container}>
      {/* Media header */}
      {renderMediaHeader()}

      {/* Text header */}
      {header?.text && !hasMediaHeader && (
        <Text style={[styles.headerText, isOutgoing && styles.headerTextOutgoing]}>
          {header.text}
        </Text>
      )}

      {/* Body text */}
      {bodyText && (
        <Text style={[styles.bodyText, isOutgoing && styles.bodyTextOutgoing]}>
          {bodyText}
        </Text>
      )}

      {/* Footer */}
      {footer && (
        <Text style={[styles.footerText, isOutgoing && styles.footerTextOutgoing]}>
          {footer}
        </Text>
      )}

      {/* Buttons */}
      {buttons.length > 0 && (
        <View style={styles.buttonsContainer}>
          {buttons.map((button, index) => {
            const buttonTitle = button.reply?.title || button.title || button.text || `Button ${index + 1}`;
            const buttonIcon = getButtonIcon(button);

            return (
              <TouchableOpacity
                key={index}
                style={styles.button}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Icon name={buttonIcon} size={16} color={chatColors.primary} />
                <Text style={styles.buttonText} numberOfLines={1}>
                  {buttonTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  headerTextOutgoing: {
    color: colors.text.primary,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bodyTextOutgoing: {
    color: colors.text.primary,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 6,
  },
  footerTextOutgoing: {
    color: colors.text.secondary,
  },
  buttonsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 4,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  mediaImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  mediaVideo: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
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
  mediaAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  audioText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  mediaDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  documentText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
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
});

export default memo(ButtonMessage);
