import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  Vibration,
  PanResponder,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, chatColors } from '../../theme/colors';
import { showError, showWarning } from '../../utils/toast';

const LOCK_THRESHOLD = -100; // Slide up threshold to lock (higher = more swipe needed)
const CANCEL_THRESHOLD = -140; // Slide left threshold to cancel
const HOLD_DELAY = 200; // Delay before recording starts (slower response)

/**
 * Custom recording options for cross-platform AAC audio recording
 */
const getRecordingOptions = () => {
  return {
    isMeteringEnabled: true,
    android: {
      extension: '.aac',
      outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.aac',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  };
};

/**
 * VoiceRecorder Component
 * WhatsApp-style voice recording:
 * - Hold to record
 * - Release to send
 * - Slide left to cancel
 * - Slide up to lock (hands-free mode)
 */
const VoiceRecorder = ({
  onRecordingComplete,
  onCancel,
  onRecordingStateChange,
  disabled = false,
}) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const micScale = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const recordingUIOpacity = useRef(new Animated.Value(0)).current;
  const lockHighlight = useRef(new Animated.Value(0)).current;

  // Refs for PanResponder (to avoid stale closures)
  const isMountedRef = useRef(true);
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const recordingRef = useRef(null);
  const pulseAnimRef = useRef(null);
  const holdTimerRef = useRef(null);
  const isHoldingRef = useRef(false);
  const gestureStartTimeRef = useRef(0);
  const hasStartedRecordingRef = useRef(false);

  // Format duration as mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start pulse animation
  const startPulseAnimation = useCallback(() => {
    pulseAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimRef.current.start();
  }, [pulseAnim]);

  // Stop animations
  const stopAnimations = useCallback(() => {
    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pulseAnim.setValue(1);
    micScale.setValue(1);
    slideX.setValue(0);
    slideY.setValue(0);
    lockOpacity.setValue(0);
    cancelOpacity.setValue(0);
    recordingUIOpacity.setValue(0);
    lockHighlight.setValue(0);
  }, [pulseAnim, micScale, slideX, slideY, lockOpacity, cancelOpacity, recordingUIOpacity, lockHighlight]);

  // Recording status update callback
  const onRecordingStatusUpdate = useCallback((status) => {
    if (!isMountedRef.current) return;
    if (status.isRecording) {
      const durationSeconds = Math.floor((status.durationMillis || 0) / 1000);
      setDuration(durationSeconds);
    }
  }, []);

  // Start recording - called from ref to avoid stale closure
  const startRecordingRef = useRef(null);
  startRecordingRef.current = async () => {
    if (disabled || isInitializing || isRecordingRef.current) return;

    setIsInitializing(true);
    hasStartedRecordingRef.current = true;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showWarning('Microphone permission is required', 'Permission Required');
        setIsInitializing(false);
        hasStartedRecordingRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      recording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);

      const recordingOptions = getRecordingOptions();
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();

      if (isMountedRef.current) {
        recordingRef.current = recording;
        isRecordingRef.current = true;
        setIsRecording(true);
        setDuration(0);
        setIsInitializing(false);
        onRecordingStateChange?.(true);
        startPulseAnimation();

        // Haptic feedback
        Vibration.vibrate(50);

        // Show recording UI and lock indicator with slower, smoother fade
        Animated.parallel([
          Animated.timing(recordingUIOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(lockOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      if (isMountedRef.current) {
        setIsInitializing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        recordingRef.current = null;
        hasStartedRecordingRef.current = false;
      }

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
        });
      } catch (resetError) {
        // Ignore
      }

      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('permission')) {
        showError('Microphone permission denied');
      } else {
        showError('Failed to start recording');
      }
    }
  };

  // Stop recording - called from ref to avoid stale closure
  const stopRecordingRef = useRef(null);
  stopRecordingRef.current = async (shouldSend = true) => {
    const recording = recordingRef.current;
    if (!recording) {
      // Reset state even if no recording
      hasStartedRecordingRef.current = false;
      return;
    }

    stopAnimations();

    try {
      const status = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
      });

      const originalUri = recording.getURI();
      const finalDuration = status?.durationMillis
        ? Math.floor(status.durationMillis / 1000)
        : duration;

      if (isMountedRef.current) {
        recordingRef.current = null;
        isRecordingRef.current = false;
        isLockedRef.current = false;
        isHoldingRef.current = false;
        hasStartedRecordingRef.current = false;
        setIsRecording(false);
        setIsLocked(false);
        setDuration(0);
        onRecordingStateChange?.(false);
      }

      if (shouldSend && originalUri) {
        if (finalDuration >= 1) {
          try {
            const timestamp = Date.now();
            const fileName = `voice_${timestamp}.aac`;
            const destUri = `${FileSystem.documentDirectory}${fileName}`;

            const originalFileInfo = await FileSystem.getInfoAsync(originalUri);
            let finalUri = originalUri;
            let finalFileSize = originalFileInfo.size;

            if (originalFileInfo.exists) {
              await FileSystem.copyAsync({ from: originalUri, to: destUri });
              const copiedFileInfo = await FileSystem.getInfoAsync(destUri);

              if (copiedFileInfo.exists) {
                finalUri = destUri;
                finalFileSize = copiedFileInfo.size || originalFileInfo.size;
                try {
                  await FileSystem.deleteAsync(originalUri, { idempotent: true });
                } catch (cleanupError) {
                  // Ignore
                }
              }
            }

            onRecordingComplete?.({
              uri: finalUri,
              duration: finalDuration,
              fileName,
              fileType: 'audio',
              mimeType: 'audio/aac',
              fileSize: finalFileSize,
            });
          } catch (copyError) {
            onRecordingComplete?.({
              uri: originalUri,
              duration: finalDuration,
              fileName: `voice_${Date.now()}.aac`,
              fileType: 'audio',
              mimeType: 'audio/aac',
            });
          }
        } else {
          showWarning('Recording too short', 'Hold longer to record');
          onCancel?.();
        }
      } else if (!shouldSend) {
        Vibration.vibrate(30);
        onCancel?.();
      }
    } catch (error) {
      if (isMountedRef.current) {
        recordingRef.current = null;
        isRecordingRef.current = false;
        isLockedRef.current = false;
        isHoldingRef.current = false;
        hasStartedRecordingRef.current = false;
        setIsRecording(false);
        setIsLocked(false);
        setDuration(0);
        onRecordingStateChange?.(false);
      }

      showError('Failed to stop recording');
    }
  };

  // PanResponder - using refs to call functions to avoid stale closures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        gestureStartTimeRef.current = Date.now();
        isHoldingRef.current = true;

        // Scale up mic button with slower, smoother spring
        Animated.spring(micScale, {
          toValue: 1.1,
          useNativeDriver: true,
          friction: 10, // Higher friction = slower
          tension: 50,  // Lower tension = smoother
        }).start();

        // Start recording after delay
        holdTimerRef.current = setTimeout(() => {
          if (isHoldingRef.current && isMountedRef.current) {
            Animated.spring(micScale, {
              toValue: 1.25,
              useNativeDriver: true,
              friction: 8,
              tension: 40,
            }).start();
            startRecordingRef.current?.();
          }
        }, HOLD_DELAY);
      },

      onPanResponderMove: (_, gestureState) => {
        // Track gesture even before recording fully starts
        if (!isHoldingRef.current || isLockedRef.current) return;

        const { dx, dy } = gestureState;

        // Update slide position with stronger damping for slower, smoother feel
        // Lower multiplier = more resistance = slower movement
        const dampedDx = Math.min(0, dx * 0.7);
        const dampedDy = Math.min(0, dy * 0.7);

        slideX.setValue(dampedDx);
        slideY.setValue(dampedDy);

        // Cancel feedback with smoother easing
        if (isRecordingRef.current) {
          const cancelProgress = Math.min(1, Math.pow(Math.abs(dx) / Math.abs(CANCEL_THRESHOLD), 0.6));
          cancelOpacity.setValue(cancelProgress);
        }

        // Lock highlight when approaching threshold with smoother eased progress
        const rawLockProgress = Math.abs(dy) / Math.abs(LOCK_THRESHOLD);
        const lockProgress = Math.min(1, Math.pow(rawLockProgress, 0.5));
        lockHighlight.setValue(lockProgress);

        // Check for lock gesture (slide up)
        if (dy < LOCK_THRESHOLD && !isLockedRef.current && isRecordingRef.current) {
          isLockedRef.current = true;
          setIsLocked(true);
          Vibration.vibrate(50);

          // Snap back with slower, smoother spring
          Animated.parallel([
            Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
            Animated.spring(slideY, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
            Animated.spring(micScale, { toValue: 1, useNativeDriver: true, friction: 10, tension: 50 }),
            Animated.timing(lockOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(lockHighlight, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start();
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        const holdDuration = Date.now() - gestureStartTimeRef.current;

        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }

        isHoldingRef.current = false;

        // Reset animations with slower, smoother spring
        Animated.parallel([
          Animated.spring(micScale, { toValue: 1, useNativeDriver: true, friction: 10, tension: 50 }),
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
          Animated.timing(cancelOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(lockHighlight, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();

        // Quick tap - ignore
        if (holdDuration < HOLD_DELAY && !hasStartedRecordingRef.current) {
          return;
        }

        // If locked, don't stop
        if (isLockedRef.current) return;

        // Cancel or send (use original dx, not damped)
        if (dx < CANCEL_THRESHOLD && isRecordingRef.current) {
          stopRecordingRef.current?.(false);
        } else if (isRecordingRef.current) {
          stopRecordingRef.current?.(true);
        }
      },

      onPanResponderTerminate: () => {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }

        isHoldingRef.current = false;

        Animated.parallel([
          Animated.spring(micScale, { toValue: 1, useNativeDriver: true, friction: 10, tension: 50 }),
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, friction: 10, tension: 40 }),
        ]).start();

        if (!isLockedRef.current && isRecordingRef.current) {
          stopRecordingRef.current?.(false);
        }
      },
    })
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAnimations();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [stopAnimations]);

  // Locked recording UI
  if (isRecording && isLocked) {
    return (
      <View style={styles.lockedContainer}>
        <TouchableOpacity
          style={styles.lockedDeleteButton}
          onPress={() => stopRecordingRef.current?.(false)}
          activeOpacity={0.7}
        >
          <Icon name="delete" size={20} color={colors.error.main} />
        </TouchableOpacity>

        <View style={styles.lockedRecordingInfo}>
          <Animated.View
            style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]}
          />
          <Text style={styles.lockedDuration}>{formatDuration(duration)}</Text>
        </View>

        <TouchableOpacity
          style={styles.lockedSendButton}
          onPress={() => stopRecordingRef.current?.(true)}
          activeOpacity={0.7}
        >
          <Icon name="send" size={18} color={colors.common.white} />
        </TouchableOpacity>
      </View>
    );
  }

  // Main render
  return (
    <View style={[styles.container, isRecording && styles.containerRecording]}>
      {/* Recording UI overlay */}
      {isRecording && (
        <Animated.View style={[styles.recordingOverlay, { opacity: recordingUIOpacity }]}>
          <View style={styles.cancelSection}>
            <Animated.View style={[styles.cancelHint, { opacity: Animated.subtract(1, cancelOpacity) }]}>
              <Icon name="chevron-left" size={16} color={colors.grey[500]} />
              <Text style={styles.slideText}>Slide to cancel</Text>
            </Animated.View>
            <Animated.View style={[styles.cancelActiveHint, { opacity: cancelOpacity }]}>
              <Icon name="chevron-left" size={18} color={colors.error.main} />
              <Text style={styles.cancelText}>Release to cancel</Text>
            </Animated.View>
          </View>

          <View style={styles.recordingInfo}>
            <Animated.View
              style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]}
            />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </Animated.View>
      )}

      {/* Lock indicator - positioned higher */}
      {isRecording && (
        <Animated.View
          style={[
            styles.lockIndicator,
            {
              opacity: lockOpacity,
              transform: [
                { translateY: Animated.add(slideY, Animated.multiply(lockHighlight, -8)) },
                { scale: Animated.add(1, Animated.multiply(lockHighlight, 0.12)) },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.lockIconBg,
              {
                backgroundColor: lockHighlight.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [colors.grey[100], colors.grey[200], chatColors.accent],
                }),
              },
            ]}
          >
            <Icon name="chevron-up" size={14} color={colors.grey[600]} style={styles.lockChevron} />
            <Icon name="lock" size={18} color={colors.grey[700]} />
          </Animated.View>
        </Animated.View>
      )}

      {/* Mic button with PanResponder */}
      <Animated.View
        style={[
          styles.micButtonWrapper,
          {
            transform: [
              { scale: micScale },
              { translateX: isRecording ? slideX : 0 },
              { translateY: isRecording ? slideY : 0 },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.micButton, disabled && styles.micButtonDisabled]}>
          <Icon
            name={isInitializing ? 'microphone-outline' : 'microphone'}
            size={20}
            color={colors.common.white}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  containerRecording: {
    flex: 1,
  },

  recordingOverlay: {
    position: 'absolute',
    left: 0,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },

  cancelSection: {
    flex: 1,
    justifyContent: 'center',
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
  },
  cancelActiveHint: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
  },
  slideText: {
    fontSize: 13,
    color: colors.grey[500],
    marginLeft: 2,
  },
  cancelText: {
    fontSize: 13,
    color: colors.error.main,
    fontWeight: '500',
    marginLeft: 2,
  },

  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error.main,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },

  // Lock indicator - positioned much higher for proper gesture reach
  lockIndicator: {
    position: 'absolute',
    right: 4,
    bottom: 100, // Higher position to match increased threshold
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  lockIconBg: {
    width: 36,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  lockChevron: {
    marginBottom: 2,
  },

  micButtonWrapper: {
    zIndex: 10,
  },

  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: chatColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },

  // Locked UI
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginLeft: 8,
    flex: 1,
  },
  lockedDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedRecordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  lockedDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  lockedSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VoiceRecorder;
