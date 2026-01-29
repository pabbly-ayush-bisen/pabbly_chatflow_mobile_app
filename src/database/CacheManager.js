/**
 * CacheManager - High-level caching management
 *
 * This module provides a unified interface for cache operations,
 * handling the coordination between local cache and server data.
 *
 * Features:
 * - Cache-first data fetching strategy
 * - Background sync with server
 * - Stale-while-revalidate pattern
 * - Offline support with sync queue
 */

import { databaseManager } from './DatabaseManager';
import { ChatModel, MessageModel } from './models';
import { Tables, CacheKeys, CacheExpiry } from './schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

class CacheManager {
  constructor() {
    this.isInitialized = false;
    this.currentSettingId = null;
    this.syncInProgress = false;
    this.pendingSyncCallbacks = [];
  }

  /**
   * Initialize the cache manager
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize database
      await databaseManager.initialize();

      // Get current setting ID from storage
      const settingId = await AsyncStorage.getItem('settingId') ||
        await AsyncStorage.getItem('@pabbly_chatflow_settingId');
      this.currentSettingId = settingId;

      this.isInitialized = true;
      console.log('[CacheManager] Initialized with settingId:', settingId);
    } catch (error) {
      console.error('[CacheManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Set the current setting ID (on login or account switch)
   * @param {string} settingId - Setting ID
   */
  setSettingId(settingId) {
    this.currentSettingId = settingId;
    console.log('[CacheManager] Setting ID updated:', settingId);
  }

  /**
   * Get the current setting ID
   * @returns {string|null}
   */
  getSettingId() {
    return this.currentSettingId;
  }

  // ==========================================
  // CHATS CACHE OPERATIONS
  // ==========================================

  /**
   * Get chats with cache-first strategy
   * @param {Object} options - Query options
   * @returns {Promise<{chats: Array, fromCache: boolean, isStale: boolean}>}
   */
  async getChats(options = {}) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) {
      console.warn('[CacheManager] No setting ID available');
      return { chats: [], fromCache: false, isStale: false };
    }

    // Check if cache is valid
    const isCacheValid = await ChatModel.isCacheValid(settingId);
    const cachedChats = await ChatModel.getChats(settingId, options);

    if (cachedChats.length > 0) {
      return {
        chats: cachedChats,
        fromCache: true,
        isStale: !isCacheValid,
      };
    }

    return { chats: [], fromCache: false, isStale: true };
  }

  /**
   * Save chats to cache
   * @param {Array} chats - Array of chat objects from API
   * @returns {Promise<void>}
   */
  async saveChats(chats) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !chats) return;

    await ChatModel.saveChats(chats, settingId);
  }

  /**
   * Update a single chat in cache
   * @param {Object} chat - Chat object
   * @returns {Promise<void>}
   */
  async updateChat(chat) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !chat) return;

    await ChatModel.saveChat(chat, settingId);
  }

  /**
   * Update chat with new message
   * @param {string} chatId - Chat ID
   * @param {Object} messageData - New message data
   * @returns {Promise<void>}
   */
  async updateChatWithMessage(chatId, messageData) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await ChatModel.updateChatWithMessage(chatId, messageData, settingId);
  }

  /**
   * Reset unread count for a chat
   * @param {string} chatId - Chat ID
   * @returns {Promise<void>}
   */
  async resetUnreadCount(chatId) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await ChatModel.resetUnreadCount(chatId, settingId);
  }

  /**
   * Get a single chat by ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<Object|null>}
   */
  async getChatById(chatId) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return null;

    return ChatModel.getChatById(chatId, settingId);
  }

  // ==========================================
  // MESSAGES CACHE OPERATIONS
  // ==========================================

  /**
   * Get messages for a chat with cache-first strategy
   * @param {string} chatId - Chat ID
   * @param {Object} options - Query options
   * @returns {Promise<{messages: Array, fromCache: boolean, hasMore: boolean}>}
   */
  async getMessages(chatId, options = {}) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) {
      return { messages: [], fromCache: false, hasMore: false };
    }

    const messages = await MessageModel.getMessages(chatId, settingId, options);
    const messageCount = await MessageModel.getMessageCount(chatId, settingId);

    return {
      messages,
      fromCache: true,
      hasMore: messageCount > (options.limit || 50) + (options.offset || 0),
      totalCount: messageCount,
    };
  }

  /**
   * Save messages to cache
   * @param {Array} messages - Array of message objects
   * @param {string} chatId - Chat ID
   * @returns {Promise<void>}
   */
  async saveMessages(messages, chatId) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !messages || !chatId) return;

    await MessageModel.saveMessages(messages, chatId, settingId);
  }

  /**
   * Add a single message to cache
   * @param {Object} message - Message object
   * @param {string} chatId - Chat ID
   * @returns {Promise<void>}
   */
  async addMessage(message, chatId) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !message || !chatId) return;

    await MessageModel.saveMessage(message, chatId, settingId);
  }

  /**
   * Add optimistic message for sending
   * @param {Object} message - Message data
   * @param {string} chatId - Chat ID
   * @returns {Promise<string>} Temp ID
   */
  async addOptimisticMessage(message, chatId) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) throw new Error('No setting ID');

    return MessageModel.addOptimisticMessage(message, chatId, settingId);
  }

  /**
   * Update optimistic message with server response
   * @param {string} tempId - Temporary message ID
   * @param {Object} serverMessage - Server response
   * @returns {Promise<void>}
   */
  async updateOptimisticMessage(tempId, serverMessage) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await MessageModel.updateOptimisticMessage(tempId, serverMessage, settingId);
  }

  /**
   * Mark optimistic message as failed
   * @param {string} tempId - Temporary message ID
   * @param {Object} error - Error info
   * @returns {Promise<void>}
   */
  async markMessageFailed(tempId, error) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await MessageModel.markOptimisticMessageFailed(tempId, error, settingId);
  }

  /**
   * Update message status
   * @param {string} messageId - Message ID or wamid
   * @param {Object} updates - Status updates
   * @returns {Promise<void>}
   */
  async updateMessageStatus(messageId, updates) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await MessageModel.updateMessageStatus(messageId, updates, settingId);
  }

  /**
   * Get pending messages for sync
   * @returns {Promise<Array>}
   */
  async getPendingMessages() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return [];

    return MessageModel.getPendingMessages(settingId);
  }

  // ==========================================
  // SYNC QUEUE OPERATIONS
  // ==========================================

  /**
   * Add operation to sync queue (for offline support)
   * @param {string} operation - Operation type (create, update, delete)
   * @param {string} tableName - Table name
   * @param {string} recordId - Record ID
   * @param {Object} data - Operation data
   * @returns {Promise<void>}
   */
  async addToSyncQueue(operation, tableName, recordId, data) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await databaseManager.upsert(Tables.SYNC_QUEUE, {
      operation,
      table_name: tableName,
      record_id: recordId,
      data: JSON.stringify(data),
      setting_id: settingId,
      status: 'pending',
      created_at: Date.now(),
    });
  }

  /**
   * Get pending sync operations
   * @returns {Promise<Array>}
   */
  async getPendingSyncOperations() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return [];

    return databaseManager.query(
      `SELECT * FROM ${Tables.SYNC_QUEUE}
       WHERE setting_id = ? AND status = 'pending' AND retry_count < max_retries
       ORDER BY created_at ASC`,
      [settingId]
    );
  }

  /**
   * Mark sync operation as completed
   * @param {number} id - Sync queue record ID
   * @returns {Promise<void>}
   */
  async markSyncCompleted(id) {
    await databaseManager.execute(
      `UPDATE ${Tables.SYNC_QUEUE} SET status = 'completed', processed_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  }

  /**
   * Mark sync operation as failed
   * @param {number} id - Sync queue record ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<void>}
   */
  async markSyncFailed(id, errorMessage) {
    await databaseManager.execute(
      `UPDATE ${Tables.SYNC_QUEUE}
       SET retry_count = retry_count + 1,
           error_message = ?,
           status = CASE WHEN retry_count + 1 >= max_retries THEN 'failed' ELSE 'pending' END
       WHERE id = ?`,
      [errorMessage, id]
    );
  }

  // ==========================================
  // CACHE METADATA OPERATIONS
  // ==========================================

  /**
   * Get cache metadata value
   * @param {string} key - Metadata key
   * @returns {Promise<string|null>}
   */
  async getCacheMetadata(key) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    const result = await databaseManager.queryFirst(
      `SELECT value FROM ${Tables.CACHE_METADATA} WHERE key = ?`,
      [settingId ? `${key}_${settingId}` : key]
    );
    return result?.value || null;
  }

  /**
   * Set cache metadata value
   * @param {string} key - Metadata key
   * @param {string} value - Value to store
   * @returns {Promise<void>}
   */
  async setCacheMetadata(key, value) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    await databaseManager.upsert(Tables.CACHE_METADATA, {
      key: settingId ? `${key}_${settingId}` : key,
      value: value.toString(),
      setting_id: settingId,
      updated_at: Date.now(),
    });
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Clear all cache for current setting
   * @returns {Promise<void>}
   */
  async clearCurrentSettingCache() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    await databaseManager.clearSettingData(settingId);
    console.log('[CacheManager] Cleared cache for setting:', settingId);
  }

  /**
   * Clear all cached data (for logout)
   * @returns {Promise<void>}
   */
  async clearAllCache() {
    await this.ensureInitialized();

    await databaseManager.clearAllData();
    this.currentSettingId = null;
    console.log('[CacheManager] All cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getCacheStats() {
    await this.ensureInitialized();

    const stats = await databaseManager.getStats();
    const settingId = this.currentSettingId;

    // Get setting-specific counts
    if (settingId) {
      const chatCount = await ChatModel.getChatCount(settingId);
      stats.currentSettingChats = chatCount;
    }

    return stats;
  }

  /**
   * Check if cache has data for current setting
   * @returns {Promise<boolean>}
   */
  async hasCachedData() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return false;

    const chatCount = await ChatModel.getChatCount(settingId);
    return chatCount > 0;
  }

  /**
   * Invalidate chat cache (mark as stale)
   * @returns {Promise<void>}
   */
  async invalidateChatCache() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    // Set last fetch time to 0 to force refresh
    await this.setCacheMetadata(CacheKeys.LAST_CHATS_FETCH, '0');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Ensure manager is initialized before operations
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Close database connection (for app shutdown)
   * @returns {Promise<void>}
   */
  async close() {
    await databaseManager.close();
    this.isInitialized = false;
    console.log('[CacheManager] Closed');
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

export default cacheManager;
