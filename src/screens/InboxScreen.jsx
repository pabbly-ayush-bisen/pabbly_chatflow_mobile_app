import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useDrawerStatus } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { fetchChats, fetchMoreChats, resetUnreadCount, setActiveFilter, resetPagination } from '../redux/slices/inboxSlice';
import { resetUnreadCountViaSocket } from '../services/socketService';
import { useSocket } from '../contexts/SocketContext';
import { colors, chatColors } from '../theme/colors';
import ChatListItem from '../components/chat/ChatListItem';
import InboxHeader from '../components/chat/InboxHeader';
import FilterChips from '../components/chat/FilterChips';

export default function InboxScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    chats,
    status,
    error,
    selectedChatId,
    activeFilter,
    hasMoreChats,
    isLoadingMore
  } = useSelector((state) => state.inbox);
  const { teamMemberStatus } = useSelector((state) => state.user);
  const { connectionStatus } = useSocket();

  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  const isLoading = status === 'loading';
  const isRefreshing = status === 'loading' && chats.length > 0;

  // Base chats: when logged in as team member, only show chats assigned to this member
  const visibleChats = useMemo(() => {
    if (!isTeamMemberLoggedIn) return chats;
    const memberName = (teamMemberStatus?.name || '').trim();
    if (!memberName) return chats;
    return chats.filter((chat) => {
      const assignedName = chat?.assignedToMember?.name || '';
      return assignedName.trim() === memberName;
    });
  }, [chats, isTeamMemberLoggedIn, teamMemberStatus?.name]);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return visibleChats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
  }, [visibleChats]);

  useEffect(() => {
    loadChats();
  }, [activeFilter, isTeamMemberLoggedIn]);

  // Team-member mode: always enforce "assigned_to_me" (no team queue screen on mobile)
  useEffect(() => {
    if (isTeamMemberLoggedIn && activeFilter !== 'assigned_to_me') {
      dispatch(setActiveFilter('assigned_to_me'));
    }
  }, [dispatch, isTeamMemberLoggedIn, activeFilter]);

  const loadChats = useCallback(() => {
    dispatch(resetPagination());
    const effectiveFilter = isTeamMemberLoggedIn ? 'assigned_to_me' : activeFilter;
    const params = effectiveFilter !== 'all' ? { filter: effectiveFilter } : {};
    dispatch(fetchChats(params));
  }, [dispatch, activeFilter, isTeamMemberLoggedIn]);

  const onRefresh = useCallback(() => {
    loadChats();
  }, [loadChats]);

  // Handle filter change
  const handleFilterChange = useCallback((filter) => {
    if (isTeamMemberLoggedIn) return; // locked in team-member mode
    if (filter !== activeFilter) {
      dispatch(setActiveFilter(filter));
    }
  }, [dispatch, activeFilter, isTeamMemberLoggedIn]);

  // Handle load more (pagination)
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMoreChats && !isLoading) {
      dispatch(fetchMoreChats());
    }
  }, [dispatch, isLoadingMore, hasMoreChats, isLoading]);

  // Render footer for pagination loading
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={chatColors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  }, [isLoadingMore]);

  const handleChatPress = useCallback((chat) => {
    // Reset unread count
    if (chat.unreadCount > 0) {
      dispatch(resetUnreadCount(chat._id));
      resetUnreadCountViaSocket(chat._id);
    }

    // Navigate to chat details
    navigation.navigate('ChatDetails', { chatId: chat._id, chat });
  }, [dispatch, navigation]);

  const handleMenuPress = useCallback(() => {
    navigation.openDrawer();
  }, [navigation]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  const handleNewChat = useCallback(() => {
    // Navigate to contacts to start new chat
    navigation.navigate('ContactsTab');
  }, [navigation]);

  // Filter chats based on search
  const filteredChats = visibleChats.filter((chat) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const contactName = chat.contact?.name?.toLowerCase() || '';
    const phoneNumber = chat.contact?.phoneNumber || '';
    const lastMessage = typeof chat.lastMessage === 'string'
      ? chat.lastMessage.toLowerCase()
      : (chat.lastMessage?.message?.body || chat.lastMessage?.text || '').toLowerCase();

    return (
      contactName.includes(query) ||
      phoneNumber.includes(query) ||
      lastMessage.includes(query)
    );
  });

  const renderChatItem = useCallback(({ item }) => (
    <ChatListItem
      chat={item}
      onPress={handleChatPress}
      isSelected={selectedChatId === item._id}
    />
  ), [handleChatPress, selectedChatId]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="message-text-outline" size={80} color={colors.grey[300]} />
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No conversations
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Start a new conversation to see it here
      </Text>
      <TouchableOpacity style={styles.startChatButton} onPress={handleNewChat}>
        <Icon name="plus" size={20} color={colors.common.white} />
        <Text style={styles.startChatButtonText}>Start Chat</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Icon name="alert-circle-outline" size={48} color={colors.error.main} />
      <Text variant="bodyMedium" style={styles.errorText}>
        {typeof error === 'string' ? error : 'An error occurred'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadChats}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !isRefreshing && chats.length === 0) {
    return (
      <View style={styles.container}>
        <InboxHeader
          onMenuPress={handleMenuPress}
          onSearchChange={handleSearchChange}
          connectionStatus={connectionStatus}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={chatColors.primary} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading conversations...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InboxHeader
        onMenuPress={handleMenuPress}
        onSearchChange={handleSearchChange}
        connectionStatus={connectionStatus}
      />

      {/* Filter Chips (hidden in team-member mode) */}
      {!isTeamMemberLoggedIn && (
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          unreadCount={totalUnreadCount}
        />
      )}

      {error && !chats.length ? (
        renderError()
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContent,
            filteredChats.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[chatColors.primary]}
              tintColor={chatColors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}

      {/* Floating Action Button for new chat - WhatsApp style */}
      {!isTeamMemberLoggedIn && (
        <FAB
          icon="message-text"
          style={styles.fab}
          onPress={handleNewChat}
          color={colors.common.white}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.common.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.common.white,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.common.white,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  startChatButtonText: {
    color: colors.common.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.common.white,
  },
  errorText: {
    color: colors.error.main,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: chatColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.common.white,
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: chatColors.accent,
    borderRadius: 16,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});
