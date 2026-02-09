import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, hasFileSizeError, getActualMediaType, getFileSizeLimit, isMediaDownloaded } from '../../../utils/messageHelpers';

/**
 * AudioMessage Component
 * Renders audio/voice messages with inline playback and waveform visualization
 * Uses expo-av for audio playback within the message bubble
 * Supports local-first playback from downloaded files
 */
const AudioMessage = ({ message, isOutgoing, onDownload, downloadState }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasFinished, setHasFinished] = useState(false);

  const soundRef = useRef(null);
  const isMountedRef = useRef(true);

  const remoteUrl = getMediaUrl(message);
  const downloaded = isMediaDownloaded(message);
  const localPath = downloaded ? message._localMediaPath : (downloadState?.localPath || null);
  const isDownloading = downloadState?.status === 'downloading';
  const downloadProgress = downloadState?.progress || 0;

  // The URL to use for playback: prefer local file
  const audioSource = localPath || remoteUrl;

  // Get duration from message if available
  const messageDuration = message?.message?.duration ||
                          message?.message?.audio?.duration ||
                          message?.duration || 0;

  // Check for file size error
  const isFileSizeErr = hasFileSizeError(message);

  // Generate random waveform bars (static visualization)
  const waveformBars = React.useMemo(() => {
    return Array.from({ length: 25 }, () => Math.random() * 0.8 + 0.2);
  }, []);

  // Initialize audio mode
  const initAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      // Silent fail
    }
  }, []);

  // Playback status update callback
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!isMountedRef.current) return;

    if (status.isLoaded) {
      if (status.durationMillis > 0) {
        const currentPosition = status.positionMillis / 1000;
        const totalDuration = status.durationMillis / 1000;
        setPosition(currentPosition);
        setDuration(totalDuration);
        setProgress(status.positionMillis / status.durationMillis);
      }

      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setProgress(0);
        setPosition(0);
        setHasFinished(true);
      }
    }
  }, []);

  // Load and play audio
  const loadAndPlayAudio = useCallback(async () => {
    if (!audioSource || isLoading) return;

    setIsLoading(true);

    try {
      await initAudioMode();

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioSource },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      if (!isMountedRef.current) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;

      if (status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }

      setIsPlaying(true);
    } catch (error) {
      // Audio loading failed
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [audioSource, isLoading, initAudioMode, onPlaybackStatusUpdate]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(async () => {
    if (isLoading) return;

    // If not downloaded yet, trigger download instead of play
    if (!downloaded && !localPath) {
      onDownload?.(message);
      return;
    }

    if (!soundRef.current) {
      setHasFinished(false);
      await loadAndPlayAudio();
    } else {
      try {
        const status = await soundRef.current.getStatusAsync();

        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
          } else {
            const isAtEnd = hasFinished ||
                           status.didJustFinish ||
                           (status.durationMillis > 0 && status.positionMillis >= status.durationMillis - 100);

            if (isAtEnd) {
              await soundRef.current.setPositionAsync(0);
              setProgress(0);
              setPosition(0);
            }

            setHasFinished(false);
            await soundRef.current.playAsync();
          }
        } else {
          setHasFinished(false);
          await loadAndPlayAudio();
        }
      } catch (error) {
        setHasFinished(false);
        await loadAndPlayAudio();
      }
    }
  }, [isLoading, loadAndPlayAudio, hasFinished, downloaded, localPath, onDownload, message]);

  // Pre-load audio metadata to get duration without playing
  // Only when we have a local file or the audio is already downloaded
  const loadAudioMetadata = useCallback(async () => {
    if (!audioSource || messageDuration > 0) return;
    // Only pre-load metadata if we have a local file
    if (!downloaded && !localPath) return;

    try {
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioSource },
        { shouldPlay: false }
      );

      if (!isMountedRef.current) {
        await sound.unloadAsync();
        return;
      }

      if (status.isLoaded && status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }

      await sound.unloadAsync();
    } catch (error) {
      // Silent fail
    }
  }, [audioSource, messageDuration, downloaded, localPath]);

  // Load metadata on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (audioSource && messageDuration === 0 && (downloaded || localPath)) {
      loadAudioMetadata();
    }

    return () => {
      isMountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [audioSource, messageDuration, loadAudioMetadata, downloaded, localPath]);

  const displayDuration = duration > 0 ? duration : messageDuration;

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
  if (!remoteUrl && !localPath) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="microphone-off" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Audio not available</Text>
      </View>
    );
  }

  // Determine button icon and state
  const needsDownload = !downloaded && !localPath && !isDownloading;
  const buttonIcon = isDownloading ? null : (needsDownload ? 'download' : (isPlaying ? 'pause' : 'play'));

  return (
    <View style={[styles.container, isOutgoing && styles.containerOutgoing]}>
      {/* Play/Pause/Download button */}
      <TouchableOpacity
        style={[styles.playButton, isOutgoing && styles.playButtonOutgoing]}
        onPress={handlePlayPause}
        activeOpacity={0.7}
        disabled={isLoading || isDownloading}
      >
        {(isLoading || isDownloading) ? (
          <ActivityIndicator
            size="small"
            color={isOutgoing ? colors.text.primary : colors.common.white}
          />
        ) : (
          <Icon
            name={buttonIcon}
            size={24}
            color={isOutgoing ? colors.text.primary : colors.common.white}
          />
        )}
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
                backgroundColor: isOutgoing
                  ? (index / waveformBars.length <= progress ? colors.text.primary : 'rgba(0,0,0,0.25)')
                  : (index / waveformBars.length <= progress ? chatColors.primary : colors.grey[300]),
              },
            ]}
          />
        ))}
      </View>

      {/* Duration / Download progress */}
      <Text style={[styles.duration, isOutgoing && styles.durationOutgoing]}>
        {isDownloading
          ? `${downloadProgress}%`
          : (isPlaying ? formatDuration(position) : formatDuration(displayDuration))
        }
      </Text>
    </View>
  );
};

/**
 * Format duration in seconds to mm:ss
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
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
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
    color: colors.text.primary,
    fontWeight: '500',
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
