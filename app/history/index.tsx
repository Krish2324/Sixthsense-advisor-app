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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Mock psychic ID - in real app, get from auth context
const MOCK_PSYCHIC_ID = 'psychic-1';

type HistoryTab = 'chats' | 'calls' | 'videos' | 'recorded';

interface ChatHistory {
  id: string;
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  last_message: string;
  message_count: number;
  last_activity: string;
}

interface CallHistory {
  id: string;
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  call_type: 'phone' | 'video';
  duration: number;
  earnings: number;
  recording_url: string | null;
  created_at: string;
}

interface RecordedReading {
  id: string;
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  question: string;
  duration: number;
  earnings: number;
  video_url: string;
  created_at: string;
}

// Mock data for demonstration
const MOCK_CHAT_HISTORY: ChatHistory[] = [
  {
    id: '1',
    client_id: 'c1',
    client_name: 'Sarah M.',
    client_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    last_message: 'Thank you so much for the reading!',
    message_count: 45,
    last_activity: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    client_id: 'c2',
    client_name: 'John D.',
    client_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    last_message: 'That was very insightful',
    message_count: 23,
    last_activity: new Date(Date.now() - 86400000).toISOString(),
  },
];

const MOCK_CALL_HISTORY: CallHistory[] = [
  {
    id: 'c1',
    client_id: 'c1',
    client_name: 'Sarah M.',
    client_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    call_type: 'phone',
    duration: 900,
    earnings: 18.00,
    recording_url: 'https://example.com/recording1.mp3',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'c2',
    client_id: 'c2',
    client_name: 'John D.',
    client_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    call_type: 'phone',
    duration: 600,
    earnings: 12.00,
    recording_url: 'https://example.com/recording2.mp3',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

const MOCK_VIDEO_HISTORY: CallHistory[] = [
  {
    id: 'v1',
    client_id: 'c1',
    client_name: 'Sarah M.',
    client_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    call_type: 'video',
    duration: 1200,
    earnings: 32.00,
    recording_url: 'https://example.com/video1.mp4',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

const MOCK_RECORDED_READINGS: RecordedReading[] = [
  {
    id: 'r1',
    client_id: 'c1',
    client_name: 'Sarah M.',
    client_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    question: 'Will I find love this year?',
    duration: 180,
    earnings: 6.00,
    video_url: 'https://example.com/recorded1.mp4',
    created_at: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: 'r2',
    client_id: 'c2',
    client_name: 'John D.',
    client_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    question: 'What does my career future look like?',
    duration: 240,
    earnings: 8.00,
    video_url: 'https://example.com/recorded2.mp4',
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
];

export default function PsychicHistoryScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [activeTab, setActiveTab] = useState<HistoryTab>((tab as HistoryTab) || 'chats');
  // ADV-071: Session Rating Filter State
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [videoHistory, setVideoHistory] = useState<CallHistory[]>([]);
  const [recordedReadings, setRecordedReadings] = useState<RecordedReading[]>([]);

  useEffect(() => {
    if (tab && ['chats', 'calls', 'videos', 'recorded'].includes(tab)) {
      setActiveTab(tab as HistoryTab);
    }
  }, [tab]);

  const fetchHistory = useCallback(async () => {
    try {
      // Fetch chat history
      const chatRes = await fetch(`${BACKEND_URL}/api/history/chats/${MOCK_PSYCHIC_ID}?user_type=psychic`);
      if (chatRes.ok) {
        const data = await chatRes.json();
        setChatHistory(data.length > 0 ? data : MOCK_CHAT_HISTORY);
      } else {
        setChatHistory(MOCK_CHAT_HISTORY);
      }
      
      // Fetch call history
      const callRes = await fetch(`${BACKEND_URL}/api/history/calls/${MOCK_PSYCHIC_ID}?user_type=psychic&call_type=phone`);
      if (callRes.ok) {
        const data = await callRes.json();
        setCallHistory(data.length > 0 ? data : MOCK_CALL_HISTORY);
      } else {
        setCallHistory(MOCK_CALL_HISTORY);
      }
      
      // Fetch video history
      const videoRes = await fetch(`${BACKEND_URL}/api/history/calls/${MOCK_PSYCHIC_ID}?user_type=psychic&call_type=video`);
      if (videoRes.ok) {
        const data = await videoRes.json();
        setVideoHistory(data.length > 0 ? data : MOCK_VIDEO_HISTORY);
      } else {
        setVideoHistory(MOCK_VIDEO_HISTORY);
      }

      // Fetch recorded readings
      const recordedRes = await fetch(`${BACKEND_URL}/api/history/recorded/${MOCK_PSYCHIC_ID}?user_type=psychic`);
      if (recordedRes.ok) {
        const data = await recordedRes.json();
        setRecordedReadings(data.length > 0 ? data : MOCK_RECORDED_READINGS);
      } else {
        setRecordedReadings(MOCK_RECORDED_READINGS);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setChatHistory(MOCK_CHAT_HISTORY);
      setCallHistory(MOCK_CALL_HISTORY);
      setVideoHistory(MOCK_VIDEO_HISTORY);
      setRecordedReadings(MOCK_RECORDED_READINGS);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderChatItem = ({ item }: { item: ChatHistory }) => (
    <TouchableOpacity
      style={[styles.historyCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
      onPress={() => router.push({
        pathname: '/messages/chat/[id]',
        params: { id: item.id, clientId: item.client_id, clientName: item.client_name }
      })}
    >
      <Image
        source={{ uri: item.client_avatar || 'https://via.placeholder.com/50', cache: 'force-cache' }}
        style={styles.avatar}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{item.client_name}</Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.last_activity)}</Text>
        </View>
        <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.last_message}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted }]}>{item.message_count} messages</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderCallItem = ({ item }: { item: CallHistory }) => (
    <View style={[styles.historyCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <Image
        source={{ uri: item.client_avatar || 'https://via.placeholder.com/50', cache: 'force-cache' }}
        style={styles.avatar}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{item.client_name}</Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name={item.call_type === 'phone' ? 'call' : 'videocam'} size={14} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {formatDuration(item.duration)} • Earned ${item.earnings.toFixed(2)}
            </Text>
          </View>
        </View>
        {item.recording_url && (
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => router.push({
              pathname: '/play-recording' as any,
              params: { 
                url: item.recording_url, 
                type: item.call_type,
                clientName: item.client_name,
                duration: item.duration.toString(),
                date: item.created_at
              }
            })}
          >
            <Ionicons name="play-circle" size={18} color={colors.primary} />
            <Text style={[styles.playButtonText, { color: colors.primary }]}>Play Recording</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderRecordedItem = ({ item }: { item: RecordedReading }) => (
    <View style={[styles.historyCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <Image
        source={{ uri: item.client_avatar || 'https://via.placeholder.com/50', cache: 'force-cache' }}
        style={styles.avatar}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{item.client_name}</Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.questionPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          "{item.question}"
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="film" size={14} color={colors.warning} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {formatDuration(item.duration)} • Earned ${item.earnings.toFixed(2)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.warning + '15' }]}
          onPress={() => router.push({
            pathname: '/play-recording' as any,
            params: { 
              url: item.video_url, 
              type: 'recorded',
              clientName: item.client_name,
              duration: item.duration.toString(),
              date: item.created_at
            }
          })}
        >
          <Ionicons name="play-circle" size={18} color={colors.warning} />
          <Text style={[styles.playButtonText, { color: colors.warning }]}>Watch Recording</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = (type: string) => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={type === 'chats' ? 'chatbubbles-outline' : type === 'calls' ? 'call-outline' : type === 'videos' ? 'videocam-outline' : 'film-outline'} 
        size={60} 
        color={colors.textMuted} 
      />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No {type === 'recorded' ? 'recorded readings' : type} yet</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        Your {type === 'recorded' ? 'recorded readings' : type} history will appear here
      </Text>
    </View>
  );

  const getActiveData = () => {
    switch (activeTab) {
      case 'chats': return chatHistory;
      case 'calls': return callHistory;
      case 'videos': return videoHistory;
      case 'recorded': return recordedReadings;
      default: return [];
    }
  };

  const getActiveRenderItem = () => {
    switch (activeTab) {
      case 'chats': return renderChatItem;
      case 'recorded': return renderRecordedItem;
      default: return renderCallItem;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Session History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Header Title Banner */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.backgroundCard, borderBottomColor: colors.border, justifyContent: 'flex-start', paddingHorizontal: SPACING.md }]}>
        <View style={[styles.tab, { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
          <Ionicons name="chatbubbles" size={18} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary }]}>Chat Readings</Text>
        </View>
      </View>

      {/* ADV-071: Session Rating Filter Pills */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: colors.background }}>
        {[
          { id: 'all', label: 'All Ratings' },
          { id: '5', label: '5 ⭐' },
          { id: '4', label: '4 ⭐' },
          { id: '3', label: '3 ⭐ & Below' },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 14,
              backgroundColor: ratingFilter === item.id ? colors.primary : colors.backgroundCard,
              borderWidth: 1,
              borderColor: ratingFilter === item.id ? colors.primary : colors.border,
            }}
            onPress={() => setRatingFilter(item.id as any)}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: ratingFilter === item.id ? '#FFF' : colors.textSecondary }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={getActiveData() as any[]}
          keyExtractor={(item) => item.id}
          renderItem={getActiveRenderItem() as any}
          contentContainerStyle={[
            styles.listContent,
            getActiveData().length === 0 && { flex: 1 }
          ]}
          ListEmptyComponent={() => renderEmptyState(activeTab)}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      )}
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: SPACING.md,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
    marginBottom: 6,
  },
  questionPreview: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 6,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
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
  },
});
