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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';

import { useAuth } from '../../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.227:8000';

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
}

export default function ReadingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { psychic } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  // ADV-073: Question Feed Pagination State
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const [selectedClientVideo, setSelectedClientVideo] = useState<{ url: string; clientName: string } | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);

  const formatReadingDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} mins ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
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

  useEffect(() => {
    fetchReadings();
    const interval = setInterval(fetchReadings, 10000);
    return () => clearInterval(interval);
  }, [fetchReadings]);

  const pendingReadings = readings.filter(r => r.status === 'pending' || r.status === 'accepted');
  const completedReadings = readings.filter(r => r.status === 'completed');
  
  const filteredReadings = activeTab === 'pending' ? pendingReadings : completedReadings;

  const onRefresh = () => {
    setRefreshing(true);
    fetchReadings();
  };

  const handleRecord = (reading: Reading) => {
    // Navigate to record answer screen
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

  const renderReading = useCallback(({ item }: { item: Reading }) => (
    <View style={[styles.readingCard, { backgroundColor: colors.backgroundCard }]}>
      {/* Header */}
      <View style={styles.readingHeader}>
        <View style={styles.clientInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{item.clientName[0]}</Text>
          </View>
          <View>
            <Text style={[styles.clientName, { color: colors.textPrimary }]}>{item.clientName}</Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>{item.createdAt}</Text>
          </View>
        </View>
        <View style={[
          styles.typeBadge,
          { backgroundColor: item.type === 'emergency' ? colors.error + '20' : colors.primary + '20' }
        ]}>
          {item.type === 'emergency' && (
            <Ionicons name="flash" size={12} color={colors.error} style={{ marginRight: 4 }} />
          )}
          <Text style={[
            styles.typeText,
            { color: item.type === 'emergency' ? colors.error : colors.primary }
          ]}>
            {item.type === 'emergency' ? 'URGENT' : 'Standard'}
          </Text>
        </View>
      </View>

      {/* Question */}
      <Text style={[styles.questionText, { color: colors.textSecondary }]} numberOfLines={2}>{item.question}</Text>

      {/* Video indicator - Tap to watch client's video */}
      {item.hasVideo && (
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

      {/* Footer */}
      <View style={[styles.readingFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.price, { color: colors.gold }]}>${item.price.toFixed(2)}</Text>
        
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
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                  console.log('Start recording for', selectedReading?.id);
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

      {/* Fixed Header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Readings</Text>
        <TouchableOpacity 
          style={[styles.messagesButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => router.push('/messages')}
        >
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages Banner */}
      <TouchableOpacity 
        style={[styles.messagesBanner, { backgroundColor: colors.backgroundCard, borderColor: colors.secondary + '30' }]}
        onPress={() => router.push('/messages')}
      >
        <View style={styles.messagesBannerLeft}>
          <View style={[styles.messagesBannerIcon, { backgroundColor: colors.secondary + '20' }]}>
            <Ionicons name="chatbubbles" size={20} color={colors.secondary} />
          </View>
          <View>
            <Text style={[styles.messagesBannerTitle, { color: colors.textPrimary }]}>Client Messages</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

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
        </TouchableOpacity>
      </View>

      {/* Readings List */}
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={60} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No {activeTab} readings</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {activeTab === 'pending' 
                ? 'New reading requests will appear here' 
                : 'Completed readings will show here'}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
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
  messagesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  messagesBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  messagesBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pendingAlertContainer: {
    paddingHorizontal: SPACING.lg,
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
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
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
    fontWeight: '500',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  videoText: {
    fontSize: 12,
  },
  readingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    gap: 6,
  },
  recordButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: SPACING.xs,
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
  modalRecordButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalRecordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
