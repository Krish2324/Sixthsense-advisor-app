import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ImageBackground,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Mystical cosmic/nebula video for psychic theme
const VIDEO_URL = 'https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-tunnel-of-colorful-lights-31513-large.mp4';
// Fallback image if video doesn't load
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800';
// Advisor App Logo (pink diamond)
// Use local icon asset
const ADVISOR_LOGO_URL = require("../../assets/icon.png");

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [showFallback, setShowFallback] = useState(false);
  
  // Hiring status
  const [isHiring, setIsHiring] = useState(true);
  const [hiringMessage, setHiringMessage] = useState('');
  const [checkingHiring, setCheckingHiring] = useState(true);
  
  // Waitlist
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  useEffect(() => {
    const loadVideo = async () => {
      if (videoRef.current) {
        try {
          await videoRef.current.playAsync();
        } catch (_error) {
          console.log('Video failed to load, using fallback');
          setShowFallback(true);
        }
      }
    };
    
    // Small delay to ensure component is mounted
    const timer = setTimeout(loadVideo, 100);
    return () => clearTimeout(timer);
  }, []);

  // Check hiring status on mount
  useEffect(() => {
    const checkHiringStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/admin/hiring-status`);
        if (response.ok) {
          const data = await response.json();
          setIsHiring(data.is_hiring);
          setHiringMessage(data.message || 'We are not currently hiring. Leave your email and we will contact you when positions open up.');
        }
      } catch (_error) {
        console.error('Error checking hiring status');
        // Default to hiring open if API fails
        setIsHiring(true);
      } finally {
        setCheckingHiring(false);
      }
    };
    
    checkHiringStatus();
  }, []);

  const handleJoinWaitlist = async () => {
    if (!waitlistEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(waitlistEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    setSubmittingWaitlist(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/hiring-waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail.trim().toLowerCase() }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setWaitlistSubmitted(true);
        Alert.alert('Success', data.message || "You've been added to the waitlist!");
      } else {
        Alert.alert('Error', data.detail || 'Failed to join waitlist');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const renderBackground = () => {
    if (showFallback || Platform.OS === 'web') {
      return (
        <ImageBackground
          source={{ uri: FALLBACK_IMAGE }}
          style={styles.backgroundVideo}
          resizeMode="cover"
        />
      );
    }
    
    return (
      <Video
        ref={videoRef}
        source={{ uri: VIDEO_URL }}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onError={() => setShowFallback(true)}
      />
    );
  };

  const renderApplyButton = () => {
    if (checkingHiring) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#7C4DFF" />
        </View>
      );
    }
    
    if (!isHiring) {
      // Show "Not Hiring" message and waitlist option
      return (
        <View style={styles.notHiringContainer}>
          <View style={styles.notHiringBanner}>
            <Ionicons name="information-circle" size={24} color="#FFD740" />
            <Text style={styles.notHiringText}>{hiringMessage}</Text>
          </View>
          
          {!waitlistSubmitted ? (
            <View style={styles.waitlistContainer}>
              <Text style={styles.waitlistTitle}>Join the Waitlist</Text>
              <View style={styles.waitlistInputContainer}>
                <TextInput
                  style={styles.waitlistInput}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={waitlistEmail}
                  onChangeText={setWaitlistEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.waitlistButton}
                  onPress={handleJoinWaitlist}
                  disabled={submittingWaitlist}
                >
                  {submittingWaitlist ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.waitlistSuccessContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4CD964" />
              <Text style={styles.waitlistSuccessText}>You&apos;re on the waitlist!</Text>
              <Text style={styles.waitlistSuccessSubtext}>We&apos;ll notify you when positions open up.</Text>
            </View>
          )}
        </View>
      );
    }
    
    // Normal "Apply" button when hiring
    return (
      <TouchableOpacity
        style={styles.applyButton}
        onPress={() => router.push('/application')}
      >
        <LinearGradient
          colors={['#7C4DFF', '#5C2DC9']}
          style={styles.applyGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.applyButtonText}>Apply to Become an Advisor</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Video/Image Background */}
      {renderBackground()}

      {/* Dark Overlay */}
      <LinearGradient
        colors={['rgba(13,13,13,0.4)', 'rgba(13,13,13,0.8)', 'rgba(13,13,13,0.95)']}
        style={styles.overlay}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={ADVISOR_LOGO_URL}
              style={styles.logoImage}
            />
          </View>
          <Text style={styles.appName}>Sixth Sense Advisors</Text>
          <Text style={styles.tagline}>Share Your Gift With The World</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 215, 64, 0.15)' }]}>
              <Ionicons name="wallet" size={26} color="#FFD740" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Earn Your Way</Text>
              <Text style={styles.featureDesc}>Set your own rates, work on your terms</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
              <Ionicons name="time" size={26} color="#00E5FF" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Flexible Schedule</Text>
              <Text style={styles.featureDesc}>Work when you want, from anywhere</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(124, 77, 255, 0.15)' }]}>
              <Ionicons name="people" size={26} color="#7C4DFF" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Global Clients</Text>
              <Text style={styles.featureDesc}>Connect with seekers worldwide</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={[styles.buttons, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          {renderApplyButton()}
        </View>
      </View>
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
  content: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 20,
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 22,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(124, 77, 255, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.7)',
  },
  features: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  buttons: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 14,
  },
  loginButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#7C4DFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#7C4DFF',
  },
  applyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  applyGradient: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  loadingContainer: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notHiringContainer: {
    gap: 16,
  },
  notHiringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 64, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 64, 0.3)',
    gap: 12,
  },
  notHiringText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  waitlistContainer: {
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 77, 255, 0.3)',
  },
  waitlistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  waitlistInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  waitlistInput: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  waitlistButton: {
    width: 48,
    height: 48,
    backgroundColor: '#7C4DFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitlistSuccessContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(76, 217, 100, 0.1)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.3)',
    gap: 8,
  },
  waitlistSuccessText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CD964',
  },
  waitlistSuccessSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
