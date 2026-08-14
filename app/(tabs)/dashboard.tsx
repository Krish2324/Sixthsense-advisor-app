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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import NotificationBanner from '../../src/components/NotificationBanner';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { psychic, token, updateProfile } = useAuth();
  const { colors } = useTheme();
  
  // Service availability toggles - will be loaded from backend
  const [chatOnline, setChatOnline] = useState(false);
  const [phoneOnline, setPhoneOnline] = useState(false);
  const [videoOnline, setVideoOnline] = useState(false);
  const [standardReadings, setStandardReadings] = useState(false);
  const [emergencyReadings, setEmergencyReadings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSale, setActiveSale] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load current service settings from backend on mount
  useEffect(() => {
    const loadCurrentSettings = async () => {
      if (!psychic?.id && !psychic?.email) {
        // No psychic logged in, use defaults
        setChatOnline(true);
        setPhoneOnline(true);
        setVideoOnline(false);
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
          // Load actual settings from database
          setChatOnline(data.offers_chat ?? true);
          setPhoneOnline(data.offers_phone ?? true);
          setVideoOnline(data.offers_video ?? data.offers_video_call ?? false);
          setStandardReadings(data.offers_standard_readings ?? true);
          setEmergencyReadings(data.offers_emergency_readings ?? false);
          console.log('📥 Loaded service settings from backend:', {
            chat: data.offers_chat,
            phone: data.offers_phone,
            video: data.offers_video,
            standard: data.offers_standard_readings,
            emergency: data.offers_emergency_readings
          });
        } else {
          // Fallback to defaults if fetch fails
          setChatOnline(true);
          setPhoneOnline(true);
          setVideoOnline(false);
          setStandardReadings(true);
          setEmergencyReadings(false);
        }
      } catch (error) {
        console.error('Error loading service settings:', error);
        // Fallback to defaults
        setChatOnline(true);
        setPhoneOnline(true);
        setVideoOnline(false);
        setStandardReadings(true);
        setEmergencyReadings(false);
      } finally {
        setSettingsLoaded(true);
      }
    };
    
    loadCurrentSettings();
  }, [psychic?.id, psychic?.email]);

  // Mock data for demo
  const stats = {
    todayEarnings: 145.50,
    weeklyEarnings: 892.30,
    pendingQuestions: 3,
    completedToday: 7,
    averageRating: psychic?.average_rating || 4.9,
    totalReviews: psychic?.total_reviews || 156,
  };

  // Check if any service is online
  const isAnyServiceOnline = chatOnline || phoneOnline || videoOnline;

  // Update online status in backend when toggles change
  const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
    if (!psychic?.id && !psychic?.email) return;
    
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
          online_status: isOnline ? 'online' : 'offline',
          offers_chat: chatOnline,
          offers_phone: phoneOnline,
          offers_video: videoOnline,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }, [psychic, token, chatOnline, phoneOnline, videoOnline]);

  // Handle service toggle changes
  const handleChatToggle = async (value: boolean) => {
    setChatOnline(value);
    const newIsOnline = value || phoneOnline || videoOnline;
    
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
          offers_chat: value,  // Use the new value directly
          offers_phone: phoneOnline,
          offers_video: videoOnline,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update chat status');
      }
    } catch (error) {
      console.error('Error updating chat status:', error);
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
          offers_phone: value,  // Use the new value directly
          offers_video: videoOnline,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update phone status');
      }
    } catch (error) {
      console.error('Error updating phone status:', error);
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
          offers_video: value,  // Use the new value directly
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update video status');
      }
    } catch (error) {
      console.error('Error updating video status:', error);
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
    
    try {
      const endpoint = psychic?.email 
        ? `${BACKEND_URL}/api/chat/requests/pending/email/${encodeURIComponent(psychic.email)}`
        : `${BACKEND_URL}/api/chat/requests/pending/${psychic?.id}`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (data.requests && data.requests.length > 0) {
          const request = data.requests[0];
          // Navigate to incoming request screen
          router.push({
            pathname: '/incoming-request',
            params: {
              requestId: request.id,
              clientName: request.client_name || 'Client',
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
  }, [psychic, router]);

  // Poll for incoming requests every 3 seconds when online
  useEffect(() => {
    if (!isAnyServiceOnline) return;
    
    const interval = setInterval(checkIncomingRequests, 3000);
    return () => clearInterval(interval);
  }, [isAnyServiceOnline, checkIncomingRequests]);

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
        setChatOnline(data.offers_chat ?? true);
        setPhoneOnline(data.offers_phone ?? true);
        setVideoOnline(data.offers_video ?? data.offers_video_call ?? false);
        setStandardReadings(data.offers_standard_readings ?? true);
        setEmergencyReadings(data.offers_emergency_readings ?? false);
      }
    } catch (error) {
      console.error('Error reloading settings:', error);
    }
  }, [psychic?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchActiveSale(),
      reloadServiceSettings()
    ]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header - Outside ScrollView */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{psychic?.name || 'Advisor'}</Text>
        </View>
        
        {/* Overall Status Indicator */}
        <View style={[styles.statusIndicator, { backgroundColor: colors.backgroundCard }]}>
          <View style={[styles.statusDot, { backgroundColor: isAnyServiceOnline ? colors.success : colors.textMuted }]} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>{isAnyServiceOnline ? 'Available' : 'Offline'}</Text>
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

        {/* Live Status Controls - Chat Only */}
        <View style={[styles.liveControlsCard, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.liveTitle, { color: colors.textPrimary }]}>Go Live - Chat Availability</Text>
          <Text style={[styles.liveSubtitle, { color: colors.textSecondary }]}>Toggle to start receiving chat readings</Text>
          
          <View style={[styles.serviceToggle, { borderBottomWidth: 0 }]}>
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
        </View>

        {/* Weekly Earnings Chart */}
        <View style={[styles.earningsChartCard, { backgroundColor: colors.backgroundCard }]}>
          <View style={styles.earningsChartHeader}>
            <Text style={[styles.liveTitle, { color: colors.textPrimary }]}>Weekly Earnings</Text>
            <Text style={[styles.earningsTotal, { color: colors.primary }]}>${stats.weeklyEarnings.toFixed(2)}</Text>
          </View>
          <Text style={[styles.liveSubtitle, { color: colors.textSecondary, marginBottom: SPACING.md }]}>Last 7 days performance</Text>
          
          <View style={styles.chartContainer}>
            {(() => {
              const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const earnings = [45.50, 28.00, 89.50, 120.30, 95.00, 145.50, 78.00];
              const maxEarning = Math.max(...earnings);
              const avgEarning = earnings.reduce((a, b) => a + b, 0) / earnings.length;
              
              return earnings.map((earning, index) => {
                const barHeight = (earning / maxEarning) * 100;
                const isHigh = earning >= avgEarning * 1.2;
                const isLow = earning < avgEarning * 0.7;
                const barColor = isHigh ? colors.success : isLow ? colors.error : colors.primary;
                
                return (
                  <View key={index} style={styles.chartBarContainer}>
                    <Text style={[styles.chartValue, { color: barColor }]}>${earning.toFixed(0)}</Text>
                    <View style={styles.chartBarWrapper}>
                      <View 
                        style={[
                          styles.chartBar, 
                          { 
                            height: `${Math.max(barHeight, 10)}%`,
                            backgroundColor: barColor,
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.chartDay, { color: colors.textMuted }]}>{weekDays[index]}</Text>
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
          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name="star" size={24} color={colors.gold} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.averageRating}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rating</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="chatbubbles" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalReviews}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reviews</Text>
          </View>
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
