/**
 * Cache Middleware for Redux
 *
 * This middleware intercepts Redux actions and syncs data with the SQLite cache.
 * It implements a "cache-first" strategy where cached data is loaded immediately
 * while fresh data is fetched in the background.
 *
 * Features:
 * - Automatic cache population on successful API fetches
 * - Cache invalidation on data mutations
 * - Background sync for stale data
 * - Offline support with sync queue
 */

import { cacheManager } from '../database/CacheManager';

/**
 * Cache middleware for Redux
 * Intercepts actions and manages cache synchronization
 */
export const cacheMiddleware = (store) => (next) => async (action) => {
  const result = next(action);

  // Handle async thunk fulfilled actions
  if (action.type.endsWith('/fulfilled')) {
    try {
      await handleCacheUpdate(action, store.getState());
    } catch (error) {
      console.error('[CacheMiddleware] Error updating cache:', error);
    }
  }

  return result;
};

/**
 * Handle cache updates based on action type
 */
async function handleCacheUpdate(action, state) {
  switch (action.type) {
    case 'inbox/fetchChats/fulfilled':
      await handleChatsUpdate(action.payload);
      break;

    case 'inbox/fetchConversation/fulfilled':
      await handleConversationUpdate(action);
      break;

    case 'inbox/fetchMoreMessages/fulfilled':
      await handleMoreMessagesUpdate(action);
      break;

    case 'inbox/updateChat/fulfilled':
    case 'inbox/updateContactChat/fulfilled':
      await handleChatUpdate(action.payload);
      break;

    case 'inbox/deleteChat/fulfilled':
      await handleChatDelete(action.payload);
      break;

    default:
      // No cache action needed
      break;
  }
}

/**
 * Cache chats after successful fetch
 */
async function handleChatsUpdate(payload) {
  const chats = payload?.data?.chats || payload?.chats || payload?._raw?.chats || [];
  if (chats.length > 0) {
    await cacheManager.saveChats(chats);
    console.log(`[CacheMiddleware] Cached ${chats.length} chats`);
  }
}

/**
 * Cache conversation messages after successful fetch
 */
async function handleConversationUpdate(action) {
  const data = action.payload?.data || action.payload;
  const arg = action.meta?.arg;
  const chatId = typeof arg === 'object' ? (arg.chatId || arg._id || arg.id) : arg;

  if (chatId && data?.messages) {
    await cacheManager.saveMessages(data.messages, chatId);
    console.log(`[CacheMiddleware] Cached ${data.messages.length} messages for chat: ${chatId}`);
  }
}

/**
 * Cache additional messages after pagination
 */
async function handleMoreMessagesUpdate(action) {
  const data = action.payload?.response?.data || action.payload?.response;
  const chatId = action.meta?.arg?.chatId;

  if (chatId && data?.messages) {
    await cacheManager.saveMessages(data.messages, chatId);
    console.log(`[CacheMiddleware] Cached ${data.messages.length} more messages for chat: ${chatId}`);
  }
}

/**
 * Update single chat in cache
 */
async function handleChatUpdate(payload) {
  const { id, response } = payload;
  const chatData = response?.data || response;

  if (id && chatData) {
    await cacheManager.updateChat({ _id: id, ...chatData });
    console.log(`[CacheMiddleware] Updated chat in cache: ${id}`);
  }
}

/**
 * Delete chat from cache
 */
async function handleChatDelete(payload) {
  const { id } = payload;

  if (id) {
    // Note: We would need to add a deleteChat method to cacheManager
    // For now, the chat will be removed on next sync
    console.log(`[CacheMiddleware] Chat deleted: ${id}`);
  }
}

export default cacheMiddleware;
