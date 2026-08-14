import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { SPACING } from '../src/constants/theme';

// Conditionally import Notifications to avoid Android build issues
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('expo-notifications not available');
}

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [notificationStatus, setNotificationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [cameraStatus, setCameraStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [photoStatus, setPhotoStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  const requestNotificationPermission = async () => {
    try {
      // Skip notifications on web or if module not available
      if (Platform.OS === 'web' || !Notifications) {
        setNotificationStatus('granted');
        return;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // On Android, just grant if notifications aren't available
      setNotificationStatus('granted');
    }
  };

  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setCameraStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setCameraStatus('denied');
    }
  };

  const requestPhotoPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPhotoStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting photo permission:', error);
      setPhotoStatus('denied');
    }
  };

  const handleContinue = async () => {
    await AsyncStorage.setItem('permissions_requested', 'true');
    router.replace('/(auth)/welcome');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return 'checkmark-circle';
      case 'denied': return 'close-circle';
      default: return 'ellipse-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted': return colors.success;
      case 'denied': return colors.error;
      default: return colors.textMuted;
    }
  };

  const allPermissionsHandled = notificationStatus !== 'pending' && cameraStatus !== 'pending' && photoStatus !== 'pending';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + SPACING.xl }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>App Permissions</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            To provide the best experience, we need a few permissions
          </Text>
        </View>

        {/* Permissions */}
        <View style={styles.permissionsContainer}>
          {/* Notifications */}
          <View style={[styles.permissionCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="notifications" size={24} color={colors.secondary} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
                Get alerts for new readings & messages
              </Text>
            </View>
            {notificationStatus === 'pending' ? (
              <TouchableOpacity
                style={[styles.allowButton, { backgroundColor: colors.primary }]}
                onPress={requestNotificationPermission}
              >
                <Text style={styles.allowButtonText}>Enable</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name={getStatusIcon(notificationStatus) as any} size={28} color={getStatusColor(notificationStatus)} />
            )}
          </View>

          {/* Camera */}
          <View style={[styles.permissionCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="camera" size={24} color={colors.primary} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Camera</Text>
              <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
                Take photos for your profile & chat
              </Text>
            </View>
            {cameraStatus === 'pending' ? (
              <TouchableOpacity
                style={[styles.allowButton, { backgroundColor: colors.primary }]}
                onPress={requestCameraPermission}
              >
                <Text style={styles.allowButtonText}>Enable</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name={getStatusIcon(cameraStatus) as any} size={28} color={getStatusColor(cameraStatus)} />
            )}
          </View>

          {/* Photos */}
          <View style={[styles.permissionCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name="images" size={24} color={colors.gold} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Photo Library</Text>
              <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
                Share images in messages
              </Text>
            </View>
            {photoStatus === 'pending' ? (
              <TouchableOpacity
                style={[styles.allowButton, { backgroundColor: colors.primary }]}
                onPress={requestPhotoPermission}
              >
                <Text style={styles.allowButtonText}>Enable</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name={getStatusIcon(photoStatus) as any} size={28} color={getStatusColor(photoStatus)} />
            )}
          </View>
        </View>

        {/* Continue Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: colors.primary }
            ]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionsContainer: {
    flex: 1,
    gap: SPACING.md,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 16,
    gap: SPACING.md,
  },
  permissionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 13,
  },
  allowButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  allowButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    gap: SPACING.md,
    alignItems: 'center',
  },
  continueButton: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 14,
  },
});
