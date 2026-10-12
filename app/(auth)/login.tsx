import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { COLORS, SPACING } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

const { width, height } = Dimensions.get('window');

// Same mystical video as welcome
const VIDEO_URL = 'https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-tunnel-of-colorful-lights-31513-large.mp4';

// Advisor App Logo (pink diamond)
// Use local icon asset
const ADVISOR_LOGO_URL = require("../../assets/icon.png");

// Backend URL from env
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';

// Google OAuth Client IDs for Advisors app
const GOOGLE_WEB_CLIENT_ID = '512681929226-37j50jbk2jvu09picvht72uhhdif2dut.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '512681929226-7kjg1t62ltoubj5k1143ab1edp3kcsof.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '512681929226-go61m3ld94n91fghqo8uqo4bnahvn6h8.apps.googleusercontent.com';

// Ensure WebBrowser redirect completes properly
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const videoRef = useRef<Video>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // ADV-020: Failed attempts and 15-minute account lockout policy
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playAsync();
    }
  }, []);

  const handleLogin = async () => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingMins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      Alert.alert('Account Locked 🔒', `Too many failed login attempts. Account locked for ${remainingMins} more minutes.`);
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    
    try {
      // First check if this email has a pending/rejected application
      const appResponse = await fetch(`${BACKEND_URL}/api/applications/email/${email.toLowerCase()}`);
      const appData = await appResponse.json();
      
      if (appResponse.ok && appData) {
        // User has an application
        if (appData.status === 'pending') {
          setIsLoading(false);
          router.replace('/application/pending');
          return;
        } else if (appData.status === 'rejected') {
          setIsLoading(false);
          Alert.alert(
            'Account Rejected',
            'Your application was not approved. You cannot access this app.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        // If approved, continue with login
      }
      
      // Proceed with login
      const result = await login(email, password);
      setIsLoading(false);

      if (result.success) {
        router.replace('/(tabs)/dashboard');
      } else {
        const errorMessage = result.error || 'Invalid credentials';
        
        // Check if account doesn't exist
        if (errorMessage.toLowerCase().includes('not found') || 
            errorMessage.toLowerCase().includes('does not exist') ||
            errorMessage.toLowerCase().includes('no account')) {
          // Store the email for the application form
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('signup_email', email.toLowerCase());
          
          Alert.alert(
            'Account Not Found',
            'No advisor account found with this email. Would you like to apply as an advisor?',
            [
              { text: 'Apply Now', onPress: () => router.push('/application') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          return;
        }
        
        // Differentiate between network errors and credential errors
        if (errorMessage.toLowerCase().includes('network') || 
            errorMessage.toLowerCase().includes('fetch') ||
            errorMessage.toLowerCase().includes('connection') ||
            errorMessage.toLowerCase().includes('timeout')) {
          setLoginError('Unable to connect. Please check your internet connection.');
          Alert.alert(
            'Connection Error',
            'Unable to connect to the server. Please check your internet connection and try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: handleLogin }
            ]
          );
        } else if (errorMessage.toLowerCase().includes('invalid') || 
                   errorMessage.toLowerCase().includes('incorrect') ||
                   errorMessage.toLowerCase().includes('credentials') ||
                   errorMessage.toLowerCase().includes('password') ||
                   errorMessage.toLowerCase().includes('email') ||
                   errorMessage.toLowerCase().includes('unauthorized')) {
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);
          if (nextAttempts >= 5) {
            setLockoutUntil(Date.now() + 15 * 60 * 1000);
            Alert.alert('Account Locked 🔒', 'Too many failed login attempts. Your account is temporarily locked for 15 minutes.');
          } else {
            setLoginError(`Invalid credentials (${5 - nextAttempts} attempts remaining before lockout).`);
            Alert.alert('Login Failed', `Invalid email or password. ${5 - nextAttempts} attempts remaining.`);
          }
        } else {
          setLoginError(errorMessage);
          Alert.alert('Login Failed', errorMessage);
        }
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Login error:', error);
      // If checking application fails, just proceed with normal login
      const result = await login(email, password);
      if (result.success) {
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    }
  };

  // GOOGLE SIGN-IN with OAuth
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleToken(authentication.accessToken);
      }
    }
  }, [response]);

  const handleGoogleToken = async (accessToken: string) => {
    setIsLoading(true);
    try {
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const googleUser = await userInfoResponse.json();

      // For advisors, we check if they're already registered as a psychic
      // If not, they need to apply through the application flow
      Alert.alert(
        'Welcome!',
        'To become an advisor, please complete our application process.',
        [
          { text: 'Apply Now', onPress: () => router.push('/application') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Sign-In Error', error.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Sign-In Error', 'Failed to initiate Google Sign-In. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        ref={videoRef}
        source={{ uri: VIDEO_URL }}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Dark Overlay */}
      <LinearGradient
        colors={['rgba(13,13,13,0.5)', 'rgba(13,13,13,0.85)', 'rgba(13,13,13,0.95)']}
        style={styles.overlay}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={ADVISOR_LOGO_URL}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login to your advisor account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* ADV-012: Password visibility eye toggle */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#7C4DFF', '#5C2DC9']}
                style={styles.loginGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.footerText}>Not an advisor yet?</Text>
            <TouchableOpacity onPress={() => router.push('/application')}>
              <Text style={styles.applyLink}>Apply Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: width,
    height: height,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 16,
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#7C4DFF',
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loginGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  applyLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C4DFF',
  },
});
