import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';
import { cardStyles } from '../../theme/cardStyles';
import { InfoBanner } from '../../components/common';

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

export default function TimeZoneScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Local state for timezone data
  const [timezone, setTimezone] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const { getSettingsStatus } = useSelector((state) => state.settings);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load timezone data
  const loadTimezoneData = useCallback(async () => {
    try {
      const result = await dispatch(getSettings('timeZone')).unwrap();
      const data = result.data || result;
      setTimezone(data.timeZone || '');
    } catch (error) {
      // Log:('Error loading timezone:', error);
      showSnackbar('Failed to load timezone');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadTimezoneData();
  }, [loadTimezoneData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTimezoneData();
    setIsRefreshing(false);
  }, [loadTimezoneData]);

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

  // Loading State
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading timezone...</Text>
        </View>
      </View>
    );
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
        <View style={styles.timezoneCard}>
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
        </View>

        {/* Usage Info Card */}
        <View style={styles.usageCard}>
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
        </View>

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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },


  // Timezone Card
  timezoneCard: {
    ...cardStyles.card,
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
    ...cardStyles.card,
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

  // Bottom Spacing
  bottomSpacing: {
    height: 24,
  },
});
