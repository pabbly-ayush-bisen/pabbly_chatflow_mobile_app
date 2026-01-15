import React, { memo, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * AudioMessage Component
 * Renders audio/voice messages with waveform visualization
 * Aligned with web app AudioPlayer component
 */
const AudioMessage = ({ message, isOutgoing }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioUrl = getMediaUrl(message);
  const duration = message?.message?.duration || 0;

  // Check for file size error
  const isFileSizeErr = hasFileSizeError(message);

  // Generate random waveform bars (static visualization)
  const waveformBars = React.useMemo(() => {
    return Array.from({ length: 25 }, () => Math.random() * 0.8 + 0.2);
  }, []);

  // Handle play/pause
  const handlePlayPause = () => {
    if (audioUrl) {
      // For now, open in external player
      // Full audio playback implementation would use expo-av
      Linking.openURL(audioUrl);
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
            Audio file exceeds size limit
          </Text>
          <Text style={styles.fileSizeErrorSubtitle}>
            Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (!audioUrl) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="microphone-off" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Audio not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isOutgoing && styles.containerOutgoing]}>
      {/* Play/Pause button */}
      <TouchableOpacity
        style={[styles.playButton, isOutgoing && styles.playButtonOutgoing]}
        onPress={handlePlayPause}
        activeOpacity={0.7}
      >
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          size={24}
          color={isOutgoing ? chatColors.primary : colors.common.white}
        />
      </TouchableOpacity>

      {/* Waveform visualization */}
      <View style={styles.waveformContainer}>
        {waveformBars.map((height, index) => (
          <View
            key={index}
            style={[
              styles.waveformBar,
              {
                height: height * 24,
                backgroundColor: index / waveformBars.length <= progress
                  ? (isOutgoing ? 'rgba(255,255,255,0.9)' : chatColors.primary)
                  : (isOutgoing ? 'rgba(255,255,255,0.4)' : colors.grey[300]),
              },
            ]}
          />
        ))}
      </View>

      {/* Duration */}
      <Text style={[styles.duration, isOutgoing && styles.durationOutgoing]}>
        {formatDuration(duration)}
      </Text>
    </View>
  );
};

/**
 * Format duration in seconds to mm:ss
 */
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 220,
    paddingVertical: 4,
  },
  containerOutgoing: {},
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playButtonOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    marginRight: 8,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
  duration: {
    fontSize: 12,
    color: colors.text.secondary,
    minWidth: 36,
    textAlign: 'right',
  },
  durationOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
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

export default memo(AudioMessage);
