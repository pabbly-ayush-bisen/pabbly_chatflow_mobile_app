import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useDrawerStatus } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { fetchChats, resetUnreadCount, resetPagination, setShouldRefreshChats } from '../redux/slices/inboxSlice';
import { getAssistants, getFlows } from '../redux/slices/assistantSlice';
import { resetUnreadCountViaSocket } from '../services/socketService';
import { useSocket } from '../contexts/SocketContext';
import { useNetwork } from '../contexts/NetworkContext';
import { colors, chatColors } from '../theme/colors';
import ChatListItem from '../components/chat/ChatListItem';
import InboxHeader from '../components/chat/InboxHeader';
import QuickAddContactSheet from '../components/contacts/QuickAddContactSheet';
import { ConversationsListSkeleton, EmptyState } from '../components/common';

export default function InboxScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isOffline, isNetworkAvailable } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);
  const [isSilentRefresh, setIsSilentRefresh] = useState(false);

  const {
    chats,
    status,
    error,
    selectedChatId,
    isLoadingMore,
    shouldRefreshChats,
  } = useSelector((state) => state.inbox);
  const { teamMemberStatus } = useSelector((state) => state.user);
  const { connectionStatus } = useSocket();

  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  // Only show loading if online and actually loading
  const isLoading = isNetworkAvailable && status === 'loading';
  // Don't show refresh indicator for silent refreshes (e.g., after creating a new contact)
  const isRefreshing = isNetworkAvailable && status === 'loading' && chats.length > 0 && !isSilentRefresh;

  // Show all chats without team member filtering
  const visibleChats = useMemo(() => {
    return chats;
  }, [chats]);

  useEffect(() => {
    // Only fetch if online and no chats loaded yet
    // This prevents re-fetching every time the screen mounts
    if (isNetworkAvailable && chats.length === 0) {
      loadChats();
    }
  }, []);

  // Fetch when network becomes available (if we haven't loaded yet)
  useEffect(() => {
    if (isNetworkAvailable && !hasLoadedOnce && chats.length === 0) {
      loadChats();
    }
  }, [isNetworkAvailable, hasLoadedOnce, chats.length]);

  // Load assistants and flows for sender name display in chat messages
  useEffect(() => {
    if (isNetworkAvailable) {
      dispatch(getAssistants({ page: 1, limit: 50, fetchAll: true }));
      dispatch(getFlows());
    }
  }, [dispatch, isNetworkAvailable]);

  // Refresh chats when shouldRefreshChats flag is set (e.g., after creating a new chat)
  // Using useEffect instead of useFocusEffect to trigger immediately when flag changes
  // This is a silent refresh - no loading indicator shown
  useEffect(() => {
    if (shouldRefreshChats && isNetworkAvailable) {
      dispatch(setShouldRefreshChats(false));
      setIsSilentRefresh(true);
      loadChats();
    }
  }, [shouldRefreshChats, isNetworkAvailable, dispatch, loadChats]);

  const loadChats = useCallback(() => {
    // Don't fetch if offline
    if (isOffline) return;

    dispatch(resetPagination());
    // Fetch ALL chats without pagination (matching web app behavior)
    // The 'all: true' param tells the API to return all chats in one request
    dispatch(fetchChats({ all: true }))
      .then(() => {
        setHasLoadedOnce(true);
        setIsSilentRefresh(false); // Reset silent refresh flag after load completes
      })
      .catch(() => {
        setIsSilentRefresh(false); // Also reset on error
      });
  }, [dispatch, isOffline]);

  const onRefresh = useCallback(() => {
    // Don't refresh if offline
    if (isOffline) return;
    loadChats();
  }, [loadChats, isOffline]);

  // Handle load more (pagination) - disabled since we now fetch all chats at once
  // Keeping this for potential future use if pagination is re-enabled
  const handleLoadMore = useCallback(() => {
    // Pagination disabled - we fetch all chats with { all: true }
    // If pagination needs to be re-enabled in the future, uncomment below:
    // if (!isLoadingMore && hasMoreChats && !isLoading) {
    //   dispatch(fetchMoreChats());
    // }
  }, []);

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

  const handleAddContact = useCallback(() => {
    setShowQuickAddContact(true);
  }, []);

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

  const renderEmptyState = () => {
    // Show skeleton while loading (not during refresh) - only if online
    if (isLoading && !isRefreshing && isNetworkAvailable) {
      return (
        <View style={styles.skeletonInListContainer}>
          <ConversationsListSkeleton count={10} />
        </View>
      );
    }

    // Show offline state if offline and no chats
    if (isOffline && chats.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="cloud-off-outline" size={80} color={colors.grey[300]} />
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            You're Offline
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Connect to the internet to load conversations.{'\n'}Previously loaded chats will appear here.
          </Text>
        </View>
      );
    }

    // Show empty state only after loading completes with no results
    return (
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
  };

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
          onAddContact={handleAddContact}
          connectionStatus={connectionStatus}
        />
        <View style={styles.skeletonContainer}>
          <ConversationsListSkeleton count={10} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InboxHeader
        onMenuPress={handleMenuPress}
        onSearchChange={handleSearchChange}
        onAddContact={handleAddContact}
        connectionStatus={connectionStatus}
      />

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

      {/* Quick Add Contact Sheet */}
      <QuickAddContactSheet
        visible={showQuickAddContact}
        onClose={() => setShowQuickAddContact(false)}
        navigation={navigation}
      />
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
  skeletonContainer: {
    flex: 1,
    backgroundColor: colors.common.white,
  },
  skeletonInListContainer: {
    flex: 1,
    backgroundColor: colors.common.white,
    paddingTop: 8,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 80,
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
