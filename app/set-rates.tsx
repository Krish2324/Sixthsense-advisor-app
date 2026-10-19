import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const MIN_RATE = 0.99;
const MAX_RATE = 19.99;
const RATE_PRESETS = ['1.99', '2.99', '3.99', '4.99', '6.99', '9.99'];

export default function SetRatesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { psychic, updateProfile } = useAuth();
  const { colors } = useTheme();

  const [chatRate, setChatRate] = useState(
    psychic?.chat_rate !== undefined ? psychic.chat_rate.toString() : '3.99'
  );
  const [phoneRate, setPhoneRate] = useState(
    psychic?.phone_rate !== undefined ? psychic.phone_rate.toString() : '4.99'
  );
  const [videoRate, setVideoRate] = useState(
    psychic?.video_rate !== undefined
      ? psychic.video_rate.toString()
      : ((psychic as any)?.video_call_rate !== undefined
          ? (psychic as any).video_call_rate.toString()
          : '6.99')
  );

  const [saving, setSaving] = useState(false);
  const [chatError, setChatError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [videoError, setVideoError] = useState<string | undefined>();

  const sanitizeRate = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
  };

  const validateRate = (value: string): string | undefined => {
    const rate = parseFloat(value);
    if (isNaN(rate)) {
      return 'Enter a valid rate';
    }
    if (rate < MIN_RATE) {
      return `Min is $${MIN_RATE}`;
    }
    if (rate > MAX_RATE) {
      return `Max is $${MAX_RATE}`;
    }
    return undefined;
  };

  const handleChatChange = (val: string) => {
    const cleaned = sanitizeRate(val);
    setChatRate(cleaned);
    if (cleaned) setChatError(validateRate(cleaned));
  };

  const handlePhoneChange = (val: string) => {
    const cleaned = sanitizeRate(val);
    setPhoneRate(cleaned);
    if (cleaned) setPhoneError(validateRate(cleaned));
  };

  const handleVideoChange = (val: string) => {
    const cleaned = sanitizeRate(val);
    setVideoRate(cleaned);
    if (cleaned) setVideoError(validateRate(cleaned));
  };

  const handleSave = async () => {
    const errChat = validateRate(chatRate);
    const errPhone = validateRate(phoneRate);
    const errVideo = validateRate(videoRate);

    setChatError(errChat);
    setPhoneError(errPhone);
    setVideoError(errVideo);

    if (errChat || errPhone || errVideo) {
      Alert.alert(
        'Invalid Rates',
        `All rates must be between $${MIN_RATE} and $${MAX_RATE} per minute.`
      );
      return;
    }

    try {
      setSaving(true);
      await updateProfile({
        chat_rate: parseFloat(chatRate),
        phone_rate: parseFloat(phoneRate),
        video_rate: parseFloat(videoRate),
        video_call_rate: parseFloat(videoRate),
      } as any);

      Alert.alert('Rates Updated', 'Your rates for Live Chat, Audio Call, and Video Call have been successfully saved!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save rates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate psychic earnings (40% of session cost)
  const calculateEarnings = (rateStr: string, minutes: number) => {
    const r = parseFloat(rateStr) || 0;
    return (r * minutes * 0.4).toFixed(2);
  };

  const renderServiceCard = (
    title: string,
    subtitle: string,
    icon: keyof typeof Ionicons.glyphMap,
    accentColor: string,
    rateValue: string,
    onRateChange: (val: string) => void,
    errorMsg?: string
  ) => {
    return (
      <View style={[styles.rateCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <View style={styles.rateHeader}>
          <View style={[styles.rateIconBg, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name={icon} size={24} color={accentColor} />
          </View>
          <View style={styles.rateInfo}>
            <Text style={[styles.rateTitle, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.rateDesc, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
        </View>

        {/* Input Row */}
        <View style={styles.rateInputRow}>
          <Text style={[styles.dollarSign, { color: accentColor }]}>$</Text>
          <TextInput
            style={[
              styles.rateInput,
              {
                color: colors.textPrimary,
                borderColor: errorMsg ? colors.error : colors.border,
                backgroundColor: colors.backgroundElevated,
              },
            ]}
            value={rateValue}
            onChangeText={onRateChange}
            keyboardType="decimal-pad"
            placeholder="3.99"
            placeholderTextColor={colors.textMuted}
            maxLength={5}
          />
          <Text style={[styles.perMinute, { color: colors.textMuted }]}>/ min</Text>
        </View>

        {errorMsg && (
          <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
        )}

        {/* Preset Chips */}
        <View style={styles.presetRow}>
          {RATE_PRESETS.map((preset) => {
            const isSelected = rateValue === preset;
            return (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected ? accentColor : colors.backgroundElevated,
                    borderColor: isSelected ? accentColor : colors.border,
                  },
                ]}
                onPress={() => onRateChange(preset)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  ${preset}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Earnings Preview */}
        <View style={[styles.earningsPreview, { backgroundColor: colors.backgroundElevated }]}>
          <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
            Your Earnings Preview (40% Share)
          </Text>
          <View style={styles.earningsGrid}>
            <View style={styles.earningsItem}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>10 min</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>
                ${calculateEarnings(rateValue, 10)}
              </Text>
            </View>
            <View style={[styles.earningsItem, styles.earningsDivider, { borderColor: colors.border }]}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>30 min</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>
                ${calculateEarnings(rateValue, 30)}
              </Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={[styles.earningsTime, { color: colors.textSecondary }]}>60 min</Text>
              <Text style={[styles.earningsAmount, { color: colors.success }]}>
                ${calculateEarnings(rateValue, 60)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundElevated }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Set Your Rates</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
      >
        {/* Info Banner */}
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' },
          ]}
        >
          <Ionicons name="sparkles" size={24} color={colors.primary} />
          <View style={styles.infoBannerText}>
            <Text style={[styles.infoBannerTitle, { color: colors.primary }]}>
              Customize Rates for All Services
            </Text>
            <Text style={[styles.infoBannerDesc, { color: colors.textSecondary }]}>
              Set individual per-minute rates for Live Chat, Audio Calls, and Video Calls. You take home 40% of every reading.
            </Text>
          </View>
        </View>

        {/* 1. Live Chat */}
        {renderServiceCard(
          'Live Chat',
          'Per minute rate for text chat readings',
          'chatbubble-ellipses',
          '#22C55E',
          chatRate,
          handleChatChange,
          chatError
        )}

        {/* 2. Audio Call */}
        {renderServiceCard(
          'Audio Call',
          'Per minute rate for 1-on-1 voice phone calls',
          'call',
          '#3B82F6',
          phoneRate,
          handlePhoneChange,
          phoneError
        )}

        {/* 3. Video Call */}
        {renderServiceCard(
          'Video Call',
          'Per minute rate for face-to-face live video sessions',
          'videocam',
          '#A855F7',
          videoRate,
          handleVideoChange,
          videoError
        )}

        {/* Guidelines Card */}
        <View
          style={[
            styles.guidelinesCard,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.guidelinesTitle, { color: colors.textPrimary }]}>
            Rate Guidelines & Tips
          </Text>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Allowable range: ${MIN_RATE}/min to ${MAX_RATE}/min
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="videocam-outline" size={18} color={colors.primary} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Video calls are premium services and typically command higher rates ($5.99–$9.99/min)
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="trending-up" size={18} color={colors.primary} />
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              Competitive rates help attract new clients and build repeat loyalty
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View
        style={[
          styles.saveContainer,
          {
            paddingBottom: insets.bottom + SPACING.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={22} color="#FFF" />
              <Text style={styles.saveButtonText}>Save All Rates</Text>
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
    fontWeight: '700',
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: 14,
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
    fontWeight: '700',
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
    borderWidth: 1,
  },
  rateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  rateDesc: {
    fontSize: 13,
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  dollarSign: {
    fontSize: 26,
    fontWeight: '700',
    marginRight: 6,
  },
  rateInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  perMinute: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earningsPreview: {
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: 4,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  earningsTime: {
    fontSize: 12,
    marginBottom: 2,
  },
  earningsAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  guidelinesCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  guidelineText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
