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
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.backgroundElevated }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.lastUpdated}>Last Updated: March 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Advisor Agreement</Text>
          <Text style={styles.sectionText}>
            By registering as a Psychic Advisor on our platform, you agree to provide authentic, ethical psychic readings to clients. You acknowledge that you are an independent contractor, not an employee of the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Earnings & Payment</Text>
          <Text style={styles.sectionText}>
            • Advisors receive 40% of all reading fees{"\n"}
            • Advisors receive 40% of all tips from clients{"\n"}
            • Platform retains 60% for operational costs{"\n"}
            • Connection fees may apply for phone/video calls and are deducted from advisor earnings{"\n"}
            • Payments processed weekly via PayPal{"\n"}
            • Minimum withdrawal amount: $50{"\n"}
            • Earnings over $600/year require tax reporting (1099)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Code of Conduct</Text>
          <Text style={styles.sectionText}>
            Advisors must:{"\n"}
            • Provide readings with integrity and honesty{"\n"}
            • Respect client confidentiality{"\n"}
            • Never make guarantees about outcomes{"\n"}
            • Avoid dependency-creating behaviors{"\n"}
            • Report any concerning client situations{"\n"}
            • Maintain professional boundaries
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Suspension Policy</Text>
          <Text style={styles.sectionText}>
            Advisors may be suspended for:{"\n"}
            • Consistently low ratings (below 3.5 stars){"\n"}
            • Multiple client complaints{"\n"}
            • Fraudulent or deceptive practices{"\n"}
            • Violating platform guidelines{"\n"}{"\n"}
            First offense: 5-day suspension{"\n"}
            Second offense: 30-day suspension{"\n"}
            Third offense: Permanent removal
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Content Guidelines</Text>
          <Text style={styles.sectionText}>
            • No explicit or adult content{"\n"}
            • No medical, legal, or financial advice{"\n"}
            • No promotion of self-harm or dangerous activities{"\n"}
            • No discrimination based on race, gender, religion, etc.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Client Messaging</Text>
          <Text style={styles.sectionText}>
            Clients who have purchased readings may message you directly for clarifications. Key terms:{"\n"}{"\n"}
            • Maximum 5 messages per day per person (resets at midnight){"\n"}
            • Messages are for clarifications and doubts ONLY{"\n"}
            • Messages are NOT for providing unpaid readings or consultations{"\n"}
            • Abuse of messaging to avoid session charges may result in account suspension{"\n"}
            • You will receive in-app notifications for new messages{"\n"}
            • Respond promptly to maintain good client relationships
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Tax Obligations</Text>
          <Text style={styles.sectionText}>
            As an independent contractor in the United States, you are responsible for:{"\n"}
            • Reporting all earnings to the IRS{"\n"}
            • Paying self-employment taxes{"\n"}
            • Providing accurate W-9 information{"\n"}
            • Keeping records of your earnings
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Privacy & Data</Text>
          <Text style={styles.sectionText}>
            You agree to:{"\n"}
            • Keep all client information confidential{"\n"}
            • Not record sessions without consent{"\n"}
            • Not share client data with third parties{"\n"}
            • Follow all applicable privacy laws
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.error + '10', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: colors.error + '30' }]}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>8.1 CHAT RECORDING & ADMIN MONITORING</Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '700', color: colors.error }}>⚠️ IMPORTANT NOTICE:</Text>{"\n"}{"\n"}
            To maintain platform integrity and protect both advisors and clients, <Text style={{ fontWeight: '700' }}>ALL conversations, messages, video calls, and communications on this platform are recorded and may be reviewed by platform administrators</Text>.{"\n"}{"\n"}
            This includes:{"\n"}
            • All text messages and chat conversations{"\n"}
            • Images shared within chat{"\n"}
            • Video and phone call recordings{"\n"}
            • Any other communications on the platform{"\n"}{"\n"}
            Purpose of monitoring:{"\n"}
            • Detecting fraudulent or scam activity{"\n"}
            • Ensuring quality of service{"\n"}
            • Investigating client complaints{"\n"}
            • Enforcing Terms & Conditions{"\n"}{"\n"}
            <Text style={{ fontWeight: '700', color: colors.error }}>Advisors found engaging in scams, fraudulent behavior, or policy violations will be immediately suspended without warning.</Text>{"\n"}{"\n"}
            By continuing to use this platform, you acknowledge and consent to this monitoring.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>9. Mandatory Sale Participation</Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            As a platform advisor, you are required to participate in monthly promotional events:{"\n"}{"\n"}
            • One mandatory sale event per month (e.g., Full Moon Sale, Equinox Special){"\n"}
            • Sale discounts are applied automatically to your rates during the event{"\n"}
            • Typical discounts range from 10-30% off regular rates{"\n"}
            • You will be notified in advance of upcoming sales{"\n"}
            • All approved advisors must participate - no opt-out available{"\n"}
            • Sales help attract new clients and increase overall bookings{"\n"}
            • Your earnings remain proportional (40% of discounted rate){"\n"}{"\n"}
            Non-compliance with mandatory sales may result in account review.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.primary + '10', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '30' }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>10. New Client Policy (Mandatory)</Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            All advisors are required to provide <Text style={{ fontWeight: '700' }}>4 free minutes</Text> to new clients on their first reading:{"\n"}{"\n"}
            <Text style={{ fontWeight: '700', color: colors.primary }}>Policy Details:</Text>{"\n"}
            • Every new client's first 4 minutes with any advisor are FREE{"\n"}
            • You will be notified when a client is new ("New Client" indicator){"\n"}
            • After 4 minutes, regular session rates apply automatically{"\n"}
            • This policy is mandatory for all advisors - no opt-out available{"\n"}
            • Platform does not compensate for the free 4 minutes{"\n"}{"\n"}
            <Text style={{ fontWeight: '700', color: colors.primary }}>Why This Matters:</Text>{"\n"}
            • First impressions lead to loyal, returning clients{"\n"}
            • New clients who have a great first experience become long-term customers{"\n"}
            • Quality service during free time builds your reputation{"\n"}{"\n"}
            By accepting readings, you acknowledge that new clients receive their first 4 minutes free as part of our platform policy.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.gold + '10', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: colors.gold + '30' }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>11. Profile Tags & Badges</Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Advisors may earn special profile tags based on performance:{"\n"}{"\n"}
            <Text style={{ fontWeight: '700', color: colors.gold }}>Available Tags:</Text>{"\n"}
            • <Text style={{ fontWeight: '600' }}>Top Rated</Text> - Awarded to advisors with 4.8+ average rating{"\n"}
            • <Text style={{ fontWeight: '600' }}>Trending</Text> - High activity and engagement in recent weeks{"\n"}
            • <Text style={{ fontWeight: '600' }}>Featured</Text> - Handpicked by platform for exceptional service{"\n"}
            • <Text style={{ fontWeight: '600' }}>Rising Star</Text> - New advisors showing exceptional promise{"\n"}{"\n"}
            <Text style={{ fontWeight: '700', color: colors.error }}>Tag Removal Policy:</Text>{"\n"}
            Tags are automatically monitored and will be <Text style={{ fontWeight: '700', color: colors.error }}>removed if ratings drop</Text>:{"\n"}
            • Top Rated tag removed if rating falls below 4.5{"\n"}
            • Trending tag removed after 30 days of low activity{"\n"}
            • Featured status may be revoked for policy violations{"\n"}
            • All tags subject to periodic review{"\n"}{"\n"}
            Maintaining high ratings and quality service is essential to keep your earned tags.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>12. Termination</Text>
          <Text style={styles.sectionText}>
            Either party may terminate this agreement at any time. Upon termination, you will receive any pending earnings minus any chargebacks or refunds. You may not use platform trademarks or client lists after termination.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Dispute Resolution</Text>
          <Text style={styles.sectionText}>
            Any disputes will be resolved through binding arbitration in accordance with United States law. Small claims court remains available for qualifying disputes.
          </Text>
        </View>

        <View style={styles.acceptanceNote}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.acceptanceText}>
            By using this platform, you acknowledge that you have read, understood, and agree to these Terms & Conditions.
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
    borderBottomWidth: 1,
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: 100,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  acceptanceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  acceptanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
