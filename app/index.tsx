import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';

export default function Index() {
  const router = useRouter();
  const { isLoading, isAuthenticated, psychic } = useAuth();
  const { colors } = useTheme();
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  useEffect(() => {
    const checkPermissionsAndNavigate = async () => {
      try {
        // Check if permissions have been requested before
        const permissionsRequested = await AsyncStorage.getItem('permissions_requested');
        
        if (!isLoading) {
          if (!permissionsRequested) {
            // First time user - show permissions screen
            router.replace('/permissions');
          } else if (isAuthenticated && psychic?.status === 'approved') {
            router.replace('/(tabs)/dashboard');
          } else if (isAuthenticated && psychic?.status === 'pending') {
            router.replace('/application/pending');
          } else {
            router.replace('/(auth)/welcome');
          }
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        // Fallback to normal flow
        if (!isLoading) {
          if (isAuthenticated && psychic?.status === 'approved') {
            router.replace('/(tabs)/dashboard');
          } else if (isAuthenticated && psychic?.status === 'pending') {
            router.replace('/application/pending');
          } else {
            router.replace('/(auth)/welcome');
          }
        }
      } finally {
        setCheckingPermissions(false);
      }
    };

    checkPermissionsAndNavigate();
  }, [isLoading, isAuthenticated, psychic]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
