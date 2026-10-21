import React, { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AnimatedSplash from '../src/components/AnimatedSplash';

const LOGO_IMAGE = require('../assets/icon.png');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch {}
}

if (Notifications && Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
}

if (Notifications && Platform.OS === 'android') {
  try {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6B4EAA',
    });
    Notifications.setNotificationChannelAsync('high_importance_channel', {
      name: 'Session Requests',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF6B6B',
    });
  } catch {}
}

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const { psychic } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const handledRequestIdsRef = useRef<Set<string>>(new Set());

  const openIncomingRequest = (req: any) => {
    const reqId = req?.id || req?.request_id;
    if (!reqId || handledRequestIdsRef.current.has(reqId)) return;

    // Do not interrupt an active session or an already open incoming request screen
    if (pathname && (pathname.includes('/session') || pathname.includes('/incoming-request'))) {
      console.log('Skipping openIncomingRequest - advisor is already in active session or incoming screen:', pathname);
      return;
    }

    handledRequestIdsRef.current.add(reqId);

    router.push({
      pathname: '/incoming-request',
      params: {
        requestId: reqId,
        clientName: req.client_name || 'Client',
        clientType: req.client_type || 'NEW CLIENT',
        sessionType: req.session_type || 'chat',
        rate: (req.rate_per_minute || req.rate || '2.99').toString(),
        minutes: (req.requested_minutes || req.minutes || '5').toString(),
      },
    });
  };

  const triggerLocalNotification = async (title: string, body: string, data: any = {}) => {
    if (Platform.OS === 'web' || !Notifications) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority?.MAX || 'max',
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Error scheduling local notification:', e);
    }
  };

  // Push Notification listeners
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    const tapSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification?.request?.content?.data || {};
      if (data.type === 'session_request' || data.request_id) {
        openIncomingRequest(data);
      } else {
        router.push('/notifications' as any);
      }
    });

    const recvSub = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = notification?.request?.content?.data || {};
      if (data.type === 'session_request' || data.request_id) {
        openIncomingRequest(data);
      }
    });

    return () => {
      tapSub?.remove?.();
      recvSub?.remove?.();
    };
  }, []);

  // Global real-time WebSocket connection for instant incoming session requests & notifications
  useEffect(() => {
    if (!psychic?.id && !psychic?.email) return;

    const wsUserId = psychic.id || psychic.email;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;
      try {
        ws = new WebSocket(`${WS_URL}/api/ws/${encodeURIComponent(wsUserId)}`);
        ws.onopen = () => {
          console.log('🔌 Advisor WebSocket connected for real-time requests & notifications');
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'incoming_request') {
              console.log('📲 Received real-time incoming_request via WebSocket:', msg);
              const req = msg.request || msg;
              triggerLocalNotification(
                'New Client Request! 🌟',
                `${req.client_name || 'A client'} wants to start a ${req.session_type || 'chat'} session ($${req.rate_per_minute || '2.99'}/min).`,
                {
                  type: 'session_request',
                  request_id: req.id || msg.request_id,
                  ...req,
                }
              );
              openIncomingRequest(req);
            } else if (msg.type === 'new_notification' && msg.notification) {
              const notif = msg.notification;
              // Avoid duplicate banner if it's already handled as incoming_request
              if (notif.data?.type !== 'session_request') {
                triggerLocalNotification(
                  notif.title || 'New Notification 🔔',
                  notif.body || '',
                  notif.data || { type: notif.type || 'notification' }
                );
              }
            }
          } catch (e) {}
        };
        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };
        ws.onerror = () => {};
      } catch (e) {}
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {}
    };
  }, [psychic?.id, psychic?.email]);
  
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {showSplash && (
        <AnimatedSplash
          onFinish={() => setShowSplash(false)}
          appName="Sixth Sense Advisors"
          tagline="Share Your Gift With The World"
          logoSource={LOGO_IMAGE}
          gradientColors={['#1A1A2E', '#2D1B4E', '#4A1A6B']}
        />
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: 300,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="application" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

