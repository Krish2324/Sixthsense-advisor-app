import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { psychic, logout } = useAuth();
  const { colors, isDark, themeMode } = useTheme();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const performLogout = async () => {
    try {
      setShowLogoutModal(false);
      // Clear all storage
      await AsyncStorage.clear();
      // Call logout from context
      await logout();
      // Navigate to welcome
      router.replace('/(auth)/welcome');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigate anyway
      router.replace('/(auth)/welcome');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Use custom modal for web
      setShowLogoutModal(true);
    } else {
      // Use native Alert for mobile
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Logout',
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  const getThemeLabel = () => {
    switch(themeMode) {
      case 'light': return 'Day Mode';
      case 'dark': return 'Night Mode';
      case 'auto': return 'Automatic';
      default: return 'Night Mode';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Logout Confirmation Modal for Web */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Logout</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.backgroundElevated }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalLogoutButton, { backgroundColor: colors.error }]}
                onPress={performLogout}
              >
                <Text style={styles.modalLogoutText}>Yes, Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fixed Header - Outside ScrollView */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
        <TouchableOpacity 
          style={[styles.notificationButton, { backgroundColor: colors.backgroundElevated }]}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* Profile Section */}
        <TouchableOpacity 
          style={[styles.profileCard, { backgroundColor: colors.backgroundCard }]}
          onPress={() => router.push('/profile')}
        >
          <View style={[styles.profileAvatar, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{psychic?.name || 'Advisor'}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{psychic?.email || 'email@example.com'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Pricing Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Pricing</Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/set-rates')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.backgroundElevated }]}>
              <Ionicons name="cash" size={22} color={colors.gold} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Set Your Rates</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Chat, Phone, Video rates</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Payout & Banking Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Payouts & Banking</Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/bank-account')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="business" size={22} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Bank Account Details</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Direct deposit account for withdrawals</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard, marginTop: 8 }]} onPress={() => router.push('/withdraw')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="wallet" size={22} color={colors.success} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Withdraw Funds</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Request earnings payout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preferences</Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/notifications')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.backgroundElevated }]}>
              <Ionicons name="notifications" size={22} color={colors.secondary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>View announcements & alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/appearance')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.backgroundElevated }]}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Appearance</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{getThemeLabel()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Support</Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/help-center')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.backgroundElevated }]}>
              <Ionicons name="help-circle" size={22} color={colors.secondary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Help Center</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Contact support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.backgroundCard }]} onPress={() => router.push('/terms')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.backgroundElevated }]}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Terms & Conditions</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Legal information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Logout / ADV-069: Touch Ripple & Active Opacity Feedback */}
        <Pressable 
          android_ripple={{ color: 'rgba(255, 71, 87, 0.25)' }}
          style={({ pressed }) => [
            styles.logoutButton,
            { backgroundColor: colors.error + '15' },
            pressed && { opacity: 0.7 }
          ]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </Pressable>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  fixedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 13,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 14,
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalLogoutButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalLogoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
