import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

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

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-earnings/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setEarnings({
          available: data.available_balance || 0,
          pending: data.pending_balance || 0,
          lifetime: data.total_earnings || 0,
          totalTips: data.total_tips || 0,
        });
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Earnings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

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

        {/* IRS 1099 Tax Summary Card (ADV-046) */}
        <View style={[styles.txCard, { backgroundColor: colors.backgroundCard, marginBottom: SPACING.lg, padding: SPACING.md }]}>
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
