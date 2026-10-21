import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { setSecureItem, getSecureItem } from '../../src/services/secureStorage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';

const formatTxDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
};

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, psychic } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState({
    available: 0,
    pending: 0,
    lifetime: 0,
    totalTips: 0,
  });
  const [period, setPeriod] = useState({ gross: 0, net: 0, readingNet: 0, tips: 0, sessions: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  // ADV-049: Date Range Earnings Filter state
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  const fetchEarnings = useCallback(async () => {
    const pid = psychic?.id || user?.id || psychic?.email;
    if (!pid) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/payments/psychic-earnings/${encodeURIComponent(pid)}?timeframe=${timeframeRef.current}`
      );
      if (response.ok) {
        const data = await response.json();
        const newEarnings = {
          available: Number(data.available_balance) || 0,
          pending: Number(data.pending_balance) || 0,
          lifetime: Number(data.total_earnings) || 0,
          totalTips: Number(data.total_tips) || 0,
        };
        setEarnings(newEarnings);
        const periodTipsVal = Number(data.period_tips) || 0;
        const netVal = Number(data.period_net) || 0;
        const readingNetVal = (data.period_reading_net !== undefined && data.period_reading_net !== null)
          ? Number(data.period_reading_net)
          : Math.max(0, netVal - periodTipsVal);
        setPeriod({
          gross: Number(data.period_gross) || 0,
          net: netVal,
          readingNet: readingNetVal,
          tips: periodTipsVal,
          sessions: Number(data.period_sessions) || 0,
        });
        setRecentTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        // ADV-018: Encrypted financial earnings cache
        setSecureItem('__6th_sense_earnings_cache', JSON.stringify(newEarnings)).catch(() => null);
      }

      // Fetch withdrawal & payout requests history
      try {
        const pRes = await fetch(`${BACKEND_URL}/api/payments/psychic-payouts/${encodeURIComponent(pid)}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          setPayoutHistory(Array.isArray(pData.payouts) ? pData.payouts : []);
        }
      } catch (pErr) {
        console.log('Error fetching psychic payouts:', pErr);
      }
    } catch (error) {
      console.warn('Error fetching earnings:', error);
      // Fall back to last cached values (never fake numbers)
      try {
        const cached = await getSecureItem('__6th_sense_earnings_cache');
        if (cached) setEarnings(JSON.parse(cached));
      } catch {}
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [psychic?.id, psychic?.email, user?.id]);

  // Re-fetch when timeframe changes
  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings, timeframe]);

  // Refresh every time the Earnings tab is opened + live poll every 10s while visible
  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
      const interval = setInterval(fetchEarnings, 10000);
      return () => clearInterval(interval);
    }, [fetchEarnings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  // Revenue breakdown by session type (from real transactions in selected timeframe)
  const breakdown = recentTransactions.reduce(
    (acc, tx) => {
      const key = tx.session_type === 'video' ? 'video' : tx.session_type === 'phone' ? 'phone' : 'chat';
      acc[key] += Number(tx.amount) || 0;
      return acc;
    },
    { phone: 0, video: 0, chat: 0 } as Record<'phone' | 'video' | 'chat', number>
  );
  const breakdownTotal = breakdown.phone + breakdown.video + breakdown.chat + earnings.totalTips;
  const pct = (v: number) => (breakdownTotal > 0 ? Math.round((v / breakdownTotal) * 100) : 0);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ADV-052: Printable Earnings Statement PDF Generator
  const handleDownloadStatementPDF = async () => {
    const pid = psychic?.id || user?.id || psychic?.email;
    if (!pid) {
      Alert.alert('Notice', 'Advisor profile not loaded yet');
      return;
    }
    const url = `${BACKEND_URL}/api/payments/statement-pdf/${encodeURIComponent(pid)}?timeframe=${timeframe}`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } else {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Linking.openURL(url);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Earnings</Text>
        {/* ADV-052: PDF Statement Download Action Button */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
          onPress={handleDownloadStatementPDF}
        >
          <Ionicons name="document-text" size={16} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>PDF Statement</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

        {/* ADV-049: Date Range Earnings Filter Pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: timeframe === item.id ? colors.primary : colors.backgroundCard,
                borderWidth: 1,
                borderColor: timeframe === item.id ? colors.primary : colors.border,
                alignItems: 'center',
              }}
              onPress={() => setTimeframe(item.id as any)}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: timeframe === item.id ? '#FFF' : colors.textSecondary }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>${earnings.available.toFixed(2)}</Text>
          
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Pending</Text>
              <Text style={styles.balanceItemValue}>${earnings.pending.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Lifetime</Text>
              <Text style={styles.balanceItemValue}>${earnings.lifetime.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.withdrawButton, { backgroundColor: '#FFF' }]}
            onPress={() => router.push('/withdraw')}
          >
            <Ionicons name="wallet" size={20} color={colors.primary} />
            <Text style={[styles.withdrawText, { color: colors.primary }]}>Withdraw Funds</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ADV-046: Platform Commission & Net Payout Breakdown Card */}
        <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, backgroundColor: colors.backgroundCard, padding: SPACING.md, borderRadius: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="pie-chart" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Platform Fee & Payout Split</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>40% Advisor / 60% Platform • {period.sessions} session{period.sessions === 1 ? '' : 's'}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Gross Reading Revenue</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>${period.gross.toFixed(2)}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Platform Operations Fee (60%)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error }}>-${Math.max(0, period.gross - period.readingNet).toFixed(2)}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Advisor Net Reading Earnings (40%)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>${period.readingNet.toFixed(2)}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>Client Tips (100% to Advisor)</Text>
              <Ionicons name="gift-outline" size={13} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>+${period.tips.toFixed(2)}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Total Advisor Take-Home Net</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success }}>${period.net.toFixed(2)}</Text>
          </View>
        </View>

        {/* IRS 1099 Tax Summary Card */}
        <View style={[styles.txCard, { backgroundColor: colors.backgroundCard, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.md }]}>
          <View style={[styles.txIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="document-text" size={24} color={colors.primary} />
          </View>
          <View style={styles.txInfo}>
            <Text style={[styles.txClient, { color: colors.textPrimary }]}>IRS 1099 Tax Status</Text>
            <Text style={[styles.txType, { color: colors.textSecondary }]}>
              {earnings.lifetime >= 600 ? 'Eligible for 1099-K Tax Form ($600+ threshold reached)' : `$${(600 - earnings.lifetime).toFixed(2)} remaining before $600 1099 threshold`}
            </Text>
          </View>
        </View>

        {/* ADV-044: Revenue Source Breakdown Chart & Progress Bars */}
        <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Revenue Source Breakdown</Text>
          <View style={{ backgroundColor: colors.backgroundCard, padding: SPACING.lg, borderRadius: 16 }}>
            
            {/* Voice Calls */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>📞 Audio Calls ({pct(breakdown.phone)}%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${breakdown.phone.toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${pct(breakdown.phone)}%`, height: '100%', backgroundColor: colors.primary }} />
              </View>
            </View>

            {/* Video Sessions */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>📹 Video Calls ({pct(breakdown.video)}%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${breakdown.video.toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${pct(breakdown.video)}%`, height: '100%', backgroundColor: colors.secondary }} />
              </View>
            </View>

            {/* Chat Messages */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>💬 Live Chat ({pct(breakdown.chat)}%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${breakdown.chat.toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${pct(breakdown.chat)}%`, height: '100%', backgroundColor: '#F1C40F' }} />
              </View>
            </View>

            {/* Client Tips */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>🎁 Client Tips ({pct(earnings.totalTips)}%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${earnings.totalTips.toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${pct(earnings.totalTips)}%`, height: '100%', backgroundColor: '#E74C3C' }} />
              </View>
            </View>

          </View>
        </View>

        {/* Withdrawal & Payout Requests History (ADV-045) */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                Withdrawal Requests
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/withdraw')}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>+ New Payout</Text>
            </TouchableOpacity>
          </View>

          {payoutHistory.length === 0 ? (
            <View style={[styles.txCard, { backgroundColor: colors.backgroundCard, justifyContent: 'center', paddingVertical: 18 }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                No withdrawal requests yet. Tap "Withdraw Funds" above to cash out earnings.
              </Text>
            </View>
          ) : (
            payoutHistory.map((payout) => {
              const status = (payout.status || 'pending').toLowerCase();
              const isPending = status === 'pending';
              const isCompleted = ['completed', 'paid', 'succeeded'].includes(status);
              const isRejected = status === 'rejected';

              const statusColor = isCompleted ? colors.success : isRejected ? colors.error : colors.warning;
              const statusLabel = isCompleted ? '✓ Completed' : isRejected ? '✕ Declined' : '⏳ Under Review';

              return (
                <View
                  key={payout.id || payout._id}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: colors.backgroundCard,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      borderLeftWidth: 4,
                      borderLeftColor: statusColor,
                      padding: 14,
                      marginBottom: 10,
                    },
                  ]}
                >
                  {/* Card Top */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.txIcon, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons
                          name={isCompleted ? 'checkmark-circle' : isRejected ? 'close-circle' : 'time'}
                          size={20}
                          color={statusColor}
                        />
                      </View>
                      <View>
                        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
                          ${(payout.net_amount || payout.amount).toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                          {formatTxDate(payout.created_at)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Financial Breakdown */}
                  <View style={{ backgroundColor: colors.backgroundElevated, borderRadius: 8, padding: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Applied: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>${(payout.gross_amount || payout.amount).toFixed(2)}</Text> • Fee: <Text style={{ fontWeight: '700', color: colors.success }}>${(payout.fee || 0).toFixed(2)}</Text> • Method: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{payout.method ? payout.method.replace('_', ' ').toUpperCase() : 'BANK TRANSFER'}</Text>
                    </Text>

                    {isPending && (
                      <Text style={{ fontSize: 11, color: colors.warning, marginTop: 4 }}>
                        ⏳ Request submitted to admin. Will be transferred within 1-2 business days.
                      </Text>
                    )}

                    {isRejected && payout.rejection_reason && (
                      <Text style={{ fontSize: 11, color: colors.error, marginTop: 4 }}>
                        ⚠️ Reason: {payout.rejection_reason}
                      </Text>
                    )}

                    {isCompleted && (
                      <Text style={{ fontSize: 11, color: colors.success, marginTop: 4 }}>
                        ✓ Transferred to your registered account.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
          
          {recentTransactions.length === 0 && (
            <View style={[styles.txCard, { backgroundColor: colors.backgroundCard, justifyContent: 'center' }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No completed sessions in this period yet.</Text>
            </View>
          )}
          {recentTransactions.map((tx) => (
            <View key={tx.id} style={[styles.txCard, { backgroundColor: colors.backgroundCard }]}>
              <View style={[
                styles.txIcon,
                { backgroundColor: tx.amount > 0 ? colors.success + '20' : colors.error + '20' }
              ]}>
                <Ionicons
                  name={tx.type === 'withdrawal' ? 'arrow-up' : tx.type === 'tip' ? 'heart' : tx.session_type === 'video' ? 'videocam' : tx.session_type === 'phone' ? 'call' : 'chatbubble'}
                  size={20}
                  color={tx.amount > 0 ? colors.success : colors.error}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txClient, { color: colors.textPrimary }]}>
                  {tx.type === 'tip' ? `Tip from ${tx.client}` : tx.client}
                </Text>
                <Text style={[styles.txType, { color: colors.textSecondary }]}>
                  {tx.type === 'tip' ? 'Client Tip' : tx.type === 'withdrawal' ? 'Withdrawal' : `${tx.session_type === 'video' ? 'Video Call' : tx.session_type === 'phone' ? 'Audio Call' : 'Live Chat'}${tx.duration_seconds ? ` • ${Math.floor(tx.duration_seconds / 60)}m ${tx.duration_seconds % 60}s` : ''}`}
                </Text>
                <Text style={[styles.txDate, { color: colors.textMuted }]}>{formatTxDate(tx.date)}</Text>
                {tx.notes ? (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    📝 {tx.notes}
                  </Text>
                ) : null}
              </View>
              <Text style={[
                styles.txAmount,
                { color: tx.amount > 0 ? colors.success : colors.error }
              ]}>
                {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
              </Text>
            </View>
          ))}
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
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  fixedHeader: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  balanceCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
    marginVertical: SPACING.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  balanceItemValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  balanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.md,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  withdrawText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  txClient: {
    fontSize: 15,
    fontWeight: '500',
  },
  txType: {
    fontSize: 12,
    marginTop: 2,
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
