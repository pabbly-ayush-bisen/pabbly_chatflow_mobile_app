import { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, ActivityIndicator, Button, Surface } from 'react-native-paper';
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
import {
  accessBusinessAccount,
  checkSession,
  loginViaTeammemberAccount,
  logoutFromTeammember,
} from '../redux/slices/userSlice';
import { callApi, endpoints, httpMethods } from '../utils/axios';
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

  const { settingId, teamMemberStatus } = useSelector((state) => state.user);
  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  const isLoading = statsStatus === 'loading' || accountStatus === 'loading' || folderStatus === 'loading';
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

  // Load initial data
  useEffect(() => {
    dispatch(getDashboardStats());
    dispatch(getFolders({ sort: -1 }));
  }, [dispatch]);

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

    try {
      setTeamMembersError(null);
      setSharedAccountsError(null);
      setTeamMembersLoading(true);
      setSharedAccountsLoading(true);

      const [statsRes, sharedRes] = await Promise.all([
        callApi(endpoints.teamMember.getTeamMemberStats, httpMethods.GET),
        callApi(`${endpoints.teamMember.WANumberAccess}?skip=0&limit=10&order=-1`, httpMethods.GET),
      ]);

      if (statsRes?.success && statsRes.status !== 'error') {
        setTeamMemberStats({
          totalMembers: statsRes.data?.totalMembers || 0,
          activeMembers: statsRes.data?.activeMembers || 0,
          inactiveMembers: statsRes.data?.inactiveMembers || 0,
        });
        setTeamMembers(statsRes.data?.members || []);
      } else {
        setTeamMembersError(statsRes?.error || statsRes?.message || 'Failed to load team members');
      }

      if (sharedRes?.success && sharedRes.status !== 'error') {
        // API returns { totalCount, teamMembers } in web app; keep fallback to items for safety
        const items = sharedRes.data?.teamMembers || sharedRes.data?.items || [];
        setSharedAccounts(items);
      } else {
        setSharedAccountsError(sharedRes?.error || sharedRes?.message || 'Failed to load shared accounts');
      }
    } catch (e) {
      setTeamMembersError(e?.message || 'Failed to load team members');
      setSharedAccountsError(e?.message || 'Failed to load shared accounts');
    } finally {
      setTeamMembersLoading(false);
      setSharedAccountsLoading(false);
    }
  }, [isTeamMemberLoggedIn]);

  // Load team-member widgets only when admin user is active
  useEffect(() => {
    if (!isTeamMemberLoggedIn) {
      loadTeamMemberWidgets();
    }
  }, [isTeamMemberLoggedIn, loadTeamMemberWidgets]);

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
        console.log('[DashboardScreen] Failed to load selectedFolderId:', e);
      }
    };

    selectDefaultFolder();
    return () => {
      cancelled = true;
    };
  }, [folders, selectedFolder, dispatch, findFolderById, flattenFolders]);

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
    if (!isTeamMemberLoggedIn) {
      loadTeamMemberWidgets();
    }
  }, [dispatch, fetchWANumbers, isTeamMemberLoggedIn, loadTeamMemberWidgets]);

  const onRefresh = () => loadDashboardData();

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
      console.error('Failed to access inbox:', error);
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
      console.error('Failed to sync WhatsApp info:', error);
    } finally {
      setSyncingId(null);
    }
  };

  const handleAccessSharedAccount = async (row) => {
    const id = row?._id;
    if (!row?.email || !row?.teamMemberId || !row?.settingId) return;

    setAccessingSharedId(id || `${row?.email}-${row?.settingId}`);
    try {
      const payload = {
        email: row.email,
        teamMemberId: row.teamMemberId,
        settingId: row.settingId,
      };
      const result = await dispatch(loginViaTeammemberAccount(payload)).unwrap();
      if (result?.status === 'success') {
        // Same as web app: navigate back to dashboard and refresh session state
        await dispatch(checkSession());
        // Refresh core dashboard data only (avoid admin-only teammember endpoints in team-member mode)
        dispatch(getDashboardStats());
        dispatch(getFolders({ sort: -1 }));
        fetchWANumbers();
      }
    } catch (error) {
      console.error('Failed to access shared account:', error);
    } finally {
      setAccessingSharedId(null);
    }
  };

  const handleExitTeamMember = async () => {
    if (!isTeamMemberLoggedIn) return;
    setExitingTeamMember(true);
    try {
      await dispatch(logoutFromTeammember()).unwrap();
      await dispatch(checkSession());
      // Back to admin mode: refresh dashboard and reload team-member widgets
      dispatch(getDashboardStats());
      dispatch(getFolders({ sort: -1 }));
      fetchWANumbers();
      loadTeamMemberWidgets({ force: true });
    } catch (error) {
      console.error('Failed to logout from team member:', error);
    } finally {
      setExitingTeamMember(false);
    }
  };

  const renderTeamMembersPreview = () => {
    if (teamMembersLoading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading team members...</Text>
        </View>
      );
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
        />
      );
    }

    const preview = teamMembers.slice(0, 3);

    return (
      <View style={styles.cardList}>
        {preview.map((m, index) => (
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
                <View style={styles.memberBadgesRow}>
                  <View style={[styles.pill, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.pillText, { color: '#4F46E5' }]}>
                      {(m?.role || 'member').toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: m?.status === 'active' ? '#DCFCE7' : '#F1F5F9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: m?.status === 'active' ? '#16A34A' : '#64748B' },
                      ]}
                    >
                      {(m?.status || 'inactive').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Surface>
        ))}

        <TouchableOpacity
          style={styles.viewAllRow}
          onPress={() => navigation.navigate('MoreTab', { screen: 'TeamMember' })}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View all team members</Text>
          <Icon name="chevron-right" size={18} color={colors.primary.main} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSharedAccounts = () => {
    if (sharedAccountsLoading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading shared accounts...</Text>
        </View>
      );
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
          message="No WhatsApp number accounts are shared with you yet"
        />
      );
    }

    return (
      <View style={styles.sharedSectionContainer}>
        {/* Info card to clarify purpose */}
        <Surface style={styles.sharedInfoCard} elevation={0}>
          <View style={styles.sharedInfoRow}>
            <View style={styles.sharedInfoIconBox}>
              <Icon name="information-outline" size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sharedInfoTitle}>What is this?</Text>
              <Text style={styles.sharedInfoText}>
                These are WhatsApp inboxes shared with you. Tap “Access Now” (or tap the card) to switch into that account.
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.cardList}>
          {sharedAccounts.slice(0, 5).map((row, index) => {
            const key = row?._id || `${row?.email}-${row?.settingId}-${index}`;
            const isLoadingRow = accessingSharedId === (row?._id || `${row?.email}-${row?.settingId}`);

            const isReadOnly = row?.role === 'manager';
            const permissionLabel = isReadOnly ? 'Read Only' : 'Full Access';
            const permissionBg = isReadOnly ? '#EEF2FF' : '#DCFCE7';
            const permissionText = isReadOnly ? '#4F46E5' : '#16A34A';

            return (
              <Surface key={key} style={styles.sharedAccountCard} elevation={0}>
                <View style={styles.sharedCardStrip} />

                <View style={styles.sharedCardContent}>
                  <TouchableOpacity
                    style={styles.sharedTapArea}
                    onPress={() => handleAccessSharedAccount(row)}
                    disabled={isLoadingRow}
                    activeOpacity={0.75}
                  >
                    <View style={styles.sharedHeaderRow}>
                      <View style={styles.sharedIconBox}>
                        <Icon name="whatsapp" size={18} color="#16A34A" />
                      </View>

                      <View style={styles.sharedMeta}>
                        <Text style={styles.sharedTitle} numberOfLines={1}>
                          {row?.waNumber || 'Shared WhatsApp Number'}
                        </Text>
                        <Text style={styles.sharedSubtitle} numberOfLines={1}>
                          Shared by {row?.email || '-'}
                        </Text>
                      </View>

                      <View style={[styles.sharedPermissionChip, { backgroundColor: permissionBg }]}>
                        <Text style={[styles.sharedPermissionText, { color: permissionText }]}>
                          {permissionLabel.toUpperCase()}
                        </Text>
                      </View>

                      <Icon name="chevron-right" size={18} color="#94A3B8" />
                    </View>

                    <View style={styles.sharedHintRow}>
                      <Icon name="login-variant" size={16} color={colors.text.secondary} />
                      <Text style={styles.sharedHintText}>
                        Tap to switch into this account and open its inbox.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <Button
                    mode="contained"
                    onPress={() => handleAccessSharedAccount(row)}
                    loading={isLoadingRow}
                    disabled={isLoadingRow}
                    style={styles.sharedActionBtn}
                    labelStyle={styles.sharedActionBtnLabel}
                    contentStyle={styles.sharedActionBtnContent}
                    icon={isLoadingRow ? undefined : 'login'}
                  >
                    {isLoadingRow ? 'Accessing...' : 'Access Now'}
                  </Button>
                </View>
              </Surface>
            );
          })}
        </View>
      </View>
    );
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
        ref={foldersScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.foldersContainer}
        onLayout={(e) => setFoldersViewportWidth(e.nativeEvent.layout.width)}
      >
        {allFolders.map((folder, index) => {
          const id = folder?._id;
          const isSelected = !!id && selectedFolder?._id === id;
          return (
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
                onPress={() => handleFolderSelect(folder)}
              />
            </View>
          );
        })}
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

        {/* Team Member Mode Card (top) */}
        {isTeamMemberLoggedIn && (
          <Surface style={styles.teamMemberBanner} elevation={0}>
            <View style={styles.teamMemberBannerLeft}>
              <View style={styles.teamMemberBannerIconBox}>
                <Icon name="account-badge-outline" size={18} color="#0C4A6E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamMemberBannerTitle} numberOfLines={1}>
                  Logged in as team member
                </Text>
                <Text style={styles.teamMemberBannerSubtitle} numberOfLines={1}>
                  {(teamMemberStatus?.name || teamMemberStatus?.email || '').trim()}
                  {teamMemberStatus?.role ? ` • ${String(teamMemberStatus.role).toUpperCase()}` : ''}
                </Text>
              </View>
            </View>
            <Button
              mode="outlined"
              onPress={handleExitTeamMember}
              loading={exitingTeamMember}
              disabled={exitingTeamMember}
              style={styles.teamMemberBannerBtn}
              textColor={colors.primary.main}
            >
              Exit
            </Button>
          </Surface>
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

        {/* Team-member dashboard widgets (hide while logged in as team member) */}
        {!isTeamMemberLoggedIn && (
          <>
            {/* Team Members Section (moved to bottom) */}
            <View style={styles.section}>
              <SectionHeader title="Team Members" count={teamMemberStats.totalMembers} />
              {renderTeamMembersPreview()}
            </View>

            {/* Accounts Shared With You Section (moved to bottom) */}
            <View style={styles.section}>
              <SectionHeader title="Accounts Shared With You" count={sharedAccounts.length} />
              {renderSharedAccounts()}
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Team-member account switching overlay */}
      {accessingSharedId && (
        <View style={styles.teamSwitchOverlay}>
          <View style={styles.teamSwitchCard}>
            <View style={styles.teamSwitchIconCircle}>
              <Icon name="account-switch-outline" size={32} color={colors.primary.main} />
            </View>
            <Text style={styles.teamSwitchTitle}>Switching to team member account</Text>
            <Text style={styles.teamSwitchSubtitle}>
              Please wait while we log you in and refresh your inbox.
            </Text>
            <ActivityIndicator size="large" color={colors.primary.main} style={{ marginTop: 16 }} />
          </View>
        </View>
      )}
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

  // Team member banner
  teamMemberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamMemberBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  teamMemberBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C4A6E',
  },
  teamMemberBannerSubtitle: {
    fontSize: 12,
    color: '#075985',
    marginTop: 2,
  },
  teamMemberBannerBtn: {
    borderRadius: 10,
  },

  // Team Members preview cards
  memberPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
  },
  memberPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  memberBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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

  // Shared Accounts cards
  sharedAccountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  sharedSectionContainer: {
    gap: 12,
  },
  sharedInfoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
  },
  sharedInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sharedInfoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 4,
  },
  sharedInfoText: {
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 16,
  },
  sharedCardStrip: {
    height: 4,
    backgroundColor: '#0C68E9',
  },
  sharedCardContent: {
    padding: 14,
  },
  sharedTapArea: {
    borderRadius: 14,
    padding: 2,
    marginBottom: 10,
  },
  sharedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  sharedIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedMeta: {
    flex: 1,
  },
  sharedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  sharedSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  sharedPermissionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sharedPermissionText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  sharedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sharedHintText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  sharedActionBtn: {
    borderRadius: 14,
    elevation: 0,
  },
  sharedActionBtnContent: {
    paddingVertical: 8,
  },
  sharedActionBtnLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  bottomSpace: {
    height: 20,
  },
  // Team-member account switching overlay
  teamSwitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  teamSwitchCard: {
    width: '78%',
    maxWidth: 360,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  teamSwitchIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  teamSwitchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  teamSwitchSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
