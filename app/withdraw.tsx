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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// PayPal fee: 2.9% + $0.30 per transaction
const PAYPAL_FEE_PERCENT = 0.029;
const PAYPAL_FEE_FIXED = 0.30;

// ADV-048: Dynamic Currency Symbol Localization
export const getCurrencySymbol = (countryOrCurrency?: string): string => {
  if (!countryOrCurrency) return '$';
  const c = countryOrCurrency.toUpperCase();
  if (c === 'UK' || c === 'GB' || c === 'GBP') return '£';
  if (c === 'EU' || c === 'EUR' || c === 'FR' || c === 'DE' || c === 'ES' || c === 'IT') return '€';
  if (c === 'CA' || c === 'CAD') return 'CA$';
  if (c === 'AU' || c === 'AUD') return 'A$';
  if (c === 'IN' || c === 'INR') return '₹';
  return '$';
};

// ADV-043: US ABA Routing Number Checksum Validation (Weighted Checksum Algorithm)
export const isValidABARouting = (routing: string): boolean => {
  const cleaned = routing.replace(/\D/g, '');
  if (cleaned.length !== 9) return false;
  const d = cleaned.split('').map(Number);
  const checksum = (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10;
  return checksum === 0;
};

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
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'paypal'>('bank');
  const [routingNumber, setRoutingNumber] = useState('');
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bank Details States
  const [hasBankDetails, setHasBankDetails] = useState<boolean>(false);
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: user?.name || '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'Checking',
  });
  const [showBankModal, setShowBankModal] = useState<boolean>(false);
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);

  // Dynamic fee calculation
  const calculateBankFee = (amount: number) => {
    const fee = (amount * platformFeePercent) / 100;
    return Math.round(fee * 100) / 100;
  };

  const calculatePayPalFee = (amount: number) => {
    const fee = (amount * PAYPAL_FEE_PERCENT) + PAYPAL_FEE_FIXED;
    return Math.round(fee * 100) / 100;
  };

  const getAmountReceived = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    if (paymentMethod === 'bank') {
      const fee = calculateBankFee(amount);
      return Math.max(0, amount - fee);
    } else {
      const fee = calculatePayPalFee(amount);
      return Math.max(0, amount - fee);
    }
  };

  const getPlatformFee = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    if (paymentMethod === 'bank') {
      return calculateBankFee(amount);
    } else {
      return calculatePayPalFee(amount);
    }
  };

  const getPayPalFee = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    return calculatePayPalFee(amount);
  };

  // Restore unsaved form state on mount
  useEffect(() => {
    AsyncStorage.getItem('withdraw_form_draft').then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.amount) setWithdrawAmount(parsed.amount);
        if (parsed.routing) setRoutingNumber(parsed.routing);
      }
    }).catch(() => null);
  }, []);

  const updateWithdrawAmount = (text: string) => {
    setWithdrawAmount(text);
    AsyncStorage.setItem('withdraw_form_draft', JSON.stringify({ amount: text, routing: routingNumber })).catch(() => null);
  };

  useEffect(() => {
    fetchEarnings();
    fetchPlatformFee();
    fetchBankDetails();
  }, [user?.id]);

  const fetchPlatformFee = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/platform-fee`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.fee_percent !== undefined) {
          setPlatformFeePercent(Number(data.fee_percent) || 0);
        }
      }
    } catch (e) {
      console.log('Error fetching platform fee:', e);
    }
  };

  const fetchBankDetails = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-bank-details/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.bank_details && data.bank_details.account_number) {
          setBankDetails({
            account_holder_name: data.bank_details.account_holder_name || user?.name || '',
            bank_name: data.bank_details.bank_name || 'Chase Bank, N.A.',
            account_number: data.bank_details.account_number || '',
            routing_number: data.bank_details.routing_number || '',
            account_type: data.bank_details.account_type || 'Checking',
          });
          setRoutingNumber(data.bank_details.routing_number || '');
          setHasBankDetails(true);
        } else {
          setHasBankDetails(false);
        }
      }
    } catch (e) {
      console.log('Error fetching bank details:', e);
    }
  };

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

  const handleSaveBankDetails = async () => {
    if (!bankDetails.account_number.trim() || !bankDetails.routing_number.trim()) {
      const msg = 'Please enter both Account Number and 9-digit Routing Number';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Incomplete Form', msg);
      return;
    }

    if (!isValidABARouting(bankDetails.routing_number.trim())) {
      const msg = 'Invalid 9-digit ABA Routing Number. Please double-check your routing number.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Routing Number', msg);
      return;
    }

    setIsSavingBank(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-bank-details/${user?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankDetails),
      });

      if (response.ok) {
        setHasBankDetails(true);
        setRoutingNumber(bankDetails.routing_number);
        setShowBankModal(false);
        const doneMsg = 'Bank details saved successfully! You can now proceed with your withdrawal.';
        Platform.OS === 'web' ? alert(doneMsg) : Alert.alert('Bank Details Saved', doneMsg);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save bank details');
      }
    } catch (e: any) {
      const msg = e?.message || 'Error saving bank details';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount < 40) {
      const msg = 'Minimum withdrawal is $40';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    if (amount > earnings.available) {
      const msg = 'Insufficient available balance';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    if (paymentMethod === 'bank' && (!hasBankDetails || !bankDetails.account_number)) {
      const msg = 'Please provide your bank details before submitting a withdrawal request.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Bank Details Required', msg);
      setShowBankModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const calculatedFee = getPlatformFee();
      const amountToReceive = getAmountReceived();

      const response = await fetch(`${BACKEND_URL}/api/payments/payout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: user?.id,
          amount: amount,
          fee: calculatedFee,
          fee_percent: paymentMethod === 'bank' ? platformFeePercent : undefined,
          net_amount: amountToReceive,
          method: paymentMethod === 'paypal' ? 'paypal' : 'bank_transfer',
          account_details: paymentMethod === 'bank' ? {
            ...bankDetails,
            method: 'bank_transfer',
          } : {
            method: 'paypal',
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        const netRcv = (data.net_amount || amountToReceive).toFixed(2);
        const msg = `Withdrawal request submitted successfully!\n\nRequested: $${amount.toFixed(2)}\nPlatform Fee (${data.fee_percent || platformFeePercent}%): -$${(data.fee || calculatedFee).toFixed(2)}\nYou Will Receive: $${netRcv}\nStatus: Under Review (Pending)\nEstimated arrival: ${data.estimated_arrival}`;
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('Withdrawal Submitted', msg);
        }
        fetchEarnings();
        setWithdrawAmount('');
        AsyncStorage.removeItem('withdraw_form_draft').catch(() => null);
        router.back();
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
        {/* Available Balance Card */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark || colors.primary]}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Available for Withdrawal</Text>
          <Text style={styles.balanceAmount}>${earnings.available.toFixed(2)}</Text>
          <View style={styles.balanceBreakdown}>
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

        {/* Withdrawal Amount Input */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Withdrawal Amount</Text>
          <View style={[styles.amountInputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.currencyPrefix, { color: colors.textPrimary }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={withdrawAmount}
              onChangeText={updateWithdrawAmount}
              keyboardType="decimal-pad"
            />
          </View>
          {withdrawAmount.length > 0 && parseFloat(withdrawAmount) < 40 ? (
            <Text style={[styles.minNote, { color: colors.error, fontWeight: '600' }]}>
              ⚠️ Amount must be at least $40.00 to request payout
            </Text>
          ) : (
            <Text style={[styles.minNote, { color: colors.textMuted }]}>Minimum withdrawal: $40.00</Text>
          )}

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmounts}>
            {[40, 100, 200, earnings.available].map((amount, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickAmountBtn,
                  { borderColor: colors.border },
                  withdrawAmount === amount.toString() && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => updateWithdrawAmount(amount.toString())}
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
          
          <View
            style={[
              styles.methodOption,
              { borderColor: colors.success, backgroundColor: colors.success + '10' },
            ]}
          >
            <Ionicons name="business" size={24} color={colors.success} />
            <View style={styles.methodInfo}>
              <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>Direct Bank Transfer</Text>
              <Text style={[styles.methodDesc, { color: colors.textMuted }]}>Direct deposit to your linked bank account (3-5 business days)</Text>
              <View style={styles.feeTagContainer}>
                {platformFeePercent === 0 ? (
                  <View style={[styles.feeTag, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.feeTagText, { color: colors.success }]}>FREE - No fees!</Text>
                  </View>
                ) : (
                  <View style={[styles.feeTag, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="pricetag" size={14} color={colors.primary} />
                    <Text style={[styles.feeTagText, { color: colors.primary }]}>{platformFeePercent}% Platform Fee</Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>

          {/* Linked Bank Account Card or Add Button */}
          {hasBankDetails && bankDetails.account_number ? (
            <View style={{
              backgroundColor: colors.backgroundElevated,
              borderRadius: 12,
              padding: 14,
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="business" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {bankDetails.bank_name || 'Chase Bank, N.A.'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {bankDetails.account_holder_name || user?.name || 'Account Holder'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary + '15',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                  }}
                  onPress={() => setShowBankModal(true)}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Edit Bank</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Account Number:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    •••• {bankDetails.account_number.slice(-4)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Routing Number (ABA):</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {bankDetails.routing_number}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Account Type:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>
                    {bankDetails.account_type || 'Checking'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                backgroundColor: colors.backgroundElevated,
                borderRadius: 12,
                padding: 14,
                marginTop: 12,
                borderWidth: 1.5,
                borderColor: colors.warning,
                borderStyle: 'dashed',
                alignItems: 'center',
              }}
              onPress={() => setShowBankModal(true)}
            >
              <Ionicons name="card-outline" size={28} color={colors.warning} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                No Bank Account Linked
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: 8 }}>
                Provide your bank details once to receive direct deposits.
              </Text>
              <View style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>+ Add Bank Account Details</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Fee Info Box */}
          <View style={[styles.feeInfoBox, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 12 }]}>
            <Ionicons name="information-circle" size={20} color={platformFeePercent > 0 ? colors.primary : colors.textMuted} />
            <Text style={[styles.feeInfoText, { color: colors.textSecondary }]}>
              {platformFeePercent === 0
                ? 'Bank transfers and direct deposits are completely free with zero platform withdrawal fees.'
                : `A standard platform operations fee of ${platformFeePercent}% is deducted upon payout processing.`}
            </Text>
          </View>
        </View>

        {/* Amount Summary */}
        {parseFloat(withdrawAmount) >= 40 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.primary + '30' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="calculator-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Fee & Payout Calculation</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Applied Withdrawal (Gross)</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>${parseFloat(withdrawAmount).toFixed(2)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                Platform Operations Fee {platformFeePercent > 0 ? `(${platformFeePercent}%)` : '(Direct Deposit)'}
              </Text>
              <Text style={[styles.summaryValue, { color: platformFeePercent > 0 ? colors.warning : colors.success }]}>
                {platformFeePercent > 0
                  ? `-$${calculateBankFee(parseFloat(withdrawAmount)).toFixed(2)}`
                  : '$0.00 (FREE)'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Remaining Balance After Payout</Text>
              <Text style={[styles.summaryValue, { color: colors.textSecondary }]}>
                ${Math.max(0, earnings.available - parseFloat(withdrawAmount)).toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelBold, { color: colors.textPrimary, fontSize: 16 }]}>Total You Will Receive</Text>
              <Text style={[styles.summaryValueBold, { color: colors.success, fontSize: 20 }]}>
                ${getAmountReceived().toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Payout Tracking Timeline */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Payout Tracking Timeline</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            {/* Step 1 */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="checkmark" size={18} color="#FFF" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 6 }}>Requested</Text>
              <Text style={{ fontSize: 10, color: colors.textMuted }}>Instant</Text>
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: colors.success, marginBottom: 18 }} />

            {/* Step 2 */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="time" size={18} color="#FFF" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 6 }}>Processing</Text>
              <Text style={{ fontSize: 10, color: colors.textMuted }}>1-2 Days</Text>
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: colors.border, marginBottom: 18 }} />

            {/* Step 3 */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="business" size={16} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 6 }}>Deposited</Text>
              <Text style={{ fontSize: 10, color: colors.textMuted }}>Completed</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.success },
            (!withdrawAmount || parseFloat(withdrawAmount) < 40) && { opacity: 0.5 },
          ]}
          onPress={handleWithdraw}
          disabled={isSubmitting || !withdrawAmount || parseFloat(withdrawAmount) < 40}
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

      {/* Bank Account Details Modal */}
      <Modal
        visible={showBankModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: 20,
            padding: 22,
            width: '100%',
            maxWidth: 440,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                  Bank Account Details
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBankModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
              Please enter your direct deposit bank details. These will be securely saved so you don't need to re-enter them on future payouts.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Account Holder Name */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Account Holder Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontSize: 14,
                  marginBottom: 12,
                }}
                placeholder="e.g. Luna Starweaver"
                placeholderTextColor={colors.textMuted}
                value={bankDetails.account_holder_name}
                onChangeText={(t) => setBankDetails((prev) => ({ ...prev, account_holder_name: t }))}
              />

              {/* Bank Name */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Bank Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontSize: 14,
                  marginBottom: 12,
                }}
                placeholder="e.g. JPMorgan Chase Bank"
                placeholderTextColor={colors.textMuted}
                value={bankDetails.bank_name}
                onChangeText={(t) => setBankDetails((prev) => ({ ...prev, bank_name: t }))}
              />

              {/* Account Number */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Account Number
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontSize: 14,
                  marginBottom: 12,
                }}
                placeholder="Enter account number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={bankDetails.account_number}
                onChangeText={(t) => setBankDetails((prev) => ({ ...prev, account_number: t }))}
              />

              {/* Routing Number (ABA) */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Routing Number (9 Digits)
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontSize: 14,
                  marginBottom: 12,
                }}
                placeholder="e.g. 021000021"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={9}
                value={bankDetails.routing_number}
                onChangeText={(t) => {
                  setBankDetails((prev) => ({ ...prev, routing_number: t }));
                  setRoutingNumber(t);
                }}
              />

              {/* Account Type */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Account Type
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {['Checking', 'Savings'].map((type) => {
                  const isSelected = bankDetails.account_type === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={{
                        flex: 1,
                        backgroundColor: isSelected ? colors.primary : colors.backgroundElevated,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }}
                      onPress={() => setBankDetails((prev) => ({ ...prev, account_type: type }))}
                    >
                      <Text style={{
                        color: isSelected ? '#FFF' : colors.textPrimary,
                        fontWeight: '700',
                        fontSize: 13,
                      }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Save Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleSaveBankDetails}
                disabled={isSavingBank}
              >
                {isSavingBank ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Save Bank Details</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setShowBankModal(false)}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  balanceBreakdown: {
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
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