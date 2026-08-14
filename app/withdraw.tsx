import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// PayPal fee: 2.9% + $0.30 per transaction
const PAYPAL_FEE_PERCENT = 0.029;
const PAYPAL_FEE_FIXED = 0.30;

export default function WithdrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [earnings, setEarnings] = useState({
    available: 0,
    pending: 0,
    total: 0,
    totalTips: 0,
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'paypal'>('bank');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate PayPal fee and amount received
  const calculatePayPalFee = (amount: number) => {
    const fee = (amount * PAYPAL_FEE_PERCENT) + PAYPAL_FEE_FIXED;
    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  };

  const getAmountReceived = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    if (paymentMethod === 'bank') {
      return amount;
    } else {
      const fee = calculatePayPalFee(amount);
      return Math.max(0, amount - fee);
    }
  };

  const getPayPalFee = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    return calculatePayPalFee(amount);
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-earnings/${user?.id}`);
      const data = await response.json();
      setEarnings({
        available: data.available_balance || 0,
        pending: data.pending_balance || 0,
        total: data.total_earnings || 0,
        totalTips: data.total_tips || 0,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount < 50) {
      const msg = 'Minimum withdrawal is $50';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    if (amount > earnings.available) {
      const msg = 'Insufficient available balance';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/payout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: user?.id,
          amount: amount,
          method: paymentMethod === 'bank' ? 'bank_transfer' : 'paypal',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const msg = `Withdrawal request submitted!\n\nAmount: $${amount.toFixed(2)}\nEstimated arrival: ${data.estimated_arrival}`;
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
        fetchEarnings();
        setWithdrawAmount('');
      } else {
        throw new Error(data.detail || 'Failed to submit withdrawal');
      }
    } catch (error: any) {
      const msg = error.message || 'Failed to submit withdrawal request';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Withdraw Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <LinearGradient
          colors={[colors.success, '#1D8348']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available for Withdrawal</Text>
          <Text style={styles.balanceAmount}>${earnings.available.toFixed(2)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Pending</Text>
              <Text style={styles.balanceItemValue}>${earnings.pending.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Total Earned</Text>
              <Text style={styles.balanceItemValue}>${earnings.total.toFixed(2)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Withdrawal Amount */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Withdrawal Amount</Text>
          <View style={[styles.amountInput, { borderColor: colors.border }]}>
            <Text style={[styles.currencySymbol, { color: colors.textMuted }]}>$</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={[styles.minNote, { color: colors.textMuted }]}>Minimum withdrawal: $50.00</Text>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmounts}>
            {[50, 100, 200, earnings.available].map((amount, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickAmountBtn,
                  { borderColor: colors.border },
                  withdrawAmount === amount.toString() && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => setWithdrawAmount(amount.toString())}
              >
                <Text style={[
                  styles.quickAmountText,
                  { color: colors.textSecondary },
                  withdrawAmount === amount.toString() && { color: colors.primary },
                ]}>
                  {index === 3 ? 'All' : `$${amount}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Payment Method</Text>
          
          <TouchableOpacity
            style={[
              styles.methodOption,
              { borderColor: paymentMethod === 'bank' ? colors.success : colors.border },
              paymentMethod === 'bank' && { backgroundColor: colors.success + '10' },
            ]}
            onPress={() => setPaymentMethod('bank')}
          >
            <Ionicons name="business" size={24} color={paymentMethod === 'bank' ? colors.success : colors.textMuted} />
            <View style={styles.methodInfo}>
              <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>Bank Transfer</Text>
              <Text style={[styles.methodDesc, { color: colors.textMuted }]}>3-5 business days</Text>
              <View style={styles.feeTagContainer}>
                <View style={[styles.feeTag, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.feeTagText, { color: colors.success }]}>FREE - No fees!</Text>
                </View>
              </View>
            </View>
            {paymentMethod === 'bank' && (
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodOption,
              { borderColor: paymentMethod === 'paypal' ? colors.primary : colors.border },
              paymentMethod === 'paypal' && { backgroundColor: colors.primary + '10' },
            ]}
            onPress={() => setPaymentMethod('paypal')}
          >
            <Ionicons name="logo-paypal" size={24} color={paymentMethod === 'paypal' ? colors.primary : colors.textMuted} />
            <View style={styles.methodInfo}>
              <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>PayPal</Text>
              <Text style={[styles.methodDesc, { color: colors.textMuted }]}>1-2 business days</Text>
              <View style={styles.feeTagContainer}>
                <View style={[styles.feeTag, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.warning} />
                  <Text style={[styles.feeTagText, { color: colors.warning }]}>2.9% + $0.30 fee applies</Text>
                </View>
              </View>
            </View>
            {paymentMethod === 'paypal' && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>

          {/* Fee Info Box */}
          <View style={[styles.feeInfoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={20} color={colors.textMuted} />
            <Text style={[styles.feeInfoText, { color: colors.textMuted }]}>
              Bank transfers are completely free! PayPal charges a small fee which will be deducted from your withdrawal amount.
            </Text>
          </View>
        </View>

        {/* Amount Summary */}
        {parseFloat(withdrawAmount) >= 50 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Withdrawal Amount</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>${parseFloat(withdrawAmount).toFixed(2)}</Text>
            </View>
            
            {paymentMethod === 'paypal' && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.error }]}>PayPal Fee (2.9% + $0.30)</Text>
                <Text style={[styles.summaryValue, { color: colors.error }]}>-${getPayPalFee().toFixed(2)}</Text>
              </View>
            )}
            
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelBold, { color: colors.textPrimary }]}>You'll Receive</Text>
              <Text style={[styles.summaryValueBold, { color: colors.success }]}>${getAmountReceived().toFixed(2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.success },
            (!withdrawAmount || parseFloat(withdrawAmount) < 50) && { opacity: 0.5 },
          ]}
          onPress={handleWithdraw}
          disabled={isSubmitting || !withdrawAmount || parseFloat(withdrawAmount) < 50}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="arrow-down-circle" size={22} color="#FFF" />
              <Text style={styles.submitButtonText}>
                Withdraw ${withdrawAmount ? parseFloat(withdrawAmount).toFixed(2) : '0.00'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  balanceCard: {
    borderRadius: 20,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  balanceItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 4,
  },
  balanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 20,
  },
  section: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
  },
  minNote: {
    fontSize: 12,
    marginTop: 8,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    gap: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  feeTagContainer: {
    marginTop: 6,
  },
  feeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  feeTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feeInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    gap: 10,
  },
  feeInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 8,
  },
  footer: {
    padding: SPACING.md,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 14,
    gap: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
