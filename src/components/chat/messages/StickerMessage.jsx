import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { getMediaUrl } from '../../../utils/messageHelpers';

/**
 * StickerMessage Component
 * Renders sticker messages (smaller than regular images, transparent background)
 * Aligned with web app implementation (100x100 max on web)
 */
const StickerMessage = ({ message, onImagePress }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const stickerUrl = getMediaUrl(message);

  // Render error state
  if (!stickerUrl) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="sticker-emoji" size={32} color={colors.grey[400]} />
        <Text style={styles.errorText}>Sticker not available</Text>
      </View>
    );
  }

  if (imageError) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="sticker-emoji" size={32} color={colors.grey[400]} />
        <Text style={styles.errorText}>Failed to load sticker</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onImagePress?.(stickerUrl)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: stickerUrl }}
        style={styles.sticker}
        resizeMode="contain"
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        onError={() => {
          setImageLoading(false);
          setImageError(true);
        }}
      />
      {imageLoading && (
        <View style={styles.loadingOverlay}>
          <Icon name="sticker-emoji" size={32} color={colors.grey[300]} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  sticker: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    width: 100,
    height: 100,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default memo(StickerMessage);
