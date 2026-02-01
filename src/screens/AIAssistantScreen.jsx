import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Text, Searchbar, ActivityIndicator } from 'react-native-paper';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getAssistants, getAssistantStats, getAssistant } from '../redux/slices/assistantSlice';
import { colors } from '../theme/colors';
import { format, formatDistanceToNow } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// OpenAI Model configurations
const MODEL_CONFIG = {
  'gpt-4': { name: 'GPT-4', icon: 'brain', color: '#10A37F' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', icon: 'rocket-launch', color: '#8B5CF6' },
  'gpt-4o': { name: 'GPT-4o', icon: 'lightning-bolt', color: '#F59E0B' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', icon: 'flash', color: '#06B6D4' },
  'gpt-3.5-turbo': { name: 'GPT-3.5', icon: 'speedometer', color: '#3B82F6' },
  default: { name: 'AI Model', icon: 'robot', color: '#6366F1' },
};

// Provider configurations with icons and colors
const PROVIDER_CONFIG = {
  openai: { name: 'OpenAI', icon: 'creation', color: '#10A37F', bgColor: '#ECFDF5' },
  anthropic: { name: 'Anthropic', icon: 'alpha-a-circle', color: '#D97706', bgColor: '#FEF3C7' },
  google: { name: 'Google', icon: 'google', color: '#4285F4', bgColor: '#EFF6FF' },
  default: { name: 'AI', icon: 'robot', color: '#6366F1', bgColor: '#EEF2FF' },
};

const getProviderConfig = (provider) => {
  if (!provider) return PROVIDER_CONFIG.default;
  const lower = provider.toLowerCase();
  if (lower.includes('openai')) return PROVIDER_CONFIG.openai;
  if (lower.includes('anthropic')) return PROVIDER_CONFIG.anthropic;
  if (lower.includes('google')) return PROVIDER_CONFIG.google;
  return PROVIDER_CONFIG.default;
};

const getModelConfig = (modelName) => {
  if (!modelName) return MODEL_CONFIG.default;
  const lower = modelName.toLowerCase();
  if (lower.includes('gpt-4o-mini')) return MODEL_CONFIG['gpt-4o-mini'];
  if (lower.includes('gpt-4o')) return MODEL_CONFIG['gpt-4o'];
  if (lower.includes('gpt-4-turbo')) return MODEL_CONFIG['gpt-4-turbo'];
  if (lower.includes('gpt-4')) return MODEL_CONFIG['gpt-4'];
  if (lower.includes('gpt-3.5')) return MODEL_CONFIG['gpt-3.5-turbo'];
  return MODEL_CONFIG.default;
};

// Status configuration
const STATUS_CONFIG = {
  active: { label: 'Active', color: '#16A34A', icon: 'check-circle' },
  inactive: { label: 'Inactive', color: '#64748B', icon: 'pause-circle' },
};

// Skeleton Components
const SkeletonBox = ({ style }) => <View style={[styles.skeleton, style]} />;

const AssistantCardSkeleton = () => (
  <View style={styles.card}>
    {/* Provider Icon Skeleton */}
    <View style={styles.skeletonProviderIcon}>
      <SkeletonBox style={{ width: 48, height: 48, borderRadius: 12 }} />
    </View>
    <View style={styles.cardContent}>
      <View style={styles.cardTopRow}>
        <SkeletonBox style={{ width: 140, height: 16 }} />
        <SkeletonBox style={{ width: 65, height: 22, borderRadius: 6 }} />
      </View>
      <View style={styles.cardMiddleRow}>
        <SkeletonBox style={{ width: 95, height: 26, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 75, height: 26, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 50, height: 26, borderRadius: 6 }} />
      </View>
      <View style={styles.cardBottomRow}>
        <SkeletonBox style={{ width: 100, height: 14 }} />
        <SkeletonBox style={{ width: 90, height: 14 }} />
      </View>
      <View style={[styles.cardUpdateRow, { borderTopWidth: 0, marginTop: 4 }]}>
        <SkeletonBox style={{ width: 130, height: 12 }} />
      </View>
    </View>
  </View>
);

// Skeleton List for loading state
const SkeletonList = () => (
  <View style={{ paddingHorizontal: 0 }}>
    {[1, 2, 3, 4].map((i) => <AssistantCardSkeleton key={i} />)}
  </View>
);

export default function AIAssistantScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [detailsVisible, setDetailsVisible] = useState(false);

  const {
    assistants,
    selectedAssistant,
    assistantsStatus,
    assistantsError,
    assistantStatus,
    totalAssistants,
    activeAssistants,
    inactiveAssistants,
  } = useSelector((state) => state.assistant);

  const isLoading = assistantsStatus === 'loading';
  const isLoadingDetails = assistantStatus === 'loading';
  const isInitialLoading = isLoading && assistants.length === 0;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAssistants();
  }, [searchQuery, selectedStatus]);

  const loadData = useCallback(() => {
    dispatch(getAssistantStats());
    loadAssistants();
  }, [dispatch]);

  const loadAssistants = useCallback(() => {
    dispatch(getAssistants({
      page: 1,
      limit: 50,
      fetchAll: true,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      name: searchQuery || undefined,
    }));
  }, [dispatch, searchQuery, selectedStatus]);

  const handleAssistantPress = (assistant) => {
    dispatch(getAssistant(assistant._id));
    setDetailsVisible(true);
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return null;
    }
  };

  const formatRelativeDate = (dateString) => {
    if (!dateString) return null;
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return null;
    }
  };

  // Filter Pills Data
  const filterPills = [
    { key: 'all', label: 'All', count: totalAssistants, icon: 'robot-outline' },
    { key: 'active', label: 'Active', count: activeAssistants, icon: 'check-circle-outline' },
    { key: 'inactive', label: 'Inactive', count: inactiveAssistants, icon: 'pause-circle-outline' },
  ];

  // Filter Pill Component
  const renderFilterPill = ({ item }) => {
    const isSelected = selectedStatus === item.key;
    return (
      <TouchableOpacity
        onPress={() => setSelectedStatus(item.key)}
        activeOpacity={0.7}
        style={[styles.filterChip, isSelected && styles.filterChipActive]}
      >
        <Icon
          name={item.icon}
          size={16}
          color={isSelected ? '#FFFFFF' : colors.text.secondary}
        />
        <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
          {item.label}
        </Text>
        <View style={[styles.filterBadge, isSelected && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, isSelected && styles.filterBadgeTextActive]}>
            {item.count || 0}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Assistant Card - Modern Design with Provider Icon
  const renderCard = ({ item }) => {
    if (!item || !item._id) return null;

    const model = getModelConfig(item.modelName || item.model);
    const provider = getProviderConfig(item.modelProvider);
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.inactive;
    const createdBy = item.createdBy?.name || item.createdBy?.email || 'Unknown';
    const createdDate = formatRelativeDate(item.createdAt);
    const updatedDate = formatRelativeDate(item.updatedAt);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleAssistantPress(item)}
        activeOpacity={0.8}
      >
        {/* Provider Icon - Left Side */}
        <View style={[styles.providerIconContainer, { backgroundColor: provider.bgColor }]}>
          <Icon name={provider.icon} size={24} color={provider.color} />
        </View>

        <View style={styles.cardContent}>
          {/* Top Row: Name and Status */}
          <View style={styles.cardTopRow}>
            <Text style={styles.assistantName} numberOfLines={1}>
              {item.name || 'Unnamed Assistant'}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: statusConfig.color + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusChipText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Middle Row: Model and Provider */}
          <View style={styles.cardMiddleRow}>
            <View style={[styles.modelChip, { backgroundColor: model.color + '12' }]}>
              <Icon name={model.icon} size={14} color={model.color} />
              <Text style={[styles.modelChipText, { color: model.color }]}>
                {item.modelName || item.model || model.name}
              </Text>
            </View>
            {item.modelProvider && (
              <View style={[styles.providerChip, { backgroundColor: provider.color + '10' }]}>
                <Icon name={provider.icon} size={12} color={provider.color} />
                <Text style={[styles.providerChipText, { color: provider.color }]}>{provider.name}</Text>
              </View>
            )}
            {item.temperature !== undefined && (
              <View style={styles.tempChip}>
                <Icon name="thermometer" size={12} color={colors.text.tertiary} />
                <Text style={styles.tempChipText}>{item.temperature}</Text>
              </View>
            )}
          </View>

          {/* Bottom Row: Created By, Created At */}
          <View style={styles.cardBottomRow}>
            <View style={styles.metaInfo}>
              <Icon name="account-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.metaText} numberOfLines={1}>{createdBy}</Text>
            </View>
            {createdDate && (
              <View style={styles.metaInfo}>
                <Icon name="calendar-plus-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{createdDate}</Text>
              </View>
            )}
          </View>

          {/* Updated info on separate row if available */}
          {updatedDate && (
            <View style={styles.cardUpdateRow}>
              <Icon name="update" size={13} color={colors.text.tertiary} />
              <Text style={styles.updateText}>Updated {updatedDate}</Text>
            </View>
          )}
        </View>

        {/* Arrow indicator */}
        <View style={styles.cardArrow}>
          <Icon name="chevron-right" size={22} color={colors.grey[300]} />
        </View>
      </TouchableOpacity>
    );
  };

  // Scroll handling for bottom sheet
  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const handleScrollTo = (p) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo(p);
    }
  };

  const handleOnScroll = (event) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  // Details Bottom Sheet
  const renderDetailsBottomSheet = () => {
    if (!selectedAssistant) return null;
    const model = getModelConfig(selectedAssistant.modelName || selectedAssistant.model);
    const provider = getProviderConfig(selectedAssistant.modelProvider);
    const statusConfig = STATUS_CONFIG[selectedAssistant.status] || STATUS_CONFIG.inactive;
    const createdBy = selectedAssistant.createdBy?.name || selectedAssistant.createdBy?.email || 'Unknown';

    return (
      <Modal
        isVisible={detailsVisible}
        onBackdropPress={() => setDetailsVisible(false)}
        onSwipeComplete={() => setDetailsVisible(false)}
        swipeDirection={['down']}
        style={styles.bottomSheet}
        propagateSwipe={true}
        scrollTo={handleScrollTo}
        scrollOffset={scrollOffset}
        scrollOffsetMax={400}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.bottomSheetContainer}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {isLoadingDetails ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.sheetLoadingText}>Loading assistant details...</Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetAvatar, { backgroundColor: provider.bgColor }]}>
                  <Icon name={provider.icon} size={28} color={provider.color} />
                </View>
                <View style={styles.sheetHeaderInfo}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {selectedAssistant.name || 'Unnamed Assistant'}
                  </Text>
                  <View style={styles.sheetProviderRow}>
                    <Icon name={provider.icon} size={14} color={provider.color} />
                    <Text style={[styles.sheetProviderText, { color: provider.color }]}>
                      {provider.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailsVisible(false)}
                  style={styles.sheetCloseButton}
                >
                  <Icon name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Status Badges */}
              <View style={styles.sheetStatusRow}>
                <View style={[styles.sheetStatusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                  <Text style={[styles.sheetStatusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <View style={[styles.sheetModelBadge, { backgroundColor: model.color + '12' }]}>
                  <Icon name={model.icon} size={14} color={model.color} />
                  <Text style={[styles.sheetModelText, { color: model.color }]}>
                    {selectedAssistant.modelName || selectedAssistant.model || model.name}
                  </Text>
                </View>
                {selectedAssistant.temperature !== undefined && (
                  <View style={styles.sheetTempBadge}>
                    <Icon name="thermometer" size={14} color="#F59E0B" />
                    <Text style={styles.sheetTempText}>{selectedAssistant.temperature}</Text>
                  </View>
                )}
              </View>

              <ScrollView
                ref={scrollViewRef}
                style={styles.sheetScrollContent}
                contentContainerStyle={styles.sheetScrollContainer}
                onScroll={handleOnScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                {/* Model Configuration Section */}
                <View style={styles.sheetSection}>
                  <View style={styles.sheetSectionHeader}>
                    <Icon name="chip" size={20} color={colors.primary.main} />
                    <Text style={styles.sheetSectionTitle}>Model Configuration</Text>
                  </View>
                  <View style={styles.sheetInfoCard}>
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name="brain" size={18} color={model.color} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Model</Text>
                        <Text style={styles.sheetInfoValue}>
                          {selectedAssistant.modelName || selectedAssistant.model || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sheetInfoSeparator} />
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name={provider.icon} size={18} color={provider.color} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Provider</Text>
                        <Text style={styles.sheetInfoValue}>
                          {selectedAssistant.modelProvider || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    {selectedAssistant.temperature !== undefined && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="thermometer" size={18} color="#F59E0B" />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Temperature</Text>
                            <Text style={styles.sheetInfoValue}>{selectedAssistant.temperature}</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Instructions Section */}
                {(selectedAssistant.systemPrompt || selectedAssistant.instructionlist) && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="text-box-outline" size={20} color={colors.primary.main} />
                      <Text style={styles.sheetSectionTitle}>System Instructions</Text>
                    </View>
                    <View style={styles.sheetInstructionsCard}>
                      <Text style={styles.sheetInstructionsText} numberOfLines={8}>
                        {selectedAssistant.systemPrompt || selectedAssistant.instructionlist}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Fallback Message */}
                {selectedAssistant.fallbackMessage && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="message-alert-outline" size={20} color="#F59E0B" />
                      <Text style={styles.sheetSectionTitle}>Fallback Message</Text>
                    </View>
                    <View style={styles.sheetFallbackCard}>
                      <Text style={styles.sheetFallbackText}>
                        {selectedAssistant.fallbackMessage}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Knowledge Files */}
                {selectedAssistant.files && selectedAssistant.files.length > 0 && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeader}>
                      <Icon name="folder-open-outline" size={20} color={colors.primary.main} />
                      <Text style={styles.sheetSectionTitle}>Knowledge Base</Text>
                      <View style={styles.sheetCountBadge}>
                        <Text style={styles.sheetCountText}>{selectedAssistant.files.length}</Text>
                      </View>
                    </View>
                    <View style={styles.sheetFilesCard}>
                      {selectedAssistant.files.map((file, idx) => (
                        <View key={idx} style={styles.sheetFileItem}>
                          <Icon name="file-document-outline" size={18} color={colors.primary.main} />
                          <Text style={styles.sheetFileName} numberOfLines={1}>
                            {file.name || `File ${idx + 1}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Details Section */}
                <View style={styles.sheetSection}>
                  <View style={styles.sheetSectionHeader}>
                    <Icon name="information-outline" size={20} color={colors.primary.main} />
                    <Text style={styles.sheetSectionTitle}>Details</Text>
                  </View>
                  <View style={styles.sheetInfoCard}>
                    <View style={styles.sheetInfoRow}>
                      <View style={styles.sheetInfoIconContainer}>
                        <Icon name="account" size={18} color={colors.info.main} />
                      </View>
                      <View style={styles.sheetInfoContent}>
                        <Text style={styles.sheetInfoLabel}>Created By</Text>
                        <Text style={styles.sheetInfoValue}>{createdBy}</Text>
                      </View>
                    </View>
                    {selectedAssistant.createdAt && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="calendar-plus" size={18} color={colors.success.main} />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Created</Text>
                            <Text style={styles.sheetInfoValue}>
                              {formatDate(selectedAssistant.createdAt)}
                            </Text>
                            <Text style={styles.sheetInfoSubtext}>
                              {formatRelativeDate(selectedAssistant.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                    {selectedAssistant.updatedAt && (
                      <>
                        <View style={styles.sheetInfoSeparator} />
                        <View style={styles.sheetInfoRow}>
                          <View style={styles.sheetInfoIconContainer}>
                            <Icon name="calendar-edit" size={18} color={colors.warning.main} />
                          </View>
                          <View style={styles.sheetInfoContent}>
                            <Text style={styles.sheetInfoLabel}>Last Updated</Text>
                            <Text style={styles.sheetInfoValue}>
                              {formatDate(selectedAssistant.updatedAt)}
                            </Text>
                            <Text style={styles.sheetInfoSubtext}>
                              {formatRelativeDate(selectedAssistant.updatedAt)}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    );
  };

  // Empty State - Show skeleton when loading, otherwise show empty message
  const renderEmpty = () => {
    // Show skeleton cards when loading (filtering/searching)
    if (isLoading) {
      return <SkeletonList />;
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon name="robot-off-outline" size={64} color={colors.grey[300]} />
        </View>
        <Text style={styles.emptyTitle}>No AI Assistants</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? 'Try a different search term'
            : assistantsError
            ? `Error: ${assistantsError}`
            : 'No assistants found for the selected filter'}
        </Text>
        {assistantsError && (
          <TouchableOpacity style={styles.retryBtn} onPress={loadData} activeOpacity={0.8}>
            <Icon name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Section Header
  const renderSectionHeader = () => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {selectedStatus === 'all' ? 'All Assistants' : selectedStatus === 'active' ? 'Active Assistants' : 'Inactive Assistants'}
      </Text>
      <Text style={styles.sectionCount}>
        {assistants.length} {assistants.length === 1 ? 'assistant' : 'assistants'}
      </Text>
    </View>
  );

  // List Header Component
  const ListHeader = () => (
    <>
      {/* Search - Matching ContactsScreen */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search assistants..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filterPills}
          renderItem={renderFilterPill}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Section Header */}
      {renderSectionHeader()}
    </>
  );

  // Initial Loading State
  if (isInitialLoading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <SkeletonBox style={{ height: 48, borderRadius: 12 }} />
          </View>
          <View style={styles.filtersContainer}>
            <View style={[styles.filtersList, { flexDirection: 'row' }]}>
              <SkeletonBox style={{ width: 80, height: 36, borderRadius: 20, marginRight: 8 }} />
              <SkeletonBox style={{ width: 90, height: 36, borderRadius: 20, marginRight: 8 }} />
              <SkeletonBox style={{ width: 100, height: 36, borderRadius: 20 }} />
            </View>
          </View>
          <View style={styles.sectionHeader}>
            <SkeletonBox style={{ width: 120, height: 20 }} />
            <SkeletonBox style={{ width: 80, height: 16 }} />
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {[1, 2, 3, 4].map((i) => <AssistantCardSkeleton key={i} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Determine what to show in the list
  const showSkeletonInList = isLoading && assistants.length > 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={showSkeletonInList ? [] : assistants}
        renderItem={renderCard}
        keyExtractor={(item, index) => item?._id || `assistant-${index}`}
        contentContainerStyle={[styles.listContent, (assistants.length === 0 || showSkeletonInList) && { flex: 1 }]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={loadData}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {renderDetailsBottomSheet()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  listContent: {
    paddingBottom: 80,
    flexGrow: 1,
  },

  // Header / Search - Matching ContactsScreen
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.background.default,
  },
  searchbar: {
    backgroundColor: colors.grey[100],
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 48,
  },

  // Filter Pills - Matching TemplatesScreen
  filtersContainer: {
    backgroundColor: colors.background.default,
    paddingBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Card - Modern Design matching TemplatesScreen
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.grey[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  assistantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: 10,
    lineHeight: 20,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  modelChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.grey[50],
    gap: 4,
  },
  providerChipText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  tempChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.grey[50],
    gap: 4,
  },
  tempChipText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  cardUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  updateText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  cardArrow: {
    paddingRight: 12,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.grey[100],
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    gap: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Skeleton
  skeleton: {
    backgroundColor: colors.grey[200],
    borderRadius: 6,
  },
  skeletonProviderIcon: {
    marginLeft: 14,
    marginRight: 0,
  },

  // Bottom Sheet
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  bottomSheetContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetLoading: {
    padding: 60,
    alignItems: 'center',
  },
  sheetLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Sheet Header
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sheetProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetProviderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sheet Status Row
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  sheetStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetModelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetModelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetTempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sheetTempText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },

  // Sheet Scroll Content
  sheetScrollContent: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  sheetScrollContainer: {
    paddingBottom: 40,
  },

  // Sheet Section
  sheetSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  sheetCountBadge: {
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sheetCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Sheet Info Card
  sheetInfoCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
  },
  sheetInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sheetInfoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetInfoContent: {
    flex: 1,
    paddingTop: 2,
  },
  sheetInfoLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  sheetInfoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  sheetInfoSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  sheetInfoSeparator: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginVertical: 12,
    marginLeft: 48,
  },

  // Sheet Instructions Card
  sheetInstructionsCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  sheetInstructionsText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Sheet Fallback Card
  sheetFallbackCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  sheetFallbackText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  // Sheet Files Card
  sheetFilesCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  sheetFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  sheetFileName: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
