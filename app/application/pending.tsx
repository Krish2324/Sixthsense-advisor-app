import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING } from '../../src/constants/theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.73:8000';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [applicantEmail, setApplicantEmail] = useState<string>((params.email as string) || '');
  const [applicantName, setApplicantName] = useState<string>((params.name as string) || '');
  const [status, setStatus] = useState<'pending' | 'under_review' | 'rejected' | 'accepted'>(
    ((params.status as string) || 'pending') as any
  );
  const [rejectionReason, setRejectionReason] = useState<string>((params.reason as string) || '');

  // Live status refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Support Query Form state
  const [querySubject, setQuerySubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [isSendingQuery, setIsSendingQuery] = useState(false);

  // Load applicant email if not in params
  useEffect(() => {
    const loadSavedEmail = async () => {
      if (!applicantEmail) {
        try {
          const savedEmail = await AsyncStorage.getItem('signup_email');
          if (savedEmail) {
            setApplicantEmail(savedEmail);
            fetchApplicationStatus(savedEmail);
          }
        } catch {}
      } else {
        fetchApplicationStatus(applicantEmail);
      }
    };
    loadSavedEmail();
  }, [applicantEmail]);

  // Fetch status directly from backend
  const fetchApplicationStatus = useCallback(async (targetEmail?: string) => {
    const mail = targetEmail || applicantEmail;
    if (!mail) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/email/${encodeURIComponent(mail.toLowerCase())}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setStatus(data.status || 'pending');
          if (data.full_name) setApplicantName(data.full_name);
          if (data.rejection_reason) setRejectionReason(data.rejection_reason);

          // Save application data so when resubmitting, all inputs are pre-filled
          try {
            await AsyncStorage.setItem('application_data', JSON.stringify(data));
          } catch {}

          if (data.status === 'accepted') {
            Alert.alert(
              '🎉 Application Approved!',
              'Congratulations! Your application has been approved. You can now log in.',
              [{ text: 'Log In Now', onPress: () => router.replace('/(auth)/login') }]
            );
          }
        }
      }
    } catch (e) {
      console.warn('Status check failed:', e);
    }
  }, [applicantEmail]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    await fetchApplicationStatus();
    setIsRefreshing(false);
  };

  // Re-submit application - navigates to Become an Advisor form with all previously filled data preserved
  const handleResubmit = async () => {
    router.replace({
      pathname: '/application',
      params: { resubmit: 'true', email: applicantEmail },
    });
  };

  // Submit Support Query to Admin
  const handleSendSupportQuery = async () => {
    if (!queryMessage.trim()) {
      Alert.alert('Required', 'Please enter your message or query.');
      return;
    }

    setIsSendingQuery(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/support-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: applicantEmail,
          name: applicantName || 'Advisor Applicant',
          subject: querySubject.trim() || (status === 'rejected' ? 'Rejection Appeal / Query' : 'Application Status Inquiry'),
          message: queryMessage.trim(),
        }),
      });

      if (res.ok) {
        Alert.alert(
          'Query Sent to Admin ✅',
          'Your support message has been sent to our administrator team. We will review and reply to your email shortly.',
          [{ text: 'OK' }]
        );
        setQuerySubject('');
        setQueryMessage('');
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert('Error', errData.detail || 'Failed to submit query. Please try again.');
      }
    } catch (err: any) {
      console.error('Support query error:', err);
      Alert.alert('Error', 'Network request failed. Please check your connection.');
    } finally {
      setIsSendingQuery(false);
    }
  };

  const isRejected = status === 'rejected';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Icon */}
        <View style={[
          styles.iconContainer,
          isRejected ? styles.iconContainerRejected : styles.iconContainerPending
        ]}>
          <Ionicons
            name={isRejected ? 'close-circle' : 'time'}
            size={64}
            color={isRejected ? '#EF4444' : COLORS.gold}
          />
        </View>

        {/* Title & Badge */}
        <View style={styles.badgeRow}>
          <View style={[
            styles.statusBadge,
            isRejected ? styles.statusBadgeRejected : styles.statusBadgePending
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isRejected ? '#EF4444' : COLORS.gold }
            ]} />
            <Text style={[
              styles.statusBadgeText,
              { color: isRejected ? '#EF4444' : COLORS.gold }
            ]}>
              {isRejected ? 'Application Rejected' : 'Under Review'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>
          {isRejected ? 'Application Not Approved' : 'Application Under Review'}
        </Text>

        <Text style={styles.subtitle}>
          {isRejected
            ? 'We appreciate your interest in joining our advisor community. You can review the admin feedback below and re-submit your application.'
            : 'Thank you for applying to become a Psychic Advisor! Your profile is currently being reviewed by our admin team.'}
        </Text>

        {/* Applicant Details Card */}
        {applicantEmail ? (
          <View style={styles.applicantCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="person-circle" size={32} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                {applicantName ? <Text style={styles.applicantName}>{applicantName}</Text> : null}
                <Text style={styles.applicantEmail}>{applicantEmail}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Rejection Details & Re-Submit Button (Visible when Rejected) */}
        {isRejected ? (
          <View style={styles.rejectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={22} color="#EF4444" />
              <Text style={styles.rejectionCardTitle}>Reason from Admin:</Text>
            </View>
            <Text style={styles.rejectionReasonText}>
              {rejectionReason || 'Application details did not meet the verification guidelines. Please update your information and re-submit.'}
            </Text>

            {/* Re-Submit Button */}
            <TouchableOpacity
              style={styles.resubmitButton}
              onPress={handleResubmit}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.resubmitButtonText}>Re-Submit Application</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Under Review Info Cards */
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.infoText}>Application Received</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={24} color={COLORS.gold} />
              <Text style={styles.infoText}>Verification & Review in Progress (24 - 48h)</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={24} color={COLORS.primary} />
              <Text style={styles.infoText}>You will receive an email upon approval</Text>
            </View>
          </View>
        )}

        {/* Support Query / Contact Admin Form */}
        <View style={styles.supportSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="chatbubbles" size={22} color={COLORS.primary} />
            <Text style={styles.supportTitle}>Need Help or Have a Question?</Text>
          </View>
          <Text style={styles.supportSubtitle}>
            Send a direct query to the admin regarding your application status or questions:
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Subject / Topic</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Document question, Status follow-up"
              placeholderTextColor={COLORS.textMuted}
              value={querySubject}
              onChangeText={setQuerySubject}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Your Query / Message <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Type your message here for the admin..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={queryMessage}
              onChangeText={setQueryMessage}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendQueryButton, isSendingQuery && { opacity: 0.7 }]}
            onPress={handleSendSupportQuery}
            disabled={isSendingQuery}
          >
            {isSendingQuery ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="paper-plane" size={18} color="#FFF" />
                <Text style={styles.sendQueryButtonText}>Send to Admin Support</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshStatus}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="refresh-circle" size={22} color="#FFF" />
                <Text style={styles.refreshButtonText}>Refresh Application Status</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconContainerPending: {
    backgroundColor: COLORS.gold + '15',
    borderWidth: 2,
    borderColor: COLORS.gold + '40',
  },
  iconContainerRejected: {
    backgroundColor: '#EF444415',
    borderWidth: 2,
    borderColor: '#EF444440',
  },
  badgeRow: {
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgePending: {
    backgroundColor: COLORS.gold + '20',
  },
  statusBadgeRejected: {
    backgroundColor: '#EF444420',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  applicantCard: {
    width: '100%',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  applicantName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  applicantEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rejectionCard: {
    width: '100%',
    backgroundColor: '#EF444410',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#EF444435',
    marginBottom: SPACING.lg,
  },
  rejectionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  rejectionReasonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  resubmitButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  supportSection: {
    width: '100%',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0F081D',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  sendQueryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendQueryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtons: {
    width: '100%',
    gap: 10,
  },
  refreshButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
