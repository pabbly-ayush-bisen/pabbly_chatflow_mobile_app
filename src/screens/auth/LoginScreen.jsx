import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  Animated,
  Easing,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Checkbox,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { clearError } from '../../redux/slices/userSlice';
import { colors } from '../../theme';
import ChatflowLogo from '../../components/ChatflowLogo';
import { APP_CONFIG } from '../../config/app.config';
import PabblyAuthWebView from '../../components/PabblyAuthWebView';
import GoogleAuthWebView from '../../components/GoogleAuthWebView';
import { showError, toastActions } from '../../utils/toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive sizing based on screen height
const isSmallScreen = SCREEN_HEIGHT < 700;

// Dynamic sizes
const LOGO_SIZE = isSmallScreen ? SCREEN_WIDTH * 0.35 : SCREEN_WIDTH * 0.4;
const WELCOME_FONT_SIZE = isSmallScreen ? 24 : 28;
const SUBTITLE_FONT_SIZE = isSmallScreen ? 13 : 15;
const INPUT_HEIGHT = isSmallScreen ? 44 : 48;
const BUTTON_HEIGHT = isSmallScreen ? 44 : 48;
const SPACING = {
  logoMargin: isSmallScreen ? 20 : 28,
  welcomeMargin: isSmallScreen ? 12 : 16,
  formPadding: isSmallScreen ? 16 : 20,
  inputMargin: isSmallScreen ? 10 : 12,
  buttonMargin: isSmallScreen ? 12 : 14,
};

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAuthWebView, setShowAuthWebView] = useState(false);
  const [showGoogleAuthWebView, setShowGoogleAuthWebView] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formSlideAnim = useRef(new Animated.Value(40)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      // Logo animation
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      // Header fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Form fade in with delay
      Animated.timing(formFadeAnim, {
        toValue: 1,
        duration: 700,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Handle errors from Redux
  useEffect(() => {
    if (error) {
      toastActions.loginFailed(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Google login - Opens visible WebView for Google authentication
  const handleGoogleLogin = () => {
    setShowGoogleAuthWebView(true);
  };

  // Handle Google auth success
  const handleGoogleAuthSuccess = () => {
    setShowGoogleAuthWebView(false);
    setGoogleLoading(false);
  };

  // Handle Google auth error
  const handleGoogleAuthError = (errorMessage) => {
    setShowGoogleAuthWebView(false);
    setGoogleLoading(false);
    showError(errorMessage || 'Google authentication failed', 'Login Failed');
  };

  // Handle Google auth close
  const handleGoogleAuthClose = () => {
    setShowGoogleAuthWebView(false);
    setGoogleLoading(false);
  };

  // Handle email/password login - WebView-based authentication
  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }
    setShowAuthWebView(true);
  };

  // Handle successful authentication from WebView
  const handleAuthSuccess = useCallback(() => {
    setShowAuthWebView(false);
  }, []);

  // Handle authentication error from WebView
  const handleAuthError = useCallback((errorMessage) => {
    setShowAuthWebView(false);
    showError(errorMessage || 'Authentication failed. Please try again.', 'Login Failed');
  }, []);

  // Handle WebView close
  const handleAuthClose = useCallback(() => {
    setShowAuthWebView(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#F0FDF4', '#ECFDF5', '#F8FAFC']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative circles with animation-ready positioning */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            overScrollMode="always"
          >
            {/* Logo Section with Animation */}
            <Animated.View
              style={[
                styles.logoSection,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: logoScaleAnim }],
                  marginBottom: SPACING.logoMargin,
                },
              ]}
            >
              <View style={styles.logoContainer}>
                <View style={[styles.logoGlow, { width: LOGO_SIZE * 0.9, height: LOGO_SIZE * 0.9, borderRadius: LOGO_SIZE * 0.45 }]} />
                <ChatflowLogo width={LOGO_SIZE} />
              </View>
            </Animated.View>

            {/* Welcome Section with Animation */}
            <Animated.View
              style={[
                styles.welcomeSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                  marginBottom: SPACING.welcomeMargin,
                },
              ]}
            >
              <Text style={[styles.welcomeText, { fontSize: WELCOME_FONT_SIZE }]}>Welcome</Text>
              <Text style={[styles.subtitleText, { fontSize: SUBTITLE_FONT_SIZE }]}>
                Sign in to manage your WhatsApp business
              </Text>
            </Animated.View>

            {/* Form Section with Animation */}
            <Animated.View
              style={[
                styles.formSection,
                {
                  opacity: formFadeAnim,
                  transform: [{ translateY: formSlideAnim }],
                  padding: SPACING.formPadding,
                  paddingTop: SPACING.formPadding + 4,
                },
              ]}
            >
              {/* Email Input */}
              <View style={[styles.inputContainer, { marginBottom: SPACING.inputMargin }]}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="Enter your email"
                  placeholderTextColor={colors.grey[400]}
                  left={<TextInput.Icon icon="email-outline" color={colors.grey[400]} size={isSmallScreen ? 18 : 20} />}
                  style={[styles.input, { height: INPUT_HEIGHT }]}
                  outlineStyle={[
                    styles.inputOutline,
                    errors.email && styles.inputOutlineError
                  ]}
                  error={!!errors.email}
                  disabled={loading}
                  dense={isSmallScreen}
                  theme={{
                    colors: {
                      primary: colors.primary.main,
                      error: colors.error.main,
                      background: colors.common.white,
                    },
                  }}
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={[styles.inputContainer, { marginBottom: SPACING.inputMargin }]}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.grey[400]}
                  left={<TextInput.Icon icon="lock-outline" color={colors.grey[400]} size={isSmallScreen ? 18 : 20} />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onPress={() => setShowPassword(!showPassword)}
                      color={colors.grey[400]}
                      size={isSmallScreen ? 18 : 20}
                    />
                  }
                  style={[styles.input, { height: INPUT_HEIGHT }]}
                  outlineStyle={[
                    styles.inputOutline,
                    errors.password && styles.inputOutlineError
                  ]}
                  error={!!errors.password}
                  disabled={loading}
                  dense={isSmallScreen}
                  theme={{
                    colors: {
                      primary: colors.primary.main,
                      error: colors.error.main,
                      background: colors.common.white,
                    },
                  }}
                />
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Options Row */}
              <View style={styles.optionsRow}>
                <View style={styles.rememberMe}>
                  <Checkbox
                    status={rememberMe ? 'checked' : 'unchecked'}
                    onPress={() => setRememberMe(!rememberMe)}
                    disabled={loading}
                    color={colors.primary.main}
                  />
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </View>
                <Button
                  mode="text"
                  onPress={() => {
                    WebBrowser.openBrowserAsync(`${APP_CONFIG.pabblyAccountsUrl}/forgot-password`);
                  }}
                  textColor={colors.primary.main}
                  disabled={loading || googleLoading}
                  compact
                  labelStyle={styles.forgotPasswordLabel}
                >
                  Forgot Password?
                </Button>
              </View>

              {/* Login Button */}
              <Button
                mode="contained"
                onPress={handleLogin}
                style={[styles.loginButton, { marginBottom: SPACING.buttonMargin }]}
                contentStyle={[styles.loginButtonContent, { height: BUTTON_HEIGHT }]}
                labelStyle={styles.loginButtonLabel}
                disabled={loading}
                buttonColor={colors.primary.main}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  'Sign In'
                )}
              </Button>

              {/* Divider */}
              <View style={[styles.dividerContainer, { marginBottom: SPACING.buttonMargin }]}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.divider} />
              </View>

              {/* Google Login Button */}
              <Button
                mode="outlined"
                onPress={handleGoogleLogin}
                style={[styles.socialButton, { marginBottom: SPACING.inputMargin }]}
                contentStyle={[styles.socialButtonContent, { height: BUTTON_HEIGHT }]}
                labelStyle={styles.socialButtonLabel}
                disabled={loading || googleLoading}
                icon={() => (
                  <View style={styles.socialIconContainer}>
                    {googleLoading ? (
                      <ActivityIndicator color={colors.text.primary} size="small" />
                    ) : (
                      <Image
                        source={{ uri: 'https://www.google.com/favicon.ico' }}
                        style={styles.socialIcon}
                      />
                    )}
                  </View>
                )}
              >
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Button>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Don't have an account?</Text>
                <Button
                  mode="text"
                  onPress={() => {
                    WebBrowser.openBrowserAsync(`${APP_CONFIG.pabblyAccountsUrl}/signup`);
                  }}
                  textColor={colors.primary.main}
                  disabled={loading || googleLoading}
                  labelStyle={styles.signUpLabel}
                  compact
                >
                  Sign Up
                </Button>
              </View>
            </Animated.View>

            {/* Footer with Animation - Only show on larger screens */}
            {!isSmallScreen && (
              <Animated.View
                style={[
                  styles.footer,
                  {
                    opacity: formFadeAnim,
                  },
                ]}
              >
                <Text style={styles.footerText}>
                  By signing in, you agree to our{' '}
                  <Text style={styles.linkText}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Email/Password Authentication WebView */}
      <PabblyAuthWebView
        visible={showAuthWebView}
        onClose={handleAuthClose}
        email={email.trim()}
        password={password}
        onSuccess={handleAuthSuccess}
        onError={handleAuthError}
      />

      {/* Google Auth WebView */}
      <GoogleAuthWebView
        visible={showGoogleAuthWebView}
        onClose={handleGoogleAuthClose}
        onSuccess={handleGoogleAuthSuccess}
        onError={handleGoogleAuthError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(32, 178, 118, 0.08)',
    top: -120,
    right: -120,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(32, 178, 118, 0.06)',
    bottom: 80,
    left: -100,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(32, 178, 118, 0.04)',
    top: '40%',
    right: -60,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 4,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 178, 118, 0.12)',
  },
  welcomeSection: {
    alignItems: 'center',
  },
  welcomeText: {
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitleText: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  formSection: {
    backgroundColor: colors.common.white,
    borderRadius: 24,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(32, 178, 118, 0.08)',
  },
  inputContainer: {
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.grey[50],
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
  },
  inputOutlineError: {
    borderColor: colors.error.main,
  },
  errorText: {
    color: colors.error.main,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberMeText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  forgotPasswordLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonContent: {
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.grey[200],
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: colors.text.disabled,
    fontWeight: '500',
  },
  socialButton: {
    borderRadius: 12,
    borderColor: colors.grey[200],
    borderWidth: 1.5,
    backgroundColor: colors.common.white,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 12,
  },
  socialIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  socialIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 2,
  },
  signUpText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  signUpLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary.main,
    fontWeight: '500',
  },
});
