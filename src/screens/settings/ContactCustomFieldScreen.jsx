import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { fetchUserAttributesWithCache } from '../../redux/cacheThunks';
import { cacheManager } from '../../database/CacheManager';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useNetwork } from '../../contexts/NetworkContext';
import { colors } from '../../theme/colors';
import { cardStyles } from '../../theme/cardStyles';
import { InfoBanner } from '../../components/common';

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

// Skeleton Custom Field Card
const CustomFieldCardSkeleton = () => (
  <View style={skeletonStyles.fieldCard}>
    {/* Main Row: Name | Description */}
    <View style={skeletonStyles.mainRow}>
      <View style={skeletonStyles.leftColumn}>
        <SkeletonPulse style={{ width: 120, height: 16, borderRadius: 4 }} />
      </View>
      <View style={skeletonStyles.rightColumn}>
        <SkeletonPulse style={{ width: 140, height: 14, borderRadius: 4 }} />
      </View>
    </View>
    {/* Key Row */}
    <View style={skeletonStyles.keyRow}>
      <SkeletonPulse style={{ width: 14, height: 14, borderRadius: 3 }} />
      <SkeletonPulse style={{ flex: 1, height: 12, borderRadius: 4 }} />
      <SkeletonPulse style={{ width: 22, height: 22, borderRadius: 6 }} />
    </View>
  </View>
);

// Full Skeleton
const CustomFieldsSkeleton = () => (
  <View style={skeletonStyles.container}>
    {/* Info Banner */}
    <View style={skeletonStyles.infoBanner}>
      <SkeletonPulse style={{ width: 16, height: 16, borderRadius: 4 }} />
      <SkeletonPulse style={{ flex: 1, height: 13, borderRadius: 4 }} />
    </View>
    {/* Field Cards */}
    <View style={skeletonStyles.list}>
      <CustomFieldCardSkeleton />
      <CustomFieldCardSkeleton />
      <CustomFieldCardSkeleton />
      <CustomFieldCardSkeleton />
      <CustomFieldCardSkeleton />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    padding: 16,
  },
  mainRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 12,
    alignItems: 'flex-end',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
});

export default function ContactCustomFieldScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [localFields, setLocalFields] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);
  const fetchSucceeded = useRef(false);

  const isLoading = getSettingsStatus === 'loading';
  const isRefreshing = isLoading && localFields.length > 0 && initialLoadDone.current;

  // Set header count badge
  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerRight: () => (
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>
            {totalCount} {totalCount === 1 ? 'field' : 'fields'}
          </Text>
        </View>
      ),
    });
  }, [navigation, totalCount]);

  // Initial load — read cache locally for instant display, then fetch fresh from API
  useEffect(() => {
    isLoadingRef.current = true;
    fetchSucceeded.current = false;

    // Read cache locally for instant display while API loads
    cacheManager.getAppSetting('userAttributes').then((cached) => {
      if (cached && cached.items && cached.items.length > 0) {
        setLocalFields(cached.items);
        setTotalCount(cached.totalCount || 0);
        setIsInitialLoading(false);
      }
    }).catch(() => {});

    // Always fetch fresh from API to pick up changes made on web
    dispatch(fetchUserAttributesWithCache({ forceRefresh: true }))
      .unwrap()
      .then((result) => {
        fetchSucceeded.current = true;
        const data = result.data?.userAttributes || result.userAttributes || {};
        const items = data.items || [];
        const total = data.totalCount || 0;
        setLocalFields(items);
        setTotalCount(total);
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
      fetchSucceeded.current = false;
      setIsInitialLoading(true);
      dispatch(fetchUserAttributesWithCache({ forceRefresh: true }))
        .unwrap()
        .then((result) => {
          fetchSucceeded.current = true;
          const data = result.data?.userAttributes || result.userAttributes || {};
          const items = data.items || [];
          const total = data.totalCount || 0;
          setLocalFields(items);
          setTotalCount(total);
          initialLoadDone.current = true;
        })
        .catch(() => {})
        .finally(() => {
          isLoadingRef.current = false;
          setIsInitialLoading(false);
        });
    }
  }, [isNetworkAvailable]);

  // Sync settings.userAttributes → localFields on initial load only (safety net)
  useEffect(() => {
    if (settings.userAttributes && !initialLoadDone.current && !isInitialLoading && fetchSucceeded.current) {
      const items = settings.userAttributes.items || [];
      const total = settings.userAttributes.totalCount || 0;
      setLocalFields(items);
      setTotalCount(total);
      initialLoadDone.current = true;
    }
  }, [settings.userAttributes, isInitialLoading]);

  // Re-fetch when screen regains focus (picks up web app changes)
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current || isOffline) return;

      initialLoadDone.current = false;
      fetchSucceeded.current = false;
      dispatch(fetchUserAttributesWithCache({ forceRefresh: true }))
        .unwrap()
        .then((result) => {
          fetchSucceeded.current = true;
          const data = result.data?.userAttributes || result.userAttributes || {};
          const items = data.items || [];
          const total = data.totalCount || 0;
          setLocalFields(items);
          setTotalCount(total);
          initialLoadDone.current = true;
        })
        .catch(() => { initialLoadDone.current = true; });
    }, [isOffline])
  );

  const onRefresh = useCallback(() => {
    if (isOffline) return;
    initialLoadDone.current = false;
    fetchSucceeded.current = false;
    isLoadingRef.current = true;
    // Clear cache so fresh data is fetched from API
    cacheManager.saveAppSetting('userAttributes', null).catch(() => {});
    dispatch(fetchUserAttributesWithCache({ forceRefresh: true }))
      .unwrap()
      .then((result) => {
        fetchSucceeded.current = true;
        const data = result.data?.userAttributes || result.userAttributes || {};
        const items = data.items || [];
        const total = data.totalCount || 0;
        setLocalFields(items);
        setTotalCount(total);
        initialLoadDone.current = true;
      })
      .catch(() => {})
      .finally(() => { isLoadingRef.current = false; });
  }, [dispatch, isOffline]);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const copyToClipboard = (text) => {
    showSnackbar(`Copied: ${text}`);
  };

  // Custom Field Card
  const renderFieldCard = ({ item }) => {
    const fieldName = item.name || 'Unnamed Field';
    const fieldKey = item.key || '';
    const description = item.description || '';
    const hasDescription = description.trim().length > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => fieldKey && copyToClipboard(fieldKey)}
        style={styles.fieldCard}
      >
        <View style={styles.cardContent}>
          {/* Main Row: Field Name (left) | Description (right) */}
          <View style={styles.mainRow}>
            <View style={styles.leftColumn}>
              <Text style={styles.fieldName} numberOfLines={2}>{fieldName}</Text>
            </View>
            <View style={styles.rightColumn}>
              <Text
                style={[
                  styles.descriptionText,
                  !hasDescription && styles.noDescriptionText
                ]}
              >
                {hasDescription ? description : 'No description available'}
              </Text>
            </View>
          </View>

          {/* Key Row */}
          {fieldKey && (
            <View style={styles.keyRow}>
              <Icon name="key-variant" size={14} color={colors.text.tertiary} />
              <Text style={styles.keyText} numberOfLines={1}>{fieldKey}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(fieldKey)}
                activeOpacity={0.7}
              >
                <Icon name="content-copy" size={14} color={colors.primary.main} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="form-textbox" size={64} color="#009688" />
      </View>
      <Text style={styles.emptyTitle}>No custom fields</Text>
      <Text style={styles.emptySubtitle}>
        Create custom fields from the web dashboard to store additional contact information
      </Text>
    </View>
  );

  // Offline with no data
  if (isOffline && !initialLoadDone.current && localFields.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load custom fields.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  // Loading State - Initial load (skeleton instead of spinner)
  if (isInitialLoading && localFields.length === 0 && !isOffline) {
    return <CustomFieldsSkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <InfoBanner
        message="Manage custom fields from the web dashboard"
        style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 12 }}
      />

      {/* Fields List */}
      <FlatList
        data={localFields}
        renderItem={renderFieldCard}
        keyExtractor={(item, index) => item._id ? `field-${item._id}` : `field-index-${index}`}
        contentContainerStyle={styles.fieldsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />

      {snackbarVisible && (
        <View style={styles.snackbarContainer}>
          <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2000} style={styles.snackbar}>
            {snackbarMessage}
          </Snackbar>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },

  // Header Count Badge
  headerCountBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 16,
  },
  headerCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },


  // Fields List
  fieldsList: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  separator: {
    height: 12,
  },

  // Field Card
  fieldCard: {
    ...cardStyles.card,
  },
  cardContent: {
    padding: 16,
  },

  // Main Row - Two columns
  mainRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: colors.grey[100],
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: 'right',
  },
  noDescriptionText: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },

  // Key Row
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
    gap: 6,
  },
  keyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text.secondary,
  },
  copyBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: colors.primary.main + '10',
  },

  // Snackbar (top-positioned)
  snackbarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  snackbar: {
    backgroundColor: '#323232',
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

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
