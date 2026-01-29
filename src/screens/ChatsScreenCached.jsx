/**
 * ChatsScreenCached - Chat List Screen with SQLite Caching
 *
 * This is an enhanced version of ChatsScreen that uses the SQLite
 * caching system for instant loading and offline support.
 *
 * Features:
 * - Instant loading from cache (< 100ms)
 * - Background refresh for fresh data
 * - Offline support
 * - Pull-to-refresh with cache invalidation
 * - Cache status indicator
 */

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text, Searchbar, Chip, Badge } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { colors, chatColors } from '../theme/colors';
import ChatListItem from '../components/chat/ChatListItem';
import { setActiveFilter, setChats } from '../redux/slices/inboxSlice';
import { fetchChatsWithCache } from '../redux/cacheThunks';
import FilterChips from '../components/chat/FilterChips';
import { useCache } from '../contexts/CacheContext';

export default function ChatsScreenCached() {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingState, setLoadingState] = useState('idle'); // 'idle' | 'cache' | 'network' | 'done'
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const initialLoadDone = useRef(false);

  // Cache context
  const { isInitialized: isCacheReady, stats } = useCache();

  // Get chats from Redux store
  const {
    chats,
    status,
    activeFilter,
  } = useSelector((state) => state.inbox);

  const isLoading = loadingState === 'cache' || loadingState === 'network';

  /**
   * Load chats with cache-first strategy
   */
  const loadChats = useCallback(async (forceRefresh = false) => {
    try {
      setLoadingState(forceRefresh ? 'network' : 'cache');

      const result = await dispatch(
        fetchChatsWithCache({
          all: true,
          forceRefresh,
          filter: activeFilter !== 'all' ? activeFilter : undefined,
        })
      ).unwrap();

      // Update Redux state with the chats
      const loadedChats = result.chats || result.data?.chats || [];
      dispatch(setChats(loadedChats));

      // Track cache state
      setIsFromCache(result.fromCache || false);
      setIsStale(result.isStale || false);

      setLoadingState('done');

      // Log:(`[ChatsScreenCached] Loaded ${loadedChats.length} chats, fromCache: ${result.fromCache}, stale: ${result.isStale}`);
    } catch (error) {
      // Error:('[ChatsScreenCached] Error loading chats:', error);
      setLoadingState('done');
    }
  }, [dispatch, activeFilter]);

  /**
   * Initial load - use cache if available
   */
  useEffect(() => {
    if (!initialLoadDone.current && isCacheReady) {
      initialLoadDone.current = true;
      loadChats(false);
    }
  }, [isCacheReady, loadChats]);

  /**
   * Filter chats based on search query
   */
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;

    const query = searchQuery.toLowerCase();
    return chats.filter((chat) => {
      const contactName = chat?.contact?.name?.toLowerCase() || '';
      const phoneNumber = chat?.contact?.phoneNumber || chat?.contact?.mobile || '';
      const lastMessageText = chat?.lastMessage?.message?.body?.toLowerCase() || '';
      return (
        contactName.includes(query) ||
        phoneNumber.includes(query) ||
        lastMessageText.includes(query)
      );
    });
  }, [chats, searchQuery]);

  /**
   * Handle pull-to-refresh - force network fetch
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadChats(true); // Force refresh from network
    setIsRefreshing(false);
  }, [loadChats]);

  /**
   * Handle chat press - navigate to chat details
   */
  const handleChatPress = useCallback((chat) => {
    navigation.navigate('ChatDetails', {
      chatId: chat._id,
      chat,
    });
  }, [navigation]);

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((filter) => {
    dispatch(setActiveFilter(filter));
    // Reset initial load to trigger reload with new filter
    initialLoadDone.current = false;
  }, [dispatch]);

  /**
   * Reload when filter changes
   */
  useEffect(() => {
    if (isCacheReady && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadChats(false);
    }
  }, [activeFilter, isCacheReady, loadChats]);

  /**
   * Render chat item
   */
  const renderChatItem = useCallback(({ item }) => (
    <ChatListItem
      chat={item}
      onPress={handleChatPress}
    />
  ), [handleChatPress]);

  /**
   * Render empty state
   */
  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {searchQuery.trim() ? 'No chats found' : 'No conversations yet'}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery]);

  /**
   * Render cache indicator
   */
  const renderCacheIndicator = () => {
    if (!isFromCache && loadingState === 'done') return null;

    return (
      <View style={styles.cacheIndicator}>
        {isFromCache && (
          <Chip
            mode="flat"
            compact
            style={[
              styles.cacheChip,
              isStale ? styles.cacheChipStale : styles.cacheChipFresh,
            ]}
            textStyle={styles.cacheChipText}
          >
            {isStale ? '⏳ Updating...' : '⚡ Cached'}
          </Chip>
        )}
        {loadingState === 'network' && !isRefreshing && (
          <ActivityIndicator
            size="small"
            color={chatColors.primary}
            style={styles.networkIndicator}
          />
        )}
      </View>
    );
  };

  // Key extractor
  const keyExtractor = useCallback((item) => item._id || item.id, []);

  // Optimized item layout
  const ITEM_HEIGHT = 83;
  const getItemLayout = useCallback((_data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text variant="headlineMedium" style={styles.headerTitle}>
            Chats
          </Text>
          {renderCacheIndicator()}
        </View>
        <Searchbar
          placeholder="Search chats"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </View>

      {isLoading && !isRefreshing && chats.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={chatColors.primary} />
          <Text style={styles.loadingText}>
            {loadingState === 'cache' ? 'Loading from cache...' : 'Fetching chats...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={[
            styles.chatList,
            filteredChats.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[chatColors.primary]}
              tintColor={chatColors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.common.white,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheChip: {
    height: 24,
  },
  cacheChipFresh: {
    backgroundColor: '#E8F5E9',
  },
  cacheChipStale: {
    backgroundColor: '#FFF3E0',
  },
  cacheChipText: {
    fontSize: 11,
    lineHeight: 14,
  },
  networkIndicator: {
    marginLeft: 8,
  },
  searchBar: {
    backgroundColor: '#F0F2F5',
    elevation: 0,
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 15,
  },
  chatList: {
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.text.secondary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
