import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, getMessageCaption, hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * ImageMessage Component
 * Renders image messages with caption support
 * Aligned with web app implementation (445x300px on web)
 */
const ImageMessage = ({ message, isOutgoing, onImagePress }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const imageUrl = getMediaUrl(message);
  const caption = getMessageCaption(message);
  const hasCaption = Boolean(caption);

  // Check for file size error from WhatsApp Business App
  const isFileSizeErr = hasFileSizeError(message);

  // Render file size error
  if (isFileSizeErr) {
    const actualType = getActualMediaType(message);
    const maxSize = getFileSizeLimit(actualType);

    return (
      <View style={styles.fileSizeErrorContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
        <View style={styles.fileSizeErrorContent}>
          <Text style={styles.fileSizeErrorTitle}>
            Image file exceeds size limit
          </Text>
          <Text style={styles.fileSizeErrorSubtitle}>
            Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (!imageUrl) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="image-off" size={40} color={colors.grey[400]} />
        <Text style={styles.errorText}>Image not available</Text>
      </View>
    );
  }

  if (imageError) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="image-off" size={40} color={colors.grey[400]} />
        <Text style={styles.errorText}>Failed to load image</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.imageContainer,
          hasCaption ? styles.imageWithCaption : styles.imageWithoutCaption,
        ]}
        onPress={() => onImagePress?.(imageUrl)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
        {imageLoading && (
          <View style={styles.loadingOverlay}>
            <Icon name="image" size={40} color={colors.grey[400]} />
          </View>
        )}
      </TouchableOpacity>

      {hasCaption && (
        <Text
          style={[
            styles.caption,
            isOutgoing && styles.outgoingCaption,
          ]}
        >
          {caption}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 260,
  },
  imageContainer: {
    width: 240,
    height: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  imageWithCaption: {
    borderRadius: 4,
  },
  imageWithoutCaption: {
    borderRadius: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  caption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  outgoingCaption: {
    color: colors.common.white,
  },
  errorContainer: {
    width: 200,
    height: 150,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.text.secondary,
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

export default memo(ImageMessage);
