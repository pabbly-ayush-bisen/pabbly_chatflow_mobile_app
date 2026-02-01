import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { colors, chatColors } from '../theme/colors';
import ChatListItem from '../components/chat/ChatListItem';
import { fetchChats, setActiveFilter, clearInboxError } from '../redux/slices/inboxSlice';
import FilterChips from '../components/chat/FilterChips';
import { toastActions } from '../utils/toast';

export default function ChatsScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const initialLoadDone = useRef(false);

  // Get chats from Redux store
  const {
    chats,
    status,
    activeFilter,
    error,
  } = useSelector((state) => state.inbox);

  const isLoading = status === 'loading';

  // Load all chats on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      // Fetch all chats at once
      dispatch(fetchChats({ all: true }));
    }
  }, [dispatch]);

  // Handle errors from Redux
  useEffect(() => {
    if (error) {
      toastActions.loadFailed(error);
      dispatch(clearInboxError());
    }
  }, [error, dispatch]);

  // Filter chats based on search query
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

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const result = await dispatch(fetchChats({ all: true })).unwrap();
      if (result?.status === 'error') {
        toastActions.loadFailed(result?.message || 'Failed to refresh chats');
      }
    } catch (err) {
      toastActions.loadFailed(err?.message || 'Failed to refresh chats');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);


  // Handle chat press - navigate to chat details
  const handleChatPress = useCallback((chat) => {
    navigation.navigate('ChatDetails', {
      chatId: chat._id,
      chat,
    });
  }, [navigation]);

  // Handle filter change
  const handleFilterChange = useCallback((filter) => {
    dispatch(setActiveFilter(filter));
    dispatch(fetchChats({ all: true, filter: filter !== 'all' ? filter : undefined }));
  }, [dispatch]);

  // Render chat item
  const renderChatItem = useCallback(({ item }) => (
    <ChatListItem
      chat={item}
      onPress={handleChatPress}
    />
  ), [handleChatPress]);


  // Render empty state
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

  // Key extractor
  const keyExtractor = useCallback((item) => item._id || item.id, []);

  // Optimized item layout for fixed height items (improves scroll performance)
  // Chat item height: paddingVertical(14*2) + avatar(55) + content padding = ~83px
  const ITEM_HEIGHT = 83;
  const getItemLayout = useCallback((_data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Chats
        </Text>
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
          <Text style={styles.loadingText}>Loading chats...</Text>
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
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
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
