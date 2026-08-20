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

  useEffect(() => {
    fetchAccountStatus();
  }, []);

  const fetchAccountStatus = async () => {
    if (!psychic?.id) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe-connect/account-status/${psychic.id}`);
      if (response.ok) {
        const data = await response.json();
        setAccountStatus(data);
      }
    } catch (error) {
      console.error('Error fetching account status:', error);
    } finally {
      setIsLoading(false);
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
              onPress: (code) => {
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
    if (!accountStatus?.connected) {
      return { text: 'Not Connected', color: colors.error, icon: 'close-circle' };
    }
    if (!accountStatus.payouts_enabled) {
      return { text: 'Pending Verification', color: colors.warning, icon: 'time' };
    }
    return { text: 'Verified', color: colors.success, icon: 'checkmark-circle' };
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
              ) : accountStatus?.connected && !accountStatus?.payouts_enabled ? (
                <View style={styles.pendingInfo}>
                  <Ionicons name="information-circle" size={20} color={colors.warning} />
                  <Text style={[styles.pendingText, { color: colors.textSecondary }]}>
                    Complete verification to enable payouts
                  </Text>
                  <TouchableOpacity
                    style={[styles.completeButton, { backgroundColor: colors.warning }]}
                    onPress={handleUpdateBankInfo}
                  >
                    <Text style={styles.completeButtonText}>Complete Setup</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.notConnectedInfo}>
                  <Text style={[styles.notConnectedText, { color: colors.textSecondary }]}>
                    Connect your bank account to receive your earnings directly.
                  </Text>
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
