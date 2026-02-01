import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { tokenAuth, checkSession } from '../redux/slices/userSlice';
import { APP_CONFIG } from '../config/app.config';
import { colors } from '../theme';
import PabblyIcon from './PabblyIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Auth steps configuration for Google auth
const AUTH_STEPS = [
  { key: 'connecting', label: 'Connecting', description: 'Opening secure connection...' },
  { key: 'google', label: 'Google Sign In', description: 'Please sign in with Google...' },
  { key: 'verifying', label: 'Verifying', description: 'Verifying your account...' },
  { key: 'completing', label: 'Completing', description: 'Setting up your session...' },
];

export default function GoogleAuthWebView({
  visible,
  onClose,
  onSuccess,
  onError,
}) {
  const dispatch = useDispatch();
  const webViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [authCompleted, setAuthCompleted] = useState(false);
  const [hasNavigatedToAccess, setHasNavigatedToAccess] = useState(false);
  const [webViewKey, setWebViewKey] = useState(Date.now());
  const [showWebView, setShowWebView] = useState(false); // Start hidden, auto-click Google button first
  const [authStep, setAuthStep] = useState(0); // 0-3 for steps
  const [hasAutoClicked, setHasAutoClicked] = useState(false); // Track if auto-click was attempted

  // Pabbly URLs
  const pabblyLoginUrl = `${APP_CONFIG.pabblyAccountsUrl}/login`;
  const accessUrl = `${APP_CONFIG.pabblyAccountsBackendUrl}/access?project=${APP_CONFIG.pabblyProject}`;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const webViewFadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setWebViewKey(Date.now());
      setLoading(true);
      setAuthStep(0);
      setAuthCompleted(false);
      setCurrentUrl('');
      setHasNavigatedToAccess(false);
      setShowWebView(false); // Start hidden for auto-click
      setHasAutoClicked(false);

      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);
      webViewFadeAnim.setValue(0);

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
    if (visible && !showWebView) {
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
  }, [visible, showWebView]);

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
    if (visible && !showWebView) {
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
  }, [visible, showWebView]);

  // Progress animation based on step
  useEffect(() => {
    const targetProgress = ((authStep + 1) / AUTH_STEPS.length) * 100;

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
  }, [authStep]);

  // WebView fade animation when showing/hiding
  useEffect(() => {
    Animated.timing(webViewFadeAnim, {
      toValue: showWebView ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [showWebView]);

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

  // Script to navigate to access URL
  const getAccessNavigationScript = useCallback(() => {
    return `window.location.href = '${accessUrl}'; true;`;
  }, [accessUrl]);

  // Script to auto-click Google sign-in button on Pabbly login page
  const getAutoClickGoogleScript = useCallback(() => {
    return `
      (function() {
        // Try multiple selectors to find the Google sign-in button
        const googleButton = document.querySelector('[data-provider="google"]') ||
                            document.querySelector('button[class*="google"]') ||
                            document.querySelector('a[href*="google"]') ||
                            document.querySelector('[class*="google-btn"]') ||
                            document.querySelector('[class*="googleBtn"]') ||
                            document.querySelector('button:has(img[src*="google"])') ||
                            Array.from(document.querySelectorAll('button, a')).find(el =>
                              el.textContent.toLowerCase().includes('google') ||
                              el.innerHTML.toLowerCase().includes('google')
                            );
        if (googleButton) {
          googleButton.click();
          return true;
        }
        return false;
      })();
    `;
  }, []);

  // Handle token capture
  const handleTokenCapture = useCallback(async (url) => {
    if (authCompleted) return;

    try {
      setAuthCompleted(true);
      setShowWebView(false);
      setAuthStep(3); // Completing step

      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        const result = await dispatch(tokenAuth({ token, project: APP_CONFIG.pabblyProject })).unwrap();

        if (result.status === 'success') {
          await dispatch(checkSession());
          onSuccess?.();
        } else {
          onError?.('Authentication failed');
        }
      } else {
        onError?.('No token found');
      }
    } catch (error) {
      onError?.(error.message || 'Authentication failed');
    }

    onClose?.();
  }, [dispatch, onClose, onSuccess, onError, authCompleted]);

  // Handle navigation state change
  const handleNavigationStateChange = useCallback((navState) => {
    const { url, loading: isLoading } = navState;
    if (!url) return;

    setCurrentUrl(url);
    setLoading(isLoading);

    if (authCompleted) return;

    // Update auth step based on URL
    if (url.includes('google.com') || url.includes('accounts.google.com')) {
      setAuthStep(1); // Google step
      // Show WebView for Google authentication interaction
      setShowWebView(true);
    } else if (url.includes('/login')) {
      setAuthStep(0); // Login step
    }

    // Check for token in URL
    if (url.includes('token=') || url.includes('token%3D')) {
      handleTokenCapture(url);
      return;
    }

    // Auto-click Google button when on Pabbly login page
    if (!hasAutoClicked && !isLoading && url.includes('accounts.pabbly.com') && url.includes('/login')) {
      setHasAutoClicked(true);
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAutoClickGoogleScript());
        }
      }, 800);
    }

    // After Google auth, when on Pabbly dashboard/apps page, navigate to access URL
    if (!hasNavigatedToAccess && !isLoading) {
      const isOnDashboard = url.includes('/apps') ||
                           url.includes('/dashboard') ||
                           (url.includes('accounts.pabbly.com') && !url.includes('/login') && !url.includes('google'));

      if (isOnDashboard) {
        setHasNavigatedToAccess(true);
        setAuthStep(2); // Verifying step
        setShowWebView(false); // Hide WebView during verification

        setTimeout(() => {
          if (webViewRef.current && !authCompleted) {
            setAuthStep(3); // Completing step
            webViewRef.current.injectJavaScript(getAccessNavigationScript());
          }
        }, 500);
      }
    }

    // If we landed on ChatFlow without token, try to get token
    if (url.includes('chatflow.pabbly.com') && !url.includes('token') && !isLoading) {
      setAuthStep(3); // Completing step
      setShowWebView(false); // Hide WebView during completion
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAccessNavigationScript());
        }
      }, 500);
    }
  }, [authCompleted, hasNavigatedToAccess, hasAutoClicked, handleTokenCapture, getAccessNavigationScript, getAutoClickGoogleScript]);

  // Handle URL interception
  const handleShouldStartLoadWithRequest = useCallback((request) => {
    const url = request.url || '';

    if (authCompleted) return true;

    // Intercept custom scheme redirects
    if (url.startsWith('pabblychatflow://')) {
      if (url.includes('token=')) {
        handleTokenCapture(url);
      }
      return false;
    }

    // Check for token in any URL
    if (url.includes('token=') || url.includes('token%3D')) {
      handleTokenCapture(url);
      return true;
    }

    return true;
  }, [handleTokenCapture, authCompleted]);

  const currentStepData = AUTH_STEPS[authStep] || AUTH_STEPS[0];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Loading Overlay - shown when WebView is hidden */}
          {!showWebView && (
            <View style={[styles.loadingOverlay, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
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
                    {AUTH_STEPS.map((step, index) => (
                      <View key={step.key} style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepDot,
                            index <= authStep && styles.stepDotActive,
                            index === authStep && styles.stepDotCurrent,
                          ]}
                        >
                          {index < authStep && (
                            <Text style={styles.stepCheckmark}>✓</Text>
                          )}
                          {index === authStep && (
                            <ActivityIndicator size={12} color={colors.common.white} />
                          )}
                        </View>
                        {index < AUTH_STEPS.length - 1 && (
                          <View
                            style={[
                              styles.stepLine,
                              index < authStep && styles.stepLineActive,
                            ]}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Security note */}
                <View style={styles.securityNote}>
                  <View style={styles.securityIcon}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                  <Text style={styles.securityText}>
                    Secure authentication via Google
                  </Text>
                </View>
              </View>

              {/* Cancel button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* WebView Container - shown for Google auth interaction */}
          <Animated.View
            style={[
              styles.webViewContainer,
              {
                opacity: webViewFadeAnim,
                pointerEvents: showWebView ? 'auto' : 'none',
              },
            ]}
          >
            {/* Header with back button */}
            <View style={[styles.webViewHeader, { paddingTop: insets.top }]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Sign in with Google</Text>
                <Text style={styles.headerSubtitle}>Secure authentication</Text>
              </View>
              <View style={styles.headerPlaceholder} />
            </View>

            {/* Loading indicator over WebView */}
            {loading && showWebView && (
              <View style={styles.webViewLoadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={styles.webViewLoadingText}>Loading...</Text>
              </View>
            )}

            <WebView
              key={webViewKey}
              ref={webViewRef}
              source={{ uri: pabblyLoginUrl }}
              style={styles.webView}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              incognito={true}
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled={true}
              userAgent={Platform.select({
                ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
              })}
              originWhitelist={['https://*', 'http://*', 'pabblychatflow://*']}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              mixedContentMode="compatibility"
              allowsBackForwardNavigationGestures={true}
            />
          </Animated.View>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.common.white,
    zIndex: 10,
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
    borderTopColor: colors.primary.main,
    borderRightColor: `${colors.primary.main}40`,
  },
  innerRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'transparent',
    borderBottomColor: colors.primary.light,
    borderLeftColor: `${colors.primary.light}40`,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.main,
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
    backgroundColor: colors.primary.main,
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
    backgroundColor: colors.primary.main,
  },
  stepDotCurrent: {
    backgroundColor: colors.primary.main,
    shadowColor: colors.primary.main,
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
    width: 40,
    height: 2,
    backgroundColor: colors.grey[200],
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: colors.primary.main,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  securityIcon: {
    marginRight: 8,
  },
  lockIcon: {
    fontSize: 14,
  },
  securityText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  cancelButton: {
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  webViewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.common.white,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: '500',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 40,
  },
  webView: {
    flex: 1,
  },
  webViewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  webViewLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
