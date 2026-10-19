import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.227:8000';

interface ReviewItem {
  id: string;
  client_name: string;
  rating: number;
  comment: string;
  session_id?: string;
  created_at: string;
}

export default function AdvisorReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { psychic, user } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [totalReviews, setTotalReviews] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number>(5.0);
  const [breakdown, setBreakdown] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const psychicIdentifier = psychic?.id || user?.id || psychic?.email || '64ea86f6-968a-4dfc-8c98-1a322fb020c0';

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/reviews/psychic/${encodeURIComponent(psychicIdentifier)}?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setTotalReviews(Number(data.total_reviews ?? 0));
        setAverageRating(Number(data.average_rating ?? 5.0));
        if (data.rating_breakdown) {
          setBreakdown(data.rating_breakdown);
        }
      }
    } catch (error) {
      console.warn('Error fetching advisor reviews:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [psychicIdentifier]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const filteredReviews = filterRating !== null 
    ? reviews.filter((r) => r.rating === filterRating)
    : reviews;

  const renderStars = (rating: number, size = 16) => {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={{ marginBottom: 16 }}>
      {/* Overview Card */}
      <View style={[styles.overviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreLeft}>
            <Text style={[styles.bigRating, { color: colors.textPrimary }]}>
              {averageRating.toFixed(1)}
            </Text>
            {renderStars(Math.round(averageRating), 22)}
            <Text style={[styles.reviewCountText, { color: colors.textSecondary }]}>
              Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </Text>
          </View>

          {/* Breakdown Bars */}
          <View style={styles.barsContainer}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = breakdown[stars] || 0;
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <TouchableOpacity
                  key={stars}
                  activeOpacity={0.7}
                  style={styles.barRow}
                  onPress={() => setFilterRating(filterRating === stars ? null : stars)}
                >
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{stars}★</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.backgroundElevated }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: stars >= 4 ? colors.primary : stars === 3 ? colors.warning : colors.error,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barCount, { color: colors.textMuted }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            {
              backgroundColor: filterRating === null ? colors.primary : colors.backgroundCard,
              borderColor: filterRating === null ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setFilterRating(null)}
        >
          <Text style={[styles.filterPillText, { color: filterRating === null ? '#FFF' : colors.textPrimary }]}>
            All ({totalReviews})
          </Text>
        </TouchableOpacity>

        {[5, 4, 3, 2, 1].map((stars) => {
          const count = breakdown[stars] || 0;
          if (count === 0 && filterRating !== stars) return null;
          const isSelected = filterRating === stars;
          return (
            <TouchableOpacity
              key={stars}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.backgroundCard,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilterRating(isSelected ? null : stars)}
            >
              <Ionicons name="star" size={13} color={isSelected ? '#FFF' : '#FFD700'} style={{ marginRight: 3 }} />
              <Text style={[styles.filterPillText, { color: isSelected ? '#FFF' : colors.textPrimary }]}>
                {stars} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderReviewItem = ({ item }: { item: ReviewItem }) => {
    const initials = item.client_name
      ? item.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
      : 'C';

    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <View style={styles.reviewHeader}>
          <View style={styles.clientInfo}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
            <View>
              <Text style={[styles.clientName, { color: colors.textPrimary }]}>
                {item.client_name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {renderStars(item.rating, 14)}
                <Text style={[styles.dateText, { color: colors.textMuted }]}>
                  • {formatDate(item.created_at)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={[styles.verifiedText, { color: colors.success }]}>Verified</Text>
          </View>
        </View>

        {item.comment ? (
          <Text style={[styles.commentText, { color: colors.textSecondary }]}>
            "{item.comment}"
          </Text>
        ) : (
          <Text style={[styles.commentText, { color: colors.textMuted, fontStyle: 'italic' }]}>
            (Client rated {item.rating} stars without written comments)
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 14) }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Client Reviews</Text>

        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>Loading reviews...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderReviewItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundCard }]}>
                <Ionicons name="star-outline" size={42} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {filterRating ? `No ${filterRating}-star reviews yet` : 'No reviews yet'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {filterRating
                  ? 'Try selecting "All" to view reviews across all star ratings.'
                  : 'Completed readings with clients will show client reviews and ratings here.'}
              </Text>
            </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLeft: {
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    minWidth: 110,
  },
  bigRating: {
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
    marginBottom: 4,
  },
  reviewCountText: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  barsContainer: {
    flex: 1,
    paddingLeft: 16,
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 22,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barCount: {
    fontSize: 11,
    width: 20,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
