import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * AudioMessage Component
 * Renders audio/voice messages with inline playback and waveform visualization
 * Uses expo-av for audio playback within the message bubble
 */
const AudioMessage = ({ message, isOutgoing }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasFinished, setHasFinished] = useState(false); // Track if audio finished playing

  const soundRef = useRef(null);
  const isMountedRef = useRef(true);

  const audioUrl = getMediaUrl(message);

  // Get duration from message if available (check multiple possible locations)
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
      // Silent fail - audio mode might already be set
    }
  }, []);

  // Playback status update callback
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!isMountedRef.current) return;

    if (status.isLoaded) {
      // Update position and progress
      if (status.durationMillis > 0) {
        const currentPosition = status.positionMillis / 1000;
        const totalDuration = status.durationMillis / 1000;
        setPosition(currentPosition);
        setDuration(totalDuration);
        setProgress(status.positionMillis / status.durationMillis);
      }

      // Update playing state
      setIsPlaying(status.isPlaying);

      // Mark as finished when playback completes
      if (status.didJustFinish) {
        setIsPlaying(false);
        setProgress(0);
        setPosition(0);
        setHasFinished(true); // Track that audio finished for replay
      }
    }
  }, []);

  // Load and play audio
  const loadAndPlayAudio = useCallback(async () => {
    if (!audioUrl || isLoading) return;

    setIsLoading(true);

    try {
      // Initialize audio mode
      await initAudioMode();

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Create and load new sound
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      if (!isMountedRef.current) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;

      // Set duration from loaded audio if not available from message
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
  }, [audioUrl, isLoading, initAudioMode, onPlaybackStatusUpdate]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(async () => {
    if (isLoading) return;

    if (!soundRef.current) {
      // First time playing - load and play
      setHasFinished(false);
      await loadAndPlayAudio();
    } else {
      try {
        const status = await soundRef.current.getStatusAsync();

        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
          } else {
            // If audio has finished or is at/near the end, replay from start
            const isAtEnd = hasFinished ||
                           status.didJustFinish ||
                           (status.durationMillis > 0 && status.positionMillis >= status.durationMillis - 100);

            if (isAtEnd) {
              await soundRef.current.setPositionAsync(0);
              setProgress(0);
              setPosition(0);
            }

            setHasFinished(false); // Reset finished state when starting to play
            await soundRef.current.playAsync();
          }
        } else {
          // Sound not loaded, reload
          setHasFinished(false);
          await loadAndPlayAudio();
        }
      } catch (error) {
        // Try to reload on error
        setHasFinished(false);
        await loadAndPlayAudio();
      }
    }
  }, [isLoading, loadAndPlayAudio, hasFinished]);

  // Pre-load audio metadata to get duration without playing
  const loadAudioMetadata = useCallback(async () => {
    if (!audioUrl || messageDuration > 0) return; // Skip if we already have duration from message

    try {
      // Create sound just to get metadata, don't play
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false }
      );

      if (!isMountedRef.current) {
        await sound.unloadAsync();
        return;
      }

      // Get duration from loaded audio
      if (status.isLoaded && status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }

      // Unload the sound - we'll reload when user presses play
      await sound.unloadAsync();
    } catch (error) {
      // Silent fail - duration will show as 0:00 until played
    }
  }, [audioUrl, messageDuration]);

  // Load metadata on mount to show duration before playing
  useEffect(() => {
    isMountedRef.current = true;

    // Pre-load duration if not available from message
    if (audioUrl && messageDuration === 0) {
      loadAudioMetadata();
    }

    return () => {
      isMountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [audioUrl, messageDuration, loadAudioMetadata]);

  // Use message duration if available, otherwise use loaded duration
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
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isOutgoing ? colors.text.primary : colors.common.white}
          />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play'}
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

      {/* Duration - shows current position when playing, total duration when paused */}
      <Text style={[styles.duration, isOutgoing && styles.durationOutgoing]}>
        {isPlaying ? formatDuration(position) : formatDuration(displayDuration)}
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
