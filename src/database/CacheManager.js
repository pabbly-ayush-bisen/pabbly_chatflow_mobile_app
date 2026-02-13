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
import { ChatModel, MessageModel, QuickReplyModel, WANumberModel, DashboardStatsModel, AppSettingsModel, ContactModel, ContactListModel } from './models';
import { StatTypes } from './models/DashboardStatsModel';
import { SettingKeys } from './models/AppSettingsModel';
import { Tables, CacheKeys } from './schema';
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

      // Get PREVIOUS setting ID from cache storage (used for account switch detection)
      // This is the settingId that was used in the last session
      const cachedSettingId = await AsyncStorage.getItem('@pabbly_chatflow_current_settingId');

      // Also check legacy keys for backward compatibility
      const settingId = cachedSettingId ||
        await AsyncStorage.getItem('settingId') ||
        await AsyncStorage.getItem('@pabbly_chatflow_settingId');

      this.currentSettingId = settingId;
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set the current setting ID (on login or account switch)
   * Clears cache if switching to a different account
   * @param {string} settingId - Setting ID
   * @returns {Promise<void>}
   */
  async setSettingId(settingId) {
    const previousSettingId = this.currentSettingId;

    // IMPORTANT: Update currentSettingId FIRST before any async operations
    // This ensures any concurrent cache reads will use the NEW settingId
    // and won't return stale data from the old account
    this.currentSettingId = settingId;

    // Clear cache if switching to a different account
    if (previousSettingId && previousSettingId !== settingId) {
      try {
        await databaseManager.clearAllData();
      } catch (error) {
        // Ignore cache clearing errors
      }
    }

    // Store the current settingId in AsyncStorage for persistence
    if (settingId) {
      try {
        await AsyncStorage.setItem('@pabbly_chatflow_current_settingId', settingId);
      } catch (e) {
        // Ignore storage errors
      }
    }
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
      // Warn:('[CacheManager] No setting ID available');
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
   * @param {Object} options - Query options (pass {} or no limit for ALL messages)
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

    // If no limit specified, all messages are returned, so hasMore is false
    const hasMore = options.limit && options.limit > 0
      ? messageCount > options.limit + (options.offset || 0)
      : false;

    return {
      messages,
      fromCache: true,
      hasMore,
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
  // QUICK REPLIES CACHE OPERATIONS
  // ==========================================

  /**
   * Get quick replies from cache
   * @returns {Promise<{quickReplies: Array, fromCache: boolean}>}
   */
  async getQuickReplies() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return { quickReplies: [], fromCache: false };

    const quickReplies = await QuickReplyModel.getQuickReplies(settingId);
    return { quickReplies, fromCache: quickReplies.length > 0 };
  }

  /**
   * Save quick replies to cache
   * @param {Array} quickReplies - Array of quick reply objects from API
   * @returns {Promise<void>}
   */
  async saveQuickReplies(quickReplies) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !quickReplies) return;

    await QuickReplyModel.saveQuickReplies(quickReplies, settingId);
  }

  /**
   * Check if quick replies are cached
   * @returns {Promise<boolean>}
   */
  async hasQuickReplies() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return false;

    return QuickReplyModel.hasQuickReplies(settingId);
  }

  // ==========================================
  // CONTACTS CACHE OPERATIONS
  // ==========================================

  /**
   * Get contacts from cache.
   * On initial load (skip=0, no search), returns ALL cached contacts for the list.
   * On subsequent calls (skip>0 or search), uses paginated query.
   * @param {Object} [options] - Query options (skip, limit, search, listName)
   * @returns {Promise<{contacts: Array, totalCount: number, fromCache: boolean}>}
   */
  async getContacts(options = {}) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) {
      return { contacts: [], totalCount: 0, fromCache: false };
    }

    const { skip = 0, search, listName } = options;

    // Initial load: return ALL cached contacts for this list
    if (skip === 0 && !search) {
      const result = await ContactModel.getAllContacts(settingId, listName);
      return {
        contacts: result.contacts,
        totalCount: result.totalCount,
        fromCache: result.contacts.length > 0,
      };
    }

    // Pagination or search: use standard paginated query
    const result = await ContactModel.getContacts(settingId, options);
    return {
      contacts: result.contacts,
      totalCount: result.totalCount,
      fromCache: result.contacts.length > 0,
    };
  }

  /**
   * Save contacts to cache (append mode with sort order).
   * @param {Array} contacts - Array of contact objects from API
   * @param {string} [listName] - The list name filter (null for "All Contacts")
   * @param {number} [startIndex=0] - Starting sort_order index (API skip value)
   * @returns {Promise<void>}
   */
  async saveContacts(contacts, listName = null, startIndex = 0) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !contacts) return;

    await ContactModel.saveContacts(contacts, settingId, listName, startIndex);
  }

  /**
   * Save the server-reported total count for a contact list.
   * @param {string|null} listName - List name (null for "All Contacts")
   * @param {number} totalCount - Server total count
   * @returns {Promise<void>}
   */
  async saveContactsTotalCount(listName, totalCount) {
    await this.ensureInitialized();
    const key = `contacts_total_${listName || '__all__'}`;
    await AppSettingsModel.save(key, { totalCount });
  }

  /**
   * Get the cached server-reported total count for a contact list.
   * @param {string|null} listName - List name (null for "All Contacts")
   * @returns {Promise<number|null>} Total count, or null if not cached
   */
  async getContactsTotalCount(listName) {
    await this.ensureInitialized();
    const key = `contacts_total_${listName || '__all__'}`;
    const data = await AppSettingsModel.get(key);
    return data?.totalCount ?? null;
  }

  /**
   * Get count of cached contacts for a specific list.
   * @param {string|null} listName - List name (null for "All Contacts")
   * @returns {Promise<number>}
   */
  async getCachedContactCount(listName) {
    await this.ensureInitialized();
    const settingId = this.currentSettingId;
    if (!settingId) return 0;
    return ContactModel.getContactCount(settingId, listName);
  }

  /**
   * Clear cached contacts for a specific list (used by pull-to-refresh).
   * Only clears the specified list's contacts, not other lists.
   * Also clears the stored totalCount for this list.
   * @param {string|null} listName - List name (null for "All Contacts")
   * @returns {Promise<void>}
   */
  async clearContactsForList(listName) {
    await this.ensureInitialized();
    const settingId = this.currentSettingId;
    if (!settingId) return;

    await ContactModel.clearContactsForList(settingId, listName);
    const key = `contacts_total_${listName || '__all__'}`;
    await AppSettingsModel.remove(key);
  }

  /**
   * Check if contacts are cached for current setting
   * @returns {Promise<boolean>}
   */
  async hasContacts() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return false;

    return ContactModel.hasContacts(settingId);
  }

  // ==========================================
  // CONTACT LISTS CACHE OPERATIONS
  // ==========================================

  /**
   * Get contact lists from cache
   * @returns {Promise<{contactLists: Array, fromCache: boolean}>}
   */
  async getContactLists() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return { contactLists: [], fromCache: false };

    const contactLists = await ContactListModel.getContactLists(settingId);
    return { contactLists, fromCache: contactLists.length > 0 };
  }

  /**
   * Save contact lists to cache
   * @param {Array} lists - Array of contact list objects from API
   * @returns {Promise<void>}
   */
  async saveContactLists(lists) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !lists) return;

    await ContactListModel.saveContactLists(lists, settingId);
  }

  /**
   * Check if contact lists are cached for current setting
   * @returns {Promise<boolean>}
   */
  async hasContactLists() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return false;

    return ContactListModel.hasContactLists(settingId);
  }

  // ==========================================
  // DASHBOARD STATS CACHE OPERATIONS
  // ==========================================

  /**
   * Get cached dashboard stats (WANumberCount, totalQuota, quotaUsed)
   * @returns {Promise<{data: Object|null, fromCache: boolean}>}
   */
  async getDashboardStats() {
    await this.ensureInitialized();

    const data = await DashboardStatsModel.getStats(StatTypes.OVERVIEW);
    return { data, fromCache: data !== null };
  }

  /**
   * Save dashboard stats to cache
   * @param {Object} stats - Stats object from API (e.g., { WANumberCount, totalQuota, quotaUsed })
   * @returns {Promise<void>}
   */
  async saveDashboardStats(stats) {
    await this.ensureInitialized();
    if (!stats) return;

    await DashboardStatsModel.saveStats(StatTypes.OVERVIEW, stats);
  }

  /**
   * Get the age of cached dashboard stats (for expiry checks)
   * @returns {Promise<number>} Age in milliseconds, Infinity if not cached
   */
  async getDashboardStatsAge() {
    await this.ensureInitialized();
    return DashboardStatsModel.getStatsAge(StatTypes.OVERVIEW);
  }

  // ==========================================
  // WA NUMBERS CACHE OPERATIONS
  // ==========================================

  /**
   * Get cached WA numbers
   * @param {Object} [options] - Query options (folderId, status)
   * @returns {Promise<{waNumbers: Array, fromCache: boolean}>}
   */
  async getWANumbers(options = {}) {
    await this.ensureInitialized();

    const waNumbers = await WANumberModel.getWANumbers(options);
    return { waNumbers, fromCache: waNumbers.length > 0 };
  }

  /**
   * Save WA numbers to cache (replace-all strategy)
   * @param {Array} waNumbers - Array of WA number objects from API
   * @returns {Promise<void>}
   */
  async saveWANumbers(waNumbers) {
    await this.ensureInitialized();
    if (!waNumbers) return;

    await WANumberModel.saveWANumbers(waNumbers);
  }

  /**
   * Check if WA numbers are cached
   * @returns {Promise<boolean>}
   */
  async hasWANumbers() {
    await this.ensureInitialized();
    return WANumberModel.hasWANumbers();
  }

  // ==========================================
  // APP SETTINGS CACHE OPERATIONS (Generic JSON)
  // ==========================================

  /**
   * Get a cached app setting by key
   * @param {string} key - Setting key (e.g., SettingKeys.FOLDERS)
   * @param {string} [settingId] - Setting ID, defaults to '_global_'
   * @returns {Promise<any|null>} Parsed data, or null if not found
   */
  async getAppSetting(key, settingId) {
    await this.ensureInitialized();
    return AppSettingsModel.get(key, settingId);
  }

  /**
   * Save an app setting to cache
   * @param {string} key - Setting key (e.g., SettingKeys.FOLDERS)
   * @param {any} data - Data to cache
   * @param {string} [settingId] - Setting ID, defaults to '_global_'
   * @returns {Promise<void>}
   */
  async saveAppSetting(key, data, settingId) {
    await this.ensureInitialized();
    await AppSettingsModel.save(key, data, settingId);
  }

  /**
   * Get the age of a cached app setting (for expiry checks)
   * @param {string} key - Setting key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<number>} Age in milliseconds, Infinity if not cached
   */
  async getAppSettingAge(key, settingId) {
    await this.ensureInitialized();
    return AppSettingsModel.getAge(key, settingId);
  }

  // ==========================================
  // LOCAL SEARCH OPERATIONS
  // ==========================================

  /**
   * Search chats locally by contact name, phone, or last message body
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchChatsLocally(query) {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId || !query) return [];

    return ChatModel.getChats(settingId, { search: query, limit: 50 });
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

  /**
   * Get permanently failed sync operations (exceeded max retries)
   * @returns {Promise<Array>}
   */
  async getPermanentlyFailedOps() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return [];

    return databaseManager.query(
      `SELECT * FROM ${Tables.SYNC_QUEUE}
       WHERE setting_id = ? AND status = 'failed'
       ORDER BY created_at ASC`,
      [settingId]
    );
  }

  /**
   * Remove completed and old failed operations from sync queue
   * @returns {Promise<void>}
   */
  async cleanupSyncQueue() {
    await this.ensureInitialized();

    const settingId = this.currentSettingId;
    if (!settingId) return;

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    await databaseManager.execute(
      `DELETE FROM ${Tables.SYNC_QUEUE}
       WHERE setting_id = ? AND (status = 'completed' OR (status = 'failed' AND created_at < ?))`,
      [settingId, oneDayAgo]
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
    // Log:('[CacheManager] Cleared cache for setting:', settingId);
  }

  /**
   * Clear all cached data (for logout)
   * @returns {Promise<void>}
   */
  async clearAllCache() {
    await this.ensureInitialized();

    await databaseManager.clearAllData();
    this.currentSettingId = null;
    // Log:('[CacheManager] All cache cleared');
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
    // Log:('[CacheManager] Closed');
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

export default cacheManager;
