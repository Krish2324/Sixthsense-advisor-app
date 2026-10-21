import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { psychic } = useAuth();
  const [pendingReadingsCount, setPendingReadingsCount] = useState<number>(0);

  const fetchPendingCount = useCallback(async () => {
    const pid = psychic?.id || psychic?.email;
    if (!pid) {
      setPendingReadingsCount(0);
      return;
    }
    try {
      const emailParam = psychic?.email ? `?email=${encodeURIComponent(psychic.email)}` : '';
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/questions/${encodeURIComponent(pid)}${emailParam}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const pending = data.filter((q: any) => q.status === 'pending');
          setPendingReadingsCount(pending.length);
        }
      }
    } catch {
      // silently ignore network issues
    }
  }, [psychic?.id, psychic?.email]);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 10000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.backgroundCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingTop: 10,
          paddingBottom: 25,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{
          title: 'Readings',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="book" size={size} color={color} />
              {pendingReadingsCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{pendingReadingsCount > 99 ? '99+' : pendingReadingsCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
});
