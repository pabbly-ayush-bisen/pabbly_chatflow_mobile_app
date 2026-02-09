import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, getMessageCaption, hasFileSizeError, getActualMediaType, getFileSizeLimit, isMediaDownloaded } from '../../../utils/messageHelpers';
import { openLocalFile } from '../../../services/mediaDownloadService';

/**
 * VideoMessage Component
 * Renders video messages with thumbnail, play button, caption, and local download
 * Aligned with web app implementation
 */
const VideoMessage = ({ message, isOutgoing, onVideoPress, onDownload, downloadState }) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  const remoteUrl = getMediaUrl(message);
  const caption = getMessageCaption(message);
  const hasCaption = Boolean(caption);

  const downloaded = isMediaDownloaded(message);
  const localPath = downloaded ? message._localMediaPath : (downloadState?.localPath || null);
  const isDownloading = downloadState?.status === 'downloading';
  const downloadProgress = downloadState?.progress || 0;

  // Check for file size error
  const isFileSizeErr = hasFileSizeError(message);

  // Get thumbnail: prefer local generated thumbnail, then backend thumbnail
  const localThumbnail = message?._localThumbnailPath || downloadState?.thumbnailPath || null;
  const thumbnailUrl = localThumbnail || message?.message?.thumbnail || message?.thumbnail || null;

  // Render file size error
  if (isFileSizeErr) {
    const actualType = getActualMediaType(message);
    const maxSize = getFileSizeLimit(actualType);

    return (
      <View style={styles.fileSizeErrorContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
        <View style={styles.fileSizeErrorContent}>
          <Text style={styles.fileSizeErrorTitle}>
            Video file exceeds size limit
          </Text>
          <Text style={styles.fileSizeErrorSubtitle}>
            Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  }

  // No URL available
  if (!remoteUrl && !localPath) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="video-off" size={40} color={colors.grey[400]} />
        <Text style={styles.errorText}>Video not available</Text>
      </View>
    );
  }

  // Handle video press - open from local or remote
  const handleVideoPress = () => {
    const source = localPath || remoteUrl;
    if (onVideoPress) {
      onVideoPress(source);
    } else if (source) {
      openLocalFile(source, message?.message?.mime_type || message?.message?.video?.mime_type || 'video/*');
    }
  };

  // Not downloaded: show thumbnail preview (if available) with download button
  // NOTE: Only use thumbnailUrl for Image — remoteUrl is a video file (.mp4) that Image cannot render
  if (!downloaded && !isDownloading && !localPath) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.videoContainer,
            styles.downloadPlaceholder,
            hasCaption ? styles.videoWithCaption : styles.videoWithoutCaption,
          ]}
          onPress={() => onDownload?.(message)}
          activeOpacity={0.7}
        >
          {thumbnailUrl && !thumbnailError ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.blurryPreview}
              resizeMode="cover"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <Icon name="video" size={40} color={colors.grey[400]} />
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

  // Downloading: show thumbnail preview (if available) with progress
  if (isDownloading) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.videoContainer,
            styles.downloadPlaceholder,
            hasCaption ? styles.videoWithCaption : styles.videoWithoutCaption,
          ]}
        >
          {thumbnailUrl && !thumbnailError ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.blurryPreview}
              resizeMode="cover"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <Icon name="video" size={40} color={colors.grey[300]} />
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

  // Downloaded: show with play button
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.videoContainer,
          hasCaption ? styles.videoWithCaption : styles.videoWithoutCaption,
        ]}
        onPress={handleVideoPress}
        activeOpacity={0.9}
      >
        {/* Video thumbnail or placeholder */}
        {thumbnailUrl && !thumbnailError ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => setThumbnailError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="video" size={40} color={colors.grey[400]} />
          </View>
        )}

        {/* Play button overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Icon name="play" size={32} color={colors.common.white} />
          </View>
        </View>

        {/* Duration badge if available */}
        {message?.message?.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(message.message.duration)}
            </Text>
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

/**
 * Format duration in seconds to mm:ss
 */
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 260,
  },
  videoContainer: {
    width: 240,
    height: 160,
    overflow: 'hidden',
    position: 'relative',
  },
  videoWithCaption: {
    borderRadius: 4,
  },
  videoWithoutCaption: {
    borderRadius: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // Offset play icon for visual center
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    color: colors.common.white,
    fontWeight: '500',
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
    height: 120,
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

export default memo(VideoMessage);
