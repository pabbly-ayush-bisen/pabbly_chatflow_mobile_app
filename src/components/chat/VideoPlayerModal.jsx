import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoPlayerModal = ({ visible, videoUrl, onClose }) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isPlaying = status.isPlaying;
  const positionMillis = status.positionMillis || 0;
  const durationMillis = status.durationMillis || 0;

  // Format time mm:ss
  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
      }
    } catch (e) {
      // Ignore
    }
    setIsLoading(true);
    setHasError(false);
    onClose?.();
  }, [onClose]);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [isPlaying]);

  const handleReplay = useCallback(async () => {
    if (!videoRef.current) return;
    await videoRef.current.replayAsync();
  }, []);

  // Progress bar width
  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Icon name="close" size={24} color={colors.common.white} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>

        {/* Video container */}
        <View style={styles.videoContainer}>
          {isLoading && !hasError && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.common.white} />
            </View>
          )}

          {hasError ? (
            <View style={styles.errorContainer}>
              <Icon name="video-off" size={64} color={colors.grey[500]} />
              <Text style={styles.errorText}>Failed to load video</Text>
            </View>
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: videoUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              onPlaybackStatusUpdate={setStatus}
              onLoadStart={() => setIsLoading(true)}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </View>

        {/* Controls */}
        {!hasError && (
          <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
            </View>

            {/* Play/Pause button */}
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleReplay}
                activeOpacity={0.7}
              >
                <Icon name="restart" size={28} color={colors.common.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={handlePlayPause}
                activeOpacity={0.7}
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color={colors.common.white}
                />
              </TouchableOpacity>

              {/* Spacer to balance layout */}
              <View style={styles.controlButton} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.grey[500],
    fontSize: 16,
    marginTop: 12,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.common.white,
    borderRadius: 2,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 32,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VideoPlayerModal;
