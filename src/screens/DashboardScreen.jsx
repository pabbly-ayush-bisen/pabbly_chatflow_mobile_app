import { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
  getDashboardStats,
  getWANumbers,
  getFolders,
  setFolderFilter,
  syncWhatsAppBusinessInfo
} from '../redux/slices/dashboardSlice';
import { accessBusinessAccount, checkSession } from '../redux/slices/userSlice';
import { colors } from '../theme/colors';

// Import reusable components
import {
  StatsCard,
  FolderPill,
  SectionHeader,
  EmptyState,
} from '../components/common';
import { WhatsAppNumberCard } from '../components/dashboard';

export default function DashboardScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [accessingId, setAccessingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  const {
    statsStatus,
    statsError,
    accountStatus,
    accountError,
    folderStatus,
    folderError,
    WANumberCount,
    totalQuota,
    quotaUsed,
    whatsappNumbers,
    folders,
    foldersCount,
    selectedFolder,
  } = useSelector((state) => state.dashboard);

  const { settingId } = useSelector((state) => state.user);

  const isLoading = statsStatus === 'loading' || accountStatus === 'loading' || folderStatus === 'loading';
  const isRefreshing = statsStatus === 'loading' && accountStatus === 'loading' && folderStatus === 'loading';

  // Load initial data
  useEffect(() => {
    dispatch(getDashboardStats());
    dispatch(getFolders({ sort: -1 }));
  }, [dispatch]);

  // Set default folder (WhatsApp Numbers) when folders are loaded
  useEffect(() => {
    if (!selectedFolder) {
      // First check in defaultFolders
      let whatsappNumbersFolder = folders?.defaultFolders?.find(
        folder => folder.name === 'WhatsApp Numbers'
      );
      // If not found in defaultFolders, check in restFolders
      if (!whatsappNumbersFolder && folders?.restFolders?.length) {
        whatsappNumbersFolder = folders.restFolders.find(
          folder => folder.name === 'WhatsApp Numbers'
        );
      }
      if (whatsappNumbersFolder) {
        dispatch(setFolderFilter(whatsappNumbersFolder));
      }
    }
  }, [folders, selectedFolder, dispatch]);

  // Fetch WA numbers when selected folder changes
  const fetchWANumbers = useCallback(() => {
    const params = { skip: 0, limit: 20 };
    if (selectedFolder?._id) {
      params.folderId = selectedFolder._id;
    }
    dispatch(getWANumbers(params));
  }, [dispatch, selectedFolder]);

  useEffect(() => {
    fetchWANumbers();
  }, [fetchWANumbers]);

  const loadDashboardData = useCallback(() => {
    dispatch(getDashboardStats());
    dispatch(getFolders({ sort: -1 }));
    fetchWANumbers();
  }, [dispatch, fetchWANumbers]);

  const onRefresh = () => loadDashboardData();

  // Handlers - Same as web app's handleSettingId
  const handleAccessInbox = async (numberId) => {
    if (numberId === settingId) return;
    setAccessingId(numberId);
    try {
      const result = await dispatch(accessBusinessAccount(numberId)).unwrap();
      if (result.status === 'success') {
        // Web app calls router.refresh() which triggers checkSession
        // We do the same to update the settingId in state
        await dispatch(checkSession());
        loadDashboardData();
        // Navigate to Inbox after successful access
        navigation.navigate('InboxTab', { screen: 'InboxMain' });
      }
    } catch (error) {
      console.error('Failed to access inbox:', error);
    } finally {
      setAccessingId(null);
    }
  };

  const handleFolderSelect = useCallback((folder) => {
    dispatch(setFolderFilter(folder));
  }, [dispatch]);

  // Sync WhatsApp Business Info handler
  const handleSyncWhatsAppInfo = async (numberId) => {
    setSyncingId(numberId);
    try {
      await dispatch(syncWhatsAppBusinessInfo(numberId)).unwrap();
    } catch (error) {
      console.error('Failed to sync WhatsApp info:', error);
    } finally {
      setSyncingId(null);
    }
  };

  // Render: Credits Overview Stats
  const renderStats = () => (
    <View style={styles.statsGrid}>
      <StatsCard
        title="Allotted"
        value={totalQuota}
        icon="wallet-outline"
        iconBg="#FEF3C7"
        iconColor="#D97706"
      />
      <StatsCard
        title="Consumed"
        value={quotaUsed}
        icon="chart-line"
        iconBg="#DBEAFE"
        iconColor="#2563EB"
      />
      <StatsCard
        title="Remaining"
        value={Math.max(0, totalQuota - quotaUsed)}
        icon="gift-outline"
        iconBg="#F3E8FF"
        iconColor="#9333EA"
      />
      <StatsCard
        title="Numbers"
        value={WANumberCount}
        icon="cellphone"
        iconBg="#DCFCE7"
        iconColor="#16A34A"
      />
    </View>
  );

  // Helper function to flatten folders including subfolders
  const flattenFolders = (folderList) => {
    const result = [];
    const flatten = (folders, level = 0) => {
      folders.forEach(folder => {
        result.push({ ...folder, level });
        if (folder.subfolders && folder.subfolders.length > 0) {
          flatten(folder.subfolders, level + 1);
        }
      });
    };
    flatten(folderList);
    return result;
  };

  // Render: Folders
  const renderFolders = () => {
    const defaultFolders = folders?.defaultFolders || [];
    const restFolders = folders?.restFolders || [];

    // Flatten restFolders to include subfolders
    const flattenedRestFolders = flattenFolders(restFolders);
    const allFolders = [...defaultFolders, ...flattenedRestFolders];

    // Debug: Log folder data to check itemCount
    console.log('[Folders Debug] defaultFolders:', JSON.stringify(defaultFolders.map(f => ({ name: f.name, itemCount: f.itemCount, _id: f._id })), null, 2));
    console.log('[Folders Debug] restFolders itemCounts:', JSON.stringify(flattenedRestFolders.map(f => ({ name: f.name, itemCount: f.itemCount, level: f.level })), null, 2));

    if (allFolders.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.foldersContainer}
      >
        {allFolders.map((folder, index) => (
          <FolderPill
            key={folder._id || index}
            folder={folder}
            isSelected={selectedFolder?._id === folder._id}
            onPress={() => handleFolderSelect(folder)}
          />
        ))}
      </ScrollView>
    );
  };

  // Render: WhatsApp Numbers
  const renderWhatsAppNumbers = () => {
    if (accountStatus === 'loading') {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading numbers...</Text>
        </View>
      );
    }

    if (whatsappNumbers.length === 0) {
      return (
        <EmptyState
          icon="cellphone-off"
          title="No WhatsApp Numbers"
          message={
            selectedFolder?.name === 'Trash'
              ? 'No numbers in trash'
              : 'Add your first number to get started'
          }
        />
      );
    }

    return (
      <View style={styles.cardList}>
        {whatsappNumbers.map((number, index) => (
          <WhatsAppNumberCard
            key={number._id || index}
            number={number}
            isAccessed={settingId === number._id}
            isLoading={accessingId === number._id}
            isSyncing={syncingId === number._id}
            totalQuota={totalQuota}
            onAccess={() => handleAccessInbox(number._id)}
            onSync={() => handleSyncWhatsAppInfo(number._id)}
          />
        ))}
      </View>
    );
  };

  // Loading Screen
  if (isLoading && !isRefreshing && statsStatus !== 'succeeded') {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingScreenText}>Loading Dashboard...</Text>
      </View>
    );
  }

  // Handle error which may be a string or an object with errorMessage property
  const rawError = statsError || accountError || folderError;
  const errorMessage = typeof rawError === 'object' && rawError !== null
    ? (rawError.errorMessage || rawError.message || JSON.stringify(rawError))
    : rawError;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Credits Overview Section */}
        <View style={styles.section}>
          <SectionHeader title="Credits Overview" showBadge={false} />
          {renderStats()}
        </View>

        {/* Folders Section */}
        <View style={styles.section}>
          <SectionHeader title="Folders" count={foldersCount} />
          {renderFolders()}
        </View>

        {/* WhatsApp Numbers Section */}
        <View style={styles.section}>
          <SectionHeader title="WhatsApp Numbers" count={whatsappNumbers.length} />
          {renderWhatsAppNumbers()}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  loadingScreenText: {
    fontSize: 15,
    color: colors.text.secondary,
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },

  // Section
  section: {
    marginBottom: 24,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Folders
  foldersContainer: {
    gap: 10,
    paddingVertical: 2,
  },

  // Loading & Card List
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  cardList: {
    gap: 16,
  },

  bottomSpace: {
    height: 20,
  },
});
