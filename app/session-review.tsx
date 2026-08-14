import React, { useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SessionReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  const clientId = params.clientId as string;
  const clientName = params.clientName as string || 'Client';
  const sessionId = params.sessionId as string;
  const sessionType = params.sessionType as string || 'chat';
  const duration = parseInt(params.duration as string || '0');
  const earnings = parseFloat(params.earnings as string || '0');
  
  const [notes, setNotes] = useState('');
  const [clientSatisfaction, setClientSatisfaction] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Save psychic's notes about the session
      await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/psychic-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: user?.id,
          client_id: clientId,
          notes: notes,
          client_satisfaction_estimate: clientSatisfaction,
        }),
      });

      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Error saving notes:', error);
      // Still navigate even if notes fail to save
      router.replace('/(tabs)/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header */}
        <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Session Complete!</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Great reading with {clientName}
        </Text>

        {/* Earnings Card */}
        <LinearGradient
          colors={[colors.success, '#1D8348']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.earningsCard}
        >
          <Text style={styles.earningsLabel}>You Earned</Text>
          <Text style={styles.earningsAmount}>${earnings.toFixed(2)}</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsItemLabel}>Duration</Text>
              <Text style={styles.earningsItemValue}>{formatTime(duration)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsItemLabel}>Type</Text>
              <Text style={styles.earningsItemValue}>{sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Client Satisfaction Estimate */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            How do you think it went?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Estimate client satisfaction (for your records only)
          </Text>
          
          <View style={styles.satisfactionButtons}>
            {[
              { value: 1, icon: 'sad-outline', label: 'Poor' },
              { value: 2, icon: 'sad-outline', label: 'Fair' },
              { value: 3, icon: 'happy-outline', label: 'Good' },
              { value: 4, icon: 'happy-outline', label: 'Great' },
              { value: 5, icon: 'happy', label: 'Amazing' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.satisfactionBtn,
                  { borderColor: colors.border },
                  clientSatisfaction === option.value && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + '10',
                  },
                ]}
                onPress={() => setClientSatisfaction(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={clientSatisfaction === option.value ? colors.primary : colors.textMuted}
                />
                <Text style={[
                  styles.satisfactionLabel,
                  { color: clientSatisfaction === option.value ? colors.primary : colors.textMuted },
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Private Notes */}
        <View style={[styles.section, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Private Notes
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Notes for future reference (only you can see this)
          </Text>
          
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="What topics were discussed? Any insights to remember for next time?"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={[styles.skipButton, { borderColor: colors.border }]}
          onPress={handleSkip}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save & Continue</Text>
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
  content: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },
  successIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  earningsCard: {
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  earningsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsItemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  earningsItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 4,
  },
  earningsDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  satisfactionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  satisfactionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  satisfactionLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    minHeight: 100,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  skipButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
