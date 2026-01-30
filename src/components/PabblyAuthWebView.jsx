import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { tokenAuth, checkSession } from '../redux/slices/userSlice';
import { APP_CONFIG } from '../config/app.config';
import { colors } from '../theme';

const PabblyLogo = require('../../assets/icon.png');

/**
 * PabblyAuthWebView - Handles Email/Password authentication via hidden WebView
 *
 * This component is ONLY used for email/password login.
 * Google Sign-In uses WebBrowser.openAuthSessionAsync in LoginScreen.
 *
 * Flow:
 * 1. User enters email/password in app
 * 2. Hidden WebView loads Pabbly login page
 * 3. JavaScript injects credentials and submits form
 * 4. After login, navigates to ChatFlow access URL
 * 5. Captures redirect token
 * 6. Authenticates with ChatFlow
 */
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

  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [authStep, setAuthStep] = useState('loading');
  const [authCompleted, setAuthCompleted] = useState(false);
  const [hasInjectedCredentials, setHasInjectedCredentials] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [injectionRetryCount, setInjectionRetryCount] = useState(0);
  const [webViewKey, setWebViewKey] = useState(Date.now());

  const maxInjectionRetries = 5;
  const pabblyLoginUrl = `${APP_CONFIG.pabblyAccountsUrl}/login`;
  const accessUrl = `${APP_CONFIG.pabblyAccountsBackendUrl}/access?project=${APP_CONFIG.pabblyProject}`;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      console.log('[PabblyAuthWebView] Modal opened for email/password auth');
      setWebViewKey(Date.now());
      setLoading(true);
      setAuthStep('loading');
      setAuthCompleted(false);
      setCurrentUrl('');
      setHasInjectedCredentials(false);
      setLoginAttempted(false);
      setInjectionRetryCount(0);
    }
  }, [visible]);

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

    console.log('[PabblyAuthWebView] Token capture:', url);

    try {
      setAuthCompleted(true);
      setAuthStep('success');

      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        const result = await dispatch(tokenAuth({ token, project: APP_CONFIG.pabblyProject })).unwrap();

        if (result.status === 'success') {
          console.log('[PabblyAuthWebView] Auth success!');
          await dispatch(checkSession());
          onSuccess?.();
        } else {
          onError?.('Authentication failed');
        }
      } else {
        onError?.('No token found');
      }
    } catch (error) {
      console.log('[PabblyAuthWebView] Error:', error);
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
          setAuthStep('authenticating');
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
      console.log('[PabblyAuthWebView] Message error:', error);
    }
  }, [getLoginInjectionScript, injectionRetryCount, loginAttempted, onError]);

  // Handle navigation
  const handleNavigationStateChange = useCallback((navState) => {
    const { url, loading: isLoading } = navState;
    if (!url) return;

    setCurrentUrl(url);
    setLoading(isLoading);

    if (authCompleted) return;

    // Token in URL
    if (url.includes('token=') || url.includes('token%3D')) {
      handleTokenCapture(url);
      return;
    }

    // On ChatFlow without token - get token
    if (url.includes('chatflow.pabbly.com') && !url.includes('token') && !isLoading) {
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAccessNavigationScript());
        }
      }, 500);
    }

    // On Pabbly dashboard - navigate to access
    if ((url.includes('/apps') || url.includes('/dashboard')) && !url.includes('/login') && !isLoading) {
      setAuthStep('access');
      setTimeout(() => {
        if (webViewRef.current && !authCompleted) {
          webViewRef.current.injectJavaScript(getAccessNavigationScript());
        }
      }, 500);
    }
  }, [authCompleted, handleTokenCapture, getAccessNavigationScript]);

  // Handle load end
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    if (authCompleted) return;

    if (currentUrl.includes('/login') && !hasInjectedCredentials && !loginAttempted) {
      setAuthStep('login');
      setTimeout(() => {
        if (webViewRef.current && !loginAttempted) {
          webViewRef.current.injectJavaScript(getLoginInjectionScript());
          setHasInjectedCredentials(true);
        }
      }, 1500);
    }
  }, [currentUrl, hasInjectedCredentials, loginAttempted, authCompleted, getLoginInjectionScript]);

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

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const getTargetProgress = useCallback(() => {
    switch (authStep) {
      case 'loading': return 20;
      case 'login': return 40;
      case 'authenticating': return 60;
      case 'access': return 80;
      case 'success': return 100;
      default: return 10;
    }
  }, [authStep]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: getTargetProgress(),
      duration: 500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [authStep, progressAnim, getTargetProgress]);

  useEffect(() => {
    if (visible) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
      );
      pulseAnimation.start();
      rotateAnimation.start();
      return () => { pulseAnimation.stop(); rotateAnimation.stop(); };
    }
  }, [visible, pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const getStatusText = () => {
    switch (authStep) {
      case 'loading': return 'Connecting...';
      case 'login': return 'Signing in...';
      case 'authenticating': return 'Verifying...';
      case 'access': return 'Almost done...';
      case 'success': return 'Success!';
      default: return 'Please wait...';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            {/* Animated Logo */}
            <View style={styles.logoWrapper}>
              <Animated.View style={[styles.glowRing, { transform: [{ rotate: spin }] }]} />
              <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.logoInner}>
                  <Image source={PabblyLogo} style={styles.logoImage} resizeMode="contain" />
                </View>
              </Animated.View>
              <View style={styles.miniSpinnerContainer}>
                <ActivityIndicator size="small" color={colors.primary.main} />
              </View>
            </View>

            {/* Status */}
            <Text style={styles.statusTitle}>{getStatusText()}</Text>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
              </View>
            </View>

            <Text style={styles.subtleText}>Securely authenticating with Pabbly Accounts</Text>
          </View>

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
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              userAgent={Platform.select({
                ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
              })}
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 28,
    padding: 36,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 15,
    minWidth: 300,
    maxWidth: 340,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: 120,
    height: 120,
  },
  glowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.primary.main,
    borderRightColor: colors.primary.light,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.grey[100],
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  miniSpinnerContainer: {
    position: 'absolute',
    bottom: -5,
    backgroundColor: colors.common.white,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.grey[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: 4,
  },
  subtleText: {
    fontSize: 12,
    color: colors.text.disabled,
    textAlign: 'center',
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
