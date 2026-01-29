import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
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
import { signIn, checkSession, clearError } from '../../redux/slices/userSlice';
import { colors } from '../../theme';
import ChatflowLogo from '../../components/ChatflowLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loading, error, authenticated } = useSelector((state) => state.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

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

  // Handle login - Same as web app: signIn then checkSession
  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(signIn({ email: email.trim(), password })).unwrap();
      if (result.status === 'success') {
        // Web app calls checkSession immediately after successful login
        await dispatch(checkSession());
      }
    } catch (err) {
      // Error is handled by the error useEffect
      // Error:('Login failed:', err);
    }
  };

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
                <ChatflowLogo width={SCREEN_WIDTH * 0.45} />
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
                  onPress={() => { /* Log:('Forgot password') */ }}
                  textColor={colors.primary.main}
                  disabled={loading}
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
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Don't have an account?</Text>
                <Button
                  mode="text"
                  onPress={() => { /* Log:('Sign up') */ }}
                  textColor={colors.primary.main}
                  disabled={loading}
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
    paddingTop: 40,
    paddingBottom: 24,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Welcome Section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Form Section
  formSection: {
    backgroundColor: colors.common.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 20,
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
    marginBottom: 24,
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
    marginBottom: 20,
  },
  loginButtonContent: {
    height: 52,
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
    marginBottom: 20,
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
    marginTop: 24,
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
