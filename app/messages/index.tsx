import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Mock psychic ID - in real app, get from auth context
const MOCK_PSYCHIC_ID = 'psychic-1';

interface Conversation {
  id: string;
  client_id: string;
  psychic_id: string;
  client_name: string | null;
  psychic_name: string | null;
  client_avatar: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  remaining_messages: number;
  is_new_client: boolean;
}

export default function PsychicMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const timezoneOffset = new Date().getTimezoneOffset();
      
      const response = await fetch(
        `${BACKEND_URL}/api/messages/conversations/${MOCK_PSYCHIC_ID}?user_type=psychic&timezone_offset=${timezoneOffset}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
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

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationCard, { backgroundColor: colors.backgroundCard }]}
      onPress={() => router.push({
        pathname: '/messages/chat/[id]',
        params: { 
          id: item.id,
          clientId: item.client_id,
          clientName: item.client_name || 'Client',
          isNewClient: item.is_new_client ? 'true' : 'false'
        }
      })}
    >
      <View style={styles.avatarContainer}>
        {item.client_avatar ? (
          <Image source={{ uri: item.client_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {(item.client_name || 'C')[0].toUpperCase()}
            </Text>
          </View>
        )}
        {item.unread_count > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
        {item.is_new_client && (
          <View style={[styles.newBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name="star" size={8} color="#FFF" />
          </View>
        )}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameRow}>
            <Text style={[styles.clientName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.client_name || 'Client'}
            </Text>
            {item.is_new_client && (
              <View style={[styles.newClientTag, { backgroundColor: colors.secondary + '20' }]}>
                <Text style={[styles.newClientTagText, { color: colors.secondary }]}>NEW</Text>
              </View>
            )}
          </View>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
        
        <Text 
          style={[
            styles.lastMessage,
            { color: colors.textSecondary },
            item.unread_count > 0 && [styles.unreadMessage, { color: colors.textPrimary }]
          ]} 
          numberOfLines={1}
        >
          {item.last_message || 'No messages yet'}
        </Text>
        
        <View style={styles.remainingBadge}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.remainingText, { color: colors.textMuted }]}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Client Messages</Text>
        <TouchableOpacity 
          style={[styles.historyButton, { backgroundColor: colors.backgroundElevated }]} 
          onPress={() => router.push('/history')}
        >
          <Ionicons name="time" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
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
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Messages Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Messages from clients who purchased readings will appear here.
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
  historyButton: {
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  newBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  conversationContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
  },
  newClientTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newClientTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    marginLeft: SPACING.sm,
  },
  lastMessage: {
    fontSize: 14,
    marginBottom: 6,
  },
  unreadMessage: {
    fontWeight: '600',
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  remainingText: {
    fontSize: 11,
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
