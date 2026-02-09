/**
 * Cache-Enhanced Thunks (Device-Primary Strategy)
 *
 * These thunks implement a "device-primary" strategy like WhatsApp where:
 * 1. Cached data is ALWAYS returned if available (no time-based expiry)
 * 2. Fresh data is fetched ONLY on explicit refresh (pull-to-refresh) or first load
 * 3. Real-time updates come via WebSocket, not polling
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { cacheManager } from '../database/CacheManager';
import { ChatModel, MessageModel } from '../database/models';
import { callApi, endpoints, httpMethods } from '../utils/axios';

/**
 * Fetch chats with device-primary strategy (like WhatsApp)
 */
export const fetchChatsWithCache = createAsyncThunk(
  'inbox/fetchChatsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false, filter, maxPages } = params;

      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cacheResult = await cacheManager.getChats({ filter });

        if (cacheResult.chats.length > 0) {
          return {
            status: 'success',
            chats: cacheResult.chats,
            data: { chats: cacheResult.chats },
            fromCache: true,
            isStale: false,
          };
        }
      }

      // Cache miss or force refresh - fetch from server
      return await fetchChatsFromServer(params);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch chats from server and cache them
 */
async function fetchChatsFromServer(params = {}) {
  const { all: fetchAll, filter, maxPages: pageLimit } = params;
  let allChats = [];
  let lastChatUpdatedAt = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = pageLimit || 50;

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
      isPartialFetch: !!(pageLimit && pageLimit < 50),
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
 * Fetch conversation messages with device-primary strategy (like WhatsApp)
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

      const settingId = cacheManager.getSettingId();

      // Check if messages are already loaded for this chat
      if (!forceRefresh && settingId) {
        const messagesLoaded = await ChatModel.areMessagesLoaded(chatId, settingId);

        if (messagesLoaded) {
          const cacheResult = await cacheManager.getMessages(chatId, {});
          const cachedChat = await cacheManager.getChatById(chatId);

          return {
            status: 'success',
            data: {
              _id: chatId,
              ...cachedChat,
              messages: cacheResult.messages,
            },
            fromCache: true,
            hasMore: false,
            messagesLoaded: true,
          };
        }

        // Check if we have any cached messages (partial load)
        const cacheResult = await cacheManager.getMessages(chatId, {});

        if (cacheResult.messages.length > 0) {
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
            messagesLoaded: false,
          };
        }
      }

      // Cache miss or force refresh - fetch ALL from server
      if (forceRefresh && settingId) {
        await ChatModel.resetMessagesLoaded(chatId, settingId);
      }

      const params = { _id: chatId, all: true };
      const response = await callApi(endpoints.inbox.getConversation, httpMethods.GET, params);

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch conversation');
      }

      const data = response.data || response;

      // Cache ALL the messages
      let cacheSaveSuccess = false;
      if (data.messages && data.messages.length > 0) {
        try {
          await cacheManager.saveMessages(data.messages, chatId);
          cacheSaveSuccess = true;

          if (settingId) {
            await ChatModel.markMessagesLoaded(chatId, settingId);
          }
        } catch (cacheError) {
          // Continue - return data from API even if cache save failed
        }
      }

      return {
        status: 'success',
        data: {
          ...data,
          _id: data._id || chatId,
        },
        fromCache: false,
        hasMore: false,
        messagesLoaded: cacheSaveSuccess,
      };
    } catch (error) {
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
        return {
          messages: cacheResult.messages,
          hasMore: cacheResult.hasMore,
          fromCache: true,
        };
      }

      // Cache miss - fetch from server
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
      // Add optimistic message to cache
      const tempId = await cacheManager.addOptimisticMessage(messageData, chatId);

      // Update chat's last message in cache
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
        await cacheManager.setSettingId(settingId);
      }

      const hasCachedData = await cacheManager.hasCachedData();
      const stats = await cacheManager.getCacheStats();

      return {
        initialized: true,
        hasCachedData,
        stats,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch quick replies with cache-first strategy
 */
export const fetchQuickRepliesWithCache = createAsyncThunk(
  'settings/fetchQuickRepliesWithCache',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cacheResult = await cacheManager.getQuickReplies();
        if (cacheResult.quickReplies.length > 0) {
          return {
            status: 'success',
            quickReplies: cacheResult.quickReplies,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from API
      const response = await callApi(
        `${endpoints.settings.getSettings}?keys=quickReplies`,
        httpMethods.GET
      );

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch quick replies');
      }

      const data = response.data || response;
      const quickReplies = data.quickReplies?.items || data.quickReplies || [];

      // Cache the results
      if (quickReplies.length > 0) {
        await cacheManager.saveQuickReplies(quickReplies);
      }

      return {
        status: 'success',
        quickReplies,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Search chats locally in SQLite by contact name/phone (instant)
 * API search (on Enter press) still available via existing searchChats thunk
 */
export const searchChatsWithCache = createAsyncThunk(
  'inbox/searchChatsWithCache',
  async ({ search }, { rejectWithValue }) => {
    try {
      if (!search?.trim()) {
        return { chats: [], search: '', fromCache: true };
      }

      const localResults = await cacheManager.searchChatsLocally(search.trim());

      return {
        chats: localResults,
        search: search.trim(),
        fromCache: true,
        hasMore: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Background sync missed messages after loading from cache
 * Fetches ALL messages from API and saves them (dedup-safe).
 * This ensures any missing messages (older or newer) are filled in.
 * Only returns messages not already in Redux for UI merge.
 */
export const syncMissedMessages = createAsyncThunk(
  'inbox/syncMissedMessages',
  async ({ chatId }, { getState, rejectWithValue }) => {
    try {
      const settingId = cacheManager.getSettingId();
      if (!settingId) return { messages: [], chatId };

      // Fetch all messages from API
      const params = { _id: chatId, all: true };
      const response = await callApi(endpoints.inbox.getConversation, httpMethods.GET, params);

      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to sync messages');
      }

      const data = response.data || response;
      const allMessages = data.messages || [];

      if (allMessages.length === 0) {
        return { chatId, messages: [], totalFromServer: 0 };
      }

      // Save ALL messages to SQLite — saveMessages() has dedup built in,
      // so existing messages get updated and only new ones are inserted
      await cacheManager.saveMessages(allMessages, chatId);

      // Mark messages as loaded for this chat
      if (settingId) {
        await ChatModel.markMessagesLoaded(chatId, settingId);
      }

      // Build set of IDs already in the current Redux conversation
      const state = getState();
      const currentMessages = state.inbox?.currentConversation?.messages || [];
      const existingIds = new Set();
      currentMessages.forEach(m => {
        if (m._id) existingIds.add(m._id);
        if (m.wamid) existingIds.add(m.wamid);
      });

      // Return only messages not already in Redux (for UI merge)
      const newForRedux = allMessages.filter(m =>
        !(m._id && existingIds.has(m._id)) &&
        !(m.wamid && existingIds.has(m.wamid))
      );

      return {
        chatId,
        messages: newForRedux,
        totalFromServer: allMessages.length,
      };
    } catch (error) {
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
  fetchQuickRepliesWithCache,
  searchChatsWithCache,
  syncMissedMessages,
};
