import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import NotificationBanner from '../../src/components/NotificationBanner';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.227:8000';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { psychic, token, updateProfile } = useAuth();
  const { colors } = useTheme();
  
  // Service availability toggles - loaded from backend
  const [chatOnline, setChatOnline] = useState(psychic?.online_status === 'online');
  const [phoneOnline, setPhoneOnline] = useState(psychic?.online_status === 'online');
  const [videoOnline, setVideoOnline] = useState(psychic?.online_status === 'online');
  const [standardReadings, setStandardReadings] = useState(false);
  const [emergencyReadings, setEmergencyReadings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSale, setActiveSale] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const handledRequestsRef = React.useRef<Set<string>>(new Set());

  // Load current service settings from backend on mount
  useEffect(() => {
    const loadCurrentSettings = async () => {
      if (!psychic?.id && !psychic?.email) {
        setChatOnline(true);
        setPhoneOnline(true);
        setVideoOnline(true);
        setStandardReadings(true);
        setEmergencyReadings(false);
        setSettingsLoaded(true);
        return;
      }
      
      try {
        // Fetch current psychic data from backend
        const response = await fetch(`${BACKEND_URL}/api/psychics/${psychic.id}`);
        if (response.ok) {
          const data = await response.json();
          const isOnline = data.online_status === 'online';
          setChatOnline(isOnline && (data.offers_chat ?? true));
          setPhoneOnline(isOnline && (data.offers_phone ?? true));
          setVideoOnline(isOnline && (data.offers_video ?? data.offers_video_call ?? true));
          setStandardReadings(data.offers_standard_readings ?? true);
          setEmergencyReadings(data.offers_emergency_readings ?? false);
          console.log('📥 Loaded service settings from backend:', {
            online_status: data.online_status,
            chat: isOnline && (data.offers_chat ?? true),
            phone: isOnline && (data.offers_phone ?? true),
            video: isOnline && (data.offers_video ?? data.offers_video_call ?? true),
          });
        } else {
          const isOnline = psychic?.online_status === 'online';
          setChatOnline(isOnline);
          setPhoneOnline(isOnline);
          setVideoOnline(isOnline);
          setStandardReadings(true);
          setEmergencyReadings(false);
        }
      } catch (error) {
        console.error('Error loading service settings:', error);
        const isOnline = psychic?.online_status === 'online';
        setChatOnline(isOnline);
        setPhoneOnline(isOnline);
        setVideoOnline(isOnline);
        setStandardReadings(true);
        setEmergencyReadings(false);
      } finally {
        setSettingsLoaded(true);
      }
    };
    
    loadCurrentSettings();
  }, [psychic?.id, psychic?.email]);

  // Dynamic dashboard stats from backend
  const [dashboardStats, setDashboardStats] = useState({
    todayEarnings: 0,
    weeklyEarnings: 0,
    averageRating: Number(psychic?.average_rating || (psychic as any)?.rating || 5.0),
    totalReviews: Number(psychic?.total_reviews || (psychic as any)?.reviews || 0),
    totalReadings: Number(psychic?.total_readings || 0),
    pendingQuestions: 0,
    activeSessions: 0,
    dailyBreakdown: [
      { day: 'Mon', date: '', earnings: 0 },
      { day: 'Tue', date: '', earnings: 0 },
      { day: 'Wed', date: '', earnings: 0 },
      { day: 'Thu', date: '', earnings: 0 },
      { day: 'Fri', date: '', earnings: 0 },
      { day: 'Sat', date: '', earnings: 0 },
      { day: 'Sun', date: '', earnings: 0 },
    ],
  });

  const fetchDashboardStats = useCallback(async () => {
    const psychicIdentifier = psychic?.id || psychic?.email;
    if (!psychicIdentifier) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/dashboard/${encodeURIComponent(psychicIdentifier)}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardStats({
          todayEarnings: Number(data.today_earnings ?? 0),
          weeklyEarnings: Number(data.weekly_earnings ?? 0),
          averageRating: Number(data.average_rating ?? psychic?.average_rating ?? 5.0),
          totalReviews: Number(data.total_reviews ?? psychic?.total_reviews ?? 0),
          totalReadings: Number(data.total_readings ?? 0),
          pendingQuestions: Number(data.pending_questions ?? 0),
          activeSessions: Number(data.active_sessions ?? 0),
          dailyBreakdown: Array.isArray(data.daily_breakdown) && data.daily_breakdown.length > 0 
            ? data.daily_breakdown 
            : [
                { day: 'Mon', date: '', earnings: 0 },
                { day: 'Tue', date: '', earnings: 0 },
                { day: 'Wed', date: '', earnings: 0 },
                { day: 'Thu', date: '', earnings: 0 },
                { day: 'Fri', date: '', earnings: 0 },
                { day: 'Sat', date: '', earnings: 0 },
                { day: 'Sun', date: '', earnings: 0 },
              ],
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }, [psychic?.id, psychic?.email]);

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardStats]);

  // Check if any service is online
  const isAnyServiceOnline = chatOnline || phoneOnline || videoOnline;

  // Master Header Toggle: turns all 3 services (Chat, Audio Call, Video Call) ON or OFF together
  const handleMasterToggle = async (value: boolean) => {
    setChatOnline(value);
    setPhoneOnline(value);
    setVideoOnline(value);
    const newStatus = value ? 'online' : 'offline';

    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          online_status: newStatus,
          offers_chat: value,
          offers_phone: value,
          offers_video: value,
        }),
      });
      if (!response.ok) {
        console.error('Failed to update master status');
      } else {
        console.log(`✅ Advisor master status updated to: ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating master status:', error);
    }
  };

  // Handle Live Chat toggle
  const handleChatToggle = async (value: boolean) => {
    setChatOnline(value);
    const newIsOnline = value || phoneOnline || videoOnline;
    const newStatus = newIsOnline ? 'online' : 'offline';
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          online_status: newStatus,
          offers_chat: value,
          offers_phone: phoneOnline,
          offers_video: videoOnline,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update chat status');
        setChatOnline(!value);
      } else {
        console.log(`✅ Advisor chat status updated to: ${value}`);
      }
    } catch (error) {
      console.error('Error updating chat status:', error);
      setChatOnline(!value);
    }
  };


  const handlePhoneToggle = async (value: boolean) => {
    setPhoneOnline(value);
    const newIsOnline = chatOnline || value || videoOnline;
    
    // Update backend with new values directly
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          online_status: newIsOnline ? 'online' : 'offline',
          offers_chat: chatOnline,
          offers_phone: value,
          offers_video: videoOnline,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update phone status');
        setPhoneOnline(!value);
      }
    } catch (error) {
      console.error('Error updating phone status:', error);
      setPhoneOnline(!value);
    }
  };

  const handleVideoToggle = async (value: boolean) => {
    setVideoOnline(value);
    const newIsOnline = chatOnline || phoneOnline || value;
    
    // Update backend with new values directly
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          online_status: newIsOnline ? 'online' : 'offline',
          offers_chat: chatOnline,
          offers_phone: phoneOnline,
          offers_video: value,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update video status');
        setVideoOnline(!value);
      }
    } catch (error) {
      console.error('Error updating video status:', error);
      setVideoOnline(!value);
    }
  };

  // Handle standard readings toggle
  const handleStandardReadingsToggle = async (value: boolean) => {
    setStandardReadings(value);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          offers_standard_readings: value,
          offers_emergency_readings: emergencyReadings,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update standard readings status');
      }
    } catch (error) {
      console.error('Error updating standard readings status:', error);
    }
  };

  // Handle emergency readings toggle
  const handleEmergencyReadingsToggle = async (value: boolean) => {
    setEmergencyReadings(value);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          email: psychic?.email,
          offers_standard_readings: standardReadings,
          offers_emergency_readings: value,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update emergency readings status');
      }
    } catch (error) {
      console.error('Error updating emergency readings status:', error);
    }
  };

  // Poll for incoming session requests
  const checkIncomingRequests = useCallback(async () => {
    if (!psychic?.email && !psychic?.id) return;
    
    // Do not poll or navigate if advisor is already in an active session or incoming screen
    if (pathname && (pathname.includes('/session') || pathname.includes('/incoming-request'))) {
      return;
    }
    
    try {
      const endpoint = psychic?.email 
        ? `${BACKEND_URL}/api/chat/requests/pending/email/${encodeURIComponent(psychic.email)}`
        : `${BACKEND_URL}/api/chat/requests/pending/${psychic?.id}`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (data.requests && data.requests.length > 0) {
          const request = data.requests[0];
          if (handledRequestsRef.current.has(request.id)) {
            return;
          }
          handledRequestsRef.current.add(request.id);
          // Navigate to incoming request screen
          router.push({
            pathname: '/incoming-request',
            params: {
              requestId: request.id,
              clientName: request.client_name || 'Client',
              clientType: request.client_type || 'NEW CLIENT',
              sessionType: request.session_type || 'chat',
              rate: request.rate_per_minute?.toString() || '2.99',
              minutes: request.requested_minutes?.toString() || '5',
            },
          });
        }
      }
    } catch (error) {
      console.error('Error checking for incoming requests:', error);
    }
  }, [psychic, router, pathname]);

  // Poll for incoming requests every 2.5 seconds when online
  useEffect(() => {
    if (!isAnyServiceOnline) return;
    if (pathname && (pathname.includes('/session') || pathname.includes('/incoming-request'))) return;
    
    const interval = setInterval(checkIncomingRequests, 2500);
    return () => clearInterval(interval);
  }, [isAnyServiceOnline, checkIncomingRequests, pathname]);

  const fetchActiveSale = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sales/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveSale(data);
      }
    } catch (error) {
      console.error('Error fetching active sale:', error);
    }
  }, []);

  useEffect(() => {
    fetchActiveSale();
  }, [fetchActiveSale]);

  // Function to reload current settings from backend
  const reloadServiceSettings = useCallback(async () => {
    if (!psychic?.id) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/psychics/${psychic.id}`);
      if (response.ok) {
        const data = await response.json();
        const isOnline = data.online_status === 'online';
        setChatOnline(isOnline && (data.offers_chat ?? true));
        setPhoneOnline(isOnline && (data.offers_phone ?? true));
        setVideoOnline(isOnline && (data.offers_video ?? data.offers_video_call ?? true));
        setStandardReadings(data.offers_standard_readings ?? true);
        setEmergencyReadings(data.offers_emergency_readings ?? false);
      }
    } catch (error) {
      console.error('Error reloading settings:', error);
    }
  }, [psychic?.id]);

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const fetchUnreadCount = useCallback(async () => {
    if (!psychic?.id) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications/unread-count/${psychic.id}`);
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifCount(data.count || 0);
      }
    } catch {}
  }, [psychic?.id]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 8000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchActiveSale(),
      reloadServiceSettings(),
      fetchUnreadCount(),
      fetchDashboardStats(),
    ]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header - Outside ScrollView */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{psychic?.name || 'Advisor'}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Notification Bell Button with Unread Badge */}
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.backgroundCard,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => router.push('/notifications' as any)}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadNotifCount > 0 && (
              <View style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.error,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 3,
              }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Overall Status Indicator / ADV-064: 1-Tap Header Quick Online/Offline Toggle */}
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.statusIndicator, { backgroundColor: colors.backgroundCard, paddingHorizontal: 10, paddingVertical: 4 }]}
            onPress={() => handleMasterToggle(!isAnyServiceOnline)}
          >
            <View style={[styles.statusDot, { backgroundColor: isAnyServiceOnline ? colors.success : colors.error }]} />
            <Text style={[styles.statusText, { color: isAnyServiceOnline ? colors.success : colors.error, fontWeight: '700' }]}>
              {isAnyServiceOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <View pointerEvents="none">
              <Switch
                value={isAnyServiceOnline}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#FFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>


      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Notification Banner at top of dashboard */}
        <NotificationBanner />

        {/* Active Sale Banner - Mandatory Participation */}
        {activeSale && (
          <View style={[styles.saleBanner, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <View style={styles.saleBannerContent}>
              <View style={[styles.saleLiveTag, { backgroundColor: colors.warning }]}>
                <Ionicons name="pricetag" size={12} color="#000" />
                <Text style={styles.saleLiveText}>SALE ACTIVE</Text>
              </View>
              <Text style={[styles.saleBannerTitle, { color: colors.textPrimary }]}>{activeSale.name}</Text>
              <Text style={[styles.saleBannerDesc, { color: colors.textSecondary }]}>
                Your rates are automatically discounted {activeSale.discount_percentage}% during this sale.
              </Text>
              <Text style={[styles.saleBannerMandatory, { color: colors.warning }]}>
                Mandatory participation • Your earnings: 40% of discounted rate
              </Text>
            </View>
          </View>
        )}

        {/* Live Status Controls - Chat, Audio Call & Video Call */}
        <View style={[styles.liveControlsCard, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.liveTitle, { color: colors.textPrimary }]}>Go Live - Reading Availability</Text>
          <Text style={[styles.liveSubtitle, { color: colors.textSecondary }]}>Toggle services to receive Chat, Audio & Video calls</Text>
          
          {/* Live Chat Toggle */}
          <View style={[styles.serviceToggle, { borderBottomColor: colors.border }]}>
            <View style={styles.serviceInfo}>
              <Ionicons name="chatbubble" size={22} color={chatOnline ? colors.success : colors.textMuted} />
              <View>
                <Text style={[styles.serviceName, { color: colors.textPrimary }]}>Live Chat</Text>
                <Text style={[styles.serviceRate, { color: colors.textMuted }]}>${psychic?.chat_rate || '3.99'}/min</Text>
              </View>
            </View>
            <Switch
              value={chatOnline}
              onValueChange={handleChatToggle}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#FFF"
            />
          </View>

          {/* Audio Call Toggle */}
          <View style={[styles.serviceToggle, { borderBottomColor: colors.border }]}>
            <View style={styles.serviceInfo}>
              <Ionicons name="call" size={22} color={phoneOnline ? colors.success : colors.textMuted} />
              <View>
                <Text style={[styles.serviceName, { color: colors.textPrimary }]}>Audio Call</Text>
                <Text style={[styles.serviceRate, { color: colors.textMuted }]}>${psychic?.phone_rate || '5.99'}/min</Text>
              </View>
            </View>
            <Switch
              value={phoneOnline}
              onValueChange={handlePhoneToggle}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#FFF"
            />
          </View>

          {/* Video Call Toggle */}
          <View style={[styles.serviceToggle, { borderBottomWidth: 0 }]}>
            <View style={styles.serviceInfo}>
              <Ionicons name="videocam" size={22} color={videoOnline ? colors.success : colors.textMuted} />
              <View>
                <Text style={[styles.serviceName, { color: colors.textPrimary }]}>Video Call</Text>
                <Text style={[styles.serviceRate, { color: colors.textMuted }]}>${psychic?.video_rate || (psychic as any)?.video_call_rate || '7.99'}/min</Text>
              </View>
            </View>
            <Switch
              value={videoOnline}
              onValueChange={handleVideoToggle}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* Weekly Earnings Chart */}
        <View style={[styles.earningsChartCard, { backgroundColor: colors.backgroundCard }]}>
          <View style={styles.earningsChartHeader}>
            <Text style={[styles.liveTitle, { color: colors.textPrimary }]}>Weekly Earnings</Text>
            <Text style={[styles.earningsTotal, { color: colors.primary }]}>${dashboardStats.weeklyEarnings.toFixed(2)}</Text>
          </View>
          <Text style={[styles.liveSubtitle, { color: colors.textSecondary, marginBottom: SPACING.md }]}>Last 7 days performance</Text>
          
          <View style={styles.chartContainer}>
            {(() => {
              const items = dashboardStats.dailyBreakdown && dashboardStats.dailyBreakdown.length > 0
                ? dashboardStats.dailyBreakdown
                : [
                    { day: 'Mon', earnings: 0 },
                    { day: 'Tue', earnings: 0 },
                    { day: 'Wed', earnings: 0 },
                    { day: 'Thu', earnings: 0 },
                    { day: 'Fri', earnings: 0 },
                    { day: 'Sat', earnings: 0 },
                    { day: 'Sun', earnings: 0 },
                  ];
              const earnings = items.map((d: any) => Number(d.earnings || 0));
              const maxEarning = Math.max(...earnings, 1);
              const totalSum = earnings.reduce((a, b) => a + b, 0);
              const avgEarning = totalSum / (earnings.length || 1);
              
              return items.map((item: any, index: number) => {
                const earning = Number(item.earnings || 0);
                const barHeight = earning > 0 ? Math.max((earning / maxEarning) * 100, 12) : 6;
                const isHigh = earning > 0 && totalSum > 0 && earning >= avgEarning * 1.15;
                const isLow = earning > 0 && totalSum > 0 && earning < avgEarning * 0.7;
                const barColor = isHigh ? colors.success : isLow ? colors.error : (earning > 0 ? colors.primary : colors.border);
                
                return (
                  <View key={index} style={styles.chartBarContainer}>
                    <Text style={[styles.chartValue, { color: earning > 0 ? barColor : colors.textMuted }]}>
                      ${earning.toFixed(0)}
                    </Text>
                    <View style={styles.chartBarWrapper}>
                      <View 
                        style={[
                          styles.chartBar, 
                          { 
                            height: `${barHeight}%`,
                            backgroundColor: barColor,
                            opacity: earning > 0 ? 1 : 0.4,
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.chartDay, { color: colors.textMuted }]}>{item.day}</Text>
                  </View>
                );
              });
            })()}
          </View>
          
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>High earnings</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Low earnings</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.statCard, { backgroundColor: colors.backgroundCard }]}
            onPress={() => router.push('/reviews')}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name="star" size={24} color={colors.gold} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {dashboardStats.averageRating.toFixed(1)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rating</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.statCard, { backgroundColor: colors.backgroundCard }]}
            onPress={() => router.push('/reviews')}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="chatbubbles" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {dashboardStats.totalReviews}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reviews</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 14,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  liveControlsCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  liveSubtitle: {
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  serviceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
  },
  serviceRate: {
    fontSize: 12,
  },
  earningsCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  earningsAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
    marginVertical: SPACING.sm,
  },
  earningsFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: SPACING.sm,
  },
  weeklyEarnings: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  saleBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 14,
    borderWidth: 2,
    padding: SPACING.md,
  },
  saleBannerContent: {},
  saleLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 8,
  },
  saleLiveText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  saleBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  saleBannerDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  saleBannerMandatory: {
    fontSize: 11,
    fontWeight: '600',
  },
  freeReadingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  freeReadingsBenefits: {
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: SPACING.sm,
  },
  freeReadingsActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.sm,
  },
  freeReadingsActiveText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  freeReadingsNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  mandatoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mandatoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  earningsChartCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 16,
    padding: SPACING.md,
  },
  earningsChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsTotal: {
    fontSize: 20,
    fontWeight: '700',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    marginBottom: SPACING.md,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartBarWrapper: {
    width: 24,
    height: 100,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
  },
  chartDay: {
    fontSize: 10,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
