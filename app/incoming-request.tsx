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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

const { width, height } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function IncomingRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  
  const requestId = params.requestId as string;
  const clientName = params.clientName as string || 'Client';
  const sessionType = params.sessionType as string || 'chat';
  const rate = parseFloat(params.rate as string || '2.99');
  const minutes = parseInt(params.minutes as string || '5');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
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
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
    };
  }, []);

  const getSessionIcon = () => {
    return 'chatbubble';
  };

  const getSessionLabel = () => {
    return 'Chat';
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/request/${requestId}/accept`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Navigate to live session chat screen
        router.replace({
          pathname: '/session/[id]',
          params: {
            id: data.session_id || requestId,
            clientId: data.session?.client_id || params.clientId || 'client',
            clientName: clientName,
            rate: rate.toString(),
          },
        });
      } else {
        console.error('Failed to accept request');
        router.back();
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
      router.back();
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    try {
      await fetch(`${BACKEND_URL}/api/chat/request/${requestId}/reject`, {
        method: 'PUT',
      });
      router.back();
    } catch (error) {
      console.error('Failed to reject request:', error);
      router.back();
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

        <Text style={styles.clientName}>{clientName}</Text>
        <View style={styles.sessionTypeContainer}>
          <Ionicons name={getSessionIcon() as any} size={20} color={colors.primary} />
          <Text style={styles.sessionTypeText}>
            Incoming {getSessionLabel()} Request
          </Text>
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
        {/* Reject */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleReject}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={36} color="#FFF" />
          <Text style={styles.actionText}>Decline</Text>
        </TouchableOpacity>

        {/* Accept */}
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAccept}
          disabled={isProcessing}
        >
          <Ionicons name={getSessionIcon() as any} size={36} color="#FFF" />
          <Text style={styles.actionText}>Accept</Text>
        </TouchableOpacity>
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
    marginBottom: 20,
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
    gap: 60,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
});
