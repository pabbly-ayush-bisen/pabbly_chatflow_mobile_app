/**
 * useCache - React hooks for cache operations
 *
 * These hooks provide easy-to-use interfaces for components
 * to interact with the caching system.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { cacheManager } from '../database/CacheManager';

/**
 * Hook to manage cache initialization
 * @returns {Object} Cache initialization state
 */
export function useCacheInitialization() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);

  const settingId = useSelector((state) => state.user?.settingId);

  useEffect(() => {
    let mounted = true;

    const initCache = async () => {
      try {
        setIsInitializing(true);
        await cacheManager.initialize();

        if (settingId) {
          cacheManager.setSettingId(settingId);
        }

        if (mounted) {
          setIsInitialized(true);
          setError(null);
        }
      } catch (err) {
        // Error logged:('[useCacheInitialization] Error:', err);
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    initCache();

    return () => {
      mounted = false;
    };
  }, []);

  // Update setting ID when it changes
  useEffect(() => {
    if (isInitialized && settingId) {
      cacheManager.setSettingId(settingId);
    }
  }, [isInitialized, settingId]);

  return { isInitialized, isInitializing, error };
}

/**
 * Hook to fetch chats with cache-first strategy
 * @param {Object} options - Query options
 * @returns {Object} Chats state and methods
 */
export function useCachedChats(options = {}) {
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const loadChats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const result = await cacheManager.getChats(optionsRef.current);

      setChats(result.chats);
      setFromCache(result.fromCache);
      setIsStale(result.isStale);
      setError(null);
    } catch (err) {
      // Error logged:('[useCachedChats] Error loading chats:', err);
      setError(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadChats(false);
  }, [loadChats]);

  const updateCache = useCallback(async (newChats) => {
    try {
      await cacheManager.saveChats(newChats);
      setChats(newChats);
      setFromCache(true);
      setIsStale(false);
    } catch (err) {
      // Error logged:('[useCachedChats] Error updating cache:', err);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return {
    chats,
    isLoading,
    isRefreshing,
    fromCache,
    isStale,
    error,
    refresh,
    updateCache,
    reload: loadChats,
  };
}

/**
 * Hook to fetch messages for a chat with cache-first strategy
 * @param {string} chatId - Chat ID
 * @param {Object} options - Query options
 * @returns {Object} Messages state and methods
 */
export function useCachedMessages(chatId, options = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const offsetRef = useRef(0);
  const chatIdRef = useRef(chatId);

  // Reset when chat ID changes
  useEffect(() => {
    if (chatId !== chatIdRef.current) {
      chatIdRef.current = chatId;
      offsetRef.current = 0;
      setMessages([]);
      setHasMore(true);
    }
  }, [chatId]);

  const loadMessages = useCallback(async (showLoading = true) => {
    if (!chatId) return;

    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const result = await cacheManager.getMessages(chatId, {
        limit: options.limit || 50,
        offset: 0,
      });

      setMessages(result.messages);
      setFromCache(result.fromCache);
      setHasMore(result.hasMore);
      setError(null);
      offsetRef.current = result.messages.length;
    } catch (err) {
      // Error logged:('[useCachedMessages] Error loading messages:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, options.limit]);

  const loadMore = useCallback(async () => {
    if (!chatId || !hasMore || isLoadingMore) return;

    try {
      setIsLoadingMore(true);

      const result = await cacheManager.getMessages(chatId, {
        limit: options.limit || 50,
        offset: offsetRef.current,
      });

      if (result.messages.length > 0) {
        setMessages((prev) => [...result.messages, ...prev]);
        offsetRef.current += result.messages.length;
      }

      setHasMore(result.hasMore);
    } catch (err) {
      // Error logged:('[useCachedMessages] Error loading more:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, isLoadingMore, options.limit]);

  const addMessage = useCallback(async (message) => {
    try {
      await cacheManager.addMessage(message, chatId);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      // Error logged:('[useCachedMessages] Error adding message:', err);
    }
  }, [chatId]);

  const updateCache = useCallback(async (newMessages) => {
    try {
      await cacheManager.saveMessages(newMessages, chatId);
      setMessages(newMessages);
      setFromCache(true);
    } catch (err) {
      // Error logged:('[useCachedMessages] Error updating cache:', err);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    fromCache,
    hasMore,
    error,
    loadMore,
    addMessage,
    updateCache,
    reload: loadMessages,
  };
}

/**
 * Hook to manage optimistic message sending
 * @param {string} chatId - Chat ID
 * @returns {Object} Send message methods
 */
export function useOptimisticMessage(chatId) {
  const [pendingMessages, setPendingMessages] = useState([]);

  const addOptimistic = useCallback(async (messageData) => {
    try {
      const tempId = await cacheManager.addOptimisticMessage(messageData, chatId);

      const optimisticMessage = {
        ...messageData,
        tempId,
        _id: tempId,
        status: 'pending',
        isPending: true,
        timestamp: Date.now(),
        direction: 'outbound',
        isFromMe: true,
      };

      setPendingMessages((prev) => [...prev, optimisticMessage]);

      // Also update chat's last message
      await cacheManager.updateChatWithMessage(chatId, {
        ...messageData,
        _id: tempId,
        direction: 'outbound',
        timestamp: Date.now(),
      });

      return tempId;
    } catch (err) {
      // Error logged:('[useOptimisticMessage] Error adding optimistic:', err);
      throw err;
    }
  }, [chatId]);

  const confirmMessage = useCallback(async (tempId, serverMessage) => {
    try {
      await cacheManager.updateOptimisticMessage(tempId, serverMessage);
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } catch (err) {
      // Error logged:('[useOptimisticMessage] Error confirming message:', err);
    }
  }, []);

  const failMessage = useCallback(async (tempId, error) => {
    try {
      await cacheManager.markMessageFailed(tempId, error);
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed', error } : m
        )
      );
    } catch (err) {
      // Error logged:('[useOptimisticMessage] Error marking failed:', err);
    }
  }, []);

  return {
    pendingMessages,
    addOptimistic,
    confirmMessage,
    failMessage,
  };
}

/**
 * Hook to manage cache statistics
 * @returns {Object} Cache stats
 */
export function useCacheStats() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const cacheStats = await cacheManager.getCacheStats();
      setStats(cacheStats);
    } catch (err) {
      // Error logged:('[useCacheStats] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, isLoading, refresh: loadStats };
}

/**
 * Hook for cache management operations
 * @returns {Object} Cache management methods
 */
export function useCacheManagement() {
  const [isClearing, setIsClearing] = useState(false);

  const clearCurrentCache = useCallback(async () => {
    try {
      setIsClearing(true);
      await cacheManager.clearCurrentSettingCache();
    } catch (err) {
      // Error logged:('[useCacheManagement] Error clearing cache:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, []);

  const clearAllCache = useCallback(async () => {
    try {
      setIsClearing(true);
      await cacheManager.clearAllCache();
    } catch (err) {
      // Error logged:('[useCacheManagement] Error clearing all cache:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, []);

  const invalidateChats = useCallback(async () => {
    try {
      await cacheManager.invalidateChatCache();
    } catch (err) {
      // Error logged:('[useCacheManagement] Error invalidating:', err);
    }
  }, []);

  return {
    isClearing,
    clearCurrentCache,
    clearAllCache,
    invalidateChats,
  };
}

export default {
  useCacheInitialization,
  useCachedChats,
  useCachedMessages,
  useOptimisticMessage,
  useCacheStats,
  useCacheManagement,
};
