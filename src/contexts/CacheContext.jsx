/**
 * CacheContext - React Context for Cache Management
 *
 * This context provides cache state and methods to the entire app,
 * managing the initialization and synchronization of the SQLite cache.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppState } from 'react-native';
import { cacheManager } from '../database/CacheManager';
import { initializeCache } from '../redux/cacheThunks';

// Create the context
const CacheContext = createContext(null);

/**
 * CacheProvider Component
 *
 * Wraps the app and provides cache functionality to all child components.
 * Handles cache initialization, setting ID changes, and app state changes.
 */
export function CacheProvider({ children }) {
  const dispatch = useDispatch();

  // Get setting ID from Redux
  const settingId = useSelector((state) => state.user?.settingId);
  const isAuthenticated = useSelector((state) => !!state.user?.user);

  // Local state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  /**
   * Initialize the cache system
   */
  const initialize = useCallback(async () => {
    if (isInitializing || isInitialized) return;

    try {
      setIsInitializing(true);
      setError(null);

      // Log:('[CacheProvider] Initializing cache...');

      const result = await dispatch(initializeCache(settingId)).unwrap();

      setStats(result.stats);
      setIsInitialized(true);

      // Log:('[CacheProvider] Cache initialized:', result);
    } catch (err) {
      // Error:('[CacheProvider] Initialization error:', err);
      setError(err);
    } finally {
      setIsInitializing(false);
    }
  }, [dispatch, settingId, isInitializing, isInitialized]);

  /**
   * Update setting ID when user changes account
   */
  useEffect(() => {
    if (isInitialized && settingId) {
      // Log:('[CacheProvider] Setting ID changed:', settingId);
      cacheManager.setSettingId(settingId);
    }
  }, [isInitialized, settingId]);

  /**
   * Initialize cache when user is authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !isInitialized && !isInitializing) {
      initialize();
    }
  }, [isAuthenticated, isInitialized, isInitializing, initialize]);

  /**
   * Handle app state changes (foreground/background)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isInitialized) {
        // App came to foreground - could trigger sync here
        // Log:('[CacheProvider] App active, cache ready');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized]);

  /**
   * Refresh cache statistics
   */
  const refreshStats = useCallback(async () => {
    try {
      const newStats = await cacheManager.getCacheStats();
      setStats(newStats);
      return newStats;
    } catch (err) {
      // Error:('[CacheProvider] Error refreshing stats:', err);
      return null;
    }
  }, []);

  /**
   * Clear cache for current setting
   */
  const clearCache = useCallback(async () => {
    try {
      await cacheManager.clearCurrentSettingCache();
      await refreshStats();
      // Log:('[CacheProvider] Cache cleared');
    } catch (err) {
      // Error:('[CacheProvider] Error clearing cache:', err);
      throw err;
    }
  }, [refreshStats]);

  /**
   * Clear all cache (for logout)
   */
  const clearAllCache = useCallback(async () => {
    try {
      await cacheManager.clearAllCache();
      setIsInitialized(false);
      setStats(null);
      // Log:('[CacheProvider] All cache cleared');
    } catch (err) {
      // Error:('[CacheProvider] Error clearing all cache:', err);
      throw err;
    }
  }, []);

  /**
   * Invalidate chat cache (force refresh on next load)
   */
  const invalidateChats = useCallback(async () => {
    try {
      await cacheManager.invalidateChatCache();
      // Log:('[CacheProvider] Chat cache invalidated');
    } catch (err) {
      // Error:('[CacheProvider] Error invalidating chats:', err);
    }
  }, []);

  // Context value
  const value = {
    // State
    isInitialized,
    isInitializing,
    error,
    stats,
    settingId,

    // Methods
    initialize,
    refreshStats,
    clearCache,
    clearAllCache,
    invalidateChats,
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
}

/**
 * Custom hook to use the cache context
 */
export function useCache() {
  const context = useContext(CacheContext);

  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }

  return context;
}

export default CacheContext;
