import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Switch,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { updateSettings, deleteSettings, silentUpdateOptInManagement } from '../../redux/slices/settingsSlice';
import { fetchOptInManagementWithCache } from '../../redux/cacheThunks';
import { fetchAllTemplates } from '../../redux/slices/templateSlice';
import { useNetwork } from '../../contexts/NetworkContext';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { cacheManager } from '../../database/CacheManager';
import { colors, chatColors } from '../../theme/colors';
import { MessagePreviewBubble } from '../../components/common';
import { getCarouselCards, getLimitedTimeOffer } from '../../components/common/MessagePreview/messagePreviewUtils';

const CHIP_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },   // Blue
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },   // Green
  { bg: '#FDF4FF', border: '#F0ABFC', text: '#A21CAF' },   // Purple
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },   // Orange
  { bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E' },   // Teal
  { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },   // Red
  { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },   // Amber
  { bg: '#F5F3FF', border: '#C4B5FD', text: '#6D28D9' },   // Violet
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },   // Emerald
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },   // Pink
];

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

const SkeletonSection = ({ accentColor }) => (
  <View style={skeletonStyles.card}>
    {/* Header */}
    <View style={skeletonStyles.cardHeader}>
      <View style={[skeletonStyles.iconBox, { backgroundColor: accentColor + '20' }]}>
        <SkeletonPulse style={{ width: 18, height: 18, borderRadius: 4 }} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonPulse style={{ width: 120, height: 14 }} />
        <SkeletonPulse style={{ width: 160, height: 10 }} />
      </View>
    </View>

    {/* Keywords */}
    <View style={skeletonStyles.sectionBlock}>
      <View style={skeletonStyles.sectionHead}>
        <SkeletonPulse style={{ width: 70, height: 12 }} />
        <SkeletonPulse style={{ width: 28, height: 20, borderRadius: 10 }} />
      </View>
      <View style={skeletonStyles.chipsRow}>
        <SkeletonPulse style={{ width: 72, height: 30, borderRadius: 16 }} />
        <SkeletonPulse style={{ width: 56, height: 30, borderRadius: 16 }} />
        <SkeletonPulse style={{ width: 84, height: 30, borderRadius: 16 }} />
      </View>
      <View style={skeletonStyles.inputRow}>
        <SkeletonPulse style={{ flex: 1, height: 40, borderRadius: 10 }} />
        <SkeletonPulse style={{ width: 40, height: 40, borderRadius: 10 }} />
      </View>
    </View>

    <View style={skeletonStyles.divider} />

    {/* Response */}
    <View style={skeletonStyles.sectionBlock}>
      <View style={skeletonStyles.sectionHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SkeletonPulse style={{ width: 95, height: 12 }} />
          <SkeletonPulse style={{ width: 50, height: 18, borderRadius: 4 }} />
        </View>
        <SkeletonPulse style={{ width: 48, height: 26, borderRadius: 14 }} />
      </View>
      <SkeletonPulse style={{ width: '100%', height: 80, borderRadius: 12 }} />
    </View>
  </View>
);

const OptInManagementSkeleton = () => (
  <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Info box */}
      <View style={skeletonStyles.infoBox}>
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 8 }} />
        <SkeletonPulse style={{ flex: 1, height: 14 }} />
      </View>

      <SkeletonSection accentColor="#16A34A" />
      <SkeletonSection accentColor="#DC2626" />
    </ScrollView>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    padding: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
});

export default function OptInManagementScreen() {
  const dispatch = useDispatch();
  const { isOffline, isNetworkAvailable } = useNetwork();

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);
  const { templates } = useSelector((state) => state.template);
  const { teamMemberStatus } = useSelector((state) => state.user);
  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  // Opt-in state
  const [optInKeywords, setOptInKeywords] = useState([]);
  const [optInKeywordInput, setOptInKeywordInput] = useState('');
  const [optInResponseEnabled, setOptInResponseEnabled] = useState(false);
  const [optInMessageType, setOptInMessageType] = useState('');
  const [optInRegularMessageType, setOptInRegularMessageType] = useState('');
  const [optInMessage, setOptInMessage] = useState('');
  const [optInFileUrl, setOptInFileUrl] = useState('');
  const [optInFileName, setOptInFileName] = useState('');
  const [optInTemplateName, setOptInTemplateName] = useState('');
  const [optInTemplateData, setOptInTemplateData] = useState(null);
  const [optInBodyParams, setOptInBodyParams] = useState({});
  const [optInHeaderParams, setOptInHeaderParams] = useState({});

  // Opt-out state
  const [optOutKeywords, setOptOutKeywords] = useState([]);
  const [optOutKeywordInput, setOptOutKeywordInput] = useState('');
  const [optOutResponseEnabled, setOptOutResponseEnabled] = useState(false);
  const [optOutMessageType, setOptOutMessageType] = useState('');
  const [optOutRegularMessageType, setOptOutRegularMessageType] = useState('');
  const [optOutMessage, setOptOutMessage] = useState('');
  const [optOutFileUrl, setOptOutFileUrl] = useState('');
  const [optOutFileName, setOptOutFileName] = useState('');
  const [optOutTemplateName, setOptOutTemplateName] = useState('');
  const [optOutTemplateData, setOptOutTemplateData] = useState(null);
  const [optOutBodyParams, setOptOutBodyParams] = useState({});
  const [optOutHeaderParams, setOptOutHeaderParams] = useState({});

  // UI state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [updatingKey, setUpdatingKey] = useState(null);

  const isLoading = getSettingsStatus === 'loading';
  const isRefreshing = getSettingsStatus === 'loading' && (optInKeywords.length > 0 || optOutKeywords.length > 0);

  useEffect(() => {
    dispatch(fetchOptInManagementWithCache());
    // Fetch all templates to get full template data
    dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
  }, [dispatch]);

  useEffect(() => {
    if (settings.optInManagement) {
      const optInMgmt = settings.optInManagement;

      if (optInMgmt.optInSettings) {
        const { response } = optInMgmt.optInSettings;
        // Only sync keywords when no add/delete is in progress — prevents partial
        // data from updateSettings/deleteSettings reducers from overwriting local state
        if (!updatingKey) {
          setOptInKeywords(optInMgmt.optInSettings.kewords || optInMgmt.optInSettings.keywords || []);
        }
        setOptInResponseEnabled(response?.enabled || false);
        setOptInMessageType(response?.messageType || '');
        setOptInRegularMessageType(response?.regularMessageType || '');
        setOptInMessage(response?.regularMessage || '');
        setOptInFileUrl(response?.headerFileURL || '');
        setOptInFileName(response?.fileName || response?.headerFileName || '');
        setOptInTemplateName(response?.templateName || '');
        setOptInBodyParams(response?.bodyParams || {});
        setOptInHeaderParams(response?.headerParams || {});
      }

      if (optInMgmt.optOutSettings) {
        const { response } = optInMgmt.optOutSettings;
        if (!updatingKey) {
          setOptOutKeywords(optInMgmt.optOutSettings.kewords || optInMgmt.optOutSettings.keywords || []);
        }
        setOptOutResponseEnabled(response?.enabled || false);
        setOptOutMessageType(response?.messageType || '');
        setOptOutRegularMessageType(response?.regularMessageType || '');
        setOptOutMessage(response?.regularMessage || '');
        setOptOutFileUrl(response?.headerFileURL || '');
        setOptOutFileName(response?.fileName || response?.headerFileName || '');
        setOptOutTemplateName(response?.templateName || '');
        setOptOutBodyParams(response?.bodyParams || {});
        setOptOutHeaderParams(response?.headerParams || {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.optInManagement]);

  // Find full template data when templates are loaded
  useEffect(() => {
    if (templates && templates.length > 0) {
      if (optInTemplateName) {
        const template = templates.find(
          (t) => t.name === optInTemplateName || t.templateName === optInTemplateName
        );
        setOptInTemplateData(template || null);
      }
      if (optOutTemplateName) {
        const template = templates.find(
          (t) => t.name === optOutTemplateName || t.templateName === optOutTemplateName
        );
        setOptOutTemplateData(template || null);
      }
    }
  }, [templates, optInTemplateName, optOutTemplateName]);

  // Network recovery — re-fetch when connectivity is restored
  useEffect(() => {
    if (isNetworkAvailable && optInKeywords.length === 0 && optOutKeywords.length === 0 && getSettingsStatus !== 'loading') {
      dispatch(fetchOptInManagementWithCache({ forceRefresh: true }));
    } else if (isNetworkAvailable && getSettingsStatus === 'failed') {
      dispatch(fetchOptInManagementWithCache({ forceRefresh: true }));
    }
  }, [isNetworkAvailable]);

  const onRefresh = useCallback(() => {
    if (isOffline) return;
    dispatch(fetchOptInManagementWithCache({ forceRefresh: true }));
  }, [dispatch, isOffline]);

  const showSnackbar = useCallback((message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  // Silent background cache sync — fetches full data from server, updates SQLite cache
  // and Redux state with the complete list (corrects any partial data from add/delete reducers)
  const syncCacheInBackground = useCallback(() => {
    callApi(`${endpoints.settings.getSettings}?keys=optInManagement`, httpMethods.GET)
      .then(async (response) => {
        if (response.status !== 'error') {
          const data = response.data || response;
          const optInManagement = data.optInManagement || {};
          await cacheManager.saveAppSetting('optInManagement', optInManagement);
          dispatch(silentUpdateOptInManagement(optInManagement));
        }
      })
      .catch(() => {});
  }, [dispatch]);

  const handleAddKeyword = async (type) => {
    const input = type === 'optIn' ? optInKeywordInput.trim() : optOutKeywordInput.trim();
    const currentKeywords = type === 'optIn' ? optInKeywords : optOutKeywords;
    const otherKeywords = type === 'optIn' ? optOutKeywords : optInKeywords;

    if (!input || isOffline) return;

    if (currentKeywords.includes(input)) {
      showSnackbar('Keyword already exists');
      return;
    }

    if (otherKeywords.includes(input)) {
      showSnackbar(`Already exists in ${type === 'optIn' ? 'opt-out' : 'opt-in'}`);
      return;
    }

    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.kewords'
      : 'optInManagement.optOutSettings.kewords';

    setUpdatingKey(key);
    try {
      await dispatch(updateSettings({ key, data: [input] })).unwrap();
      showSnackbar('Keyword added');
      type === 'optIn' ? setOptInKeywordInput('') : setOptOutKeywordInput('');
      // Add keyword to local state immediately
      const setKeywords = type === 'optIn' ? setOptInKeywords : setOptOutKeywords;
      setKeywords(prev => [...prev, input]);
      // Sync full data from server to SQLite cache + Redux (corrects partial reducer data)
      syncCacheInBackground();
    } catch (error) {
      showSnackbar(error || 'Failed to add');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleDeleteKeyword = async (type, keyword) => {
    if (isOffline) return;

    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.kewords'
      : 'optInManagement.optOutSettings.kewords';

    setUpdatingKey(`${key}-${keyword}`);
    try {
      await dispatch(deleteSettings({ key, names: [keyword] })).unwrap();
      showSnackbar('Keyword removed');
      // Remove keyword from local state after API success
      const setKeywords = type === 'optIn' ? setOptInKeywords : setOptOutKeywords;
      setKeywords(prev => prev.filter(k => k !== keyword));
      // Sync cache in background without triggering loading state
      syncCacheInBackground();
    } catch (error) {
      showSnackbar(error || 'Failed to remove');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleToggleResponse = async (type, enabled) => {
    if (isOffline) return;

    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.response.enabled'
      : 'optInManagement.optOutSettings.response.enabled';

    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        showSnackbar(`Response ${enabled ? 'enabled' : 'disabled'}`);
        type === 'optIn' ? setOptInResponseEnabled(enabled) : setOptOutResponseEnabled(enabled);
        dispatch(fetchOptInManagementWithCache({ forceRefresh: true }));
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  const renderKeywordChips = (type) => {
    const keywords = type === 'optIn' ? optInKeywords : optOutKeywords;

    if (!keywords || keywords.length === 0) {
      return (
        <View style={styles.emptyKeywords}>
          <Icon name="tag-off-outline" size={18} color={colors.grey[400]} />
          <Text style={styles.emptyKeywordsText}>No keywords added</Text>
        </View>
      );
    }

    return (
      <View style={styles.chipsWrap}>
        {keywords.map((keyword, index) => {
          const isDeleting = updatingKey?.includes(keyword);
          return (
            <View key={`${keyword}-${index}`} style={[styles.chip, { backgroundColor: CHIP_COLORS[index % CHIP_COLORS.length].bg, borderColor: CHIP_COLORS[index % CHIP_COLORS.length].border }]}>
              <Text style={[styles.chipText, { color: CHIP_COLORS[index % CHIP_COLORS.length].text }]}>{keyword}</Text>
              {!isTeamMemberLoggedIn && (
                <TouchableOpacity
                  onPress={() => handleDeleteKeyword(type, keyword)}
                  disabled={isDeleting || isOffline}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isDeleting ? (
                    <ActivityIndicator size={12} color={colors.grey[400]} />
                  ) : (
                    <Icon name="close" size={14} color={colors.grey[500]} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderKeywordInput = (type) => {
    const value = type === 'optIn' ? optInKeywordInput : optOutKeywordInput;
    const setValue = type === 'optIn' ? setOptInKeywordInput : setOptOutKeywordInput;
    const key = type === 'optIn' ? 'optInManagement.optInSettings.kewords' : 'optInManagement.optOutSettings.kewords';
    const isAdding = updatingKey === key;

    return (
      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          placeholder="Add keyword..."
          value={value}
          onChangeText={setValue}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          dense
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => handleAddKeyword(type)}
          disabled={isAdding || isOffline}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!value.trim() || isAdding || isOffline) && styles.addBtnDisabled]}
          onPress={() => handleAddKeyword(type)}
          disabled={!value.trim() || isAdding || isOffline}
        >
          {isAdding ? (
            <ActivityIndicator size={16} color="#FFF" />
          ) : (
            <Icon name="plus" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Render message preview using shared component
  const renderMessagePreview = (type) => {
    const isOptIn = type === 'optIn';
    const msgType = isOptIn ? optInMessageType : optOutMessageType;
    const regularMsgType = isOptIn ? optInRegularMessageType : optOutRegularMessageType;
    const msg = isOptIn ? optInMessage : optOutMessage;
    const fileUrlVal = isOptIn ? optInFileUrl : optOutFileUrl;
    const fileNameVal = isOptIn ? optInFileName : optOutFileName;
    const tplName = isOptIn ? optInTemplateName : optOutTemplateName;
    const enabled = isOptIn ? optInResponseEnabled : optOutResponseEnabled;
    const tplData = isOptIn ? optInTemplateData : optOutTemplateData;
    const bParams = isOptIn ? optInBodyParams : optOutBodyParams;
    const hParams = isOptIn ? optInHeaderParams : optOutHeaderParams;

    const isTemplate = msgType === 'template' && tplName;
    const carouselCards = tplData ? getCarouselCards(tplData) : [];
    const limitedTimeOffer = tplData ? getLimitedTimeOffer(tplData) : null;

    return (
      <MessagePreviewBubble
        mode={isTemplate ? 'template' : 'regular'}
        enabled={enabled}
        disabledTitle="Response Disabled"
        disabledHint="Toggle on to send auto-reply"
        disabledIcon={isOptIn ? 'account-check' : 'account-cancel'}
        disabledIconColor={isOptIn ? '#16A34A' : '#DC2626'}
        disabledIconBg={isOptIn ? '#DCFCE7' : '#FEE2E2'}
        emptyHint="Set up response in web app"
        messageType={msgType}
        // Template props
        templateData={tplData}
        templateName={tplName}
        bodyParams={bParams}
        headerParams={hParams}
        headerFileUrl={fileUrlVal}
        showActualMedia={true}
        buttonsInsideBubble={true}
        showCarousel={carouselCards.length > 0}
        showLTO={!!limitedTimeOffer}
        // Regular message props
        regularMessageType={regularMsgType || 'text'}
        message={msg}
        fileUrl={fileUrlVal}
        fileName={fileNameVal}
      />
    );
  };

  const renderSection = (type) => {
    const isOptIn = type === 'optIn';
    const keywords = isOptIn ? optInKeywords : optOutKeywords;
    const enabled = isOptIn ? optInResponseEnabled : optOutResponseEnabled;
    const toggleKey = isOptIn ? 'optInManagement.optInSettings.response.enabled' : 'optInManagement.optOutSettings.response.enabled';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, isOptIn ? styles.iconBoxGreen : styles.iconBoxRed]}>
            <Icon name={isOptIn ? 'account-check' : 'account-cancel'} size={18} color={isOptIn ? '#16A34A' : '#DC2626'} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{isOptIn ? 'Opt-In Settings' : 'Opt-Out Settings'}</Text>
            <Text style={styles.cardSubtitle}>
              {isOptIn ? 'Keywords to subscribe' : 'Keywords to unsubscribe'}
            </Text>
          </View>
        </View>

        {/* Keywords */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Keywords</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{keywords.length}</Text>
            </View>
          </View>
          {renderKeywordChips(type)}
          {renderKeywordInput(type)}
        </View>

        <View style={styles.divider} />

        {/* Response */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Auto Response</Text>
              <View style={styles.readOnlyBadge}>
                <Icon name="eye" size={10} color={colors.text.tertiary} />
                <Text style={styles.readOnlyText}>Preview</Text>
              </View>
            </View>
            {updatingKey === toggleKey ? (
              <ActivityIndicator size={16} color={colors.primary.main} />
            ) : (
              <Switch
                value={enabled}
                onValueChange={(val) => handleToggleResponse(type, val)}
                disabled={isOffline}
                trackColor={{ false: colors.grey[300], true: '#16A34A' }}
                thumbColor="#FFF"
              />
            )}
          </View>
          {renderMessagePreview(type)}
        </View>
      </View>
    );
  };

  // Offline with no cached data
  const hasNoData = optInKeywords.length === 0 && optOutKeywords.length === 0;
  if (isOffline && hasNoData && getSettingsStatus !== 'succeeded') {
    return (
      <View style={styles.container}>
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconContainer}>
            <Icon name="wifi-off" size={64} color="#DC2626" />
          </View>
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Connect to the internet to load settings.{'\n'}Previously loaded data will appear here.
          </Text>
        </View>
      </View>
    );
  }

  if (isLoading && hasNoData) {
    return <OptInManagementSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary.main]} />
        }
      >
        {/* Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoIconBox}>
            <Icon name="information-outline" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.infoText}>
            Add or remove keywords here. Message setup requires web app.
          </Text>
        </View>

        {renderSection('optIn')}
        {renderSection('optOut')}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {snackbarVisible && (
        <View style={styles.snackbarContainer}>
          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={2000}
            style={styles.snackbar}
          >
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
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
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

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 17,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxGreen: {
    backgroundColor: '#DCFCE7',
  },
  iconBoxRed: {
    backgroundColor: '#FEE2E2',
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },

  // Section
  sectionBlock: {
    padding: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  readOnlyText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: colors.primary.main + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.main,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },

  // Keywords
  emptyKeywords: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  emptyKeywordsText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    fontSize: 13,
    height: 40,
  },
  inputOutline: {
    borderRadius: 10,
    borderColor: colors.grey[200],
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.grey[300],
  },

  // Template Card
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  templateIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary.main + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIconBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  templateNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  bottomSpace: {
    height: 16,
  },
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
});
