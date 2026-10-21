import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';

interface Reading {
  id: string;
  clientName: string;
  question: string;
  type: string;
  price: number;
  status: 'pending' | 'accepted' | 'completed';
  createdAt: string;
  hasVideo: boolean;
  videoUrl?: string;
  videoResponseUrl?: string;
  durationFormatted?: string;
  notes?: string;
}

interface SessionItem {
  id: string;
  client_name: string;
  client_email?: string;
  session_type: 'chat' | 'audio' | 'video';
  display_type: string;
  duration_seconds: number;
  duration_minutes: number;
  duration_formatted: string;
  psychic_earnings: number;
  total_cost: number;
  rate_per_minute: number;
  notes?: string;
  created_at: string;
  ended_at: string;
}

interface CategoryStats {
  count: number;
  total_seconds: number;
  total_minutes: number;
  total_earnings: number;
  sessions: SessionItem[];
}

export default function ReadingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { psychic } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const [selectedClientVideo, setSelectedClientVideo] = useState<{ url: string; clientName: string } | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);

  // Category breakdown state for Messages, Audio Calls, Video Calls
  const [breakdown, setBreakdown] = useState<{
    chat: CategoryStats;
    audio: CategoryStats;
    video: CategoryStats;
  }>({
    chat: { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
    audio: { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
    video: { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
  });

  const [selectedCategoryModal, setSelectedCategoryModal] = useState<'chat' | 'audio' | 'video' | null>(null);

  const formatReadingDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const fetchReadings = useCallback(async () => {
    const pid = psychic?.id || psychic?.email;
    if (!pid) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const emailParam = psychic?.email ? `?email=${encodeURIComponent(psychic.email)}` : '';
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/questions/${encodeURIComponent(pid)}${emailParam}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setReadings(
            data.map((q: any) => ({
              id: q.id,
              clientName: q.client_name || 'Client',
              question: q.question || '',
              type: q.type || 'standard',
              price: Number(q.price || 12.0),
              status: q.status || 'pending',
              createdAt: formatReadingDate(q.created_at),
              hasVideo: Boolean(q.has_video),
              videoUrl: q.video_url,
              videoResponseUrl: q.video_response_url,
              durationFormatted: q.duration_formatted,
              notes: q.notes || q.psychic_notes || '',
            }))
          );
        }
      }
    } catch (err) {
      console.error('Error fetching readings:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [psychic?.id, psychic?.email]);

  const fetchBreakdown = useCallback(async () => {
    const pid = psychic?.id || psychic?.email;
    if (!pid) return;
    try {
      const emailParam = psychic?.email ? `?email=${encodeURIComponent(psychic.email)}` : '';
      const response = await fetch(`${BACKEND_URL}/api/psychic-portal/session-breakdown/${encodeURIComponent(pid)}${emailParam}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          setBreakdown({
            chat: data.chat || { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
            audio: data.audio || { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
            video: data.video || { count: 0, total_seconds: 0, total_minutes: 0, total_earnings: 0, sessions: [] },
          });
        }
      }
    } catch (err) {
      console.error('Error fetching session breakdown:', err);
    }
  }, [psychic?.id, psychic?.email]);

  useEffect(() => {
    fetchReadings();
    fetchBreakdown();
    const interval = setInterval(() => {
      fetchReadings();
      fetchBreakdown();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchReadings, fetchBreakdown]);

  const pendingReadings = readings.filter(r => r.status === 'pending' || r.status === 'accepted');
  const completedReadings = readings.filter(r => r.status === 'completed');
  const filteredReadings = activeTab === 'pending' ? pendingReadings : completedReadings;

  const onRefresh = () => {
    setRefreshing(true);
    fetchReadings();
    fetchBreakdown();
  };

  const handleRecord = (reading: Reading) => {
    router.push({
      pathname: '/record-answer',
      params: {
        questionId: reading.id,
        clientName: reading.clientName,
        question: reading.question,
        clientVideoUrl: reading.videoUrl || '',
      },
    });
  };

  const renderReading = useCallback(({ item }: { item: Reading }) => {
    const isSession = item.type === 'chat' || item.type === 'audio' || item.type === 'video';
    const typeLabel = item.type === 'emergency' 
      ? 'URGENT' 
      : item.type === 'chat' 
      ? 'Live Chat' 
      : item.type === 'audio' 
      ? 'Audio Call' 
      : item.type === 'video' 
      ? 'Video Call' 
      : 'Recorded Reading';

    const typeColor = item.type === 'emergency'
      ? colors.error
      : item.type === 'chat'
      ? colors.secondary
      : item.type === 'audio'
      ? colors.success
      : colors.primary;

    return (
      <View style={[styles.readingCard, { backgroundColor: colors.backgroundCard }]}>
        {/* Header */}
        <View style={styles.readingHeader}>
          <View style={styles.clientInfo}>
            <View style={[styles.avatar, { backgroundColor: typeColor }]}>
              <Text style={styles.avatarText}>{item.clientName[0] || 'C'}</Text>
            </View>
            <View>
              <Text style={[styles.clientName, { color: colors.textPrimary }]}>{item.clientName}</Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>{item.createdAt}</Text>
            </View>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            {item.type === 'emergency' && (
              <Ionicons name="flash" size={12} color={colors.error} style={{ marginRight: 4 }} />
            )}
            {item.type === 'chat' && (
              <Ionicons name="chatbubbles" size={12} color={colors.secondary} style={{ marginRight: 4 }} />
            )}
            {item.type === 'audio' && (
              <Ionicons name="call" size={12} color={colors.success} style={{ marginRight: 4 }} />
            )}
            {item.type === 'video' && (
              <Ionicons name="videocam" size={12} color={colors.primary} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.typeText, { color: typeColor }]}>
              {typeLabel}
            </Text>
          </View>
        </View>

        {/* Question or Session Summary */}
        <Text style={[styles.questionText, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.question}
        </Text>

        {/* Client Video preview if present */}
        {item.hasVideo && item.videoUrl && (
          <TouchableOpacity
            style={[styles.videoIndicator, { backgroundColor: colors.secondary + '20', padding: 8, borderRadius: 8, marginTop: 8 }]}
            activeOpacity={0.7}
            onPress={() => {
              if (item.videoUrl) {
                setSelectedClientVideo({
                  url: item.videoUrl,
                  clientName: item.clientName,
                });
              } else {
                Alert.alert('No Video', 'Client video file is not available.');
              }
            }}
          >
            <Ionicons name="play-circle" size={18} color={colors.secondary} />
            <Text style={[styles.videoText, { color: colors.secondary, fontWeight: '700' }]}>
              Watch Client's Video Question ▶
            </Text>
          </TouchableOpacity>
        )}

        {/* Advisor Session Notes if completed */}
        {item.notes ? (
          <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.backgroundElevated, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Ionicons name="document-text" size={13} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>Advisor Session Notes</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>{item.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={[styles.readingFooter, { borderTopColor: colors.border }]}>
          <View style={styles.earningsInfo}>
            <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
              {isSession ? 'Advisor Earned' : 'Price'}
            </Text>
            <Text style={[styles.price, { color: colors.gold }]}>+${item.price.toFixed(2)}</Text>
          </View>
          
          {item.status === 'pending' ? (
            <TouchableOpacity 
              style={[styles.recordButton, { backgroundColor: colors.primary }]}
              onPress={() => handleRecord(item)}
            >
              <Ionicons name="videocam" size={18} color="#FFF" />
              <Text style={styles.recordButtonText}>Record Answer</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.completedText, { color: colors.success }]}>Completed</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [colors]);

  const activeCategoryData = selectedCategoryModal ? breakdown[selectedCategoryModal] : null;
  const activeCategoryTitle = selectedCategoryModal === 'chat' 
    ? 'Client Messages' 
    : selectedCategoryModal === 'audio' 
    ? 'Client Audio Calls' 
    : 'Client Video Calls';

  const activeCategoryIcon = selectedCategoryModal === 'chat' 
    ? 'chatbubbles' 
    : selectedCategoryModal === 'audio' 
    ? 'call' 
    : 'videocam';

  const activeCategoryColor = selectedCategoryModal === 'chat' 
    ? colors.secondary 
    : selectedCategoryModal === 'audio' 
    ? colors.success 
    : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Category Detail Modal (Dynamic Talk Time + Advisor Earnings + Records) */}
      <Modal
        visible={!!selectedCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCategoryModal(null)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={[styles.categoryModalContainer, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.categoryModalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.categoryModalTitleRow}>
                <View style={[styles.categoryModalIcon, { backgroundColor: activeCategoryColor + '20' }]}>
                  <Ionicons name={activeCategoryIcon as any} size={22} color={activeCategoryColor} />
                </View>
                <View>
                  <Text style={[styles.categoryModalTitle, { color: colors.textPrimary }]}>
                    {activeCategoryTitle}
                  </Text>
                  <Text style={[styles.categoryModalSubtitle, { color: colors.textSecondary }]}>
                    {activeCategoryData?.count || 0} Total Sessions Recorded
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.categoryModalCloseBtn, { backgroundColor: colors.backgroundElevated }]}
                onPress={() => setSelectedCategoryModal(null)}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Total Summary Banner: Talk Time (Ketala minute vaat thai) + Earnings (Advisor ne ketal paisa malya) */}
            <View style={[styles.categorySummaryBanner, { backgroundColor: colors.backgroundElevated }]}>
              <View style={styles.summaryCol}>
                <Text style={[styles.summaryColLabel, { color: colors.textMuted }]}>Total Talk Time</Text>
                <Text style={[styles.summaryColValue, { color: colors.textPrimary }]}>
                  {activeCategoryData?.total_minutes.toFixed(1)} mins
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryCol}>
                <Text style={[styles.summaryColLabel, { color: colors.textMuted }]}>Advisor Earned</Text>
                <Text style={[styles.summaryColValue, { color: colors.gold, fontWeight: '700' }]}>
                  +${activeCategoryData?.total_earnings.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* If Chat Category: Option to go directly to Messages Screen */}
            {selectedCategoryModal === 'chat' && (
              <TouchableOpacity
                style={[styles.inboxButton, { backgroundColor: colors.secondary }]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedCategoryModal(null);
                  router.push('/messages');
                }}
              >
                <Ionicons name="chatbubbles" size={18} color="#FFF" />
                <Text style={styles.inboxButtonText}>Open Live Chat Inbox</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            )}

            {/* List of Individual Session Records */}
            <FlatList
              data={activeCategoryData?.sessions || []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyCategoryState}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyCategoryTitle, { color: colors.textPrimary }]}>
                    No {activeCategoryTitle} Yet
                  </Text>
                  <Text style={[styles.emptyCategoryText, { color: colors.textSecondary }]}>
                    Completed calls and chats will be dynamically recorded here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.sessionRecordCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.sessionRecordTop}>
                    <View style={styles.sessionRecordClient}>
                      <View style={[styles.sessionClientAvatar, { backgroundColor: activeCategoryColor }]}>
                        <Text style={styles.sessionClientAvatarText}>
                          {(item.client_name || 'C')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.sessionClientName, { color: colors.textPrimary }]}>
                          {item.client_name}
                        </Text>
                        <Text style={[styles.sessionDateText, { color: colors.textMuted }]}>
                          {formatReadingDate(item.created_at || item.ended_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.earningBadge, { backgroundColor: colors.gold + '20' }]}>
                      <Text style={[styles.earningBadgeAmount, { color: colors.gold }]}>
                        +${item.psychic_earnings.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Details Row: Talk Time (duration) + Total Charged */}
                  <View style={[styles.sessionRecordBottom, { borderTopColor: colors.border }]}>
                    <View style={styles.detailPill}>
                      <Ionicons name="time-outline" size={14} color={colors.primary} />
                      <Text style={[styles.detailPillText, { color: colors.textPrimary }]}>
                        Talk Time: {item.duration_formatted}
                      </Text>
                    </View>
                    <View style={styles.detailPill}>
                      <Ionicons name="card-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.detailPillSub, { color: colors.textMuted }]}>
                        Total: ${item.total_cost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Advisor Session Notes if saved */}
                  {item.notes ? (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.backgroundElevated, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Ionicons name="document-text" size={13} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>Advisor Session Notes</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>{item.notes}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Record Modal for Web */}
      <Modal
        visible={showRecordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record Response</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Record your video answer for {selectedReading?.clientName}'s question?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.backgroundElevated }]}
                onPress={() => setShowRecordModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalRecordButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowRecordModal(false);
                }}
              >
                <Text style={styles.modalRecordText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Client Video Question Modal */}
      <Modal
        visible={!!selectedClientVideo}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedClientVideo(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 450, backgroundColor: colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                  Client's Video Question
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  From {selectedClientVideo?.clientName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedClientVideo(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedClientVideo?.url ? (
              <Video
                source={{ uri: selectedClientVideo.url }}
                style={{ width: '100%', height: 260, backgroundColor: '#000' }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
              />
            ) : null}

            <View style={{ padding: 16 }}>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => setSelectedClientVideo(null)}
              >
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fixed Top Header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Readings</Text>
        <TouchableOpacity 
          style={[styles.messagesButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => router.push('/messages')}
        >
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Main Content List with Header Component */}
      <FlatList
        data={filteredReadings.slice(0, page * PAGE_SIZE)}
        renderItem={renderReading}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        onEndReached={() => {
          if (page * PAGE_SIZE < filteredReadings.length) {
            setPage(prev => prev + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* 3 Interactive Cards: Client Messages, Client Audio Calls, Client Video Calls */}
            <View style={styles.cardsContainer}>
              {/* 1. Client Messages */}
              <TouchableOpacity 
                style={[styles.interactionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.secondary + '30' }]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategoryModal('chat')}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconCircle, { backgroundColor: colors.secondary + '20' }]}>
                    <Ionicons name="chatbubbles" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Client Messages</Text>
                      <View style={[styles.countBadge, { backgroundColor: colors.secondary + '20' }]}>
                        <Text style={[styles.countBadgeText, { color: colors.secondary }]}>
                          {breakdown.chat.count} Chats
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                      {breakdown.chat.total_minutes}m total talk time
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.earningBadgeText, { color: colors.gold }]}>
                    +${breakdown.chat.total_earnings.toFixed(2)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              {/* 2. Client Audio Calls */}
              <TouchableOpacity 
                style={[styles.interactionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.success + '30' }]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategoryModal('audio')}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconCircle, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="call" size={20} color={colors.success} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Client Audio Calls</Text>
                      <View style={[styles.countBadge, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[styles.countBadgeText, { color: colors.success }]}>
                          {breakdown.audio.count} Calls
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                      {breakdown.audio.total_minutes}m total talk time
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.earningBadgeText, { color: colors.gold }]}>
                    +${breakdown.audio.total_earnings.toFixed(2)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              {/* 3. Client Video Calls */}
              <TouchableOpacity 
                style={[styles.interactionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.primary + '30' }]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategoryModal('video')}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconCircle, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="videocam" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Client Video Calls</Text>
                      <View style={[styles.countBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                          {breakdown.video.count} Calls
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                      {breakdown.video.total_minutes}m total talk time
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.earningBadgeText, { color: colors.gold }]}>
                    +${breakdown.video.total_earnings.toFixed(2)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Pending Alert */}
            {pendingReadings.length > 0 && (
              <View style={styles.pendingAlertContainer}>
                <View style={[styles.pendingAlert, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={[styles.pendingAlertText, { color: colors.error }]}>
                    {pendingReadings.length} pending readings
                  </Text>
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'pending' && { backgroundColor: colors.primary + '20' }]}
                onPress={() => setActiveTab('pending')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'pending' ? colors.primary : colors.textSecondary }]}>
                  Pending
                </Text>
                {pendingReadings.length > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.tabBadgeText}>{pendingReadings.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'completed' && { backgroundColor: colors.primary + '20' }]}
                onPress={() => setActiveTab('completed')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'completed' ? colors.primary : colors.textSecondary }]}>
                  Completed
                </Text>
                {completedReadings.length > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.tabBadgeText}>{completedReadings.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={60} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No {activeTab} readings</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {activeTab === 'pending' 
                ? 'New reading requests will appear here' 
                : 'Completed readings and sessions will show here'}
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
  fixedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  messagesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    paddingBottom: SPACING.sm,
  },
  cardsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  interactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  cardIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pendingAlertContainer: {
    marginBottom: SPACING.sm,
  },
  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pendingAlertText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    gap: SPACING.xs,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  readingCard: {
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: SPACING.xs,
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoText: {
    fontSize: 13,
  },
  readingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  earningsInfo: {
    flexDirection: 'column',
  },
  earningsLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  price: {
    fontSize: 17,
    fontWeight: '700',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalRecordButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalRecordText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Category Modal Styles
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  categoryModalContainer: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  categoryModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  categoryModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 14,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryColLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryColValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 36,
  },
  inboxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: 12,
  },
  inboxButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionRecordCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sessionRecordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sessionRecordClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionClientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionClientAvatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sessionClientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  sessionDateText: {
    fontSize: 12,
    marginTop: 2,
  },
  earningBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  earningBadgeAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  sessionRecordBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailPillSub: {
    fontSize: 12,
  },
  emptyCategoryState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptyCategoryText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
