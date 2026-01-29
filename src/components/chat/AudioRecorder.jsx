import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, chatColors } from '../../theme/colors';

const AudioRecorder = ({ onSend, onCancel, visible }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);

  const durationInterval = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Request microphone permission
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable microphone access in settings to record audio messages.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        // Error:('Permission request failed:', error);
        setHasPermission(false);
      }
    };

    if (visible) {
      requestPermission();
    }
  }, [visible]);

  // Animate slide in when visible
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone access is required to record audio.');
      return;
    }

    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationInterval.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      // Error:('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, [hasPermission]);

  // Stop recording and send
  const stopAndSend = useCallback(async () => {
    if (!recording) return;

    try {
      // Clear timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      setIsRecording(false);

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Send the audio file
      if (uri && onSend) {
        onSend({
          uri,
          duration: recordingDuration,
          type: 'audio',
          mimeType: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
        });
      }

      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      // Error:('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    }
  }, [recording, recordingDuration, onSend]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    if (!recording) {
      onCancel?.();
      return;
    }

    try {
      // Clear timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      setIsRecording(false);

      // Stop and discard recording
      await recording.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setRecording(null);
      setRecordingDuration(0);
      onCancel?.();
    } catch (error) {
      // Error:('Failed to cancel recording:', error);
      setRecording(null);
      setRecordingDuration(0);
      onCancel?.();
    }
  }, [recording, onCancel]);

  // Format duration as mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
          opacity: slideAnim,
        },
      ]}
    >
      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={cancelRecording}
        activeOpacity={0.7}
      >
        <Icon name="close" size={24} color={colors.error.main} />
      </TouchableOpacity>

      {/* Recording indicator and timer */}
      <View style={styles.recordingInfo}>
        {isRecording ? (
          <>
            <Animated.View
              style={[
                styles.recordingDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.recordingText}>Recording</Text>
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </>
        ) : (
          <>
            <Icon name="microphone" size={24} color={colors.grey[500]} />
            <Text style={styles.idleText}>Tap mic to start recording</Text>
          </>
        )}
      </View>

      {/* Record/Send button */}
      {isRecording ? (
        <TouchableOpacity
          style={styles.sendButton}
          onPress={stopAndSend}
          activeOpacity={0.7}
        >
          <Icon name="send" size={24} color={colors.common.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.recordButton}
          onPress={startRecording}
          activeOpacity={0.7}
        >
          <Icon name="microphone" size={28} color={colors.common.white} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
    gap: 12,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error.main,
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.error.main,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 'auto',
    marginRight: 8,
  },
  idleText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error.main,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.error.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: chatColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default AudioRecorder;
