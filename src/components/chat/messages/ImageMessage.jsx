import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, getMessageCaption, hasFileSizeError, getActualMediaType, getFileSizeLimit, isMediaDownloaded } from '../../../utils/messageHelpers';

/**
 * ImageMessage Component
 * Renders image messages with caption support and local download
 * Aligned with web app implementation (445x300px on web)
 */
const ImageMessage = ({ message, isOutgoing, onImagePress, onDownload, downloadState }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const remoteUrl = getMediaUrl(message);
  const caption = getMessageCaption(message);
  const hasCaption = Boolean(caption);

  const downloaded = isMediaDownloaded(message);
  const localPath = downloaded ? message._localMediaPath : (downloadState?.localPath || null);
  const isDownloading = downloadState?.status === 'downloading';
  const downloadProgress = downloadState?.progress || 0;

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

  // No URL available at all
  if (!remoteUrl && !localPath) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="image-off" size={40} color={colors.grey[400]} />
        <Text style={styles.errorText}>Image not available</Text>
      </View>
    );
  }

  // Not downloaded and not downloading: show blurry thumbnail with download button
  if (!downloaded && !isDownloading && !localPath) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.imageContainer,
            styles.downloadPlaceholder,
            hasCaption ? styles.imageWithCaption : styles.imageWithoutCaption,
          ]}
          onPress={() => onDownload?.(message)}
          activeOpacity={0.7}
        >
          {remoteUrl ? (
            <Image
              source={{ uri: remoteUrl }}
              style={styles.blurryPreview}
              resizeMode="cover"
              blurRadius={15}
            />
          ) : (
            <Icon name="image" size={40} color={colors.grey[400]} />
          )}
          <View style={styles.downloadIconCircle}>
            <Icon name="download" size={20} color={colors.common.white} />
          </View>
        </TouchableOpacity>
        {hasCaption && (
          <Text style={[styles.caption, isOutgoing && styles.outgoingCaption]}>{caption}</Text>
        )}
      </View>
    );
  }

  // Downloading: show blurry thumbnail with progress
  if (isDownloading) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.imageContainer,
            styles.downloadPlaceholder,
            hasCaption ? styles.imageWithCaption : styles.imageWithoutCaption,
          ]}
        >
          {remoteUrl ? (
            <Image
              source={{ uri: remoteUrl }}
              style={styles.blurryPreview}
              resizeMode="cover"
              blurRadius={15}
            />
          ) : (
            <Icon name="image" size={40} color={colors.grey[300]} />
          )}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{downloadProgress}%</Text>
          </View>
        </View>
        {hasCaption && (
          <Text style={[styles.caption, isOutgoing && styles.outgoingCaption]}>{caption}</Text>
        )}
      </View>
    );
  }

  // Downloaded or just-completed: show from local file
  const imageSource = localPath || remoteUrl;

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
        onPress={() => onImagePress?.(imageSource)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: imageSource }}
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
  // Download styles
  blurryPreview: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  downloadPlaceholder: {
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIconCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    color: colors.common.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default memo(ImageMessage);
