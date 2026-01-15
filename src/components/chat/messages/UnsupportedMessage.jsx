import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * UnsupportedMessage Component
 * Renders unsupported message type indicator
 * Aligned with web app unsupported message handling
 */
const UnsupportedMessage = ({ message, isOutgoing }) => {
  // Check for file size error
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
  }

  // Parse error details if available
  let errorDetails = 'Message type is currently not supported by WhatsApp Cloud API.';

  try {
    const bodyText = message?.message?.body;
    if (typeof bodyText === 'string' && bodyText.trim().startsWith('{')) {
      const parsedBody = JSON.parse(bodyText);
      if (parsedBody?.errors?.[0]?.title === 'Message type unknown') {
        errorDetails = 'This message type is not supported';
      } else if (parsedBody?.errors?.[0]?.error_data?.details) {
        errorDetails = parsedBody.errors[0].error_data.details;
      } else if (parsedBody?.errors?.[0]?.message) {
        errorDetails = parsedBody.errors[0].message;
      }
    } else if (bodyText && typeof bodyText === 'string') {
      errorDetails = bodyText;
    }
  } catch (e) {
    // Keep default error message
    const waError =
      message?.waResponse?.errors?.[0]?.error_data?.details ||
      message?.waResponse?.errors?.[0]?.message;
    if (waError) {
      errorDetails = waError;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, isOutgoing && styles.titleOutgoing]}>
          Unsupported Message
        </Text>
        <Text
          style={[styles.description, isOutgoing && styles.descriptionOutgoing]}
          numberOfLines={3}
        >
          {errorDetails}
        </Text>
        <Text style={[styles.hint, isOutgoing && styles.hintOutgoing]}>
          Try using a different format.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    maxWidth: 280,
    gap: 10,
  },
  iconContainer: {
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning.dark,
    marginBottom: 4,
  },
  titleOutgoing: {
    color: colors.common.white,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  descriptionOutgoing: {
    color: 'rgba(255,255,255,0.8)',
  },
  hint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  hintOutgoing: {
    color: 'rgba(255,255,255,0.6)',
  },
  fileSizeErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.warning.lighter,
    borderRadius: 8,
    gap: 12,
  },
  fileSizeErrorContent: {
    flex: 1,
  },
  fileSizeErrorTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.warning.dark,
  },
  fileSizeErrorSubtitle: {
    fontSize: 12,
    color: colors.warning.main,
    marginTop: 2,
  },
});

export default memo(UnsupportedMessage);
