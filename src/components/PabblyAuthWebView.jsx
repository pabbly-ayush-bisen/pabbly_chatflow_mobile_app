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

// Auth steps configuration
const AUTH_STEPS = [
  { key: 'connecting', label: 'Connecting', description: 'Establishing secure connection...' },
  { key: 'signing_in', label: 'Signing In', description: 'Authenticating your credentials...' },
  { key: 'verifying', label: 'Verifying', description: 'Verifying your account...' },
  { key: 'completing', label: 'Completing', description: 'Setting up your session...' },
];

export default function PabblyAuthWebView({
  visible,
  onClose,
  email,
  password,
  onSuccess,
  onError,
}) {
  const dispatch = useDispatch();
  const webViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  const [currentUrl, setCurrentUrl] = useState('');
  const [authStep, setAuthStep] = useState(0); // 0-3 for steps
  const [authCompleted, setAuthCompleted] = useState(false);
  const [hasInjectedCredentials, setHasInjectedCredentials] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [injectionRetryCount, setInjectionRetryCount] = useState(0);
  const [webViewKey, setWebViewKey] = useState(Date.now());
  const [hasReceivedLoad, setHasReceivedLoad] = useState(false);

  // Timeout ref for handling slow WebView loads on new devices
  const loadTimeoutRef = useRef(null);

  const maxInjectionRetries = 5;
  const loadTimeoutDuration = 15000; // 15 seconds timeout for initial load
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

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setWebViewKey(Date.now());
      setAuthStep(0);
      setAuthCompleted(false);
      setCurrentUrl('');
      setHasInjectedCredentials(false);
      setLoginAttempted(false);
      setInjectionRetryCount(0);
      setHasReceivedLoad(false);

      // Clear any existing timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

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

      // Set timeout for slow WebView loads (common on new devices with no cache)
      loadTimeoutRef.current = setTimeout(() => {
        if (!hasReceivedLoad && !authCompleted) {
          onError?.('Connection is taking too long. Please check your internet connection and try again.');
          onClose?.();
        }
      }, loadTimeoutDuration);
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [visible]);

  // Logo pulse animation
  useEffect(() => {
    if (visible && !authCompleted) {
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
  }, [visible, authCompleted]);

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
    if (visible && !authCompleted) {
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
  }, [visible, authCompleted]);

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

  // JavaScript to inject credentials
  const getLoginInjectionScript = useCallback(() => {
    const escapedPassword = password
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    const escapedEmail = email
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

    return `
      (function() {
        function findAndFillInputs() {
          var emailInput = document.querySelector('input[type="email"]') ||
                           document.querySelector('input[name="email"]') ||
                           document.querySelector('input[id*="email" i]');

          var passwordInput = document.querySelector('input[type="password"]') ||
                             document.querySelector('input[name="password"]');

          if (emailInput && passwordInput) {
            try {
              var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(emailInput, '${escapedEmail}');
              nativeInputValueSetter.call(passwordInput, '${escapedPassword}');
            } catch(e) {
              emailInput.value = '${escapedEmail}';
              passwordInput.value = '${escapedPassword}';
            }

            ['input', 'change', 'blur'].forEach(function(eventType) {
              emailInput.dispatchEvent(new Event(eventType, { bubbles: true }));
              passwordInput.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            setTimeout(function() {
              var submitBtn = document.querySelector('button[type="submit"]') ||
                             document.querySelector('input[type="submit"]') ||
                             document.querySelector('form button');
              if (submitBtn) {
                submitBtn.click();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOGIN_SUBMITTED', success: true }));
              } else {
                var form = document.querySelector('form');
                if (form) {
                  form.submit();
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOGIN_SUBMITTED', success: true }));
                }
              }
            }, 500);
            return true;
          }
          return false;
        }

        if (!findAndFillInputs()) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FIELDS_NOT_FOUND' }));
        }
        true;
      })();
    `;
  }, [email, password]);

  const getAccessNavigationScript = useCallback(() => {
    return `window.location.href = '${accessUrl}'; true;`;
  }, [accessUrl]);

  // Handle token capture
  const handleTokenCapture = useCallback(async (url) => {
    if (authCompleted) return;

    try {
      setAuthCompleted(true);
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

  // Handle WebView messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'LOGIN_SUBMITTED':
          setLoginAttempted(true);
          setAuthStep(2); // Verifying step
          break;

        case 'FIELDS_NOT_FOUND':
          if (injectionRetryCount < maxInjectionRetries) {
            setInjectionRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (webViewRef.current && !loginAttempted) {
                webViewRef.current.injectJavaScript(getLoginInjectionScript());
              }
            }, 1000);
          } else {
            onError?.('Could not find login form');
          }
          break;
      }
    } catch (error) {
      // Silent error handling
    }
  }, [getLoginInjectionScript, injectionRetryCount, loginAttempted, onError]);

  // Handle navigation
  const handleNavigationStateChange = useCallback((navState) => {
    const { url, loading: isLoading } = navState;
    if (!url) return;

    setCurrentUrl(url);

    if (authCompleted) return;

    // Token in URL
    if (url.includes('token=') || url.includes('token%3D')) {
      handleTokenCapture(url);
      return;
    }

    // On ChatFlow without token - get token
    if (url.includes('chatflow.pabbly.com') && !url.includes('token') && !isLoading) {
      setAuthStep(3); // Completing step
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAccessNavigationScript());
        }
      }, 500);
    }

    // On Pabbly dashboard - navigate to access
    if ((url.includes('/apps') || url.includes('/dashboard')) && !url.includes('/login') && !isLoading) {
      setAuthStep(3); // Completing step
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAccessNavigationScript());
        }
      }, 500);
    }
  }, [authCompleted, handleTokenCapture, getAccessNavigationScript]);

  // Handle load end
  const handleLoadEnd = useCallback(() => {
    // Mark that we received a load - clear the timeout
    if (!hasReceivedLoad) {
      setHasReceivedLoad(true);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }

    if (authCompleted) return;

    if (currentUrl.includes('/login') && !hasInjectedCredentials && !loginAttempted) {
      setAuthStep(1); // Signing in step
      setTimeout(() => {
        if (webViewRef.current && !loginAttempted) {
          webViewRef.current.injectJavaScript(getLoginInjectionScript());
          setHasInjectedCredentials(true);
        }
      }, 1500);
    }
  }, [currentUrl, hasInjectedCredentials, loginAttempted, authCompleted, getLoginInjectionScript, hasReceivedLoad]);

  // Handle WebView errors (network errors, etc.)
  const handleWebViewError = useCallback(() => {
    // Clear the timeout since we got an error response
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }

    if (!authCompleted) {
      onError?.('Unable to connect. Please check your internet connection and try again.');
      onClose?.();
    }
  }, [authCompleted, onError, onClose]);

  // Handle URL interception
  const handleShouldStartLoadWithRequest = useCallback((request) => {
    const url = request.url || '';
    if (authCompleted) return true;

    if (url.startsWith('pabblychatflow://')) {
      if (url.includes('token=')) handleTokenCapture(url);
      return false;
    }

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
                Secure authentication via Pabbly Accounts
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

          {/* Hidden WebView */}
          <View style={styles.hiddenWebViewContainer}>
            <WebView
              key={webViewKey}
              ref={webViewRef}
              source={{ uri: pabblyLoginUrl }}
              style={styles.hiddenWebView}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              onError={handleWebViewError}
              onHttpError={handleWebViewError}
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
              mixedContentMode="compatibility"
            />
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
  hiddenWebViewContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenWebView: {
    width: 400,
    height: 600,
  },
});
