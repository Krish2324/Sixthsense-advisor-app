import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';

interface Notification {
  id: string;
  user_id: string;
  user_type: string;
  title: string;
  body: string;
  type?: string;
  notification_type?: string;
  related_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export default function PsychicNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { psychic } = useAuth();
  
  const psychicId = psychic?.id || '';
  const psychicEmail = psychic?.email || '';
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // ADV-067: Notification Category Filter state
  const [activeCategory, setActiveCategory] = useState<'all' | 'sessions' | 'earnings' | 'system'>('all');

  const fetchNotifications = useCallback(async () => {
    if (!psychicId && !psychicEmail) {
      setIsLoading(false);
      return;
    }
    
    try {
      const endpoints = [
        fetch(`${BACKEND_URL}/api/notifications/user/${psychicId}?user_type=psychic`),
        fetch(`${BACKEND_URL}/api/messages/notifications/${psychicId}?user_type=psychic`)
      ];
      if (psychicEmail && psychicEmail !== psychicId) {
        endpoints.push(fetch(`${BACKEND_URL}/api/notifications/user/${encodeURIComponent(psychicEmail)}?user_type=psychic`));
      }
      
      const responses = await Promise.all(endpoints);
      const mapById = new Map<string, Notification>();

      for (const res of responses) {
        if (!res.ok) continue;
        try {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.notifications || []);
          for (const n of items) {
            if (n && n.id) {
              mapById.set(n.id, {
                ...n,
                is_read: Boolean(n.is_read ?? n.read ?? false),
                notification_type: n.notification_type || n.type || 'admin'
              });
            }
          }
        } catch {}
      }
      
      const allNotifications = Array.from(mapById.values());
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [psychicId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string, notificationType?: string) => {
    try {
      // Different endpoints for different notification types
      if (notificationType === 'admin') {
        await fetch(`${BACKEND_URL}/api/notifications/${notificationId}/read`, {
          method: 'POST',
        });
      } else {
        await fetch(`${BACKEND_URL}/api/messages/notifications/${notificationId}/read`, {
          method: 'POST',
        });
      }
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all admin notifications as read
      await fetch(`${BACKEND_URL}/api/notifications/user/${psychicId}/read-all?user_type=psychic`, {
        method: 'POST',
      });
      // Mark all message notifications as read
      await fetch(`${BACKEND_URL}/api/messages/notifications/${psychicId}/read-all?user_type=psychic`, {
        method: 'POST',
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id, notification.notification_type);
    
    // Navigate based on notification type
    const nType = (notification.notification_type || notification.type || '').toLowerCase();
    if (nType === 'message' && notification.related_id) {
      router.push({
        pathname: '/messages/chat/[id]',
        params: { 
          id: notification.related_id,
          clientId: '',
          clientName: 'Client'
        }
      });
    } else if (nType === 'reading' || nType === 'reading_request') {
      router.push('/(tabs)/questions' as any);
    } else if (nType === 'earning' || nType === 'earnings') {
      router.push('/(tabs)/earnings' as any);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'earning':
      case 'earnings':
        return 'cash';
      case 'message':
        return 'chatbubble';
      case 'reading':
        return 'book';
      case 'tip':
        return 'gift';
      case 'admin':
        return 'megaphone';
      case 'promo':
        return 'pricetag';
      case 'announcement':
        return 'information-circle';
      default:
        return 'notifications';
    }
  };

  const renderNotification = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: item.is_read ? 'transparent' : colors.primary + '08' }
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[
        styles.iconContainer,
        { backgroundColor: item.is_read ? colors.textMuted + '15' : colors.primary + '15' }
      ]}>
        <Ionicons 
          name={getNotificationIcon(item.notification_type) as any} 
          size={20} 
          color={item.is_read ? colors.textMuted : colors.primary} 
        />
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={[
          styles.notificationTitle,
          { color: colors.textPrimary },
          !item.is_read && styles.unreadText
        ]}>
          {item.title}
        </Text>
        <Text style={[styles.notificationBody, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
      </View>
      
      {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  ), [colors, handleNotificationPress]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.backgroundElevated }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* ADV-067: Notification Category Filter Tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: colors.background }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'sessions', label: 'Sessions 🔮' },
          { id: 'earnings', label: 'Earnings 💰' },
          { id: 'system', label: 'System ⚙️' },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: activeCategory === item.id ? colors.primary : colors.backgroundCard,
              borderWidth: 1,
              borderColor: activeCategory === item.id ? colors.primary : colors.border,
            }}
            onPress={() => setActiveCategory(item.id as any)}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: activeCategory === item.id ? '#FFF' : colors.textSecondary }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={notifications.filter(n => {
          if (activeCategory === 'sessions') return n.notification_type === 'message' || n.notification_type === 'reading';
          if (activeCategory === 'earnings') {
            const t = (n.notification_type || n.type || '').toLowerCase();
            return (
              t === 'earning' ||
              t === 'earnings' ||
              t === 'tip' ||
              t === 'payout' ||
              t === 'session_earnings' ||
              n.title?.includes('💰') ||
              n.title?.includes('Earnings') ||
              n.title?.toLowerCase().includes('session completed') ||
              n.title?.toLowerCase().includes('tip')
            );
          }
          if (activeCategory === 'system') return n.notification_type === 'admin' || n.notification_type === 'promo' || n.notification_type === 'announcement';
          return true;
        })}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Notifications</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You will receive notifications for announcements, promotions, and client messages here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  markAllButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  unreadCard: {
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '600',
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  timeText: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: SPACING.sm,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
});
