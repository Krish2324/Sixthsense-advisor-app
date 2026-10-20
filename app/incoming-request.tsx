import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';

const { width, height } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.73:8000';

export default function IncomingRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  
  const requestId = params.requestId as string;
  const clientName = params.clientName as string || 'Client';
  const clientType = params.clientType as string || 'NEW CLIENT';
  const sessionType = params.sessionType as string || 'chat';
  const rate = parseFloat(params.rate as string || '2.99');
  const minutes = parseInt(params.minutes as string || '5');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timeoutTimerRef = useRef<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    // ADV-022: Configure high-priority incoming call audio ringtone & vibration
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    }).catch(() => null);

    // ADV-029: 30-second request timeout countdown
    timeoutTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
          handleReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 30000,
      useNativeDriver: false,
    }).start();

    // Start vibration pattern
    if (Platform.OS !== 'web') {
      const pattern = [0, 500, 200, 500];
      Vibration.vibrate(pattern, true);
    }

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Slide animation for buttons
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
    };
  }, []);

  const getSessionIcon = () => {
    if (sessionType === 'phone' || sessionType === 'voice') return 'call';
    if (sessionType === 'video') return 'videocam';
    return 'chatbubble';
  };

  const getSessionLabel = () => {
    if (sessionType === 'phone' || sessionType === 'voice') return 'Audio Call';
    if (sessionType === 'video') return 'Video Call';
    return 'Live Chat';
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
    
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    // Pre-request microphone (and camera) permissions only if not yet granted
    if (sessionType === 'phone' || sessionType === 'voice' || sessionType === 'video') {
      try {
        if (Platform.OS === 'android') {
          const hasRecord = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          const permsToRequest: string[] = [];
          if (!hasRecord) permsToRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (sessionType === 'video') {
            const hasCam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (!hasCam) permsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          }
          if (permsToRequest.length > 0) {
            await PermissionsAndroid.requestMultiple(permsToRequest as any);
          }
        }
      } catch (permErr) {
        console.warn('Accept permission check warning:', permErr);
      }
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/request/${requestId}/accept`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Navigate to live session screen (Chat, Audio Call, or Video Call)
        router.replace({
          pathname: '/session/[id]',
          params: {
            id: data.session_id || requestId,
            clientId: data.session?.client_id || params.clientId || 'client',
            clientName: clientName,
            sessionType: data.session?.session_type || sessionType,
            rate: rate.toString(),
            agoraChannel: data.agora_channel || data.session?.agora_channel || '',
            agoraAppId: data.agora_app_id || data.session?.agora_app_id || '',
            agoraUid: String(data.psychic_uid || data.session?.psychic_uid || 2),
            agoraToken: data.psychic_token || data.session?.psychic_token || '',
          },
        });
      } else {
        console.error('Failed to accept request');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/dashboard');
        }
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/dashboard');
      }
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
    
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    try {
      await fetch(`${BACKEND_URL}/api/chat/request/${requestId}/reject`, {
        method: 'PUT',
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/dashboard');
      }
    }
  };

  const buttonTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#1a1a2e']}
      style={styles.container}
    >
      {/* Session Info */}
      <View style={styles.requestInfo}>
        <Animated.View
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark || '#4A3578']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {clientName.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.pulseRing} />
          <View style={[styles.pulseRing, styles.pulseRing2]} />
        </Animated.View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <Text style={styles.clientName}>{clientName}</Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: clientType === 'RETURNING CLIENT' ? '#27AE6033' : '#E67E2233',
            borderWidth: 1,
            borderColor: clientType === 'RETURNING CLIENT' ? '#27AE60' : '#E67E22',
          }}>
            <Text style={{
              color: clientType === 'RETURNING CLIENT' ? '#2ECC71' : '#F39C12',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.5,
            }}>
              {clientType}
            </Text>
          </View>
        </View>
        <View style={styles.sessionTypeContainer}>
          <Ionicons name={getSessionIcon() as any} size={20} color={colors.primary} />
          <Text style={styles.sessionTypeText}>
            Incoming {getSessionLabel()} Request ({timeLeft}s)
          </Text>
        </View>

        {/* ADV-029: 30-second Countdown Progress Bar */}
        <View style={styles.timerBarContainer}>
          <Animated.View
            style={[
              styles.timerBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: timeLeft <= 5 ? '#E74C3C' : colors.primary,
              },
            ]}
          />
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rate:</Text>
            <Text style={styles.detailValue}>${rate.toFixed(2)}/min</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>{minutes} minutes</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Your Earnings:</Text>
            <Text style={[styles.detailValue, { color: '#27AE60' }]}>
              ${(rate * minutes * 0.4).toFixed(2)} (40%)
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <Animated.View
        style={[
          styles.actions,
          {
            paddingBottom: insets.bottom + 40,
            transform: [{ translateY: buttonTranslateY }],
            opacity: slideAnim,
          },
        ]}
      >
        {/* Reject / Decline */}
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionCircle, styles.rejectCircle]}
            onPress={handleReject}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={34} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.actionText}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionCircle, styles.acceptCircle]}
            onPress={handleAccept}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Ionicons name={getSessionIcon() as any} size={32} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.actionText}>Accept</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFF',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(107, 78, 170, 0.4)',
    top: -10,
    left: -10,
  },
  pulseRing2: {
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -20,
    left: -20,
    borderColor: 'rgba(107, 78, 170, 0.2)',
  },
  clientName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  sessionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timerBarContainer: {
    width: width * 0.8,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  sessionTypeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  sessionDetails: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    width: width * 0.8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  detailValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 70,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  rejectCircle: {
    backgroundColor: '#E74C3C',
  },
  acceptCircle: {
    backgroundColor: '#27AE60',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
