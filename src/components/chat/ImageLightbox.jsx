import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Share,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showError } from '../../utils/toast';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ImageLightbox = ({ visible, imageUrl, onClose }) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Animated values for pinch to zoom
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset values when closing
  const resetValues = useCallback(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetValues();
    onClose?.();
  }, [onClose, resetValues]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!imageUrl) return;
    try {
      await Share.share({
        url: imageUrl,
        message: 'Check out this image',
      });
    } catch (error) {
      showError('Failed to share image');
    }
  }, [imageUrl]);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });

  // Pan gesture for moving
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // Single tap to toggle UI (close for now)
  const singleTapGesture = Gesture.Tap()
    .onStart(() => {
      runOnJS(handleClose)();
    });

  // Combine gestures
  const composedGestures = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    panGesture
  );

  // Animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
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

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Icon name="share-variant" size={24} color={colors.common.white} />
          </TouchableOpacity>
        </View>

        {/* Image container */}
        <GestureDetector gesture={composedGestures}>
          <Animated.View style={styles.imageContainer}>
            {isLoading && !hasError && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.common.white} />
              </View>
            )}

            {hasError ? (
              <View style={styles.errorContainer}>
                <Icon name="image-broken" size={64} color={colors.grey[500]} />
                <Text style={styles.errorText}>Failed to load image</Text>
              </View>
            ) : (
              <Animated.Image
                source={{ uri: imageUrl }}
                style={[styles.image, animatedStyle]}
                resizeMode="contain"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
            )}
          </Animated.View>
        </GestureDetector>

        {/* Footer with hint */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hint}>Pinch to zoom • Double tap to zoom</Text>
        </View>
      </GestureHandlerRootView>
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
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
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
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
});

export default ImageLightbox;
