import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SPACING } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const { psychic } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideAnim] = useState(new Animated.Value(0));
  const [isVisible, setIsVisible] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!psychic?.id) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/user/${psychic.id}?limit=10`);
      if (response.ok) {
        const data = await response.json();
        const unreadNotifications = (data.notifications || []).filter(
          (n: any) => !n.is_read && !n.read
        );
        setNotifications(unreadNotifications);
        setIsVisible(unreadNotifications.length > 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [psychic?.id]);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 8 seconds for near-instant banner updates
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (notifications.length > 1) {
      const rotateInterval = setInterval(() => {
        // Animate out
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex((prev) => (prev + 1) % notifications.length);
          slideAnim.setValue(width);
          // Animate in
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }, 5000);
      return () => clearInterval(rotateInterval);
    }
  }, [notifications.length, slideAnim]);

  const handleDismiss = async () => {
    if (notifications.length === 0) return;
    
    const notification = notifications[currentIndex];
    
    try {
      // Mark as read
      await fetch(`${BACKEND_URL}/api/notifications/mark-read/${notification.id}`, {
        method: 'POST',
      });
      
      // Remove from local state
      const newNotifications = notifications.filter((_, i) => i !== currentIndex);
      setNotifications(newNotifications);
      
      if (newNotifications.length === 0) {
        setIsVisible(false);
      } else {
        setCurrentIndex((prev) => prev % newNotifications.length);
      }
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handlePress = () => {
    router.push('/notifications' as any);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'promotional':
        return 'sparkles';
      case 'sale':
        return 'pricetag';
      case 'admin':
        return 'megaphone';
      case 'reading_update':
        return 'chatbubble';
      case 'app_rating_prompt':
        return 'star';
      case 'suspension':
        return 'warning';
      case 'reinstatement':
        return 'checkmark-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'promotional':
        return colors.secondary;
      case 'sale':
        return colors.gold;
      case 'admin':
        return colors.primary;
      case 'reading_update':
        return colors.info || '#3498db';
      case 'app_rating_prompt':
        return colors.gold;
      case 'suspension':
        return colors.error;
      case 'reinstatement':
        return colors.success;
      default:
        return colors.primary;
    }
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[currentIndex];
  const iconColor = getNotificationColor(currentNotification.type);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.backgroundCard }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.content,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons
            name={getNotificationIcon(currentNotification.type) as any}
            size={20}
            color={iconColor}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {currentNotification.title}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={1}>
            {currentNotification.body}
          </Text>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {notifications.length > 1 && (
        <View style={styles.dotsContainer}>
          {notifications.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? colors.primary : colors.textMuted,
                },
              ]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
