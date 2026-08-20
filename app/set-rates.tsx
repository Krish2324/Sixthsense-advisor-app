import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const MIN_RATE = 0.99;
const MAX_RATE = 19.99;

export default function SetRatesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { psychic, updateProfile } = useAuth();
  const { colors } = useTheme();

  const [chatRate, setChatRate] = useState(psychic?.chat_rate?.toString() || '3.99');
  const [error, setError] = useState<string | undefined>();

  const validateRate = (value: string) => {
    const rate = parseFloat(value);
    if (isNaN(rate)) {
      setError('Invalid rate');
      return false;
    }
    if (rate < MIN_RATE) {
      setError(`Minimum rate is $${MIN_RATE}`);
      return false;
    }
    if (rate > MAX_RATE) {
      setError(`Maximum rate is $${MAX_RATE}`);
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleRateChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    
    setChatRate(formatted);
    
    if (formatted) {
      validateRate(formatted);
    }
  };

  const handleSave = () => {
    if (!validateRate(chatRate)) {
      Alert.alert('Invalid Rate', `Rate must be between $${MIN_RATE} and $${MAX_RATE} per minute.`);
      return;
    }

    updateProfile({
      chat_rate: parseFloat(chatRate),
    });

    Alert.alert('Success', 'Your chat rate has been updated!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  // Calculate earnings
  const calculateEarnings = (rate: string, minutes: number) => {
    const r = parseFloat(rate) || 0;
    return (r * minutes * 0.4).toFixed(2); // 40% goes to psychic
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.backgroundElevated }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Set Your Rate</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoBannerText}>
            <Text style={[styles.infoBannerTitle, { color: colors.primary }]}>Earnings Split</Text>
            <Text style={[styles.infoBannerDesc, { color: colors.textSecondary }]}>
              You receive 40% of each session. Set competitive rates to attract more clients.
            </Text>
          </View>
        </View>

        {/* ADV-060: Rate Change Delay Warning Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40', marginBottom: SPACING.lg }]}>
          <Ionicons name="time" size={24} color={colors.warning} />
          <View style={styles.infoBannerText}>
            <Text style={[styles.infoBannerTitle, { color: colors.warning }]}>Rate Sync Delay Notice</Text>
            <Text style={[styles.infoBannerDesc, { color: colors.textSecondary }]}>
              Updated per-minute rates take up to 1 hour to propagate across client search listings and active cache nodes.
            </Text>
          </View>
        </View>

        {/* Chat Rate Card */}
        <View style={[styles.rateCard, { backgroundColor: colors.backgroundCard }]}>
          <View style={styles.rateHeader}>
            <View style={[styles.rateIconBg, { backgroundColor: '#22C55E20' }]}>
              <Ionicons name="chatbubble" size={24} color="#22C55E" />
            </View>
            <View style={styles.rateInfo}>
              <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>Live Chat</Text>
              <Text style={[styles.rateDesc, { color: colors.textSecondary }]}>Per minute rate for chat readings</Text>
            </View>
          </View>
          
          <View style={styles.rateInputRow}>
            <Text style={[styles.dollarSign, { color: colors.textPrimary }]}>$</Text>
            <TextInput
              style={[
                styles.rateInput, 
                { 
                  color: colors.textPrimary, 
                  borderColor: error ? colors.error : colors.border,
                  backgroundColor: colors.backgroundElevated 
                }
              ]}
              value={chatRate}
              onChangeText={handleRateChange}
              keyboardType="decimal-pad"
              placeholder="3.99"
              placeholderTextColor={colors.textMuted}
              maxLength={4}
            />
            <Text style={[styles.perMinute, { color: colors.textMuted }]}>/min</Text>
          </View>
          
          {error && (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          )}

          <View style={[styles.earningsPreview, { backgroundColor: colors.backgroundElevated }]}>
            <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>Your Earnings Preview</Text>
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>10 min session:</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>${calculateEarnings(chatRate, 10)}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>30 min session:</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>${calculateEarnings(chatRate, 30)}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>60 min session:</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>${calculateEarnings(chatRate, 60)}</Text>
            </View>
          </View>
        </View>

        {/* Rate Guidelines */}
        <View style={[styles.guidelinesCard, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.guidelinesTitle, { color: colors.textPrimary }]}>Rate Guidelines</Text>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Minimum rate: ${MIN_RATE}/min
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Maximum rate: ${MAX_RATE}/min
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="trending-up" size={18} color={colors.primary} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Lower rates attract more clients initially
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.saveContainer, { paddingBottom: insets.bottom + SPACING.md, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Ionicons name="checkmark" size={24} color="#FFF" />
          <Text style={styles.saveButtonText}>Save Rate</Text>
        </TouchableOpacity>
      </View>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  rateCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  rateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  rateIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateInfo: {
    flex: 1,
  },
  rateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  rateDesc: {
    fontSize: 13,
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dollarSign: {
    fontSize: 28,
    fontWeight: '700',
    marginRight: SPACING.xs,
  },
  rateInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: 'center',
  },
  perMinute: {
    fontSize: 16,
    marginLeft: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  earningsPreview: {
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  earningsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  earningsTime: {
    fontSize: 14,
  },
  earningsAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  guidelinesCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  guidelineText: {
    fontSize: 14,
    flex: 1,
  },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
