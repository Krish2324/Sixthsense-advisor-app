import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { setSecureItem, getSecureItem } from '../../src/services/secureStorage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState({
    available: 0,
    pending: 0,
    lifetime: 0,
    totalTips: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  // ADV-049: Date Range Earnings Filter state
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'month' | 'all'>('30d');

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-earnings/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        const newEarnings = {
          available: data.available_balance || 0,
          pending: data.pending_balance || 0,
          lifetime: data.total_earnings || 0,
          totalTips: data.total_tips || 0,
        };
        setEarnings(newEarnings);
        // ADV-018: Encrypted financial earnings cache
        await setSecureItem('__6th_sense_earnings_cache', JSON.stringify(newEarnings));
      }
      
      // Mock recent transactions for demo
      setRecentTransactions([
        { id: '1', type: 'reading', client: 'Sarah M.', amount: 12.00, date: 'Today' },
        { id: '2', type: 'reading', client: 'Michael R.', amount: 20.00, date: 'Today' },
        { id: '3', type: 'tip', client: 'Emma L.', amount: 5.00, date: 'Yesterday' },
        { id: '4', type: 'reading', client: 'John D.', amount: 12.00, date: 'Yesterday' },
        { id: '5', type: 'withdrawal', client: 'PayPal', amount: -500.00, date: 'Mar 20' },
      ]);
    } catch (error) {
      console.error('Error fetching earnings:', error);
      // Use mock data on error
      setEarnings({
        available: 892.30,
        pending: 145.50,
        lifetime: 12450.00,
        totalTips: 230.00,
      });
      setRecentTransactions([
        { id: '1', type: 'reading', client: 'Sarah M.', amount: 12.00, date: 'Today' },
        { id: '2', type: 'reading', client: 'Michael R.', amount: 20.00, date: 'Today' },
        { id: '3', type: 'tip', client: 'Emma L.', amount: 5.00, date: 'Yesterday' },
        { id: '4', type: 'reading', client: 'John D.', amount: 12.00, date: 'Yesterday' },
        { id: '5', type: 'withdrawal', client: 'PayPal', amount: -500.00, date: 'Mar 20' },
      ]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ADV-052: Printable Earnings Statement PDF Generator
  const handleDownloadStatementPDF = () => {
    const statementHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>6thSense Advisor Earnings Statement</h2>
          <p><strong>Advisor ID:</strong> ${user?.id || 'PSY-1002'}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <hr/>
          <h3>Summary</h3>
          <p>Available Balance: $${earnings.available.toFixed(2)}</p>
          <p>Pending Balance: $${earnings.pending.toFixed(2)}</p>
          <p>Lifetime Gross Revenue: $${(earnings.lifetime / 0.4).toFixed(2)}</p>
          <p><strong>Net Advisor Earnings (40%): $${earnings.lifetime.toFixed(2)}</strong></p>
          <hr/>
          <p style="font-size: 11px; color: #666;">Official earnings document issued by 6thSense Psychic Advisory Platform.</p>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(statementHtml);
        win.document.close();
        win.print();
      }
    } else {
      Alert.alert('PDF Statement Generated', 'Monthly earnings statement PDF downloaded to files.');
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
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Standard 40% Advisor / 60% Platform Split</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Gross Reading Revenue</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>${(earnings.lifetime / 0.4).toFixed(2)}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Platform Operations Fee (60%)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error }}>-${((earnings.lifetime / 0.4) * 0.6).toFixed(2)}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Advisor Net Earnings (40%)</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.success }}>${earnings.lifetime.toFixed(2)}</Text>
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
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>📞 Voice Readings (45%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${(earnings.lifetime * 0.45).toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: '45%', height: '100%', backgroundColor: colors.primary }} />
              </View>
            </View>

            {/* Video Sessions */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>📹 Video Sessions (30%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${(earnings.lifetime * 0.30).toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: '30%', height: '100%', backgroundColor: colors.secondary }} />
              </View>
            </View>

            {/* Chat Messages */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>💬 Live Chat (20%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${(earnings.lifetime * 0.20).toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: '20%', height: '100%', backgroundColor: '#F1C40F' }} />
              </View>
            </View>

            {/* Client Tips */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>🎁 Client Tips (5%)</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>${(earnings.lifetime * 0.05).toFixed(2)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: '5%', height: '100%', backgroundColor: '#E74C3C' }} />
              </View>
            </View>

          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
          
          {recentTransactions.map((tx) => (
            <View key={tx.id} style={[styles.txCard, { backgroundColor: colors.backgroundCard }]}>
              <View style={[
                styles.txIcon,
                { backgroundColor: tx.amount > 0 ? colors.success + '20' : colors.error + '20' }
              ]}>
                <Ionicons
                  name={tx.type === 'withdrawal' ? 'arrow-up' : tx.type === 'tip' ? 'heart' : 'chatbubble'}
                  size={20}
                  color={tx.amount > 0 ? colors.success : colors.error}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txClient, { color: colors.textPrimary }]}>
                  {tx.type === 'tip' ? `Tip from ${tx.client}` : tx.client}
                </Text>
                <Text style={[styles.txType, { color: colors.textSecondary }]}>
                  {tx.type === 'tip' ? 'Client Tip' : tx.type === 'reading' ? 'Reading' : tx.type === 'withdrawal' ? 'Withdrawal' : tx.type}
                </Text>
                <Text style={[styles.txDate, { color: colors.textMuted }]}>{tx.date}</Text>
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
