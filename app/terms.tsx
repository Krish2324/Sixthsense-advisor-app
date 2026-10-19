import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Terms & Conditions
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Table of Contents Quick Links */}
      <View
        style={[
          styles.tocContainer,
          { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.backgroundElevated },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }}
        >
          {[
            '1. Agreement',
            '2. Earnings & Payouts',
            '3. Code of Conduct',
            '4. Suspension Policy',
            '6. Messaging',
            '8. Monitoring & Privacy',
            '10. New Client 4-Min',
            '11. Badges & Tags',
            '13. Dispute Resolution',
          ].map((title, idx) => (
            <View
              key={idx}
              style={[
                styles.tocChip,
                { backgroundColor: colors.primary + '25', borderColor: colors.primary + '50' },
              ]}
            >
              <Text style={[styles.tocChipText, { color: colors.primary }]}>{title}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
      >
        <View style={styles.metaRow}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
            Last Updated: March 2026 • SixthSense Advisor Network
          </Text>
        </View>

        {/* 1. Advisor Agreement */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>01</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Advisor Agreement
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            By registering as a Psychic Advisor on our platform, you agree to provide authentic,
            ethical psychic readings to clients. You acknowledge that you are an independent contractor,
            not an employee of the platform.
          </Text>
        </View>

        {/* 2. Earnings & Payment */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>02</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Earnings & Payment Policy
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            • Advisors receive 40% of all reading fees (Chat, Audio, Video){'\n'}
            • Advisors receive 40% of all tips given by clients{'\n'}
            • Platform retains 60% for payment gateway, server infrastructure & client acquisition{'\n'}
            • Connection fees for phone/video calls are handled through platform balances{'\n'}
            • Weekly earnings withdrawals processed via PayPal and Stripe{'\n'}
            • Minimum withdrawal threshold: $50{'\n'}
            • Earnings over $600/year in the US require 1099 tax filing
          </Text>
        </View>

        {/* 3. Code of Conduct */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>03</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Code of Conduct
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Advisors must:{'\n'}
            • Provide readings with utmost integrity, empathy, and honesty{'\n'}
            • Strictly respect and protect client confidentiality{'\n'}
            • Never make guaranteed promises regarding health, lotteries, or absolute outcomes{'\n'}
            • Avoid emotional manipulation or dependency-creating behaviors{'\n'}
            • Promptly report any concerning self-harm or violent client disclosures{'\n'}
            • Maintain firm professional boundaries at all times
          </Text>
        </View>

        {/* 4. Suspension Policy */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>04</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Suspension & Termination Policy
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Advisors may face account review or suspension for:{'\n'}
            • Sustained low ratings (below 3.5 average stars){'\n'}
            • Validated complaints regarding scamming, off-platform solicitation, or abuse{'\n'}
            • Missing scheduled sessions without prior notice{'\n'}
            • Violating platform safety guidelines{'\n'}{'\n'}
            1st Offense: Formal warning & 5-day suspension{'\n'}
            2nd Offense: 30-day suspension{'\n'}
            3rd Offense: Permanent profile removal and fund forfeiture
          </Text>
        </View>

        {/* 5. Content Guidelines */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>05</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Content Guidelines
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            • No explicit, sexual, or adult content{'\n'}
            • No licensed medical diagnosis, legal counsel, or financial investment advice{'\n'}
            • No spells or curses promising harm to others{'\n'}
            • Zero tolerance for hate speech, harassment, or discrimination based on race, gender, religion, or orientation
          </Text>
        </View>

        {/* 6. Client Messaging */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>06</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Client Direct Messaging
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Clients who have paid for readings may send follow-up clarification messages:{'\n'}{'\n'}
            • Daily limit: 5 messages per client (resets automatically at midnight){'\n'}
            • Messages are strictly for clarifications on completed readings{'\n'}
            • Direct messages must not be used to deliver unpaid full consultations{'\n'}
            • Off-platform payment solicitation is strictly forbidden and automatically flagged
          </Text>
        </View>

        {/* 7. Tax Obligations */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>07</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Tax & Legal Obligations
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            As an independent service contractor, you are individually responsible for:{'\n'}
            • Reporting earnings to local tax authorities (e.g. IRS 1099-K / 1099-NEC){'\n'}
            • Paying self-employment and income taxes{'\n'}
            • Submitting valid identity verification and tax details when requested
          </Text>
        </View>

        {/* 8. Privacy & Data */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>08</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Privacy & Client Confidentiality
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            • Keep all client identities, birth dates, questions, and personal disclosures private{'\n'}
            • Do not record, screen-capture, or redistribute user consultations outside the app{'\n'}
            • Adhere to CCPA, GDPR, and international data privacy regulations
          </Text>
        </View>

        {/* 8.1 Admin Monitoring Alert Box */}
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: '#EF444415',
              borderColor: '#EF444450',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="warning" size={22} color="#EF4444" />
            <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
              8.1 Chat Recording & Safety Monitoring
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>
            To protect users and advisors from fraud, harassment, or financial scams, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>all communications, messages, and calls may be reviewed by platform moderation administrators</Text>.{'\n'}{'\n'}
            Advisors found executing scams or soliciting payments outside the SixthSense platform will be banned immediately.
          </Text>
        </View>

        {/* 9. Mandatory Sale Participation */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>09</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Monthly Promotional Sales
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            • Active advisors participate in periodic promotional events (e.g. New Moon / Equinox specials){'\n'}
            • Discounts (typically 10%–25%) are applied to attract new clients and drive volume{'\n'}
            • Advisor revenue share remains proportional (40% of session revenue)
          </Text>
        </View>

        {/* 10. New Client Policy */}
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: colors.primary + '18',
              borderColor: colors.primary + '50',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={22} color={colors.primary} />
            <Text style={[styles.alertTitle, { color: colors.primary }]}>
              10. First-Time Client 4-Minute Policy
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>
            First-time clients receive <Text style={{ fontWeight: '700', color: colors.primary }}>4 free introductory minutes</Text> during their initial reading to establish rapport. After 4 minutes, regular per-minute rates apply automatically without interruption.
          </Text>
        </View>

        {/* 11. Profile Tags & Badges */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: '#F59E0B25' }]}>
              <Text style={[styles.sectionNumberText, { color: '#F59E0B' }]}>11</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Profile Tags & Recognition Badges
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Advisors can earn distinguished profile badges based on quality and activity:{'\n'}
            • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Top Rated:</Text> Maintained 4.8+ star rating with over 50 readings{'\n'}
            • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Trending:</Text> High volume of active clients and responsiveness{'\n'}
            • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Rising Star:</Text> Outstanding new advisor performance in the first 30 days
          </Text>
        </View>

        {/* 12. Termination */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>12</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Agreement Termination
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Either party may terminate this agreement at any time. Upon termination, cleared earnings will be paid out during the subsequent weekly cycle minus any unresolved client chargebacks.
          </Text>
        </View>

        {/* 13. Dispute Resolution */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.sectionNumberText, { color: colors.primary }]}>13</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Dispute Resolution & Jurisdiction
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Any disputes will be resolved through binding confidential arbitration under applicable state and federal laws.
          </Text>
        </View>

        {/* Acceptance Note */}
        <View
          style={[
            styles.acceptanceNote,
            { backgroundColor: '#22C55E15', borderColor: '#22C55E40' },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={[styles.acceptanceText, { color: colors.textPrimary }]}>
            By accessing the SixthSense Advisor Portal and accepting readings, you confirm that you have read, understood, and consented to these terms and operational standards.
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
    fontWeight: '700',
  },
  placeholder: {
    width: 44,
  },
  tocContainer: {
    paddingVertical: 10,
  },
  tocChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tocChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  lastUpdated: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  alertCard: {
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sectionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionNumberText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  acceptanceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  acceptanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
});
