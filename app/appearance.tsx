import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { SPACING } from '../src/constants/theme';

type ThemeOption = 'light' | 'dark' | 'auto';

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const themeOptions: { id: ThemeOption; title: string; icon: string; description: string }[] = [
    {
      id: 'light',
      title: 'Day Mode',
      icon: 'sunny',
      description: 'Bright white theme, perfect for daytime',
    },
    {
      id: 'dark',
      title: 'Night Mode',
      icon: 'moon',
      description: 'Dark theme, easy on the eyes',
    },
    {
      id: 'auto',
      title: 'Automatic',
      icon: 'phone-portrait',
      description: 'Matches your device settings',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.backgroundElevated }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Appearance</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: colors.backgroundCard }]}>
          <View style={[styles.previewHeader, { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }]}>
            <View style={[styles.previewDot, { backgroundColor: '#FF5F57' }]} />
            <View style={[styles.previewDot, { backgroundColor: '#FEBC2E' }]} />
            <View style={[styles.previewDot, { backgroundColor: '#28C840' }]} />
          </View>
          <View style={styles.previewBody}>
            <View style={[styles.previewLine, { backgroundColor: colors.textMuted, width: '60%' }]} />
            <View style={[styles.previewLine, { backgroundColor: colors.textMuted, width: '80%' }]} />
            <View style={[styles.previewLine, { backgroundColor: colors.textMuted, width: '40%' }]} />
            <View style={[styles.previewButton, { backgroundColor: colors.primary }]} />
          </View>
        </View>

        {/* Theme Options */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>THEME</Text>
        <View style={[styles.optionsCard, { backgroundColor: colors.backgroundCard }]}>
          {themeOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                index < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
              onPress={() => setThemeMode(option.id)}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name={option.icon as any} size={22} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{option.title}</Text>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{option.description}</Text>
              </View>
              {themeMode === option.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Current Mode Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {themeMode === 'auto' 
              ? `Currently using ${isDark ? 'night' : 'day'} mode based on your device settings.`
              : `${themeMode === 'dark' ? 'Night' : 'Day'} mode is active.`
            }
          </Text>
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
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  previewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: 6,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  previewLine: {
    height: 10,
    borderRadius: 5,
  },
  previewButton: {
    height: 30,
    width: '40%',
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  optionsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
