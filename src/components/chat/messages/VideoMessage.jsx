import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, getMessageCaption, hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * VideoMessage Component
 * Renders video messages with thumbnail, play button, and caption
 * Aligned with web app implementation
 */
const VideoMessage = ({ message, isOutgoing, onVideoPress }) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  const videoUrl = getMediaUrl(message);
  const caption = getMessageCaption(message);
  const hasCaption = Boolean(caption);

  // Check for file size error
  const isFileSizeErr = hasFileSizeError(message);

  // Get thumbnail URL if available
  const thumbnailUrl = message?.message?.thumbnail || message?.thumbnail || null;

  // Handle video press - open in external player
  const handleVideoPress = () => {
    if (onVideoPress) {
      onVideoPress(videoUrl);
    } else if (videoUrl) {
      Linking.openURL(videoUrl);
    }
  };

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

  // Render error state
  if (!videoUrl) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="video-off" size={40} color={colors.grey[400]} />
        <Text style={styles.errorText}>Video not available</Text>
      </View>
    );
  }

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
});

export default memo(VideoMessage);
