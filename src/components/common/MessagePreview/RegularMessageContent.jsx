/**
 * RegularMessageContent - Renders regular message content (text, image, video, audio, file)
 * inside a WhatsApp-style chat bubble.
 *
 * Supports two rendering modes:
 * - Static preview (default): placeholder icons for video/audio
 * - Native media controls: actual expo-av Video/Audio playback
 */
import React from 'react';
import { View, Image, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import styles from './messagePreviewStyles';
import AudioPlayerPreview from './AudioPlayerPreview';

let Video, ResizeMode;
try {
  const expoAv = require('expo-av');
  Video = expoAv.Video;
  ResizeMode = expoAv.ResizeMode;
} catch (e) {
  // expo-av not available
}

const RegularMessageContent = ({
  type = 'text',
  message = '',
  fileUrl = '',
  fileName = '',
  useNativeMediaControls = false,
}) => {
  const hasMedia = fileUrl && ['image', 'video', 'audio', 'file'].includes(type);

  return (
    <>
      {/* Image */}
      {type === 'image' && fileUrl && (
        <View style={styles.mediaWrapper}>
          <Image source={{ uri: fileUrl }} style={styles.imagePreview} resizeMode="cover" />
        </View>
      )}

      {/* Video - Native Controls */}
      {type === 'video' && fileUrl && useNativeMediaControls && Video && (
        <View style={styles.nativeVideoContainer}>
          <Video
            source={{ uri: fileUrl }}
            style={styles.nativeVideo}
            useNativeControls
            resizeMode={ResizeMode?.CONTAIN || 'contain'}
            isLooping={false}
          />
        </View>
      )}

      {/* Video - Static Placeholder */}
      {type === 'video' && fileUrl && !useNativeMediaControls && (
        <View style={styles.mediaWrapper}>
          <View style={styles.videoPreview}>
            <View style={styles.videoGradient}>
              <View style={styles.playButton}>
                <Icon name="play" size={24} color="#FFF" />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Audio - Native Controls */}
      {type === 'audio' && fileUrl && useNativeMediaControls && (
        <View style={styles.nativeAudioContainer}>
          <AudioPlayerPreview audioUrl={fileUrl} />
        </View>
      )}

      {/* Audio - Static Waveform */}
      {type === 'audio' && fileUrl && !useNativeMediaControls && (
        <View style={styles.audioPreview}>
          <View style={styles.audioPlayBtn}>
            <Icon name="play" size={16} color="#FFF" />
          </View>
          <View style={styles.audioContent}>
            <View style={styles.audioWaveform}>
              {[...Array(20)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.audioBar,
                    { height: 4 + Math.sin(i * 0.5) * 8 + Math.random() * 4 },
                  ]}
                />
              ))}
            </View>
            <View style={styles.audioMeta}>
              <Text style={styles.audioDuration}>0:00</Text>
              <Icon name="microphone" size={12} color={colors.text.tertiary} />
            </View>
          </View>
        </View>
      )}

      {/* File/Document */}
      {type === 'file' && fileUrl && (
        <TouchableOpacity
          style={styles.filePreview}
          onPress={() => fileUrl && Linking.openURL(fileUrl)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconBox}>
            <Icon name="file-pdf-box" size={28} color="#DC2626" />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {fileName || 'Document'}
            </Text>
            <Text style={styles.fileTypeText}>PDF Document</Text>
          </View>
          <Icon name="download" size={18} color={colors.grey[400]} />
        </TouchableOpacity>
      )}

      {/* Text Message */}
      {message ? (
        <Text
          style={[
            styles.messageText,
            hasMedia && !['audio', 'file'].includes(type) && styles.messageCaption,
          ]}
          numberOfLines={useNativeMediaControls ? 6 : undefined}
        >
          {message}
        </Text>
      ) : null}

      {/* Empty State for text type with no message */}
      {type === 'text' && !message && (
        <Text style={styles.noTextMessage}>No text content</Text>
      )}

      {/* Empty State for media without URL */}
      {type !== 'text' && !fileUrl && !message && (
        <View style={styles.bubbleEmptyState}>
          <Icon name="file-question-outline" size={32} color={colors.grey[400]} />
          <Text style={styles.bubbleEmptyText}>No content available</Text>
        </View>
      )}
    </>
  );
};

export default RegularMessageContent;
