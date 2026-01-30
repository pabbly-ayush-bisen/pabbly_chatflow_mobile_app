import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
  Image,
  Linking,
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
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { signIn, checkSession, clearError, tokenAuth, googleSignIn } from '../../redux/slices/userSlice';
import { colors } from '../../theme';
import ChatflowLogo from '../../components/ChatflowLogo';
import { APP_CONFIG } from '../../config/app.config';
import PabblyAuthWebView from '../../components/PabblyAuthWebView';

// Ensure WebBrowser dismisses properly for auth sessions
WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loading, error, authenticated } = useSelector((state) => state.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAuthWebView, setShowAuthWebView] = useState(false);
  const [isGoogleAuthMode, setIsGoogleAuthMode] = useState(false); // Track if using Google auth via WebView

  // Get the redirect URI for OAuth callbacks using the custom scheme
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'pabblychatflow',
  });

  // Google OAuth endpoints
  const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

  // Build the Expo auth proxy redirect URI from config
  // Format: https://auth.expo.io/@<username>/<slug>
  // This MUST match EXACTLY what's configured in Google Cloud Console
  const oauthRedirectUri = `https://auth.expo.io/@${APP_CONFIG.google.expoUsername}/${APP_CONFIG.google.expoSlug}`;

  // Native Google Sign-In configuration
  // In Expo Go, this uses the auth.expo.io proxy
  // In production/development builds, it uses native redirects
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: APP_CONFIG.google.webClientId,
    iosClientId: APP_CONFIG.google.iosClientId,
    androidClientId: APP_CONFIG.google.androidClientId,
    scopes: ['profile', 'email'],
  });

  // Log redirect URI for debugging (remove in production)
  useEffect(() => {
    console.log('\n========================================');
    console.log('       GOOGLE OAUTH CONFIGURATION      ');
    console.log('========================================');
    console.log('[LoginScreen] Custom Scheme Redirect URI:', redirectUri);
    console.log('[LoginScreen] Expected Expo Redirect URI:', oauthRedirectUri);

    if (googleRequest) {
      console.log('\n*** IMPORTANT: ADD THIS URI TO GOOGLE CLOUD CONSOLE ***');
      console.log('Redirect URI from expo-auth-session:', googleRequest.redirectUri);
      console.log('*******************************************************\n');
      console.log('[LoginScreen] Google Request Details:');
      console.log('  - codeVerifier:', googleRequest.codeVerifier ? 'present' : 'missing');
      console.log('  - state:', googleRequest.state);
      console.log('  - Full OAuth URL:', googleRequest.url);
    } else {
      console.log('[LoginScreen] Google Request: Not ready yet...');
    }
    console.log('========================================\n');
  }, [redirectUri, googleRequest]);

  // Handle Google OAuth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type === 'success') {
        console.log('[Google Native] Authentication successful');
        console.log('[Google Native] Response:', JSON.stringify(googleResponse, null, 2));

        const { authentication } = googleResponse;
        const accessToken = authentication?.accessToken;
        const idToken = authentication?.idToken;

        console.log('[Google Native] Access Token:', accessToken ? 'Present' : 'Missing');
        console.log('[Google Native] ID Token:', idToken ? 'Present' : 'Missing');

        if (accessToken || idToken) {
          try {
            setGoogleLoading(true);
            // Send Google token to backend for verification and login
            const result = await dispatch(googleSignIn({
              googleToken: idToken || accessToken,
              accessToken: accessToken,
            })).unwrap();

            console.log('[Google Native] Backend response:', JSON.stringify(result, null, 2));

            if (result.status === 'success') {
              await dispatch(checkSession());
            }
          } catch (err) {
            console.log('[Google Native] Error:', err);
            Alert.alert('Login Failed', err.message || 'Google authentication failed');
          } finally {
            setGoogleLoading(false);
          }
        }
      } else if (googleResponse?.type === 'error') {
        console.log('[Google Native] Error:', googleResponse.error);
        Alert.alert('Login Error', googleResponse.error?.message || 'Google sign-in failed');
        setGoogleLoading(false);
      } else if (googleResponse?.type === 'cancel') {
        console.log('[Google Native] User cancelled');
        setGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [googleResponse, dispatch]);

  // Handle deep link for auth callback (fallback for web-based auth)
  const handleDeepLink = useCallback(async (event) => {
    const url = event.url;
    if (url && url.includes('token=')) {
      try {
        setGoogleLoading(true);
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');
        const project = urlObj.searchParams.get('s') || 'pcf';
        const paymentLink = urlObj.searchParams.get('pl');

        if (token) {
          const result = await dispatch(tokenAuth({ token, project, paymentLink })).unwrap();
          if (result.status === 'success') {
            await dispatch(checkSession());
          }
        }
      } catch (err) {
        Alert.alert('Login Failed', err.message || 'Authentication failed');
      } finally {
        setGoogleLoading(false);
      }
    }
  }, [dispatch]);

  // Listen for deep links (fallback)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription?.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    // Log:('Login Screen - authenticated:', authenticated);
  }, [authenticated]);

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

  // Handle Google login - Uses expo-auth-session's Google provider
  // In Expo Go: Opens browser via auth.expo.io proxy → Google account picker → redirect back
  // In Dev/Prod builds: Uses native Google Sign-In
  const handleGoogleLogin = async () => {
    console.log('========================================');
    console.log('[LoginScreen] GOOGLE LOGIN BUTTON PRESSED');
    console.log('========================================');
    console.log('[LoginScreen] Timestamp:', new Date().toISOString());
    console.log('[LoginScreen] Google Request ready:', !!googleRequest);

    if (googleRequest) {
      console.log('[LoginScreen] Google Request redirect URI:', googleRequest.redirectUri);
    }

    try {
      setGoogleLoading(true);

      if (!googleRequest) {
        console.log('[Google Auth] Request not ready, please wait...');
        Alert.alert('Please Wait', 'Google Sign-In is initializing. Please try again in a moment.');
        setGoogleLoading(false);
        return;
      }

      // Log the redirect URI that expo-auth-session will use
      console.log('=== EXPO AUTH SESSION INFO ===');
      console.log('Redirect URI being used:', googleRequest.redirectUri);
      console.log('This URI must be in Google Cloud Console → Web Client → Authorized redirect URIs');
      console.log('==============================');

      // Use expo-auth-session's Google provider
      // This properly integrates with Expo's auth proxy for Expo Go
      console.log('[Google Auth] Calling googlePromptAsync()...');
      const result = await googlePromptAsync();

      console.log('[Google Auth] Prompt result:', JSON.stringify(result, null, 2));

      // The response will be handled by the useEffect watching googleResponse
      if (result?.type === 'success') {
        console.log('[Google Auth] Success - token will be processed by useEffect');
      } else if (result?.type === 'cancel' || result?.type === 'dismiss') {
        console.log('[Google Auth] User cancelled or dismissed');
        setGoogleLoading(false);
      } else if (result?.type === 'error') {
        console.log('[Google Auth] Error:', result.error);
        Alert.alert('Login Error', result.error?.message || 'Google sign-in failed. Please check Google Cloud Console configuration.');
        setGoogleLoading(false);
      } else {
        console.log('[Google Auth] Unexpected result type:', result?.type);
        setGoogleLoading(false);
      }
    } catch (error) {
      console.log('[Google Auth] Exception:', error);
      Alert.alert('Login Error', error.message || 'Failed to start Google sign-in');
      setGoogleLoading(false);
    }
  };

  // Legacy fallback methods (kept for reference but not used)
  // Native Google Sign-In - requires Google OAuth Client IDs setup
  const handleGoogleLoginNative = async () => {
    try {
      console.log('[Google Native] Starting native Google Sign-In...');
      console.log('[Google Native] Request ready:', !!googleRequest);

      if (!googleRequest) {
        console.log('[Google Native] Google request not ready, falling back to web-based auth');
        handleGoogleLogin(); // Use WebView-based auth
        return;
      }

      setGoogleLoading(true);

      // Prompt user to select their Google account
      // This will show the native Google account picker on the device
      const result = await googlePromptAsync();

      console.log('[Google Native] Prompt result type:', result?.type);

      if (result?.type !== 'success') {
        // Response will be handled by the useEffect
        if (result?.type !== 'cancel' && result?.type !== 'dismiss') {
          setGoogleLoading(false);
        }
      }
      // Success case is handled by the useEffect watching googleResponse
    } catch (err) {
      console.log('[Google Native] Error:', err);
      Alert.alert('Login Error', err.message || 'Failed to start Google sign-in');
      setGoogleLoading(false);
    }
  };

  // Fallback: Web browser-based Google login via Pabbly Accounts
  const handleGoogleLoginFallback = async () => {
    try {
      console.log('[Google Fallback] Starting web-based Google Sign-In...');
      setGoogleLoading(true);

      // Open Pabbly Accounts with Google provider
      const googleAuthUrl = `${APP_CONFIG.pabblyAccountsUrl}/backend/access?project=${APP_CONFIG.pabblyProject}&provider=google&redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log('[Google Fallback] Auth URL:', googleAuthUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        redirectUri,
        {
          showInRecents: true,
          preferEphemeralSession: false,
        }
      );

      console.log('[Google Fallback] Browser result type:', result.type);

      if (result.type === 'success' && result.url) {
        await handleDeepLink({ url: result.url });
      } else {
        setGoogleLoading(false);
      }
    } catch (err) {
      console.log('[Google Fallback] Error:', err);
      Alert.alert('Login Error', err.message || 'Failed to open Google login');
      setGoogleLoading(false);
    }
  };

  // Handle login - WebView-based authentication
  // User enters email/password in the app, WebView handles Pabbly's cookie-based auth internally
  const handleLogin = async () => {
    console.log('========================================');
    console.log('[LoginScreen] LOGIN BUTTON PRESSED');
    console.log('========================================');
    console.log('[LoginScreen] Timestamp:', new Date().toISOString());
    console.log('[LoginScreen] Email entered:', email.trim());
    console.log('[LoginScreen] Password length:', password.length);
    console.log('[LoginScreen] Remember me:', rememberMe);

    if (!validateForm()) {
      console.log('[LoginScreen] Form validation FAILED');
      console.log('[LoginScreen] Validation errors:', JSON.stringify(errors));
      return;
    }

    console.log('[LoginScreen] Form validation PASSED');
    console.log('[LoginScreen] Starting WebView-based authentication...');
    console.log('[LoginScreen] Config - Pabbly Accounts URL:', APP_CONFIG.pabblyAccountsUrl);
    console.log('[LoginScreen] Config - Project code:', APP_CONFIG.pabblyProject);
    console.log('[LoginScreen] Config - ChatFlow API URL:', APP_CONFIG.apiUrl);

    // Show the WebView-based authentication modal
    // The WebView will:
    // 1. Load Pabbly login page
    // 2. Inject email/password credentials
    // 3. Submit the form
    // 4. Navigate to ChatFlow access page
    // 5. Capture the redirect token
    // 6. Authenticate with ChatFlow via tokenAuth
    console.log('[LoginScreen] Opening PabblyAuthWebView modal...');
    setShowAuthWebView(true);
  };

  // Handle successful authentication from WebView
  const handleAuthSuccess = useCallback(() => {
    console.log('========================================');
    console.log('[LoginScreen] AUTHENTICATION SUCCESS');
    console.log('========================================');
    console.log('[LoginScreen] Timestamp:', new Date().toISOString());
    console.log('[LoginScreen] Auth mode was:', isGoogleAuthMode ? 'Google' : 'Email/Password');
    console.log('[LoginScreen] User authenticated successfully via WebView');
    console.log('[LoginScreen] Closing WebView modal...');
    setShowAuthWebView(false);
    setIsGoogleAuthMode(false);
    setGoogleLoading(false);
    console.log('[LoginScreen] User should now be redirected to Dashboard');
    // User state is updated by checkSession in the WebView component
  }, [isGoogleAuthMode]);

  // Handle authentication error from WebView
  const handleAuthError = useCallback((errorMessage) => {
    console.log('========================================');
    console.log('[LoginScreen] AUTHENTICATION ERROR');
    console.log('========================================');
    console.log('[LoginScreen] Timestamp:', new Date().toISOString());
    console.log('[LoginScreen] Auth mode was:', isGoogleAuthMode ? 'Google' : 'Email/Password');
    console.log('[LoginScreen] Error message:', errorMessage);
    setShowAuthWebView(false);
    setIsGoogleAuthMode(false);
    setGoogleLoading(false);

    // Provide helpful error messages based on the error type
    let title = 'Login Failed';
    let message = errorMessage || 'Authentication failed. Please try again.';

    if (isGoogleAuthMode) {
      // Check for common Google Sign-In issues
      if (errorMessage?.includes('blocked') || errorMessage?.includes('disallowed')) {
        title = 'Google Sign-In Blocked';
        message = 'Google may have blocked the sign-in attempt. Please try again or use email/password login.';
      } else if (errorMessage?.includes('network') || errorMessage?.includes('connection')) {
        title = 'Network Error';
        message = 'Please check your internet connection and try again.';
      } else if (errorMessage?.includes('token') || errorMessage?.includes('Token')) {
        title = 'Authentication Error';
        message = 'Failed to complete Google sign-in. Please try again.';
      }
    }

    Alert.alert(title, message);
  }, [isGoogleAuthMode]);

  // Handle WebView close
  const handleAuthClose = useCallback(() => {
    console.log('[LoginScreen] Auth WebView closed by user');
    console.log('[LoginScreen] Timestamp:', new Date().toISOString());
    console.log('[LoginScreen] Auth mode was:', isGoogleAuthMode ? 'Google' : 'Email/Password');
    setShowAuthWebView(false);
    setIsGoogleAuthMode(false);
    setGoogleLoading(false);
  }, [isGoogleAuthMode]);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#F0FDF4', '#ECFDF5', '#F8FAFC']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative circles */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <ChatflowLogo width={SCREEN_WIDTH * 0.32} />
              </View>
            </View>

            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome Back!</Text>
              <Text style={styles.subtitleText}>
                Sign in to manage your WhatsApp business
              </Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
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
                  left={<TextInput.Icon icon="email-outline" color={colors.grey[400]} />}
                  style={styles.input}
                  outlineStyle={[
                    styles.inputOutline,
                    errors.email && styles.inputOutlineError
                  ]}
                  error={!!errors.email}
                  disabled={loading}
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
              <View style={styles.inputContainer}>
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
                  left={<TextInput.Icon icon="lock-outline" color={colors.grey[400]} />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onPress={() => setShowPassword(!showPassword)}
                      color={colors.grey[400]}
                    />
                  }
                  style={styles.input}
                  outlineStyle={[
                    styles.inputOutline,
                    errors.password && styles.inputOutlineError
                  ]}
                  error={!!errors.password}
                  disabled={loading}
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
                style={styles.loginButton}
                contentStyle={styles.loginButtonContent}
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
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.divider} />
              </View>

              {/* Google Login Button */}
              <Button
                mode="outlined"
                onPress={handleGoogleLogin}
                style={styles.socialButton}
                contentStyle={styles.socialButtonContent}
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
                    // Open Pabbly signup page
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
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By signing in, you agree to our{' '}
                <Text style={styles.linkText}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* WebView-based Authentication Modal */}
      {/* Supports both email/password and Google OAuth modes */}
      <PabblyAuthWebView
        visible={showAuthWebView}
        onClose={handleAuthClose}
        email={email.trim()}
        password={password}
        onSuccess={handleAuthSuccess}
        onError={handleAuthError}
        googleAuthMode={isGoogleAuthMode}
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
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(32, 178, 118, 0.08)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(32, 178, 118, 0.05)',
    bottom: 100,
    left: -80,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Welcome Section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Form Section
  formSection: {
    backgroundColor: colors.common.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.common.white,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[300],
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

  // Options Row
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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

  // Login Button
  loginButton: {
    borderRadius: 12,
    marginBottom: 16,
  },
  loginButtonContent: {
    height: 48,
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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

  // Social Login Button (Google)
  socialButton: {
    borderRadius: 12,
    borderColor: colors.grey[300],
    borderWidth: 1.5,
    marginBottom: 16,
  },
  socialButtonContent: {
    height: 46,
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
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  socialIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  // Sign Up
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  signUpLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Footer
  footer: {
    marginTop: 16,
    paddingHorizontal: 16,
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
