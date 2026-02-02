import { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, ActivityIndicator, Button, Surface } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import PabblyIcon from '../components/PabblyIcon';
import {
  getDashboardStats,
  getWANumbers,
  getFolders,
  setFolderFilter,
  syncWhatsAppBusinessInfo,
  clearDashboardError
} from '../redux/slices/dashboardSlice';
import {
  accessBusinessAccount,
  checkSession,
  loginViaTeammemberAccount,
  logoutFromTeammember,
} from '../redux/slices/userSlice';
import { callApi, endpoints, httpMethods } from '../utils/axios';
import { colors } from '../theme/colors';
import { clearInboxData, fetchChats } from '../redux/slices/inboxSlice';
import { useNetwork } from '../contexts/NetworkContext';

// Import reusable components
import {
  StatsCard,
  FolderPill,
  SectionHeader,
  EmptyState,
  StatsGridSkeleton,
  FoldersSkeleton,
  WhatsAppNumbersListSkeleton,
  TeamMembersListSkeleton,
  SharedAccountsListSkeleton,
  WelcomeCardSkeleton,
  DashboardSkeleton,
  SectionHeaderSkeleton,
} from '../components/common';
import { WhatsAppNumberCard } from '../components/dashboard';

export default function DashboardScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [accessingId, setAccessingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [accessingSharedId, setAccessingSharedId] = useState(null);
  const [exitingTeamMember, setExitingTeamMember] = useState(false);

  // Team members (view-only) + accounts shared with you (access now)
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);
  const [teamMembersError, setTeamMembersError] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMemberStats, setTeamMemberStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
  });

  const [sharedAccountsLoading, setSharedAccountsLoading] = useState(true);
  const [sharedAccountsError, setSharedAccountsError] = useState(null);
  const [sharedAccounts, setSharedAccounts] = useState([]);

  // Folder scroll UX: auto-scroll active folder into view
  const foldersScrollRef = useRef(null);
  const folderItemLayoutsRef = useRef({});
  const [foldersViewportWidth, setFoldersViewportWidth] = useState(0);
  const [folderLayoutTick, setFolderLayoutTick] = useState(0);

  // Expandable folders state
  const [expandedFolders, setExpandedFolders] = useState({});

  // Animation for loading overlay
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  // Start animation when switching accounts
  useEffect(() => {
    if (accessingSharedId || exitingTeamMember) {
      // Pulse animation for logo
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Sequential dots animation
      const animateDots = () => {
        Animated.sequence([
          // Dot 1
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Dot 2
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Dot 3
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Reset all
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          if (accessingSharedId || exitingTeamMember) {
            animateDots();
          }
        });
      };
      animateDots();
    } else {
      // Reset animations
      pulseAnim.setValue(1);
      dot1Anim.setValue(0.3);
      dot2Anim.setValue(0.3);
      dot3Anim.setValue(0.3);
    }
  }, [accessingSharedId, exitingTeamMember, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

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

  const { settingId, teamMemberStatus, user } = useSelector((state) => state.user);
  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  const isLoading = statsStatus === 'loading' || accountStatus === 'loading' || folderStatus === 'loading';

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Get user's full name for greeting
  const getUserFullName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) return user.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'there';
  };
  const isRefreshing = statsStatus === 'loading' && accountStatus === 'loading' && folderStatus === 'loading';

  const scrollActiveFolderIntoView = useCallback(() => {
    const id = selectedFolder?._id;
    if (!id) return;
    if (!foldersScrollRef.current) return;
    if (!foldersViewportWidth) return;

    const layout = folderItemLayoutsRef.current?.[id];
    if (!layout) return;

    const targetX = Math.max(0, layout.x - (foldersViewportWidth - layout.width) / 2);
    foldersScrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [selectedFolder, foldersViewportWidth]);

  // When selected folder changes (or layout becomes available), scroll it into view
  useEffect(() => {
    // Let layout settle first
    const t = setTimeout(() => {
      scrollActiveFolderIntoView();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedFolder?._id, foldersViewportWidth, folderLayoutTick, scrollActiveFolderIntoView]);

  // Helper: flatten folders including nested subfolders
  const flattenFolders = useCallback((folderList) => {
    const result = [];
    const flatten = (list, level = 0) => {
      (list || []).forEach((folder) => {
        result.push({ ...folder, level });
        if (folder.subfolders && folder.subfolders.length > 0) {
          flatten(folder.subfolders, level + 1);
        }
      });
    };
    flatten(folderList);
    return result;
  }, []);

  // Helper: find folder by id (supports nested)
  const findFolderById = useCallback((folderRoot, folderId) => {
    if (!folderId) return null;
    const all = [
      ...flattenFolders(folderRoot?.defaultFolders || []),
      ...flattenFolders(folderRoot?.restFolders || []),
    ];
    return all.find((f) => f?._id === folderId) || null;
  }, [flattenFolders]);

  // Load initial data (only if online)
  useEffect(() => {
    if (isNetworkAvailable) {
      dispatch(getDashboardStats());
      dispatch(getFolders({ sort: -1 }));
    }
  }, [dispatch, isNetworkAvailable]);

  const loadTeamMemberWidgets = useCallback(async ({ force = false } = {}) => {
    // When logged in as a team member, these admin endpoints are not allowed.
    // These sections are hidden in UI, so skip fetching entirely.
    if (!force && isTeamMemberLoggedIn) {
      setTeamMembersLoading(false);
      setSharedAccountsLoading(false);
      setTeamMembersError(null);
      setSharedAccountsError(null);
      return;
    }

    // Don't fetch if offline - skip silently without setting errors
    if (isOffline) {
      setTeamMembersLoading(false);
      setSharedAccountsLoading(false);
      return;
    }

    try {
      setTeamMembersError(null);
      setSharedAccountsError(null);
      setTeamMembersLoading(true);
      setSharedAccountsLoading(true);

      const [teamMembersRes, sharedRes] = await Promise.all([
        // Use settings endpoint with keys=teamMembers to get actual list (same as web frontend)
        callApi(`${endpoints.settings.getSettings}?keys=teamMembers&skip=0&limit=1000&order=-1`, httpMethods.GET),
        callApi(`${endpoints.teamMember.WANumberAccess}?skip=0&limit=1000&order=-1`, httpMethods.GET),
      ]);

      if (teamMembersRes?.success && teamMembersRes.status !== 'error') {
        // Web frontend structure: { teamMembers: { items: [...], totalCount: number } }
        const teamMembersData = teamMembersRes.data?.teamMembers || {};
        const membersList = teamMembersData?.items || teamMembersData?.teamMembers || [];
        setTeamMembers(membersList);
        setTeamMemberStats({
          totalMembers: teamMembersData?.totalCount ?? membersList.length,
          activeMembers: membersList.filter(m => m?.status === 'active').length,
          inactiveMembers: membersList.filter(m => m?.status !== 'active').length,
        });
      } else {
        setTeamMembersError(teamMembersRes?.error || teamMembersRes?.message || 'Failed to load team members');
      }

      if (sharedRes?.success && sharedRes.status !== 'error') {
        // API returns { totalCount, teamMembers } in web app; keep fallback to items for safety
        const items = sharedRes.data?.teamMembers || sharedRes.data?.items || [];
        setSharedAccounts(items);
      } else {
        setSharedAccountsError(sharedRes?.error || sharedRes?.message || 'Failed to load shared accounts');
      }
    } catch (e) {
      // Only set errors if not offline (network errors during offline mode should be silent)
      if (!isOffline) {
        setTeamMembersError(e?.message || 'Failed to load team members');
        setSharedAccountsError(e?.message || 'Failed to load shared accounts');
      }
    } finally {
      setTeamMembersLoading(false);
      setSharedAccountsLoading(false);
    }
  }, [isTeamMemberLoggedIn, isOffline]);

  // Load team-member widgets only when admin user is active and online
  useEffect(() => {
    if (!isTeamMemberLoggedIn && isNetworkAvailable) {
      loadTeamMemberWidgets();
    }
  }, [isTeamMemberLoggedIn, loadTeamMemberWidgets, isNetworkAvailable]);

  // Clear errors and re-fetch data when network becomes available
  useEffect(() => {
    if (isNetworkAvailable) {
      // Clear any existing errors (both local state and Redux)
      setTeamMembersError(null);
      setSharedAccountsError(null);
      dispatch(clearDashboardError());

      // Re-fetch data if we have errors or empty data
      if (!isTeamMemberLoggedIn && (teamMembers.length === 0 || sharedAccounts.length === 0)) {
        loadTeamMemberWidgets();
      }
    }
  }, [isNetworkAvailable, isTeamMemberLoggedIn, teamMembers.length, sharedAccounts.length, loadTeamMemberWidgets, dispatch]);

  // Set default folder when folders are loaded:
  // - Prefer the persisted folder (selectedFolderId) from "Access Inbox"
  // - Fallback to "WhatsApp Numbers"
  useEffect(() => {
    if (!folders || (!folders?.defaultFolders && !folders?.restFolders)) return;

    let cancelled = false;
    const selectDefaultFolder = async () => {
      try {
        const savedFolderId = await AsyncStorage.getItem('selectedFolderId');
        if (savedFolderId) {
          // If we already have the correct folder selected, do nothing
          if (selectedFolder?._id === savedFolderId) return;

          const matchedFolder = findFolderById(folders, savedFolderId);
          if (!cancelled && matchedFolder) {
            dispatch(setFolderFilter(matchedFolder));
            return;
          }
        } else if (selectedFolder) {
          // No persisted folder and user already selected something; keep it.
          return;
        }

        // Fallback to WhatsApp Numbers folder (existing mobile behavior)
        const allFolders = [
          ...(folders?.defaultFolders || []),
          ...(flattenFolders(folders?.restFolders || [])),
        ];
        const whatsappNumbersFolder = allFolders.find((f) => f?.name === 'WhatsApp Numbers');
        if (!cancelled && whatsappNumbersFolder) {
          dispatch(setFolderFilter(whatsappNumbersFolder));
        }
      } catch (e) {
        // If storage read fails, don't block UI; fallback selection happens via current folder list
        // Log:('[DashboardScreen] Failed to load selectedFolderId:', e);
      }
    };

    selectDefaultFolder();
    return () => {
      cancelled = true;
    };
  }, [folders, selectedFolder, dispatch, findFolderById, flattenFolders]);

  // Auto-select folder when settingId changes (e.g., after accessing a WhatsApp number)
  // This ensures the correct folder is selected for the accessed number
  useEffect(() => {
    if (!settingId || !folders) return;
    // Skip for team members - they don't have access to accessBusinessAccount endpoint
    if (isTeamMemberLoggedIn) return;

    const syncFolderWithSettingId = async () => {
      try {
        // Check if we need to fetch folder info for the current settingId
        const savedFolderId = await AsyncStorage.getItem('selectedFolderId');

        // If no folder is saved or current folder doesn't match, try to get the correct folder
        if (!savedFolderId && settingId) {
          // Fetch folder info for the current settingId
          const result = await dispatch(accessBusinessAccount(settingId)).unwrap();
          if (result?.data?._id) {
            await AsyncStorage.setItem('selectedFolderId', result.data._id);
            const matchedFolder = findFolderById(folders, result.data._id);
            if (matchedFolder) {
              dispatch(setFolderFilter(matchedFolder));
            }
          }
        }
      } catch (e) {
        // Log:('[DashboardScreen] Could not sync folder with settingId:', e);
      }
    };

    syncFolderWithSettingId();
  }, [settingId, folders, dispatch, findFolderById, isTeamMemberLoggedIn]);

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

  // Auto-access the first WhatsApp number if no settingId is set
  // This matches web app behavior where the first number is accessed by default
  useEffect(() => {
    // Skip if already have a settingId or if team member is logged in
    if (settingId || isTeamMemberLoggedIn) return;
    // Skip if WhatsApp numbers are still loading or empty
    if (accountStatus === 'loading' || whatsappNumbers.length === 0) return;

    // Find the first active WhatsApp number
    const firstActiveNumber = whatsappNumbers.find(n => n?.account?.status === 'active');
    const numberToAccess = firstActiveNumber || whatsappNumbers[0];

    if (numberToAccess?._id) {
      // Auto-access the first WhatsApp number silently (without navigation)
      dispatch(accessBusinessAccount(numberToAccess._id))
        .unwrap()
        .then(() => {
          dispatch(checkSession());
        })
        .catch(() => {
          // Silently fail - user can manually click Access Inbox
        });
    }
  }, [settingId, whatsappNumbers, accountStatus, isTeamMemberLoggedIn, dispatch]);

  const loadDashboardData = useCallback(() => {
    // Don't fetch if offline
    if (isOffline) return;

    dispatch(getDashboardStats());
    dispatch(getFolders({ sort: -1 }));
    fetchWANumbers();
    if (!isTeamMemberLoggedIn) {
      loadTeamMemberWidgets();
    }
  }, [dispatch, fetchWANumbers, isTeamMemberLoggedIn, loadTeamMemberWidgets, isOffline]);

  const onRefresh = () => {
    // Don't refresh if offline
    if (isOffline) return;
    loadDashboardData();
  };

  // Handlers - Same as web app's handleSettingId
  const handleAccessInbox = async (numberId) => {
    if (numberId === settingId) return;
    setAccessingId(numberId);
    try {
      const result = await dispatch(accessBusinessAccount(numberId)).unwrap();
      if (result.status === 'success') {
        // Ensure folder selection matches the folder of the accessed WhatsApp number
        const data = result.data || result;
        const accessedFolderId = data?._id;
        if (accessedFolderId && folders) {
          const matchedFolder = findFolderById(folders, accessedFolderId);
          if (matchedFolder) {
            dispatch(setFolderFilter(matchedFolder));
          }
        }

        // Web app calls router.refresh() which triggers checkSession
        // We do the same to update the settingId in state
        await dispatch(checkSession());
        loadDashboardData();
        // Navigate to Inbox after successful access
        navigation.navigate('InboxTab', { screen: 'InboxMain' });
      }
    } catch (error) {
      // Error:('Failed to access inbox:', error);
    } finally {
      setAccessingId(null);
    }
  };

  const handleFolderSelect = useCallback((folder) => {
    dispatch(setFolderFilter(folder));
    if (folder?._id) {
      // Persist selection so dashboard re-opens on same folder
      AsyncStorage.setItem('selectedFolderId', String(folder._id));
    }
  }, [dispatch]);

  // Sync WhatsApp Business Info handler
  const handleSyncWhatsAppInfo = async (numberId) => {
    setSyncingId(numberId);
    try {
      await dispatch(syncWhatsAppBusinessInfo(numberId)).unwrap();
    } catch (error) {
      // Error:('Failed to sync WhatsApp info:', error);
    } finally {
      setSyncingId(null);
    }
  };

  const handleAccessSharedAccount = async (row) => {
    const id = row?._id;
    if (!row?.email || !row?.teamMemberId || !row?.settingId) return;

    setAccessingSharedId(id || `${row?.email}-${row?.settingId}`);
    try {
      // Clear old inbox data immediately to prevent showing stale chats
      dispatch(clearInboxData());

      const payload = {
        email: row.email,
        teamMemberId: row.teamMemberId,
        settingId: row.settingId,
      };
      const result = await dispatch(loginViaTeammemberAccount(payload)).unwrap();
      if (result?.status === 'success') {
        // Note: Team members don't have access to accessBusinessAccount endpoint
        // The settingId is already set during loginViaTeammemberAccount
        // Folder info will be synced when the user is an admin

        // Refresh session to get updated user data
        await dispatch(checkSession());

        // Reload all dashboard data for the team member context
        await Promise.all([
          dispatch(getDashboardStats()),
          dispatch(getFolders({ sort: -1 })),
        ]);

        // Fetch WhatsApp numbers
        fetchWANumbers();

        // Fetch fresh inbox chats for the new account
        dispatch(fetchChats({ all: true }));

        // Stay on dashboard - don't redirect to inbox
      }
    } catch (error) {
      // Error:('Failed to access shared account:', error);
    } finally {
      setAccessingSharedId(null);
    }
  };

  const handleExitTeamMember = async () => {
    if (!isTeamMemberLoggedIn) return;
    setExitingTeamMember(true);
    try {
      // Clear old inbox data immediately to prevent showing stale chats
      dispatch(clearInboxData());

      await dispatch(logoutFromTeammember()).unwrap();

      // Refresh session to get updated user data (back to admin mode)
      const sessionResult = await dispatch(checkSession()).unwrap();

      // Get folder info for the admin's current settingId
      const adminSettingId = sessionResult?.data?.user?.settingId;
      if (adminSettingId) {
        try {
          const accessResult = await dispatch(accessBusinessAccount(adminSettingId)).unwrap();
          if (accessResult?.data?._id) {
            await AsyncStorage.setItem('selectedFolderId', accessResult.data._id);
          }
        } catch (accessError) {
          // Log:('Could not get folder info for admin:', accessError);
          // Clear folder selection to start fresh if we can't get folder info
          await AsyncStorage.removeItem('selectedFolderId');
        }
      } else {
        // No settingId, clear folder selection
        await AsyncStorage.removeItem('selectedFolderId');
      }

      // Reload all dashboard data for admin context
      await Promise.all([
        dispatch(getDashboardStats()),
        dispatch(getFolders({ sort: -1 })),
      ]);

      // Fetch WhatsApp numbers
      fetchWANumbers();

      // Fetch fresh inbox chats for the admin account
      dispatch(fetchChats({ all: true }));

      // Reload team member widgets (admin-only data)
      loadTeamMemberWidgets({ force: true });
    } catch (error) {
      // Error:('Failed to logout from team member:', error);
    } finally {
      setExitingTeamMember(false);
    }
  };

  const renderTeamMembersPreview = () => {
    if (teamMembersLoading) {
      return <TeamMembersListSkeleton count={3} />;
    }

    if (teamMembersError) {
      return (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{String(teamMembersError)}</Text>
        </View>
      );
    }

    if (!teamMembers || teamMembers.length === 0) {
      return (
        <EmptyState
          icon="account-group-outline"
          title="No Team Members"
          message="No team members have been added yet"
          compact
        />
      );
    }

    return (
      <View style={styles.cardList}>
        {teamMembers.map((m, index) => (
          <Surface key={m?._id || m?.email || index} style={styles.memberPreviewCard} elevation={0}>
            <View style={styles.memberPreviewRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {(m?.name || m?.email || 'U')[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberMeta}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m?.name || 'No Name'}
                </Text>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m?.email || ''}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.pillText, { color: '#4F46E5' }]}>
                  {(m?.role || 'member').toUpperCase()}
                </Text>
              </View>
            </View>
          </Surface>
        ))}
      </View>
    );
  };

  const renderSharedAccounts = () => {
    if (sharedAccountsLoading) {
      return <SharedAccountsListSkeleton count={3} />;
    }

    if (sharedAccountsError) {
      return (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{String(sharedAccountsError)}</Text>
        </View>
      );
    }

    if (!sharedAccounts || sharedAccounts.length === 0) {
      return (
        <EmptyState
          icon="account-switch-outline"
          title="No Shared Accounts"
          message="No WhatsApp accounts are shared with you yet"
          compact
        />
      );
    }

    return (
      <View style={styles.cardList}>
        {sharedAccounts.map((row, index) => {
          const key = row?._id || `${row?.email}-${row?.settingId}-${index}`;
          const isLoadingRow = accessingSharedId === (row?._id || `${row?.email}-${row?.settingId}`);
          const isReadOnly = row?.role === 'manager';

          const displayNumber = row?.waNumber || 'WhatsApp Number';
          const sharedByEmail = row?.email || 'Unknown';

          return (
            <Surface key={key} style={styles.sharedCard} elevation={0}>
              <View style={styles.sharedCardContent}>
                {/* WhatsApp Icon */}
                <View style={styles.sharedIconBox}>
                  <Icon name="whatsapp" size={20} color="#25D366" />
                </View>

                {/* Info */}
                <View style={styles.sharedInfo}>
                  <Text style={styles.sharedNumber} numberOfLines={1}>
                    {displayNumber}
                  </Text>
                  <Text style={styles.sharedBy} numberOfLines={1}>
                    {sharedByEmail}
                  </Text>
                  <View style={[
                    styles.sharedPermissionPill,
                    isReadOnly ? styles.sharedPermissionPillReadOnly : styles.sharedPermissionPillFull
                  ]}>
                    <Text style={[
                      styles.sharedPermissionPillText,
                      isReadOnly ? styles.sharedPermissionPillTextReadOnly : styles.sharedPermissionPillTextFull
                    ]}>
                      {isReadOnly ? 'VIEW ONLY' : 'FULL ACCESS'}
                    </Text>
                  </View>
                </View>

                {/* Access Now Button */}
                <TouchableOpacity
                  style={[styles.accessNowButton, isLoadingRow && styles.accessNowButtonLoading]}
                  onPress={() => handleAccessSharedAccount(row)}
                  disabled={isLoadingRow}
                  activeOpacity={0.7}
                >
                  {isLoadingRow ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.accessNowButtonText}>Access</Text>
                      <Icon name="arrow-right" size={14} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Surface>
          );
        })}

      </View>
    );
  };

  // Render: Credits Overview Stats
  const renderStats = () => {
    if (statsStatus === 'loading') {
      return <StatsGridSkeleton />;
    }

    return (
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
  };

  // Toggle folder expansion
  const handleToggleFolderExpand = useCallback((folderId) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  }, []);

  // Render folder pill with subfolders - supports deep nesting with level tracking
  const renderFolderWithSubfolders = (folder, index, level = 0) => {
    // Guard against invalid folder data
    if (!folder || !folder._id) {
      return [];
    }

    const id = folder._id;
    const isSelected = selectedFolder?._id === id;
    const isExpanded = expandedFolders[id];
    const isSubfolder = level > 0;

    // Check if folder has valid subfolders (with _id property)
    const validSubfolders = Array.isArray(folder.subfolders)
      ? folder.subfolders.filter(sf => sf && sf._id)
      : [];
    const hasSubfolders = validSubfolders.length > 0;

    const elements = [];

    // Add the parent folder pill
    elements.push(
      <View
        key={id || index}
        onLayout={(e) => {
          if (!id) return;
          const { x, width } = e.nativeEvent.layout;
          folderItemLayoutsRef.current[id] = { x, width };
          if (isSelected) setFolderLayoutTick((t) => t + 1);
        }}
      >
        <FolderPill
          folder={folder}
          isSelected={isSelected}
          isExpanded={isExpanded}
          isSubfolder={isSubfolder}
          level={level}
          onPress={() => handleFolderSelect(folder)}
          onExpandPress={handleToggleFolderExpand}
        />
      </View>
    );

    // If expanded and has valid subfolders, render them at next level
    if (isExpanded && hasSubfolders) {
      validSubfolders.forEach((subfolder, subIndex) => {
        // Recursively render subfolders at the next level
        const subElements = renderFolderWithSubfolders(
          subfolder,
          `${id}-${subIndex}`,
          level + 1
        );
        elements.push(...subElements);
      });
    }

    return elements;
  };

  // Render: Folders with horizontal pills (supports expandable nested folders)
  const renderFolders = () => {
    if (folderStatus === 'loading') {
      return <FoldersSkeleton />;
    }

    const defaultFolders = folders?.defaultFolders || [];
    const restFolders = folders?.restFolders || [];

    if (defaultFolders.length === 0 && restFolders.length === 0) return null;

    // Build folder list with expandable hierarchy
    const folderElements = [];

    // Add default folders (Home, WhatsApp Numbers, etc.) at level 0
    defaultFolders.forEach((folder, index) => {
      folderElements.push(...renderFolderWithSubfolders(folder, `default-${index}`, 0));
    });

    // Add rest folders (user-created folders with potential nesting) at level 0
    restFolders.forEach((folder, index) => {
      folderElements.push(...renderFolderWithSubfolders(folder, `rest-${index}`, 0));
    });

    return (
      <ScrollView
        ref={foldersScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.foldersContainer}
        onLayout={(e) => setFoldersViewportWidth(e.nativeEvent.layout.width)}
        nestedScrollEnabled={true}
      >
        {folderElements}
      </ScrollView>
    );
  };

  // Render: WhatsApp Numbers
  const renderWhatsAppNumbers = () => {
    if (accountStatus === 'loading') {
      return <WhatsAppNumbersListSkeleton count={3} />;
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
          compact
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

  // Loading Screen - Show skeleton instead of spinner
  if (isLoading && !isRefreshing && statsStatus !== 'succeeded') {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DashboardSkeleton />
        </ScrollView>
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
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        overScrollMode="always"
        scrollEventThrottle={16}
      >
        {/* Welcome Header */}
        {!isTeamMemberLoggedIn && (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconBox}>
              <Icon name="hand-wave" size={22} color="#F59E0B" />
            </View>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeGreeting}>{getGreeting()},</Text>
              <Text style={styles.welcomeName} numberOfLines={1}>{getUserFullName()}</Text>
            </View>
            <TouchableOpacity style={styles.welcomeQuickAction} activeOpacity={0.7}>
              <Icon name="bell-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Error Message - Don't show when offline (offline banner is already visible) */}
        {errorMessage && !isOffline && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Team Member Mode Card (top) - Beautiful Redesign */}
        {isTeamMemberLoggedIn && (
          <View style={styles.teamMemberBannerWrapper}>
            {/* Gradient-like background with accent */}
            <View style={styles.teamMemberBannerGradient}>
              {/* Decorative elements */}
              <View style={styles.teamMemberDecorCircle1} />
              <View style={styles.teamMemberDecorCircle2} />

              {/* Content */}
              <View style={styles.teamMemberBannerContent}>
                {/* Left: Avatar and Info */}
                <View style={styles.teamMemberBannerLeft}>
                  {/* Avatar with initials */}
                  <View style={styles.teamMemberAvatarContainer}>
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberAvatarText}>
                        {(teamMemberStatus?.name || teamMemberStatus?.email || 'T')[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.teamMemberAvatarBadge}>
                      <Icon name="account-switch" size={10} color="#FFFFFF" />
                    </View>
                  </View>

                  {/* Info */}
                  <View style={styles.teamMemberInfo}>
                    <View style={styles.teamMemberLabelRow}>
                      <Icon name="shield-account-outline" size={12} color="rgba(255, 255, 255, 0.9)" />
                      <Text style={styles.teamMemberLabel}>TEAM MEMBER ACCESS</Text>
                    </View>
                    <Text style={styles.teamMemberName} numberOfLines={1}>
                      {teamMemberStatus?.name || teamMemberStatus?.email?.split('@')[0] || 'Team Member'}
                    </Text>
                    <View style={styles.teamMemberMetaRow}>
                      {teamMemberStatus?.email && (
                        <Text style={styles.teamMemberEmail} numberOfLines={1}>
                          {teamMemberStatus.email}
                        </Text>
                      )}
                      {teamMemberStatus?.role && (
                        <View style={styles.teamMemberRoleBadge}>
                          <Text style={styles.teamMemberRoleText}>
                            {String(teamMemberStatus.role).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right: Exit Button */}
                <TouchableOpacity
                  style={[
                    styles.teamMemberExitBtn,
                    exitingTeamMember && styles.teamMemberExitBtnLoading,
                  ]}
                  onPress={handleExitTeamMember}
                  disabled={exitingTeamMember}
                  activeOpacity={0.8}
                >
                  {exitingTeamMember ? (
                    <ActivityIndicator size="small" color="#0EA5E9" />
                  ) : (
                    <>
                      <Icon name="logout" size={16} color="#0EA5E9" />
                      <Text style={styles.teamMemberExitText}>Exit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Credits Overview Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Credits Overview"
            icon="chart-arc"
            iconColor="#8B5CF6"
            showBadge={false}
          />
          {renderStats()}
        </View>

        {/* Folders Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Folders"
            icon="folder-outline"
            iconColor="#F59E0B"
            count={foldersCount}
          />
          {renderFolders()}
        </View>

        {/* WhatsApp Numbers Section */}
        <View style={styles.section}>
          <SectionHeader
            title="WhatsApp Numbers"
            icon="whatsapp"
            iconColor="#25D366"
            count={whatsappNumbers.length}
          />
          {renderWhatsAppNumbers()}
        </View>

        {/* Team-member dashboard widgets (hide while logged in as team member) */}
        {!isTeamMemberLoggedIn && (
          <>
            {/* Team Members Section (moved to bottom) */}
            <View style={styles.section}>
              <SectionHeader
                title="Team Members"
                icon="account-group-outline"
                iconColor="#3B82F6"
                count={teamMemberStats.totalMembers}
              />
              {renderTeamMembersPreview()}
            </View>

            {/* Accounts Shared With You Section (moved to bottom) */}
            <View style={styles.section}>
              <SectionHeader
                title="Shared With You"
                icon="share-variant-outline"
                iconColor="#EC4899"
                count={sharedAccounts.length}
              />
              {renderSharedAccounts()}
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Team-member account switching overlay with animated P logo - Full screen Modal */}
      <Modal
        visible={!!(accessingSharedId || exitingTeamMember)}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <StatusBar backgroundColor="rgba(15, 23, 42, 0.6)" barStyle="light-content" />
        <View style={styles.teamSwitchOverlayFull}>
          <View style={styles.teamSwitchCard}>
            {/* Animated P Logo */}
            <Animated.View
              style={[
                styles.teamSwitchLogoContainer,
                {
                  transform: [
                    { scale: pulseAnim },
                  ],
                },
              ]}
            >
              <PabblyIcon size={60} />
            </Animated.View>

            {/* Animated loading dots */}
            <View style={styles.loadingDotsContainer}>
              <Animated.View style={[styles.loadingDot, { opacity: dot1Anim }]} />
              <Animated.View style={[styles.loadingDot, { opacity: dot2Anim }]} />
              <Animated.View style={[styles.loadingDot, { opacity: dot3Anim }]} />
            </View>

            <Text style={styles.teamSwitchTitle}>
              {exitingTeamMember ? 'Exiting Team Member Access' : 'Switching Account'}
            </Text>
            <Text style={styles.teamSwitchSubtitle}>
              {exitingTeamMember
                ? 'Please wait while we restore your admin session...'
                : 'Please wait while we load the team member account...'}
            </Text>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
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

  // Welcome Card
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  welcomeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  welcomeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 1,
  },
  welcomeQuickAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  section: {
    marginBottom: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  cardList: {
    gap: 10,
  },

  // Team Member Banner - Vibrant Blue/Cyan Theme
  teamMemberBannerWrapper: {
    marginBottom: 20,
  },
  teamMemberBannerGradient: {
    backgroundColor: '#0EA5E9',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  teamMemberDecorCircle1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  teamMemberDecorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamMemberBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  teamMemberBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  teamMemberAvatarContainer: {
    position: 'relative',
  },
  teamMemberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  teamMemberAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  teamMemberAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  teamMemberLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
  },
  teamMemberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  teamMemberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamMemberEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    maxWidth: 140,
  },
  teamMemberRoleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  teamMemberRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  teamMemberExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamMemberExitBtnLoading: {
    opacity: 0.7,
  },
  teamMemberExitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },

  // Team Members preview cards
  memberPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  memberPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberMeta: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  memberBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  viewAllText: {
    color: colors.primary.main,
    fontWeight: '700',
  },

  // Shared Accounts - Clean design with Access button
  sharedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sharedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  sharedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedInfo: {
    flex: 1,
  },
  sharedNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  sharedBy: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  sharedPermissionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  sharedPermissionPillReadOnly: {
    backgroundColor: '#FEF3C7',
  },
  sharedPermissionPillFull: {
    backgroundColor: '#E0F2FE',
  },
  sharedPermissionPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sharedPermissionPillTextReadOnly: {
    color: '#D97706',
  },
  sharedPermissionPillTextFull: {
    color: '#0284C7',
  },
  accessNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  accessNowButtonLoading: {
    opacity: 0.7,
  },
  accessNowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  bottomSpace: {
    height: 20,
  },
  // Team-member account switching overlay with animated logo (full screen modal)
  teamSwitchOverlayFull: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamSwitchCard: {
    width: '82%',
    maxWidth: 340,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 15,
  },
  teamSwitchLogoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.main,
  },
  teamSwitchTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  teamSwitchSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
});
