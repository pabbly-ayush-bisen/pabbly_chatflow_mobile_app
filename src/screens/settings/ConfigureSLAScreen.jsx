import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

export default function ConfigureSLAScreen() {
  const dispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Local state for SLA data
  const [hours, setHours] = useState('--');
  const [mins, setMins] = useState('--');
  const [isLoading, setIsLoading] = useState(true);

  // Load SLA data
  const loadSLAData = useCallback(async () => {
    try {
      const result = await dispatch(getSettings('sla')).unwrap();
      const data = result.data || result;
      const slaData = data?.sla || {};

      // Set hours and mins with proper handling
      setHours(slaData.hours !== undefined && slaData.hours !== null ? String(slaData.hours) : '--');
      setMins(slaData.mins !== undefined && slaData.mins !== null ? String(slaData.mins) : '--');
    } catch (error) {
      // Log:('Error loading SLA config:', error);
      showSnackbar('Failed to load SLA configuration');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadSLAData();
  }, [loadSLAData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSLAData();
    setIsRefreshing(false);
  }, [loadSLAData]);

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

  // Loading State
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading SLA configuration...</Text>
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
        <View style={styles.infoBanner}>
          <Icon name="information-outline" size={18} color={colors.primary.main} />
          <Text style={styles.infoBannerText}>
            SLA defines the maximum response time. Configure from web dashboard.
          </Text>
        </View>

        {/* Main SLA Card */}
        <View style={styles.slaCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Icon name="clock-check-outline" size={28} color={colors.primary.main} />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Response Time SLA</Text>
              <Text style={styles.cardSubtitle}>Max time to respond to customers</Text>
            </View>
          </View>

          {isSLAConfigured && totalMinutes > 0 ? (
            <View style={styles.timeDisplay}>
              {/* Hours */}
              <View style={styles.timeBlock}>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValue}>{formatTime(hours)}</Text>
                </View>
                <Text style={styles.timeLabel}>HOURS</Text>
              </View>

              {/* Separator */}
              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes */}
              <View style={styles.timeBlock}>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValue}>{formatTime(mins)}</Text>
                </View>
                <Text style={styles.timeLabel}>MINUTES</Text>
              </View>
            </View>
          ) : (
            <View style={styles.notConfigured}>
              <Icon name="clock-alert-outline" size={48} color={colors.grey[300]} />
              <Text style={styles.notConfiguredTitle}>SLA Not Configured</Text>
              <Text style={styles.notConfiguredText}>
                Set up response time SLA from the web dashboard
              </Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What is SLA?</Text>
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
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary.dark,
  },

  // SLA Card
  slaCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[50],
    gap: 14,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Time Display
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeValueBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.grey[50],
    borderWidth: 2,
    borderColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary.main,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.grey[400],
    marginBottom: 30,
  },

  // Not Configured
  notConfigured: {
    alignItems: 'center',
    padding: 40,
  },
  notConfiguredTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
  },
  notConfiguredText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[100],
    padding: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  bottomSpacing: {
    height: 20,
  },
});
