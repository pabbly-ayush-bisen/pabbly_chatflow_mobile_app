/**
 * Cache-Enhanced Thunks
 *
 * These thunks implement a "cache-first" strategy where:
 * 1. Cached data is returned immediately (if available)
 * 2. Fresh data is fetched from the server in the background
 * 3. UI is updated when fresh data arrives
 *
 * This provides instant loading for returning users while
 * ensuring data stays up-to-date.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { cacheManager } from '../database/CacheManager';
import { callApi, endpoints, httpMethods } from '../utils/axios';

/**
 * Fetch chats with cache-first strategy
 *
 * Flow:
 * 1. Check if valid cache exists
 * 2. If cache hit: return cached data, then refresh in background
 * 3. If cache miss: fetch from server and cache result
 */
export const fetchChatsWithCache = createAsyncThunk(
  'inbox/fetchChatsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false, filter } = params;

      // Step 1: Try to get from cache first
      const cacheResult = await cacheManager.getChats({ filter });

      if (cacheResult.chats.length > 0 && !forceRefresh) {
        // Log:(`[fetchChatsWithCache] Cache hit: ${cacheResult.chats.length} chats, stale: ${cacheResult.isStale}`);

        // Return cached data immediately
        const cachedResponse = {
          status: 'success',
          chats: cacheResult.chats,
          data: { chats: cacheResult.chats },
          fromCache: true,
          isStale: cacheResult.isStale,
        };

        // If cache is stale, trigger background refresh
        if (cacheResult.isStale) {
          // Log:('[fetchChatsWithCache] Cache is stale, refreshing in background...');
          // Don't await this - let it run in background
          refreshChatsInBackground(params, dispatch).catch((err) => {
            // Error:('[fetchChatsWithCache] Background refresh failed:', err);
          });
        }

        return cachedResponse;
      }

      // Step 2: Cache miss or force refresh - fetch from server
      // Log:('[fetchChatsWithCache] Cache miss, fetching from server...');
      return await fetchChatsFromServer(params);
    } catch (error) {
      // Error:('[fetchChatsWithCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch chats from server and cache them
 */
async function fetchChatsFromServer(params = {}) {
  const { all: fetchAll, filter } = params;
  let allChats = [];
  let lastChatUpdatedAt = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 50;

  if (fetchAll === true) {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const requestParams = {};

      if (filter && filter !== 'all') {
        requestParams.filter = filter;
      }

      if (lastChatUpdatedAt) {
        requestParams.lastChatUpdatedAt = lastChatUpdatedAt;
      }

      const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, requestParams);

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch chats');
      }

      const rawChats = response.data?.chats || response.chats || response._raw?.chats || [];

      if (rawChats.length === 0) {
        hasMore = false;
        break;
      }

      allChats = [...allChats, ...rawChats];
      hasMore = response.data?.hasMoreChats || response.hasMoreChats || response._raw?.hasMoreChats || false;

      if (hasMore && rawChats.length > 0) {
        const lastChat = rawChats[rawChats.length - 1];
        lastChatUpdatedAt = lastChat.updatedAt || lastChat.lastMessageAt || lastChat.createdAt;
      }
    }

    // Deduplicate
    const uniqueChatsMap = new Map();
    allChats.forEach((chat) => {
      if (chat._id && !uniqueChatsMap.has(chat._id)) {
        uniqueChatsMap.set(chat._id, chat);
      }
    });
    const uniqueChats = Array.from(uniqueChatsMap.values());

    // Cache the results
    await cacheManager.saveChats(uniqueChats);

    return {
      status: 'success',
      chats: uniqueChats,
      data: { chats: uniqueChats },
      hasMoreChats: false,
      fromCache: false,
      isStale: false,
    };
  }

  // Single page fetch
  const requestParams = { ...params };
  delete requestParams.all;
  delete requestParams.forceRefresh;

  const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, requestParams);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch chats');
  }

  const rawChats = response.data?.chats || response.chats || response._raw?.chats || [];

  // Cache the results
  await cacheManager.saveChats(rawChats);

  return {
    ...response,
    fromCache: false,
    isStale: false,
  };
}

/**
 * Refresh chats in background without blocking UI
 */
async function refreshChatsInBackground(params, dispatch) {
  try {
    const freshData = await fetchChatsFromServer({ ...params, all: true });

    // Dispatch action to update Redux state with fresh data
    dispatch({
      type: 'inbox/fetchChatsWithCache/fulfilled',
      payload: {
        ...freshData,
        isBackgroundRefresh: true,
      },
    });

    // Log:('[refreshChatsInBackground] Background refresh completed');
  } catch (error) {
    // Error:('[refreshChatsInBackground] Error:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Fetch conversation messages with cache-first strategy
 */
export const fetchConversationWithCache = createAsyncThunk(
  'inbox/fetchConversationWithCache',
  async (arg, { rejectWithValue }) => {
    try {
      const chatId = typeof arg === 'object' ? (arg.chatId || arg._id || arg.id) : arg;
      const forceRefresh = typeof arg === 'object' && arg.forceRefresh === true;

      if (!chatId) {
        throw new Error('Chat ID is required');
      }

      // Step 1: Try to get from cache first
      if (!forceRefresh) {
        const cacheResult = await cacheManager.getMessages(chatId, { limit: 50 });

        if (cacheResult.messages.length > 0) {
          // Log:(`[fetchConversationWithCache] Cache hit: ${cacheResult.messages.length} messages`);

          // Get chat details from cache
          const cachedChat = await cacheManager.getChatById(chatId);

          return {
            status: 'success',
            data: {
              _id: chatId,
              ...cachedChat,
              messages: cacheResult.messages,
            },
            fromCache: true,
            hasMore: cacheResult.hasMore,
          };
        }
      }

      // Step 2: Cache miss - fetch from server
      // Log:('[fetchConversationWithCache] Cache miss, fetching from server...');

      const params = { _id: chatId, all: true };
      const response = await callApi(endpoints.inbox.getConversation, httpMethods.GET, params);

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch conversation');
      }

      const data = response.data || response;

      // Cache the messages
      if (data.messages && data.messages.length > 0) {
        await cacheManager.saveMessages(data.messages, chatId);
      }

      return {
        status: 'success',
        data: {
          ...data,
          _id: data._id || chatId,
        },
        fromCache: false,
        hasMore: false,
      };
    } catch (error) {
      // Error:('[fetchConversationWithCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Load more messages from cache or server
 */
export const loadMoreMessagesWithCache = createAsyncThunk(
  'inbox/loadMoreMessagesWithCache',
  async ({ chatId, currentCount, limit = 50 }, { rejectWithValue }) => {
    try {
      // Try to get from cache first
      const cacheResult = await cacheManager.getMessages(chatId, {
        limit,
        offset: currentCount,
      });

      if (cacheResult.messages.length > 0) {
        // Log:(`[loadMoreMessagesWithCache] Cache hit: ${cacheResult.messages.length} more messages`);

        return {
          messages: cacheResult.messages,
          hasMore: cacheResult.hasMore,
          fromCache: true,
        };
      }

      // Cache miss - fetch from server
      // Log:('[loadMoreMessagesWithCache] Cache miss, fetching from server...');

      const response = await callApi(endpoints.inbox.getConversation, httpMethods.GET, {
        _id: chatId,
        limit,
        skip: currentCount,
      });

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch more messages');
      }

      const data = response.data || response;
      const messages = data.messages || [];

      // Cache the new messages
      if (messages.length > 0) {
        await cacheManager.saveMessages(messages, chatId);
      }

      return {
        messages,
        hasMore: messages.length >= limit,
        fromCache: false,
      };
    } catch (error) {
      // Error:('[loadMoreMessagesWithCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Add message with optimistic update
 */
export const sendMessageWithCache = createAsyncThunk(
  'inbox/sendMessageWithCache',
  async ({ chatId, messageData }, { rejectWithValue }) => {
    try {
      // Step 1: Add optimistic message to cache
      const tempId = await cacheManager.addOptimisticMessage(messageData, chatId);

      // Step 2: Update chat's last message in cache
      await cacheManager.updateChatWithMessage(chatId, {
        ...messageData,
        _id: tempId,
        direction: 'outbound',
        timestamp: Date.now(),
      });

      return {
        tempId,
        chatId,
        message: {
          ...messageData,
          tempId,
          _id: tempId,
          status: 'pending',
          isPending: true,
          timestamp: Date.now(),
          direction: 'outbound',
          isFromMe: true,
        },
      };
    } catch (error) {
      // Error:('[sendMessageWithCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Confirm message sent (update optimistic message with server response)
 */
export const confirmMessageSent = createAsyncThunk(
  'inbox/confirmMessageSent',
  async ({ tempId, serverMessage }, { rejectWithValue }) => {
    try {
      await cacheManager.updateOptimisticMessage(tempId, serverMessage);

      return {
        tempId,
        serverMessage,
      };
    } catch (error) {
      // Error:('[confirmMessageSent] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Mark message as failed
 */
export const markMessageFailed = createAsyncThunk(
  'inbox/markMessageFailed',
  async ({ tempId, error }, { rejectWithValue }) => {
    try {
      await cacheManager.markMessageFailed(tempId, error);

      return {
        tempId,
        error,
      };
    } catch (error) {
      // Error:('[markMessageFailed] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Update message status in cache
 */
export const updateMessageStatusInCache = createAsyncThunk(
  'inbox/updateMessageStatusInCache',
  async ({ messageId, updates }, { rejectWithValue }) => {
    try {
      await cacheManager.updateMessageStatus(messageId, updates);

      return {
        messageId,
        updates,
      };
    } catch (error) {
      // Error:('[updateMessageStatusInCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Handle new message from socket - add to cache
 */
export const handleNewMessageCache = createAsyncThunk(
  'inbox/handleNewMessageCache',
  async ({ chatId, message, chatData }, { rejectWithValue }) => {
    try {
      // Add message to cache
      await cacheManager.addMessage(message, chatId);

      // Update chat in cache
      if (chatData) {
        await cacheManager.updateChat(chatData);
      } else {
        await cacheManager.updateChatWithMessage(chatId, message);
      }

      return {
        chatId,
        message,
      };
    } catch (error) {
      // Error:('[handleNewMessageCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Reset unread count in cache
 */
export const resetUnreadCountInCache = createAsyncThunk(
  'inbox/resetUnreadCountInCache',
  async (chatId, { rejectWithValue }) => {
    try {
      await cacheManager.resetUnreadCount(chatId);

      return { chatId };
    } catch (error) {
      // Error:('[resetUnreadCountInCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Clear all cache (for logout)
 */
export const clearAllCacheData = createAsyncThunk(
  'cache/clearAll',
  async (_, { rejectWithValue }) => {
    try {
      await cacheManager.clearAllCache();
      return { success: true };
    } catch (error) {
      // Error:('[clearAllCacheData] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Initialize cache for current user
 */
export const initializeCache = createAsyncThunk(
  'cache/initialize',
  async (settingId, { rejectWithValue }) => {
    try {
      await cacheManager.initialize();

      if (settingId) {
        cacheManager.setSettingId(settingId);
      }

      const hasCachedData = await cacheManager.hasCachedData();
      const stats = await cacheManager.getCacheStats();

      return {
        initialized: true,
        hasCachedData,
        stats,
      };
    } catch (error) {
      // Error:('[initializeCache] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export default {
  fetchChatsWithCache,
  fetchConversationWithCache,
  loadMoreMessagesWithCache,
  sendMessageWithCache,
  confirmMessageSent,
  markMessageFailed,
  updateMessageStatusInCache,
  handleNewMessageCache,
  resetUnreadCountInCache,
  clearAllCacheData,
  initializeCache,
};
