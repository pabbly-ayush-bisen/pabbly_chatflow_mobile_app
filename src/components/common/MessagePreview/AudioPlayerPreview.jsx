/**
 * AudioPlayerPreview - Audio player with play/pause and progress bar.
 * Extracted from QuickRepliesScreen for shared use.
 */
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors } from '../../../theme/colors';
import styles from './messagePreviewStyles';

const AudioPlayerPreview = ({ audioUrl }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const loadAndPlayAudio = async () => {
    try {
      setIsLoading(true);

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        setIsLoading(false);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.audioPlayerContainer}>
      <TouchableOpacity
        style={styles.audioPlayButton}
        onPress={loadAndPlayAudio}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.common.white} />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={colors.common.white}
          />
        )}
      </TouchableOpacity>
      <View style={styles.audioProgressContainer}>
        <View style={styles.audioProgressBar}>
          <View style={[styles.audioProgressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.audioTimeRow}>
          <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
          <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
};

export default AudioPlayerPreview;
