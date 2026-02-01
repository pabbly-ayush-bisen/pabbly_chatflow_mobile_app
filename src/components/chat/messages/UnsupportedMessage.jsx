import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

// Web app uses #FF5630 for unsupported message icon
const UNSUPPORTED_ICON_COLOR = '#FF5630';

/**
 * UnsupportedMessage Component
 * Renders unsupported message type indicator
 * Matches web app implementation (chat-message-item.jsx)
 */
const UnsupportedMessage = ({ message, isOutgoing }) => {
  // Check for file size error (from WhatsApp Business App)
  const isFileSizeErr = hasFileSizeError(message);

  // File size error display
  if (isFileSizeErr) {
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
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Icon name="alert-circle-outline" size={20} color={UNSUPPORTED_ICON_COLOR} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.messageText, isOutgoing && styles.messageTextOutgoing]}>
            {label} file exceeds size limit. Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  }

  // Regular unsupported message - matches web app exactly
  // Web app shows: "WhatsApp Cloud API does not support this message type. Try using a different format."
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="alert-circle-outline" size={20} color={UNSUPPORTED_ICON_COLOR} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.messageText, isOutgoing && styles.messageTextOutgoing]}>
          WhatsApp Cloud API does not support this message type. Try using a different format.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    minWidth: 200,
  },
  iconContainer: {
    marginRight: 8,
    flexShrink: 0,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.text.primary,
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  messageTextOutgoing: {
    color: colors.common.white,
  },
});

export default memo(UnsupportedMessage);
