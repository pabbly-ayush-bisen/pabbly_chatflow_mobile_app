import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { fetchSlaWithCache } from '../../redux/cacheThunks';
import { cacheManager } from '../../database/CacheManager';
import { useFocusEffect } from '@react-navigation/native';
import { useNetwork } from '../../contexts/NetworkContext';
import { colors } from '../../theme/colors';
import { cardStyles } from '../../theme/cardStyles';
import { InfoBanner } from '../../components/common';

// SLA screen accent colors (matching Settings/More screen)
const SLA_COLORS = {
  icon: '#E91E63',
  iconBg: '#FCE4EC',
};

// Skeleton Pulse Component
const SkeletonPulse = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: colors.grey[200], borderRadius: 6 }, style, { opacity }]} />;
};

// Layout-Matched Skeleton for SLA Screen
const SLASkeleton = () => (
  <View style={styles.container}>
    <View style={styles.scrollContent}>
      {/* Info Banner Skeleton */}
      <View style={skeletonStyles.infoBanner}>
        <SkeletonPulse style={{ width: 18, height: 18, borderRadius: 9 }} />
        <SkeletonPulse style={{ flex: 1, height: 14, borderRadius: 4 }} />
      </View>

      {/* SLA Card Skeleton */}
      <View style={skeletonStyles.slaCard}>
        {/* Card Header Skeleton */}
        <View style={skeletonStyles.cardHeader}>
          <SkeletonPulse style={{ width: 48, height: 48, borderRadius: 14 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonPulse style={{ width: 150, height: 16, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 210, height: 12, borderRadius: 4 }} />
          </View>
        </View>
        {/* Time Display Skeleton */}
        <View style={skeletonStyles.timeDisplay}>
          <View style={{ alignItems: 'center' }}>
            <SkeletonPulse style={{ width: 100, height: 100, borderRadius: 20 }} />
            <SkeletonPulse style={{ width: 50, height: 10, borderRadius: 4, marginTop: 10 }} />
          </View>
          <SkeletonPulse style={{ width: 10, height: 10, borderRadius: 5, marginBottom: 20 }} />
          <View style={{ alignItems: 'center' }}>
            <SkeletonPulse style={{ width: 100, height: 100, borderRadius: 20 }} />
            <SkeletonPulse style={{ width: 60, height: 10, borderRadius: 4, marginTop: 10 }} />
          </View>
        </View>
      </View>

      {/* Info Card Skeleton */}
      <View style={skeletonStyles.infoCard}>
        <SkeletonPulse style={{ width: 24, height: 24, borderRadius: 12, marginBottom: 10 }} />
        <SkeletonPulse style={{ width: 100, height: 16, borderRadius: 4, marginBottom: 10 }} />
        <SkeletonPulse style={{ width: '100%', height: 12, borderRadius: 4, marginBottom: 6 }} />
        <SkeletonPulse style={{ width: '90%', height: 12, borderRadius: 4, marginBottom: 6 }} />
        <SkeletonPulse style={{ width: '75%', height: 12, borderRadius: 4 }} />
      </View>
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  slaCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
    gap: 14,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 20,
  },
  infoCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    padding: 18,
  },
});

export default function ConfigureSLAScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Local state for SLA data
  const [hours, setHours] = useState('--');
  const [mins, setMins] = useState('--');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Refs for cache-first pattern
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const isFirstFocus = useRef(true);

  // Network state
  const { isOffline, isNetworkAvailable } = useNetwork();

  // Helper to apply SLA data to local state
  const applySlaData = useCallback((slaData) => {
    if (!slaData) return;
    setHours(slaData.hours !== undefined && slaData.hours !== null ? String(slaData.hours) : '--');
    setMins(slaData.mins !== undefined && slaData.mins !== null ? String(slaData.mins) : '--');
  }, []);

  // Initial load — read cache locally for instant display, then fetch fresh from API
  useEffect(() => {
    isLoadingRef.current = true;

    // Read cache locally for instant display while API loads
    cacheManager.getAppSetting('sla').then((cached) => {
      if (cached && (cached.hours !== undefined || cached.mins !== undefined)) {
        applySlaData(cached);
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Always fetch fresh from API to pick up changes made on web
    dispatch(fetchSlaWithCache({ forceRefresh: true })).unwrap()
      .then((result) => {
        const slaData = result?.data || result || {};
        applySlaData(slaData);
        initialLoadDone.current = true;
      })
      .catch(() => {})
      .finally(() => {
        isLoadingRef.current = false;
        setIsInitialLoading(false);
      });
  }, []);

  // Network recovery — re-fetch when connectivity restored and data never loaded
  useEffect(() => {
    if (isNetworkAvailable && !initialLoadDone.current && !isLoadingRef.current) {
      isLoadingRef.current = true;
      setIsInitialLoading(true);
      dispatch(fetchSlaWithCache({ forceRefresh: true })).unwrap()
        .then((result) => {
          const slaData = result?.data || result || {};
          applySlaData(slaData);
          initialLoadDone.current = true;
        })
        .catch(() => {})
        .finally(() => {
          isLoadingRef.current = false;
          setIsInitialLoading(false);
        });
    }
  }, [isNetworkAvailable]);

  // Re-fetch when screen regains focus (picks up web dashboard changes)
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount — the useEffect above already handles the first load
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!initialLoadDone.current || isOffline) return;

      dispatch(fetchSlaWithCache({ forceRefresh: true })).unwrap()
        .then((result) => {
          const slaData = result?.data || result || {};
          applySlaData(slaData);
        })
        .catch(() => {});
    }, [isOffline])
  );

  // Pull-to-refresh with cache reset & offline guard
  const onRefresh = useCallback(async () => {
    if (isOffline) return;
    setIsRefreshing(true);
    // Clear cache so fresh data is fetched from API
    await cacheManager.saveAppSetting('sla', null).catch(() => {});
    dispatch(fetchSlaWithCache({ forceRefresh: true })).unwrap()
      .then((result) => {
        const slaData = result?.data || result || {};
        applySlaData(slaData);
        initialLoadDone.current = true;
      })
      .catch(() => {
        showSnackbar('Failed to load SLA configuration');
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [dispatch, isOffline, applySlaData]);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Check if SLA is configured
  const isSLAConfigured = hours !== '--' || mins !== '--';
  const hoursNum = parseInt(hours) || 0;
  const minsNum = parseInt(mins) || 0;
  const totalMinutes = hoursNum * 60 + minsNum;

  // Format display
  const formatTime = (val) => {
    if (val === '--') return '--';
    const num = parseInt(val) || 0;
    return num < 10 ? `0${num}` : `${num}`;
  };

  // Offline with no data — only show if data was NEVER loaded
  if (isOffline && !initialLoadDone.current && hours === '--' && mins === '--') {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load SLA configuration.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Loading State — skeleton instead of spinner
  if (isInitialLoading && hours === '--' && mins === '--' && !isOffline) {
    return <SLASkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <InfoBanner
          message="SLA defines the maximum response time. Configure from web dashboard."
          style={{ marginBottom: 20 }}
        />

        {/* Main SLA Card */}
        <View style={styles.slaCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Icon name="clock-check-outline" size={24} color={SLA_COLORS.icon} />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Response Time SLA</Text>
              <Text style={styles.cardSubtitle}>Maximum time to respond to customers</Text>
            </View>
          </View>

          {isSLAConfigured && totalMinutes > 0 ? (
            <View style={styles.timeDisplay}>
              {/* Hours */}
              <View style={styles.timeBlock}>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValue}>{formatTime(hours)}</Text>
                </View>
                <Text style={styles.timeLabel}>Hours</Text>
              </View>

              {/* Separator Dots */}
              <View style={styles.separatorDots}>
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>

              {/* Minutes */}
              <View style={styles.timeBlock}>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValue}>{formatTime(mins)}</Text>
                </View>
                <Text style={styles.timeLabel}>Minutes</Text>
              </View>
            </View>
          ) : (
            <View style={styles.notConfigured}>
              <View style={styles.emptyIconContainer}>
                <Icon name="clock-check-outline" size={32} color={SLA_COLORS.icon} />
              </View>
              <Text style={styles.notConfiguredTitle}>SLA Not Configured</Text>
              <Text style={styles.notConfiguredText}>
                Set up response time SLA from the web dashboard to track team performance
              </Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconRow}>
            <Icon name="lightbulb-outline" size={20} color="#FF9800" />
            <Text style={styles.infoTitle}>What is SLA?</Text>
          </View>
          <Text style={styles.infoText}>
            Service Level Agreement (SLA) sets the expected time limit to respond to customer messages. This helps track team performance and ensure timely support.
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },

  // SLA Card
  slaCard: {
    ...cardStyles.card,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
    gap: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SLA_COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 3,
  },

  // Time Display
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 20,
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeValueBox: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: SLA_COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeValue: {
    fontSize: 36,
    fontWeight: '800',
    color: SLA_COLORS.icon,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  separatorDots: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SLA_COLORS.icon,
  },

  // Not Configured (Empty State)
  notConfigured: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: SLA_COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notConfiguredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
  },
  notConfiguredText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  // Info Card
  infoCard: {
    ...cardStyles.card,
    padding: 18,
  },
  infoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Offline State
  offlineBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  offlineIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  offlineSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  bottomSpacing: {
    height: 20,
  },
});
