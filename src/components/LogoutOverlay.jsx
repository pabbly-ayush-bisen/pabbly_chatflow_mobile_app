import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import PabblyIcon from './PabblyIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Logout steps configuration
const LOGOUT_STEPS = [
  { key: 'saving', label: 'Saving', description: 'Saving your data...' },
  { key: 'clearing', label: 'Clearing', description: 'Clearing session...' },
  { key: 'completing', label: 'Completing', description: 'Logging you out...' },
];

export default function LogoutOverlay({ visible, currentStep = 0 }) {
  const insets = useSafeAreaInsets();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;

  // Start animations when modal opens
  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);

      // Start entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Logo pulse animation
  useEffect(() => {
    if (visible) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(logoScaleAnim, {
            toValue: 1.05,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [visible]);

  // Rotating rings animation
  useEffect(() => {
    if (visible) {
      const ring1Animation = Animated.loop(
        Animated.timing(ring1Anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      const ring2Animation = Animated.loop(
        Animated.timing(ring2Anim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      ring1Animation.start();
      ring2Animation.start();
      return () => {
        ring1Animation.stop();
        ring2Animation.stop();
      };
    }
  }, [visible]);

  // Shimmer animation for progress bar
  useEffect(() => {
    if (visible) {
      const shimmerAnimation = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [visible]);

  // Progress animation based on step
  useEffect(() => {
    const targetProgress = ((currentStep + 1) / LOGOUT_STEPS.length) * 100;

    // Fade out current step text, update, fade in
    Animated.sequence([
      Animated.timing(stepFadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(stepFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const ring1Spin = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ring2Spin = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const currentStepData = LOGOUT_STEPS[currentStep] || LOGOUT_STEPS[0];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 40,
            },
          ]}
        >
          {/* Background gradient effect */}
          <View style={styles.backgroundGradient} />

          {/* Main content */}
          <View style={styles.mainContent}>
            {/* Logo section with animated rings */}
            <View style={styles.logoSection}>
              {/* Outer rotating ring */}
              <Animated.View
                style={[
                  styles.outerRing,
                  { transform: [{ rotate: ring1Spin }] },
                ]}
              />

              {/* Inner rotating ring (opposite direction) */}
              <Animated.View
                style={[
                  styles.innerRing,
                  { transform: [{ rotate: ring2Spin }] },
                ]}
              />

              {/* Logo container with pulse */}
              <Animated.View
                style={[
                  styles.logoContainer,
                  { transform: [{ scale: logoScaleAnim }] },
                ]}
              >
                <View style={styles.logoInner}>
                  <PabblyIcon size={80} />
                </View>
              </Animated.View>
            </View>

            {/* Status section */}
            <View style={styles.statusSection}>
              <Animated.View style={{ opacity: stepFadeAnim }}>
                <Text style={styles.statusTitle}>{currentStepData.label}</Text>
                <Text style={styles.statusDescription}>{currentStepData.description}</Text>
              </Animated.View>
            </View>

            {/* Progress section */}
            <View style={styles.progressSection}>
              {/* Progress bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                  {/* Shimmer effect */}
                  <Animated.View
                    style={[
                      styles.progressShimmer,
                      { transform: [{ translateX: shimmerTranslate }] },
                    ]}
                  />
                </View>
              </View>

              {/* Step indicators */}
              <View style={styles.stepIndicators}>
                {LOGOUT_STEPS.map((step, index) => (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        index <= currentStep && styles.stepDotActive,
                        index === currentStep && styles.stepDotCurrent,
                      ]}
                    >
                      {index < currentStep && (
                        <Text style={styles.stepCheckmark}>✓</Text>
                      )}
                      {index === currentStep && (
                        <ActivityIndicator size={12} color={colors.common.white} />
                      )}
                    </View>
                    {index < LOGOUT_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          index < currentStep && styles.stepLineActive,
                        ]}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Goodbye message */}
            <View style={styles.goodbyeNote}>
              <View style={styles.waveIcon}>
                <Text style={styles.waveEmoji}>👋</Text>
              </View>
              <Text style={styles.goodbyeText}>
                See you next time!
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.common.white,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.common.white,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoSection: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  outerRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.error.main,
    borderRightColor: `${colors.error.main}40`,
  },
  innerRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'transparent',
    borderBottomColor: colors.error.light,
    borderLeftColor: `${colors.error.light}40`,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error.main,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 40,
    minHeight: 70,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressSection: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 40,
  },
  progressBarContainer: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.grey[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.error.main,
    borderRadius: 3,
  },
  progressShimmer: {
    ...StyleSheet.absoluteFillObject,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ skewX: '-20deg' }],
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.grey[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.error.main,
  },
  stepDotCurrent: {
    backgroundColor: colors.error.main,
    shadowColor: colors.error.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  stepCheckmark: {
    color: colors.common.white,
    fontSize: 12,
    fontWeight: '700',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.grey[200],
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: colors.error.main,
  },
  goodbyeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  waveIcon: {
    marginRight: 10,
  },
  waveEmoji: {
    fontSize: 18,
  },
  goodbyeText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});
