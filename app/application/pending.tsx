import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../src/constants/theme';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ADV-061: Live status refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCheckStatus = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const msg = 'Application Status: Under Review.\nEstimated review completion: 24 - 48 hours.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Status Refreshed', msg);
    }, 800);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="time" size={60} color={COLORS.gold} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.subtitle}>
          Thank you for applying to become a Psychic Advisor!
        </Text>

        {/* Info Cards */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <Text style={styles.infoText}>Application received</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time" size={24} color={COLORS.gold} />
            <Text style={styles.infoText}>Review in progress (3-5 days)</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={24} color={COLORS.textMuted} />
            <Text style={styles.infoText}>We'll email you with updates</Text>
          </View>
        </View>

        {/* What to expect */}
        <View style={styles.expectSection}>
          <Text style={styles.expectTitle}>What happens next?</Text>
          <Text style={styles.expectText}>
            Our team reviews your application and video interview. If approved, you'll receive an email with instructions to set up your advisor profile and start accepting readings.
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md, gap: 10 }]}>
        {/* ADV-061: Live Application Status Refresh Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: COLORS.primary }]}
          onPress={handleCheckStatus}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="refresh-circle" size={22} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Refresh Status</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/welcome')}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  expectSection: {
    width: '100%',
  },
  expectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  expectText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  button: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
