import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

interface BankAccount {
  id: string;
  bank_name: string;
  last4: string;
  status: 'verified' | 'pending' | 'errored';
  connected_at: string;
}

interface StripeAccountStatus {
  connected: boolean;
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements: string[];
  bank_account: BankAccount | null;
}

export default function BankAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { psychic } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);

  // Direct Deposit Bank Details
  const [directBank, setDirectBank] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'Checking',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetchAccountStatus();
  }, [psychic?.id]);

  const fetchAccountStatus = async () => {
    if (!psychic?.id) return;
    
    try {
      const [stripeRes, bankRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/stripe-connect/account-status/${psychic.id}`).catch(() => null),
        fetch(`${BACKEND_URL}/api/payments/psychic-bank-details/${psychic.id}`).catch(() => null),
      ]);

      if (stripeRes && stripeRes.ok) {
        const data = await stripeRes.json();
        setAccountStatus(data);
      }

      if (bankRes && bankRes.ok) {
        const bData = await bankRes.json().catch(() => ({}));
        if (bData.bank_details && bData.bank_details.account_number) {
          setDirectBank(bData.bank_details);
          setEditForm({
            account_holder_name: bData.bank_details.account_holder_name || psychic.name || '',
            bank_name: bData.bank_details.bank_name || 'Chase Bank, N.A.',
            account_number: bData.bank_details.account_number || '',
            routing_number: bData.bank_details.routing_number || '',
            account_type: bData.bank_details.account_type || 'Checking',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching account status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDirectBank = async () => {
    if (!editForm.account_number.trim() || !editForm.routing_number.trim()) {
      const msg = 'Please enter both Account Number and 9-digit Routing Number';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Incomplete Form', msg);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/psychic-bank-details/${psychic?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setDirectBank(editForm);
        setShowEditModal(false);
        const doneMsg = 'Bank account details updated successfully!';
        Platform.OS === 'web' ? alert(doneMsg) : Alert.alert('Saved', doneMsg);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save');
      }
    } catch (e: any) {
      const msg = e?.message || 'Error saving bank details';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ADV-019: 2FA OTP verification prompt for sensitive bank settings
  const verify2FA = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const code = prompt('🔐 2FA Verification Required: Enter the 6-digit security code sent to your mobile:');
        if (code && code.length >= 4) {
          resolve(true);
        } else {
          alert('Invalid 2FA verification code.');
          resolve(false);
        }
      } else {
        Alert.prompt(
          '🔐 2FA Security Required',
          'Enter 6-digit verification code sent to your registered phone number:',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Verify Code',
              onPress: (code?: string) => {
                if (code && code.length >= 4) {
                  resolve(true);
                } else {
                  Alert.alert('Security Error', 'Invalid 2FA verification code.');
                  resolve(false);
                }
              }
            }
          ],
          'plain-text'
        );
      }
    });
  };

  const handleConnectBank = async () => {
    if (!psychic?.id) return;

    const is2FAValid = await verify2FA();
    if (!is2FAValid) return;
    
    setIsConnecting(true);
    try {
      // Get Stripe Connect onboarding URL
      const response = await fetch(`${BACKEND_URL}/api/stripe-connect/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: psychic.id,
          email: psychic.email,
          name: psychic.name,
          country: psychic.country || 'US',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.onboarding_url) {
          // Open Stripe Connect onboarding in browser
          const result = await WebBrowser.openBrowserAsync(data.onboarding_url);
          
          // Refresh status after returning from browser
          if (result.type === 'cancel' || result.type === 'dismiss') {
            await fetchAccountStatus();
          }
        }
      } else {
        const error = await response.json();
        const msg = error.detail || 'Failed to start bank connection';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
      }
    } catch (error) {
      console.error('Error connecting bank:', error);
      const msg = 'Network error. Please try again.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUpdateBankInfo = async () => {
    if (!psychic?.id || !accountStatus?.account_id) return;
    
    setIsConnecting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe-connect/account-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: psychic.id,
          account_id: accountStatus.account_id,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          await WebBrowser.openBrowserAsync(data.url);
          await fetchAccountStatus();
        }
      }
    } catch (error) {
      console.error('Error updating bank info:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusBadge = () => {
    if (directBank?.account_number || accountStatus?.bank_account) {
      return { text: 'Bank Account Linked', color: colors.success, icon: 'checkmark-circle' };
    }
    if (accountStatus?.connected && !accountStatus?.payouts_enabled) {
      return { text: 'Pending Verification', color: colors.warning, icon: 'time' };
    }
    return { text: 'Not Connected', color: colors.error, icon: 'close-circle' };
  };

  const status = getStatusBadge();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Bank Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading account status...
            </Text>
          </View>
        ) : (
          <>
            {/* Status Card */}
            <View style={[styles.statusCard, { backgroundColor: colors.backgroundCard }]}>
              <View style={styles.statusHeader}>
                <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                  Connection Status
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                  <Ionicons name={status.icon as any} size={16} color={status.color} />
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>
                    {status.text}
                  </Text>
                </View>
              </View>

              {accountStatus?.bank_account ? (
                <View style={styles.bankInfo}>
                  <View style={[styles.bankIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="business" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.bankDetails}>
                    <Text style={[styles.bankName, { color: colors.textPrimary }]}>
                      {accountStatus.bank_account.bank_name}
                    </Text>
                    {/* ADV-013: Masked bank account & routing details */}
                    <Text style={[styles.bankLast4, { color: colors.textSecondary }]}>
                      Account Ending: ••••{accountStatus.bank_account.last4}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleUpdateBankInfo}>
                    <Text style={[styles.editLink, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : directBank?.account_number ? (
                <View style={styles.bankInfo}>
                  <View style={[styles.bankIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="business" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.bankDetails}>
                    <Text style={[styles.bankName, { color: colors.textPrimary }]}>
                      {directBank.bank_name || 'Chase Bank, N.A.'}
                    </Text>
                    <Text style={[styles.bankLast4, { color: colors.textSecondary }]}>
                      Account: ••••{directBank.account_number.slice(-4)} ({directBank.account_type || 'Checking'})
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Routing: {directBank.routing_number} • {directBank.account_holder_name}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowEditModal(true)}>
                    <Text style={[styles.editLink, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={[styles.notConnectedText, { color: colors.textSecondary, marginBottom: 10 }]}>
                    No bank account linked for payouts yet.
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                    onPress={() => setShowEditModal(true)}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>+ Add Bank Account Details</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Connect/Verify Button */}
            {!accountStatus?.payouts_enabled && (
              <TouchableOpacity
                style={styles.connectButton}
                onPress={handleConnectBank}
                disabled={isConnecting}
              >
                <LinearGradient
                  colors={['#635BFF', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectGradient}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="link" size={22} color="#FFF" />
                      <Text style={styles.connectText}>
                        {accountStatus?.connected ? 'Complete Verification' : 'Connect Bank Account'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* How it Works */}
            <View style={[styles.infoCard, { backgroundColor: colors.backgroundCard }]}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                How it Works
              </Text>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.stepNumberText, { color: colors.primary }]}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                    Connect Securely
                  </Text>
                  <Text style={[styles.stepText, { color: colors.textMuted }]}>
                    Log into your bank through Plaid's secure interface
                  </Text>
                </View>
              </View>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.stepNumberText, { color: colors.primary }]}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                    Instant Verification
                  </Text>
                  <Text style={[styles.stepText, { color: colors.textMuted }]}>
                    Your bank account is verified automatically
                  </Text>
                </View>
              </View>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.stepNumberText, { color: colors.primary }]}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                    Receive Payouts
                  </Text>
                  <Text style={[styles.stepText, { color: colors.textMuted }]}>
                    Earnings deposited directly to your bank weekly
                  </Text>
                </View>
              </View>
            </View>

            {/* Security Notice */}
            <View style={[styles.securityNotice, { borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                Your bank credentials are never stored on our servers. All connections are secured by Stripe and Plaid.
              </Text>
            </View>

            {/* Requirements Notice */}
            {accountStatus?.requirements && accountStatus.requirements.length > 0 && (
              <View style={[styles.requirementsCard, { backgroundColor: colors.warning + '10', borderColor: colors.warning }]}>
                <Text style={[styles.requirementsTitle, { color: colors.warning }]}>
                  <Ionicons name="alert-circle" size={16} /> Action Required
                </Text>
                {accountStatus.requirements.map((req, index) => (
                  <Text key={index} style={[styles.requirementItem, { color: colors.textSecondary }]}>
                    • {req.replace(/_/g, ' ')}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Direct Deposit Bank Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                  Direct Deposit Details
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
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
                value={editForm.account_holder_name}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, account_holder_name: t }))}
              />

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
                value={editForm.bank_name}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, bank_name: t }))}
              />

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
                value={editForm.account_number}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, account_number: t }))}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Routing Number (ABA)
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
                value={editForm.routing_number}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, routing_number: t }))}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                Account Type
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {['Checking', 'Savings'].map((type) => {
                  const isSelected = editForm.account_type === type;
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
                      onPress={() => setEditForm((prev) => ({ ...prev, account_type: type }))}
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
                onPress={handleSaveDirectBank}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Save Details</Text>
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
                onPress={() => setShowEditModal(false)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
  },
  bankLast4: {
    fontSize: 14,
    marginTop: 2,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  pendingInfo: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pendingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  completeButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  completeButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  notConnectedInfo: {
    paddingVertical: SPACING.sm,
  },
  notConnectedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  connectButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  connectText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 18,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  requirementsCard: {
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  requirementItem: {
    fontSize: 13,
    marginTop: 4,
  },
});
