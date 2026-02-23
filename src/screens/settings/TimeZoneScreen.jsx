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
import { fetchTimezoneWithCache } from '../../redux/cacheThunks';
import { cacheManager } from '../../database/CacheManager';
import { useFocusEffect } from '@react-navigation/native';
import { useNetwork } from '../../contexts/NetworkContext';
import { colors } from '../../theme/colors';
import { InfoBanner, ShadowCard } from '../../components/common';

// Common timezone regions
const TIMEZONE_REGIONS = {
  'Asia/Kolkata': { region: 'Asia', city: 'Kolkata', country: 'India', flag: 'IN' },
  'Asia/Dubai': { region: 'Asia', city: 'Dubai', country: 'UAE', flag: 'AE' },
  'Asia/Singapore': { region: 'Asia', city: 'Singapore', country: 'Singapore', flag: 'SG' },
  'Asia/Tokyo': { region: 'Asia', city: 'Tokyo', country: 'Japan', flag: 'JP' },
  'Asia/Shanghai': { region: 'Asia', city: 'Shanghai', country: 'China', flag: 'CN' },
  'Asia/Hong_Kong': { region: 'Asia', city: 'Hong Kong', country: 'Hong Kong', flag: 'HK' },
  'Europe/London': { region: 'Europe', city: 'London', country: 'UK', flag: 'GB' },
  'Europe/Paris': { region: 'Europe', city: 'Paris', country: 'France', flag: 'FR' },
  'Europe/Berlin': { region: 'Europe', city: 'Berlin', country: 'Germany', flag: 'DE' },
  'America/New_York': { region: 'America', city: 'New York', country: 'USA', flag: 'US' },
  'America/Los_Angeles': { region: 'America', city: 'Los Angeles', country: 'USA', flag: 'US' },
  'America/Chicago': { region: 'America', city: 'Chicago', country: 'USA', flag: 'US' },
  'Australia/Sydney': { region: 'Australia', city: 'Sydney', country: 'Australia', flag: 'AU' },
  'Pacific/Auckland': { region: 'Pacific', city: 'Auckland', country: 'New Zealand', flag: 'NZ' },
  'UTC': { region: 'UTC', city: 'Coordinated Universal Time', country: 'UTC', flag: '' },
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

// Layout-Matched Skeleton for TimeZone Screen
const TimeZoneSkeleton = () => (
  <View style={styles.container}>
    <View style={styles.scrollContent}>
      {/* Info Banner Skeleton */}
      <View style={skeletonStyles.infoBanner}>
        <SkeletonPulse style={{ width: 18, height: 18, borderRadius: 9 }} />
        <SkeletonPulse style={{ flex: 1, height: 14, borderRadius: 4 }} />
      </View>

      {/* Timezone Card Skeleton */}
      <View style={skeletonStyles.timezoneCard}>
        {/* Clock Section Skeleton */}
        <View style={skeletonStyles.clockSection}>
          <SkeletonPulse style={{ width: 80, height: 80, borderRadius: 40 }} />
          <SkeletonPulse style={{ width: 180, height: 32, borderRadius: 6, marginTop: 16 }} />
          <SkeletonPulse style={{ width: 220, height: 14, borderRadius: 4, marginTop: 8 }} />
        </View>

        {/* Details Section Skeleton */}
        <View style={skeletonStyles.detailsSection}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={skeletonStyles.detailCard}>
              <SkeletonPulse style={{ width: 44, height: 44, borderRadius: 12 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonPulse style={{ width: 70, height: 10, borderRadius: 3 }} />
                <SkeletonPulse style={{ width: 140, height: 14, borderRadius: 4 }} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Usage Card Skeleton */}
      <View style={skeletonStyles.usageCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 10 }} />
          <SkeletonPulse style={{ width: 160, height: 15, borderRadius: 4 }} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <SkeletonPulse style={{ width: 38, height: 38, borderRadius: 10 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonPulse style={{ width: 130, height: 13, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: '90%', height: 11, borderRadius: 4 }} />
            </View>
          </View>
        ))}
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
    marginBottom: 16,
    gap: 10,
  },
  timezoneCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginBottom: 16,
    overflow: 'hidden',
  },
  clockSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: colors.primary.lighter,
  },
  detailsSection: {
    padding: 16,
    gap: 12,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.grey[25] || '#FAFAFA',
    borderRadius: 12,
    gap: 14,
  },
  usageCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    padding: 16,
  },
});

export default function TimeZoneScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Local state for timezone data
  const [timezone, setTimezone] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Refs for cache-first pattern
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const isFirstFocus = useRef(true);

  // Network state
  const { isOffline, isNetworkAvailable } = useNetwork();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Helper to apply timezone data to local state
  const applyTimezoneData = useCallback((data) => {
    if (!data) return;
    setTimezone(data.timeZone || data?.timeZone || '');
  }, []);

  // Initial load — read cache locally for instant display, then fetch fresh from API
  useEffect(() => {
    isLoadingRef.current = true;

    // Read cache locally for instant display while API loads
    cacheManager.getAppSetting('timezone').then((cached) => {
      if (cached && cached.timeZone !== undefined) {
        applyTimezoneData(cached);
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Always fetch fresh from API to pick up changes made on web
    dispatch(fetchTimezoneWithCache({ forceRefresh: true })).unwrap()
      .then((result) => {
        const data = result?.data || result || {};
        applyTimezoneData(data);
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
      dispatch(fetchTimezoneWithCache({ forceRefresh: true })).unwrap()
        .then((result) => {
          const data = result?.data || result || {};
          applyTimezoneData(data);
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

      dispatch(fetchTimezoneWithCache({ forceRefresh: true })).unwrap()
        .then((result) => {
          const data = result?.data || result || {};
          applyTimezoneData(data);
        })
        .catch(() => {});
    }, [isOffline])
  );

  // Pull-to-refresh with cache reset & offline guard
  const onRefresh = useCallback(async () => {
    if (isOffline) return;
    setIsRefreshing(true);
    // Clear cache so fresh data is fetched from API
    await cacheManager.saveAppSetting('timezone', null).catch(() => {});
    dispatch(fetchTimezoneWithCache({ forceRefresh: true })).unwrap()
      .then((result) => {
        const data = result?.data || result || {};
        applyTimezoneData(data);
        initialLoadDone.current = true;
      })
      .catch(() => {
        showSnackbar('Failed to load timezone');
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [dispatch, isOffline, applyTimezoneData]);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Get timezone info
  const getTimezoneInfo = () => {
    const info = TIMEZONE_REGIONS[timezone];
    if (info) {
      return info;
    }

    // Parse unknown timezone format (e.g., "America/New_York")
    const parts = timezone.split('/');
    if (parts.length >= 2) {
      return {
        region: parts[0],
        city: parts[parts.length - 1].replace(/_/g, ' '),
        country: '',
        flag: '',
      };
    }

    return {
      region: 'Unknown',
      city: timezone || 'Not configured',
      country: '',
      flag: '',
    };
  };

  // Format time in the configured timezone
  const formatTimeInTimezone = () => {
    if (!timezone) {
      return { time: '--:--:--', date: 'Not configured' };
    }

    try {
      const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: timezone,
      };

      const dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone,
      };

      const time = currentTime.toLocaleTimeString('en-US', timeOptions);
      const date = currentTime.toLocaleDateString('en-US', dateOptions);

      return { time, date };
    } catch (error) {
      return { time: '--:--:--', date: 'Invalid timezone' };
    }
  };

  // Get UTC offset
  const getUTCOffset = () => {
    if (!timezone) return '';

    try {
      const date = new Date();
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const offset = (tzDate - utcDate) / (1000 * 60 * 60);

      const hours = Math.floor(Math.abs(offset));
      const minutes = Math.round((Math.abs(offset) - hours) * 60);
      const sign = offset >= 0 ? '+' : '-';

      return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const timezoneInfo = getTimezoneInfo();
  const { time, date } = formatTimeInTimezone();
  const utcOffset = getUTCOffset();

  // Offline with no data — only show if data was NEVER loaded
  if (isOffline && !initialLoadDone.current && !timezone) {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load timezone configuration.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Loading State — skeleton instead of spinner
  if (isInitialLoading && !timezone && !isOffline) {
    return <TimeZoneSkeleton />;
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
          message="This timezone is used for scheduling broadcasts, working hours, and activity logs. Configure from the web dashboard."
          style={{ marginBottom: 16 }}
        />

        {/* Main Timezone Card */}
        <ShadowCard variant="card" style={styles.timezoneCard}>
          {timezone ? (
            <>
              {/* Clock Display */}
              <View style={styles.clockSection}>
                <View style={styles.clockCircle}>
                  <Icon name="clock-outline" size={40} color={colors.primary.main} />
                </View>
                <Text style={styles.timeDisplay}>{time}</Text>
                <Text style={styles.dateDisplay}>{date}</Text>
              </View>

              {/* Timezone Details */}
              <View style={styles.detailsSection}>
                {/* Timezone Name */}
                <View style={styles.detailCard}>
                  <View style={[styles.detailIcon, { backgroundColor: '#E3F2FD' }]}>
                    <Icon name="earth" size={22} color="#2196F3" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Timezone</Text>
                    <Text style={styles.detailValue}>{timezone}</Text>
                  </View>
                </View>

                {/* Region */}
                <View style={styles.detailCard}>
                  <View style={[styles.detailIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Icon name="map-marker-outline" size={22} color="#4CAF50" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Region</Text>
                    <Text style={styles.detailValue}>
                      {timezoneInfo.city}
                      {timezoneInfo.country ? `, ${timezoneInfo.country}` : ''}
                    </Text>
                  </View>
                </View>

                {/* UTC Offset */}
                <View style={styles.detailCard}>
                  <View style={[styles.detailIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Icon name="clock-fast" size={22} color="#FF9800" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>UTC Offset</Text>
                    <Text style={styles.detailValue}>{utcOffset || 'Unknown'}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.notConfiguredBox}>
              <View style={styles.notConfiguredIcon}>
                <Icon name="clock-alert-outline" size={56} color={colors.grey[300]} />
              </View>
              <Text style={styles.notConfiguredTitle}>Timezone Not Configured</Text>
              <Text style={styles.notConfiguredText}>
                Set your timezone from the web dashboard to ensure accurate scheduling and time-based features.
              </Text>
            </View>
          )}
        </ShadowCard>

        {/* Usage Info Card */}
        <ShadowCard variant="card" style={styles.usageCard}>
          <View style={styles.usageHeader}>
            <Icon name="lightbulb-outline" size={20} color={colors.warning.main} />
            <Text style={styles.usageTitle}>Where Timezone is Used</Text>
          </View>

          <View style={styles.usageList}>
            <View style={styles.usageItem}>
              <View style={[styles.usageIcon, { backgroundColor: '#FCE4EC' }]}>
                <Icon name="calendar-clock" size={18} color="#E91E63" />
              </View>
              <View style={styles.usageContent}>
                <Text style={styles.usageItemTitle}>Broadcast Scheduling</Text>
                <Text style={styles.usageItemDescription}>
                  Schedule broadcasts based on your local time
                </Text>
              </View>
            </View>

            <View style={styles.usageItem}>
              <View style={[styles.usageIcon, { backgroundColor: '#E0F2F1' }]}>
                <Icon name="briefcase-clock-outline" size={18} color="#009688" />
              </View>
              <View style={styles.usageContent}>
                <Text style={styles.usageItemTitle}>Working Hours</Text>
                <Text style={styles.usageItemDescription}>
                  Define when your team is available to respond
                </Text>
              </View>
            </View>

            <View style={styles.usageItem}>
              <View style={[styles.usageIcon, { backgroundColor: '#EDE7F6' }]}>
                <Icon name="history" size={18} color="#673AB7" />
              </View>
              <View style={styles.usageContent}>
                <Text style={styles.usageItemTitle}>Activity Logs</Text>
                <Text style={styles.usageItemDescription}>
                  View timestamps in your preferred timezone
                </Text>
              </View>
            </View>

            <View style={styles.usageItem}>
              <View style={[styles.usageIcon, { backgroundColor: '#E8EAF6' }]}>
                <Icon name="chart-timeline-variant" size={18} color="#3F51B5" />
              </View>
              <View style={styles.usageContent}>
                <Text style={styles.usageItemTitle}>Analytics & Reports</Text>
                <Text style={styles.usageItemDescription}>
                  Data aggregated based on your timezone
                </Text>
              </View>
            </View>
          </View>
        </ShadowCard>

        {/* Bottom Spacing */}
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

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },

  // Timezone Card
  timezoneCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },

  // Clock Section
  clockSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: colors.primary.lighter,
  },
  clockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  timeDisplay: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary.dark,
    letterSpacing: 1,
    marginBottom: 4,
  },
  dateDisplay: {
    fontSize: 14,
    color: colors.primary.main,
    fontWeight: '500',
  },

  // Details Section
  detailsSection: {
    padding: 16,
    gap: 12,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.grey[25] || '#FAFAFA',
    borderRadius: 12,
    gap: 14,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Not Configured State
  notConfiguredBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  notConfiguredIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  notConfiguredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  notConfiguredText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Usage Card
  usageCard: {
    padding: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  usageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  usageList: {
    gap: 12,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  usageIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usageContent: {
    flex: 1,
  },
  usageItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  usageItemDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
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

  // Bottom Spacing
  bottomSpacing: {
    height: 24,
  },
});
