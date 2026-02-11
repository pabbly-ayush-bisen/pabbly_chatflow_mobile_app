import React from 'react';
import { StyleSheet, Vibration } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 100;
const REPLY_ICON_SIZE = 30;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

const triggerHaptic = () => {
  Vibration.vibrate(10);
};

const SwipeableMessage = ({ children, onSwipeReply, enabled = true }) => {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const gesture = Gesture.Pan()
    .activeOffsetX(15)
    .failOffsetY([-10, 10])
    .enabled(enabled)
    .onUpdate((e) => {
      // Only allow right swipe, clamp between 0 and MAX_SWIPE
      const clampedX = Math.min(Math.max(e.translationX, 0), MAX_SWIPE);
      translateX.value = clampedX;

      // Haptic when threshold first reached
      if (clampedX >= SWIPE_THRESHOLD && !hasTriggered.value) {
        hasTriggered.value = true;
        runOnJS(triggerHaptic)();
      } else if (clampedX < SWIPE_THRESHOLD) {
        hasTriggered.value = false;
      }
    })
    .onEnd(() => {
      const shouldReply = translateX.value >= SWIPE_THRESHOLD;

      // Spring back to original position
      translateX.value = withSpring(0, SPRING_CONFIG);

      if (shouldReply && onSwipeReply) {
        runOnJS(onSwipeReply)();
      }

      hasTriggered.value = false;
    });

  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      'clamp',
    );
    const scale = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0.3, 0.7, 1],
      'clamp',
    );
    // Icon slides in from the left, stopping at a fixed position
    const iconTranslateX = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [-20, 0],
      'clamp',
    );

    return {
      opacity,
      transform: [{ scale }, { translateX: iconTranslateX }],
    };
  });

  if (!enabled) {
    return children;
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={styles.wrapper}>
        {/* Reply icon - positioned at the left, revealed as bubble slides right */}
        <Animated.View style={[styles.replyIconContainer, replyIconStyle]}>
          <Icon name="reply" size={18} color="#8696a0" />
        </Animated.View>

        {/* Message content slides right */}
        <Animated.View style={[styles.messageRow, animatedRowStyle]}>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  replyIconContainer: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: REPLY_ICON_SIZE,
    height: REPLY_ICON_SIZE,
    borderRadius: REPLY_ICON_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    alignSelf: 'center',
    zIndex: 0,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  messageRow: {
    zIndex: 1,
  },
});

export default React.memo(SwipeableMessage);
