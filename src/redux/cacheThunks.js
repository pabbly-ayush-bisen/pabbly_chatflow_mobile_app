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
          // Return cached data immediately for instant UI
          // Then silently refresh from server in the background
          fetchChatsFromServer(params)
            .then((freshData) => {
              const freshChats = freshData.data?.chats || freshData.chats || [];
              if (freshChats.length > 0) {
                // Lazy import to avoid circular dependency (inboxSlice <-> cacheThunks)
                const { silentUpdateChats } = require('./slices/inboxSlice');
                dispatch(silentUpdateChats(freshChats));
              }
            })
            .catch(() => {
              // Silent fail - cached data is already shown
              // Clear background refreshing flag so skeleton goes away
              const { setBackgroundRefreshing } = require('./slices/inboxSlice');
              dispatch(setBackgroundRefreshing(false));
            });

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
  let retried = false;
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
      const apiHasMore = response.data?.hasMoreChats || response.hasMoreChats || response._raw?.hasMoreChats || false;

      if (rawChats.length === 0) {
        // If previous page said hasMore but this page is empty,
        // retry once with a slightly adjusted cursor (handles timestamp edge cases)
        if (hasMore && lastChatUpdatedAt && !retried) {
          const adjusted = new Date(new Date(lastChatUpdatedAt).getTime() + 1);
          lastChatUpdatedAt = adjusted.toISOString();
          retried = true;
          pageCount--; // Don't count this as a page
          continue;
        }
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

    // Cache the results (INSERT OR REPLACE — preserves chats not in this batch)
    await cacheManager.saveChats(uniqueChats);

    // Read back ALL chats from cache to include any chats the server pagination
    // missed (e.g., chats added via WebSocket that fell outside the API window).
    // This aligns with the web app pattern where IndexedDB is the source of truth.
    let finalChats = uniqueChats;
    try {
      const fullCache = await cacheManager.getChats({ filter });
      if (fullCache.chats.length > uniqueChats.length) {
        finalChats = fullCache.chats;
      }
    } catch (cacheReadError) {
      // If cache read fails, fall back to server results (non-fatal)
    }

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

// ─── Quick Replies ────────────────────────────────────────────────────────────

export const fetchQuickRepliesWithCache = createAsyncThunk(
  'settings/fetchQuickRepliesWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('quickReplies');

        if (cached) {
          // Return cached data immediately, then silently refresh Redux in background
          fetchQuickRepliesFromServer()
            .then((freshData) => {
              if (freshData) {
                // Only merge with cached paginated items if no items were deleted.
                // If totalCount decreased, items were deleted server-side — use fresh
                // data only to avoid preserving stale/deleted items in cache.
                let dataToUpdate = freshData;
                if (freshData.totalCount >= cached.items.length && cached.items.length > freshData.items.length) {
                  const freshIds = new Set(freshData.items.map(r => r._id));
                  const beyondFirstPage = cached.items.slice(freshData.items.length).filter(r => !freshIds.has(r._id));
                  dataToUpdate = { items: [...freshData.items, ...beyondFirstPage], totalCount: freshData.totalCount };
                }
                const { silentUpdateQuickReplies } = require('./slices/settingsSlice');
                dispatch(silentUpdateQuickReplies(dataToUpdate));
                cacheManager.saveAppSetting('quickReplies', dataToUpdate).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: { quickReplies: cached }, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchQuickRepliesFromServer();

      // On force refresh, save fresh data directly without merging.
      // Merging with stale cache would preserve deleted items that no longer
      // exist on the server (their IDs won't appear in the first-page freshIds,
      // so the old merge logic would keep them as "beyond first page" items).
      // Pagination will re-fetch subsequent pages on scroll.
      await cacheManager.saveAppSetting('quickReplies', freshData);
      return { data: { quickReplies: freshData }, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('quickReplies');
        if (cached) {
          return { data: { quickReplies: cached }, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch first page of quick replies from API (pure fetch, no cache operations).
 * @returns {Promise<Object>} quickReplies object { items: [], totalCount: number }
 */
async function fetchQuickRepliesFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=quickReplies&skip=0&limit=10&order=-1`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch quick replies');
  }

  const data = response.data || response;
  return data.quickReplies || { items: [], totalCount: 0 };
}

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
  async ({ chatId }, { rejectWithValue }) => {
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

      // Clean up any orphaned optimistic messages (temp_ prefixed IDs) from SQLite.
      // These are created when sending messages and may not be matched by saveMessages'
      // dedup logic since they have temp_ IDs while server messages have real IDs.
      try {
        await MessageModel.deleteOptimisticMessages(chatId, settingId);
      } catch (cleanupErr) {
        // Non-critical - duplicates will be filtered in Redux merge
      }

      // Mark messages as loaded for this chat
      if (settingId) {
        await ChatModel.markMessagesLoaded(chatId, settingId);
      }

      // Return ALL messages from API for full replacement in Redux.
      // Previously we only returned "new" messages (not in Redux), but this left
      // socket-cached messages in Redux with potentially different/incomplete data
      // compared to the API version, causing wrong sort order on re-open.
      // Full replacement ensures Redux always has authoritative API data.
      return {
        chatId,
        messages: allMessages,
        totalFromServer: allMessages.length,
        fullReplace: true,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ==========================================
// DASHBOARD CACHE THUNKS
// ==========================================

/**
 * Fetch dashboard stats with cache-first strategy.
 *
 * Cache hit → return cached stats instantly, silently refresh from API in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 *
 * Returns the same payload shape as getDashboardStats so the existing
 * fulfilled reducer works unchanged: { data: { WANumberCount, totalQuota, quotaUsed } }
 */
export const fetchDashboardStatsWithCache = createAsyncThunk(
  'dashboard/fetchDashboardStatsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;
      // Try cache first
      if (!forceRefresh) {
        const cacheResult = await cacheManager.getDashboardStats();

        if (cacheResult.data) {
          // Return cached data immediately for instant UI
          // Then silently refresh from server in the background
          fetchDashboardStatsFromServer()
            .then((freshData) => {
              if (freshData) {
                // Lazy import to avoid circular dependency (dashboardSlice <-> cacheThunks)
                const { silentUpdateDashboardStats } = require('./slices/dashboardSlice');
                dispatch(silentUpdateDashboardStats(freshData));
              }
            })
            .catch(() => {
              // Silent fail — cached data is already shown
            });

          return {
            data: cacheResult.data,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchDashboardStatsFromServer();
      return {
        data: freshData,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch dashboard stats from API and save to cache.
 * @returns {Promise<Object>} Stats object { WANumberCount, totalQuota, quotaUsed }
 */
async function fetchDashboardStatsFromServer() {
  const response = await callApi(endpoints.dashboard.getDashboardStats, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch dashboard stats');
  }

  const data = response.data || response;
  const stats = {
    WANumberCount: data.WANumberCount || 0,
    totalQuota: data.totalQuota || 0,
    quotaUsed: data.quotaUsed || 0,
  };

  // Cache the results
  await cacheManager.saveDashboardStats(stats);

  return stats;
}

/**
 * Fetch WA numbers with cache-first strategy.
 *
 * WA numbers are cached **per folder** using the app_settings table
 * (key = 'waNumbers_<folderId>'). This enables instant offline folder switching —
 * each folder the user visits while online gets its own cached list.
 *
 * Cache hit → return cached numbers for THIS folder, silently refresh in background.
 * Cache miss or forceRefresh → fetch from API, save per-folder cache, return.
 */
export const fetchWANumbersWithCache = createAsyncThunk(
  'dashboard/fetchWANumbersWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false, folderId, status } = params;

      // Per-folder cache key (each folder stores its own WA numbers list)
      const cacheKey = `waNumbers_${folderId || 'default'}`;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting(cacheKey);

        if (cached && cached.waNumbers) {
          // Silently refresh from server in background
          fetchWANumbersFromServer({ folderId, status })
            .then(async (freshNumbers) => {
              const { silentUpdateWANumbers } = require('./slices/dashboardSlice');
              dispatch(silentUpdateWANumbers({
                waNumbers: freshNumbers,
              }));
            })
            .catch(() => {});

          return {
            data: { waNumbers: cached.waNumbers },
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server with folder filter
      const waNumbers = await fetchWANumbersFromServer({ folderId, status });

      return {
        data: { waNumbers },
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch WA numbers from API and save to per-folder cache.
 * Passes folderId/status to the server for filtering (server manages folder membership).
 * Saves the response in app_settings keyed by folder ID for offline folder switching.
 * @param {Object} options - Query options
 * @param {string} [options.folderId] - Folder ID for server-side filtering
 * @param {string} [options.status] - Status filter ('active'|'inactive')
 * @returns {Promise<Array>} WA numbers from API
 */
async function fetchWANumbersFromServer({ folderId, status } = {}) {
  let url = `${endpoints.dashboard.getWANumber}?order=-1`;

  if (folderId) {
    url += `&folderId=${encodeURIComponent(folderId)}`;
  }

  if (status && status !== 'all') {
    url += `&status=${encodeURIComponent(status)}`;
  }

  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch WA numbers');
  }

  const data = response.data || response;
  const waNumbers = data.waNumbers || [];

  // Save per-folder cache (each folder gets its own entry in app_settings)
  const cacheKey = `waNumbers_${folderId || 'default'}`;
  await cacheManager.saveAppSetting(cacheKey, { waNumbers });

  return waNumbers;
}

/**
 * Fetch folders with cache-first strategy.
 *
 * Folders are a nested tree ({ defaultFolders, restFolders }) stored as a single
 * JSON blob in the app_settings table via SettingKeys.FOLDERS.
 *
 * Cache hit → return cached tree instantly, silently refresh from API in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 */
export const fetchFoldersWithCache = createAsyncThunk(
  'dashboard/fetchFoldersWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false, sort = -1 } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('folders');

        if (cached) {
          // Return cached folders instantly
          // Silently refresh from server in background
          fetchFoldersFromServer(sort)
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateFolders } = require('./slices/dashboardSlice');
                dispatch(silentUpdateFolders(freshData));
              }
            })
            .catch(() => {
              // Silent fail — cached data is already shown
            });

          return {
            data: cached,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchFoldersFromServer(sort);
      return {
        data: freshData,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch folders from API and save to cache.
 * @param {number} sort - Sort order (-1 for newest first)
 * @returns {Promise<Object>} Folders data { folders, totalCount }
 */
async function fetchFoldersFromServer(sort = -1) {
  const url = `${endpoints.dashboard.getFolders}?sort=${sort}`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch folders');
  }

  const data = response.data || response;
  const result = {
    folders: data.folders || {},
    totalCount: data.totalCount || 0,
  };

  // Cache the full folder tree as JSON blob
  await cacheManager.saveAppSetting('folders', result);

  return result;
}

/**
 * Fetch team members with cache-first strategy.
 *
 * Currently fetched via inline callApi in DashboardScreen and stored in local
 * component state. This thunk moves team members to Redux + SQLite cache
 * (app_settings table with key 'teamMembers').
 *
 * Only fetched for admin users (not team-member-logged-in sessions).
 *
 * Cache hit → return cached list instantly, silently refresh in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 */
export const fetchTeamMembersWithCache = createAsyncThunk(
  'dashboard/fetchTeamMembersWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('teamMembers');

        if (cached) {
          // Silently refresh from server in background
          fetchTeamMembersFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateTeamMembers } = require('./slices/dashboardSlice');
                dispatch(silentUpdateTeamMembers(freshData));
              }
            })
            .catch(() => {
              // Silent fail — cached data is already shown
            });

          return {
            data: cached,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchTeamMembersFromServer();
      return {
        data: freshData,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch team members from API and save to cache.
 * Uses the settings endpoint: settings?keys=teamMembers&skip=0&limit=1000&order=-1
 * @returns {Promise<Object>} { members: Array, totalCount: number }
 */
async function fetchTeamMembersFromServer() {
  const url = `${endpoints.settings.getSettings}?keys=teamMembers&skip=0&limit=1000&order=-1`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error' || !response.success) {
    throw new Error(response.message || 'Failed to fetch team members');
  }

  const teamMembersData = response.data?.teamMembers || {};
  const members = teamMembersData?.items || teamMembersData?.teamMembers || [];
  const totalCount = teamMembersData?.totalCount ?? members.length;

  const result = { members, totalCount };

  // Cache as JSON blob
  await cacheManager.saveAppSetting('teamMembers', result);

  return result;
}

/**
 * Fetch shared accounts with cache-first strategy.
 *
 * "Shared accounts" are WhatsApp numbers other users have shared access to.
 * Currently fetched via inline callApi in DashboardScreen and stored in local
 * component state. This thunk moves them to Redux + SQLite cache
 * (app_settings table with key 'sharedAccounts').
 *
 * Only fetched for admin users (not team-member-logged-in sessions).
 *
 * Cache hit → return cached list instantly, silently refresh in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 */
export const fetchSharedAccountsWithCache = createAsyncThunk(
  'dashboard/fetchSharedAccountsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('sharedAccounts');

        if (cached) {
          // Silently refresh from server in background
          fetchSharedAccountsFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateSharedAccounts } = require('./slices/dashboardSlice');
                dispatch(silentUpdateSharedAccounts(freshData));
              }
            })
            .catch(() => {});

          return {
            data: cached,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchSharedAccountsFromServer();
      return {
        data: freshData,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch shared accounts from API and save to cache.
 * Uses the team member endpoint: teammember/whatsapp-number/access?skip=0&limit=1000&order=-1
 * @returns {Promise<Object>} { accounts: Array }
 */
async function fetchSharedAccountsFromServer() {
  const url = `${endpoints.teamMember.WANumberAccess}?skip=0&limit=1000&order=-1`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error' || !response.success) {
    throw new Error(response.message || 'Failed to fetch shared accounts');
  }

  const accounts = response.data?.teamMembers || response.data?.items || [];
  const result = { accounts };

  // Cache as JSON blob
  await cacheManager.saveAppSetting('sharedAccounts', result);

  return result;
}

// ==========================================
// CONTACTS CACHE THUNKS
// ==========================================

/**
 * Fetch contacts with incremental page-by-page caching.
 *
 * Strategy:
 * - forceRefresh: Clear list cache → fetch page 1 from API → save → return
 * - search: Search cached data only (SQL LIKE) → return matches
 * - initial load (skip=0): Return ALL cached contacts. If empty, fetch page 1 from API.
 * - load more (skip>0): If skip < cachedCount → serve from cache.
 *                        If skip >= cachedCount → fetch from API → append → return.
 * - Offline + cache miss: reject (show skeleton/error).
 */
export const fetchContactsWithCache = createAsyncThunk(
  'contacts/fetchContactsWithCache',
  async (params = {}, { rejectWithValue }) => {
    try {
      const {
        forceRefresh = false,
        skip = 0,
        limit = 10,
        listName = null,
        search = null,
      } = params;

      // ── FORCE REFRESH (pull-to-refresh) ──
      // Fetch FIRST, then clear+replace cache. If API fails, old cache survives.
      if (forceRefresh) {
        let url = `${endpoints.contacts.getContacts}?skip=0&limit=${limit}`;
        if (listName) {
          url += `&list=${encodeURIComponent(listName)}`;
        }

        const response = await callApi(url, httpMethods.GET);
        if (response.status === 'error') {
          throw new Error(response.message || 'Failed to fetch contacts');
        }

        const data = response.data || response;
        const contacts = data.contacts || [];
        const totalCount = data.totalCount || 0;

        // Clear old cache ONLY after successful API response
        await cacheManager.clearContactsForList(listName);

        if (contacts.length > 0) {
          await cacheManager.saveContacts(contacts, listName, 0);
        }
        await cacheManager.saveContactsTotalCount(listName, totalCount);

        return { contacts, totalCount, fromCache: false, skip: 0 };
      }

      // ── SEARCH (cache first, then API if not found) ──
      if (search && search.trim()) {
        // Step 1: Search local cache first
        const cacheResult = await cacheManager.getContacts({
          skip,
          limit,
          search,
          listName,
        });

        if (cacheResult.contacts.length > 0) {
          return {
            contacts: cacheResult.contacts,
            totalCount: cacheResult.totalCount,
            fromCache: true,
            skip,
          };
        }

        // Step 2: Cache had no results — try API (will throw if offline)
        let url = `${endpoints.contacts.getContacts}?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search.trim())}`;
        if (listName) {
          url += `&list=${encodeURIComponent(listName)}`;
        }

        const response = await callApi(url, httpMethods.GET);
        if (response.status === 'error') {
          throw new Error(response.message || 'Failed to search contacts');
        }

        const data = response.data || response;
        const contacts = data.contacts || [];
        const totalCount = data.totalCount || 0;

        // Do NOT save search results to cache — they are transient
        return { contacts, totalCount, fromCache: false, skip };
      }

      // ── INITIAL LOAD (skip=0) ──
      if (skip === 0) {
        const cacheResult = await cacheManager.getContacts({
          skip: 0,
          listName,
        });

        if (cacheResult.fromCache && cacheResult.contacts.length > 0) {
          const storedTotal = await cacheManager.getContactsTotalCount(listName);
          return {
            contacts: cacheResult.contacts,
            totalCount: storedTotal ?? cacheResult.contacts.length,
            fromCache: true,
            skip: 0,
          };
        }

        // Cache miss — fetch first page from API
        let url = `${endpoints.contacts.getContacts}?skip=0&limit=${limit}`;
        if (listName) {
          url += `&list=${encodeURIComponent(listName)}`;
        }

        const response = await callApi(url, httpMethods.GET);
        if (response.status === 'error') {
          throw new Error(response.message || 'Failed to fetch contacts');
        }

        const data = response.data || response;
        const contacts = data.contacts || [];
        const totalCount = data.totalCount || 0;

        if (contacts.length > 0) {
          await cacheManager.saveContacts(contacts, listName, 0);
        }
        await cacheManager.saveContactsTotalCount(listName, totalCount);

        return { contacts, totalCount, fromCache: false, skip: 0 };
      }

      // ── LOAD MORE (skip > 0) ──
      const cachedCount = await cacheManager.getCachedContactCount(listName);

      if (skip < cachedCount) {
        // Enough cached data — serve from cache
        const cacheResult = await cacheManager.getContacts({
          skip,
          limit,
          listName,
        });
        const storedTotal = await cacheManager.getContactsTotalCount(listName);

        return {
          contacts: cacheResult.contacts,
          totalCount: storedTotal ?? cachedCount,
          fromCache: true,
          skip,
        };
      }

      // Need more data — fetch next page from API
      let url = `${endpoints.contacts.getContacts}?skip=${skip}&limit=${limit}`;
      if (listName) {
        url += `&list=${encodeURIComponent(listName)}`;
      }

      const response = await callApi(url, httpMethods.GET);
      if (response.status === 'error') {
        throw new Error(response.message || 'Failed to fetch contacts');
      }

      const data = response.data || response;
      const contacts = data.contacts || [];
      const totalCount = data.totalCount || 0;

      if (contacts.length > 0) {
        await cacheManager.saveContacts(contacts, listName, skip);
      }
      await cacheManager.saveContactsTotalCount(listName, totalCount);

      return { contacts, totalCount, fromCache: false, skip };
    } catch (error) {
      // Offline fallback — try to return cached data
      try {
        const fallback = await cacheManager.getContacts({
          skip: params.skip || 0,
          limit: params.limit || 10,
          search: params.search,
          listName: params.listName,
        });
        if (fallback.fromCache && fallback.contacts.length > 0) {
          const storedTotal = await cacheManager.getContactsTotalCount(
            params.listName
          );
          return {
            contacts: fallback.contacts,
            totalCount: storedTotal ?? fallback.contacts.length,
            fromCache: true,
            skip: params.skip || 0,
          };
        }
      } catch (cacheErr) {
        // Cache read also failed — fall through
      }

      // For load-more (skip > 0): return empty instead of rejecting
      // to prevent FlatList onEndReached from looping indefinitely.
      // Setting totalCount = skip tells the guard "no more data beyond this point".
      // A pull-to-refresh or re-visit will reset totalCount from API/cache.
      if ((params.skip || 0) > 0) {
        return {
          contacts: [],
          totalCount: params.skip,
          fromCache: true,
          skip: params.skip,
        };
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch contact lists with cache-first strategy.
 *
 * Contact lists are the filter chips shown on ContactsScreen (e.g., "Leads", "Customers").
 * The lists array is cached in the contact_lists table; aggregate metadata
 * (totalLists, totalContactsCount, unassignedCount) is cached in app_settings.
 *
 * Cache hit → return cached lists + metadata instantly, silently refresh from API.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 */
export const fetchContactListsWithCache = createAsyncThunk(
  'contacts/fetchContactListsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cacheResult = await cacheManager.getContactLists();
        const cachedMeta = await cacheManager.getAppSetting('contactListMeta');

        if (cacheResult.fromCache) {
          // Silently refresh from server in background
          fetchContactListsFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateContactLists } = require('./slices/contactSlice');
                dispatch(silentUpdateContactLists(freshData));
              }
            })
            .catch(() => {
              // Silent fail — cached data is already shown
            });

          // Build counts from multiple fallback sources
          const lists = cacheResult.contactLists;
          const derivedTotal = lists.reduce(
            (sum, l) => sum + (l.count ?? l.contactsCount ?? 0), 0
          );
          // contacts_total___all__ is saved by fetchContactsWithCache — most reliable
          const contactsTotal = await cacheManager.getContactsTotalCount(null);

          return {
            contactsCount: lists,
            totalLists: cachedMeta?.totalLists || lists.length,
            totalContactsCount: cachedMeta?.totalContactsCount || contactsTotal || derivedTotal || 0,
            unassignedCount: cachedMeta?.unassignedCount || 0,
            fromCache: true,
          };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchContactListsFromServer();

      return {
        ...freshData,
        fromCache: false,
      };
    } catch (error) {
      // On error (e.g., offline), try to return cached data as fallback
      try {
        const fallback = await cacheManager.getContactLists();
        const fallbackMeta = await cacheManager.getAppSetting('contactListMeta');

        if (fallback.fromCache) {
          const lists = fallback.contactLists;
          const derivedTotal = lists.reduce(
            (sum, l) => sum + (l.count ?? l.contactsCount ?? 0), 0
          );
          const contactsTotal = await cacheManager.getContactsTotalCount(null);

          return {
            contactsCount: lists,
            totalLists: fallbackMeta?.totalLists || lists.length,
            totalContactsCount: fallbackMeta?.totalContactsCount || contactsTotal || derivedTotal || 0,
            unassignedCount: fallbackMeta?.unassignedCount || 0,
            fromCache: true,
          };
        }
      } catch (cacheErr) {
        // Cache read also failed — fall through to reject
      }
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch contact lists from API and save to SQLite.
 * Saves the lists array to the contact_lists table and aggregate metadata
 * (totalLists, totalContactsCount, unassignedCount) to app_settings.
 * @returns {Promise<Object>} { contactsCount, totalLists, totalContactsCount, unassignedCount }
 */
async function fetchContactListsFromServer() {
  const url = `${endpoints.contacts.getContactList}/?skip=1&limit=50`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch contact lists');
  }

  const data = response.data || response;
  const contactsCount = data.contactsCount || [];
  const totalLists = data.totalLists || contactsCount.length;
  const totalContactsCount = data.totalContactsCount ?? 0;
  const unassignedCount = data.unassignedCount ?? 0;

  // Save aggregate metadata FIRST — it's a safe upsert and provides counts
  // even if the lists save below is interrupted by app close
  await cacheManager.saveAppSetting('contactListMeta', {
    totalLists,
    totalContactsCount,
    unassignedCount,
  });

  // Save lists array to contact_lists table (atomic transaction)
  await cacheManager.saveContactLists(contactsCount);

  return { contactsCount, totalLists, totalContactsCount, unassignedCount };
}

// ==========================================
// TEMPLATES CACHE THUNKS
// ==========================================

/**
 * Fetch templates with per-status-pill independent caching.
 *
 * Each pill ('all', 'approved', 'pending', 'draft', 'rejected') has its own
 * cache bucket via cache_key. Fetching or refreshing one pill does not
 * affect another pill's cache.
 *
 * Strategy:
 * - cacheKey derived from status param: 'APPROVED' → 'approved', null → 'all'
 * - forceRefresh: Clear this pill's bucket → fetch API → save → return.
 * - search: Search this pill's cache → API fallback (transient, NOT saved).
 * - initial load (skip=0): Return ALL cached from this bucket. Miss → API → save.
 * - load more (skip>0): If skip < cachedCount[bucket] → cache. Else → API → append.
 */
export const fetchTemplatesWithCache = createAsyncThunk(
  'template/fetchTemplatesWithCache',
  async (params = {}, { rejectWithValue }) => {
    try {
      const {
        forceRefresh = false,
        skip = 0,
        limit = 10,
        search = null,
        status = null,
      } = params;

      // Derive cache bucket from status param
      const cacheKey = status && status.trim() ? status.trim().toLowerCase() : 'all';

      // ── FORCE REFRESH (pull-to-refresh) ──
      if (forceRefresh) {
        const freshData = await fetchTemplatesFromServer({ skip: 0, limit, search, status });

        // Clear ONLY this pill's cache bucket, then save fresh data
        await cacheManager.clearTemplatesForCacheKey(cacheKey);
        if (freshData.templates.length > 0) {
          await cacheManager.saveTemplates(freshData.templates, cacheKey, 0);
        }
        await cacheManager.saveTemplatesTotalCount(cacheKey, freshData.totalCount);

        return { templates: freshData.templates, totalCount: freshData.totalCount, fromCache: false, skip: 0 };
      }

      // ── SEARCH (cache-first → API fallback, transient) ──
      if (search && search.trim()) {
        const cacheResult = await cacheManager.getTemplates({ skip, limit, search, cacheKey });

        if (cacheResult.templates.length > 0) {
          return { templates: cacheResult.templates, totalCount: cacheResult.totalCount, fromCache: true, skip };
        }

        // Cache miss — try API (throws if offline)
        const apiData = await fetchTemplatesFromServer({ skip, limit, search, status });

        // Do NOT save search results to cache — they are transient
        return { templates: apiData.templates, totalCount: apiData.totalCount, fromCache: false, skip };
      }

      // ── INITIAL LOAD (skip=0, no search) ──
      if (skip === 0) {
        const cacheResult = await cacheManager.getTemplates({ skip: 0, cacheKey });

        if (cacheResult.fromCache && cacheResult.templates.length > 0) {
          const storedTotal = await cacheManager.getTemplatesTotalCount(cacheKey);
          return {
            templates: cacheResult.templates,
            totalCount: storedTotal ?? cacheResult.templates.length,
            fromCache: true,
            skip: 0,
          };
        }

        // Cache miss — fetch first page from API
        const apiData = await fetchTemplatesFromServer({ skip: 0, limit, status });

        if (apiData.templates.length > 0) {
          await cacheManager.saveTemplates(apiData.templates, cacheKey, 0);
        }
        await cacheManager.saveTemplatesTotalCount(cacheKey, apiData.totalCount);

        return { templates: apiData.templates, totalCount: apiData.totalCount, fromCache: false, skip: 0 };
      }

      // ── LOAD MORE (skip > 0) ──
      const cachedCount = await cacheManager.getCachedTemplateCount(cacheKey);

      if (skip < cachedCount) {
        // Enough cached data in this bucket — serve from cache
        const cacheResult = await cacheManager.getTemplates({ skip, limit, cacheKey });
        const storedTotal = await cacheManager.getTemplatesTotalCount(cacheKey);

        return {
          templates: cacheResult.templates,
          totalCount: storedTotal ?? cachedCount,
          fromCache: true,
          skip,
        };
      }

      // Need more data — fetch next page from API and append to this bucket
      const apiData = await fetchTemplatesFromServer({ skip, limit, status });

      if (apiData.templates.length > 0) {
        await cacheManager.saveTemplates(apiData.templates, cacheKey, skip);
      }
      await cacheManager.saveTemplatesTotalCount(cacheKey, apiData.totalCount);

      return { templates: apiData.templates, totalCount: apiData.totalCount, fromCache: false, skip };
    } catch (error) {
      // Offline fallback — try to return cached data from this bucket
      const cacheKey = params.status && params.status.trim() ? params.status.trim().toLowerCase() : 'all';
      try {
        const fallback = await cacheManager.getTemplates({
          skip: params.skip || 0,
          limit: params.limit || 10,
          search: params.search,
          cacheKey,
        });
        if (fallback.fromCache && fallback.templates.length > 0) {
          const storedTotal = await cacheManager.getTemplatesTotalCount(cacheKey);
          return {
            templates: fallback.templates,
            totalCount: storedTotal ?? fallback.templates.length,
            fromCache: true,
            skip: params.skip || 0,
          };
        }
      } catch (cacheErr) {
        // Cache read also failed — fall through
      }

      // For load-more (skip > 0): return empty instead of rejecting
      if ((params.skip || 0) > 0) {
        return {
          templates: [],
          totalCount: params.skip,
          fromCache: true,
          skip: params.skip,
        };
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch templates from API.
 * @param {Object} options - { skip, limit, search, status }
 * @returns {Promise<{templates: Array, totalCount: number}>}
 */
async function fetchTemplatesFromServer({ skip = 0, limit = 10, search, status } = {}) {
  const queryParams = new URLSearchParams({
    page: String(Math.floor(skip / limit)),
    limit: String(limit),
    sortBy: 'createdAt',
  });

  if (search?.trim()) {
    queryParams.append('search', search.trim());
  }
  if (status?.trim()) {
    queryParams.append('status', status.trim());
  }

  const url = `${endpoints.template.fetchAllTemplates}/?${queryParams.toString()}`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch templates');
  }

  const data = response.data || response;
  return {
    templates: data.templates || [],
    totalCount: data.totalResults || 0,
  };
}

/**
 * Fetch template stats with cache-first strategy.
 *
 * Cache hit → return cached stats instantly, silently refresh from API.
 * Cache miss → fetch from API, save to cache, return.
 * Offline fallback → compute stats from local DB (cached template counts by status).
 */
export const fetchTemplateStatsWithCache = createAsyncThunk(
  'template/fetchTemplateStatsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('templateStats');

        if (cached) {
          // Silently refresh from server in background
          fetchTemplateStatsFromServer()
            .then((freshStats) => {
              if (freshStats) {
                const { silentUpdateTemplateStats } = require('./slices/templateSlice');
                dispatch(silentUpdateTemplateStats(freshStats));
              }
            })
            .catch(() => {});

          return { data: cached, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshStats = await fetchTemplateStatsFromServer();
      return { data: freshStats, fromCache: false };
    } catch (error) {
      // Offline fallback — compute stats from local DB
      try {
        const localStats = await cacheManager.getTemplateCacheStats();
        if (localStats.total > 0) {
          return { data: localStats, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch template stats from API and save to cache.
 * @returns {Promise<Object>} { total, approved, pending, draft, rejected }
 */
async function fetchTemplateStatsFromServer() {
  const response = await callApi(endpoints.template.fetchTemplateStats, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch template stats');
  }

  const data = response.data || response;
  const stats = {
    total: data.total || 0,
    approved: data.approved || 0,
    pending: data.pending || 0,
    draft: data.draft || 0,
    rejected: data.rejected || 0,
  };

  // Cache as JSON blob in app_settings
  await cacheManager.saveAppSetting('templateStats', stats);

  return stats;
}

// ==========================================
// OPT-IN MANAGEMENT CACHE OPERATIONS
// ==========================================

/**
 * Fetch opt-in management settings with cache-first strategy.
 * Cache hit → return instantly + silent background refresh.
 * Cache miss / forceRefresh → fetch from API, save to cache.
 * Offline fallback → return cached data if available.
 */
export const fetchOptInManagementWithCache = createAsyncThunk(
  'settings/fetchOptInManagementWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('optInManagement');

        if (cached) {
          // Return cached data immediately, then silently refresh in background
          fetchOptInManagementFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateOptInManagement } = require('./slices/settingsSlice');
                dispatch(silentUpdateOptInManagement(freshData));
              }
            })
            .catch(() => {});

          return { data: { optInManagement: cached }, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchOptInManagementFromServer();
      return { data: { optInManagement: freshData }, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('optInManagement');
        if (cached) {
          return { data: { optInManagement: cached }, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch opt-in management settings from API and save to cache.
 * @returns {Promise<Object>} optInManagement object
 */
async function fetchOptInManagementFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=optInManagement`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch opt-in management settings');
  }

  const data = response.data || response;
  const optInManagement = data.optInManagement || {};

  // Save to cache
  await cacheManager.saveAppSetting('optInManagement', optInManagement);

  return optInManagement;
}

// ─── Inbox Settings ───────────────────────────────────────────────────────────

export const fetchInboxSettingsWithCache = createAsyncThunk(
  'settings/fetchInboxSettingsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('inboxSettings');

        if (cached) {
          // Return cached data immediately, then silently refresh in background
          fetchInboxSettingsFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateInboxSettings } = require('./slices/settingsSlice');
                dispatch(silentUpdateInboxSettings(freshData));
              }
            })
            .catch(() => {});

          return { data: { inboxSettings: cached }, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchInboxSettingsFromServer();
      return { data: { inboxSettings: freshData }, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('inboxSettings');
        if (cached) {
          return { data: { inboxSettings: cached }, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch inbox settings from API and save to cache.
 * @returns {Promise<Object>} inboxSettings object
 */
async function fetchInboxSettingsFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=inboxSettings`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch inbox settings');
  }

  const data = response.data || response;
  const inboxSettings = data.inboxSettings || {};

  // Save to cache
  await cacheManager.saveAppSetting('inboxSettings', inboxSettings);

  return inboxSettings;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const fetchTagsWithCache = createAsyncThunk(
  'settings/fetchTagsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('tags');

        if (cached) {
          // Return cached data immediately, then silently refresh Redux in background
          // Note: background refresh does NOT write to cache — only loadTags (pagination) manages cache
          fetchTagsFromServer()
            .then((freshData) => {
              if (freshData) {
                // Merge fresh first-page with cached paginated items for Redux state
                const freshIds = new Set(freshData.items.map(t => t._id));
                const beyondFirstPage = cached.items.slice(freshData.items.length).filter(t => !freshIds.has(t._id));
                const merged = { items: [...freshData.items, ...beyondFirstPage], totalCount: freshData.totalCount };
                const { silentUpdateTags } = require('./slices/settingsSlice');
                dispatch(silentUpdateTags(merged));
                // Also update cache so next mount gets fresh data
                cacheManager.saveAppSetting('tags', merged).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: { tags: cached }, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchTagsFromServer();

      // Merge with existing cache to preserve paginated items beyond first page
      let dataToSave = freshData;
      try {
        const existing = await cacheManager.getAppSetting('tags');
        if (existing && existing.items && existing.items.length > freshData.items.length) {
          const freshIds = new Set(freshData.items.map(t => t._id));
          const beyondFirstPage = existing.items.slice(freshData.items.length).filter(t => !freshIds.has(t._id));
          dataToSave = { items: [...freshData.items, ...beyondFirstPage], totalCount: freshData.totalCount };
        }
      } catch (e) { /* no existing cache */ }

      await cacheManager.saveAppSetting('tags', dataToSave);
      return { data: { tags: dataToSave }, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('tags');
        if (cached) {
          return { data: { tags: cached }, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch first page of tags from API (pure fetch, no cache operations).
 * Cache saves are handled by fetchTagsWithCache (initial load) and loadTags (pagination).
 * @returns {Promise<Object>} tags object { items: [], totalCount: number }
 */
async function fetchTagsFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=tags&skip=0&limit=10&order=-1`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch tags');
  }

  const data = response.data || response;
  return data.tags || { items: [], totalCount: 0 };
}

// ─── User Attributes (Contact Custom Fields) ─────────────────────────────────

export const fetchUserAttributesWithCache = createAsyncThunk(
  'settings/fetchUserAttributesWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      // Try cache first
      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('userAttributes');

        if (cached) {
          // Return cached data immediately, then silently refresh Redux in background
          fetchUserAttributesFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateUserAttributes } = require('./slices/settingsSlice');
                dispatch(silentUpdateUserAttributes(freshData));
                cacheManager.saveAppSetting('userAttributes', freshData).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: { userAttributes: cached }, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchUserAttributesFromServer();
      await cacheManager.saveAppSetting('userAttributes', freshData);
      return { data: { userAttributes: freshData }, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('userAttributes');
        if (cached) {
          return { data: { userAttributes: cached }, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch all user attributes from API (pure fetch, no cache operations).
 * @returns {Promise<Object>} userAttributes object { items: [], totalCount: number }
 */
async function fetchUserAttributesFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=userAttributes&order=-1`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch user attributes');
  }

  const data = response.data || response;
  return data.userAttributes || { items: [], totalCount: 0 };
}

// ==========================================
// AI ASSISTANT CACHE THUNKS
// ==========================================

/**
 * Fetch assistants with cache-first strategy (first page only, paginated).
 * Cache hit -> return cached instantly, silently refresh first page from API in background.
 * Cache miss or forceRefresh -> fetch first page from API, save to cache, return.
 * Offline fallback -> return cached data if available.
 * Pagination is handled by the screen via getAssistants thunk.
 */
export const fetchAssistantsWithCache = createAsyncThunk(
  'assistant/fetchAssistantsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('assistants');

        if (cached && cached.assistants && cached.assistants.length > 0) {
          // Return cached data immediately, then silently refresh first page in background
          fetchAssistantsFromServer()
            .then((freshData) => {
              if (freshData) {
                // Merge fresh first page with cached paginated items beyond first page
                let dataToUpdate = freshData;
                if (freshData.totalResults >= cached.assistants.length && cached.assistants.length > freshData.assistants.length) {
                  const freshIds = new Set(freshData.assistants.map(a => a._id));
                  const beyondFirstPage = cached.assistants.slice(freshData.assistants.length).filter(a => !freshIds.has(a._id));
                  dataToUpdate = { assistants: [...freshData.assistants, ...beyondFirstPage], totalResults: freshData.totalResults };
                }
                const { silentUpdateAssistants } = require('./slices/assistantSlice');
                dispatch(silentUpdateAssistants(dataToUpdate));
                cacheManager.saveAppSetting('assistants', dataToUpdate).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: cached, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch first page from server
      const freshData = await fetchAssistantsFromServer();

      // Merge with existing cache to preserve paginated items beyond first page
      let dataToSave = freshData;
      try {
        const existing = await cacheManager.getAppSetting('assistants');
        if (existing && existing.assistants && existing.assistants.length > freshData.assistants.length) {
          const freshIds = new Set(freshData.assistants.map(a => a._id));
          const beyondFirstPage = existing.assistants
            .slice(freshData.assistants.length)
            .filter(a => !freshIds.has(a._id));
          dataToSave = { assistants: [...freshData.assistants, ...beyondFirstPage], totalResults: freshData.totalResults };
        }
      } catch (e) { /* no existing cache to merge */ }

      await cacheManager.saveAppSetting('assistants', dataToSave);
      return { data: dataToSave, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('assistants');
        if (cached && cached.assistants && cached.assistants.length > 0) {
          return { data: cached, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

const PAGE_SIZE_ASSISTANTS = 10;

async function fetchAssistantsFromServer() {
  const params = new URLSearchParams();
  params.append('page', '0');
  params.append('limit', PAGE_SIZE_ASSISTANTS.toString());

  const url = `${endpoints.assistants.getAssistants}?${params.toString()}`;
  const response = await callApi(url, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch assistants');
  }

  // Parse response — handle multiple response structures (mirrors assistantSlice reducer)
  let assistantsList = [];
  const raw = response._raw || {};

  if (Array.isArray(response?.assistants)) {
    assistantsList = response.assistants;
  } else if (Array.isArray(raw?.assistants)) {
    assistantsList = raw.assistants;
  } else if (Array.isArray(response?.data?.assistants)) {
    assistantsList = response.data.assistants;
  } else if (Array.isArray(raw?.data?.assistants)) {
    assistantsList = raw.data.assistants;
  } else if (Array.isArray(response?.data)) {
    assistantsList = response.data;
  } else if (Array.isArray(raw?.data)) {
    assistantsList = raw.data;
  } else if (Array.isArray(response)) {
    assistantsList = response;
  }

  const totalResults = response?.pagination?.totalItems
    || raw?.pagination?.totalItems
    || response?.data?.pagination?.totalItems
    || assistantsList.length;

  return { assistants: assistantsList, totalResults };
}

/**
 * Fetch assistant stats with cache-first strategy.
 */
export const fetchAssistantStatsWithCache = createAsyncThunk(
  'assistant/fetchAssistantStatsWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('assistantStats');

        if (cached) {
          // Silently refresh from server in background
          fetchAssistantStatsFromServer()
            .then((freshStats) => {
              if (freshStats) {
                const { silentUpdateAssistantStats } = require('./slices/assistantSlice');
                dispatch(silentUpdateAssistantStats(freshStats));
                cacheManager.saveAppSetting('assistantStats', freshStats).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: cached, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshStats = await fetchAssistantStatsFromServer();
      await cacheManager.saveAppSetting('assistantStats', freshStats);
      return { data: freshStats, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('assistantStats');
        if (cached) {
          return { data: cached, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

async function fetchAssistantStatsFromServer() {
  const response = await callApi(endpoints.assistants.getAssistantStats, httpMethods.GET);

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch assistant stats');
  }

  const data = response.data || response;
  return {
    total: data.total || 0,
    active: data.active || 0,
    inactive: data.inactive || 0,
  };
}

// ==========================================
// CHAT RULES CACHE THUNKS
// ==========================================

/**
 * Fetch chat status rules with cache-first strategy.
 * Cache hit → return cached rules instantly, silently refresh from API in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 * Offline fallback → return cached data if available.
 */
export const fetchChatStatusRulesWithCache = createAsyncThunk(
  'settings/fetchChatStatusRulesWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('chatStatusRules');

        if (cached) {
          // Silently refresh from server in background
          fetchChatStatusRulesFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateChatStatusRules } = require('./slices/settingsSlice');
                dispatch(silentUpdateChatStatusRules(freshData));
                cacheManager.saveAppSetting('chatStatusRules', freshData).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: cached, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchChatStatusRulesFromServer();
      await cacheManager.saveAppSetting('chatStatusRules', freshData);
      return { data: freshData, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('chatStatusRules');
        if (cached) {
          return { data: cached, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch chat status rules from API and parse active rules.
 * @returns {Promise<Array>} Array of active rule objects { fromStatus, toStatus, days, _id }
 */
async function fetchChatStatusRulesFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=chatStatusRules`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch chat status rules');
  }

  const data = response.data || response;
  const rulesObj = data?.chatStatusRules?.items?.[0] || data?.chatStatusRules || {};

  // Convert to array of active rules
  const activeRules = [];
  Object.entries(rulesObj).forEach(([key, value]) => {
    if (!/^\d+$/.test(key) && value && typeof value === 'object') {
      const { toStatus, days, _id } = value;
      if (toStatus && days && parseInt(days) > 0) {
        activeRules.push({
          fromStatus: key,
          toStatus,
          days: parseInt(days),
          _id,
        });
      }
    }
  });

  return activeRules;
}

/**
 * Fetch chat team members with cache-first strategy.
 * Cache hit → return cached members instantly, silently refresh from API in background.
 * Cache miss or forceRefresh → fetch from API, save to cache, return.
 * Offline fallback → return cached data if available.
 */
export const fetchChatTeamMembersWithCache = createAsyncThunk(
  'settings/fetchChatTeamMembersWithCache',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      const { forceRefresh = false } = params;

      if (!forceRefresh) {
        const cached = await cacheManager.getAppSetting('chatTeamMembers');

        if (cached) {
          // Silently refresh from server in background
          fetchChatTeamMembersFromServer()
            .then((freshData) => {
              if (freshData) {
                const { silentUpdateChatTeamMembers } = require('./slices/settingsSlice');
                dispatch(silentUpdateChatTeamMembers(freshData));
                cacheManager.saveAppSetting('chatTeamMembers', freshData).catch(() => {});
              }
            })
            .catch(() => {});

          return { data: cached, fromCache: true };
        }
      }

      // Cache miss or force refresh — fetch from server
      const freshData = await fetchChatTeamMembersFromServer();
      await cacheManager.saveAppSetting('chatTeamMembers', freshData);
      return { data: freshData, fromCache: false };
    } catch (error) {
      // Offline fallback — try cache
      try {
        const cached = await cacheManager.getAppSetting('chatTeamMembers');
        if (cached) {
          return { data: cached, fromCache: true };
        }
      } catch (cacheErr) {
        // Cache read also failed
      }

      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch chat team members from API.
 * @returns {Promise<Array>} Array of team member objects
 */
async function fetchChatTeamMembersFromServer() {
  const response = await callApi(
    `${endpoints.settings.getSettings}?keys=teamMembers&skip=0&limit=100&order=-1`,
    httpMethods.GET
  );

  if (response.status === 'error') {
    throw new Error(response.message || 'Failed to fetch chat team members');
  }

  const data = response.data || response;
  return data?.teamMembers?.items || [];
}

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
  fetchDashboardStatsWithCache,
  fetchWANumbersWithCache,
  fetchFoldersWithCache,
  fetchTeamMembersWithCache,
  fetchSharedAccountsWithCache,
  fetchContactsWithCache,
  fetchContactListsWithCache,
  fetchTemplatesWithCache,
  fetchTemplateStatsWithCache,
  fetchOptInManagementWithCache,
  fetchInboxSettingsWithCache,
  fetchTagsWithCache,
  fetchUserAttributesWithCache,
  fetchAssistantsWithCache,
  fetchAssistantStatsWithCache,
  fetchChatStatusRulesWithCache,
  fetchChatTeamMembersWithCache,
};
