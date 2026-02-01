/**
 * ChatModel - Data model for Chat entities
 *
 * This model handles all database operations related to chats,
 * providing a clean interface between the app and SQLite storage.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables, CacheKeys, CacheExpiry } from '../schema';
import { generateUUID } from '../../utils/helpers';

class ChatModel {
  /**
   * Convert API chat object to database record format
   * @param {Object} chat - Chat object from API
   * @param {string} settingId - Current setting ID
   * @returns {Object} Database record
   */
  static toDbRecord(chat, settingId) {
    const now = Date.now();

    // Extract last message info
    const lastMessage = chat.lastMessage || chat.last_message || {};
    const lastMessageData = lastMessage.message || lastMessage;

    // Extract contact info
    const contact = chat.contact || {};

    return {
      id: generateUUID(),
      server_id: chat._id || chat.id,
      setting_id: settingId,
      contact_id: contact._id || contact.id || null,
      contact_name: contact.name || null,
      contact_phone: contact.phoneNumber || contact.mobile || contact.phone || null,
      contact_profile_pic: contact.profilePic || contact.profile_pic || null,
      wa_id: chat.waId || chat.wa_id || null,
      phone_number_id: chat.phoneNumberId || chat.phone_number_id || null,
      last_message_id: lastMessage._id || lastMessage.id || null,
      last_message_type: lastMessageData.type || 'text',
      last_message_body: this._extractMessageBody(lastMessageData),
      last_message_time: chat.lastMessageTime || lastMessage.timestamp
        ? new Date(chat.lastMessageTime || lastMessage.timestamp).getTime()
        : now,
      last_message_direction: lastMessage.direction || (lastMessage.isFromMe ? 'outbound' : 'inbound'),
      unread_count: chat.unreadCount || chat.unread_count || 0,
      is_pinned: chat.isPinned || chat.is_pinned ? 1 : 0,
      is_archived: chat.isArchived || chat.is_archived ? 1 : 0,
      is_muted: chat.isMuted || chat.is_muted ? 1 : 0,
      status: chat.status || 'active',
      assigned_to: chat.assignedTo || chat.assigned_to || null,
      tags: chat.tags ? JSON.stringify(chat.tags) : null,
      folder_id: chat.folderId || chat.folder_id || null,
      chat_window_status: chat.chatWindowStatus || chat.chat_window_status || null,
      chat_window_expiry: chat.chatWindowExpiry
        ? new Date(chat.chatWindowExpiry).getTime()
        : null,
      created_at: chat.createdAt ? new Date(chat.createdAt).getTime() : now,
      updated_at: chat.updatedAt ? new Date(chat.updatedAt).getTime() : now,
      synced_at: now,
      is_dirty: 0,
    };
  }

  /**
   * Extract message body text from various message types
   */
  static _extractMessageBody(message) {
    if (!message) return null;

    switch (message.type) {
      case 'text':
        return message.body || message.text?.body || null;
      case 'image':
        return message.image?.caption || '[Image]';
      case 'video':
        return message.video?.caption || '[Video]';
      case 'audio':
        return '[Audio]';
      case 'document':
        return message.document?.filename || '[Document]';
      case 'sticker':
        return '[Sticker]';
      case 'location':
        return '[Location]';
      case 'template':
        return '[Template]';
      case 'interactive':
        return message.interactive?.body?.text || '[Interactive]';
      default:
        return message.body || null;
    }
  }

  /**
   * Convert database record to app-friendly format
   * @param {Object} record - Database record
   * @returns {Object} App-friendly chat object
   */
  static fromDbRecord(record) {
    if (!record) return null;

    return {
      _id: record.server_id,
      id: record.server_id,
      waId: record.wa_id,
      phoneNumberId: record.phone_number_id,
      contact: {
        _id: record.contact_id,
        name: record.contact_name,
        phoneNumber: record.contact_phone,
        mobile: record.contact_phone,
        profilePic: record.contact_profile_pic,
      },
      lastMessage: {
        _id: record.last_message_id,
        message: {
          type: record.last_message_type,
          body: record.last_message_body,
        },
        direction: record.last_message_direction,
        timestamp: record.last_message_time,
      },
      lastMessageTime: record.last_message_time,
      unreadCount: record.unread_count,
      isPinned: Boolean(record.is_pinned),
      isArchived: Boolean(record.is_archived),
      isMuted: Boolean(record.is_muted),
      status: record.status,
      assignedTo: record.assigned_to,
      tags: record.tags ? JSON.parse(record.tags) : [],
      folderId: record.folder_id,
      chatWindowStatus: record.chat_window_status,
      chatWindowExpiry: record.chat_window_expiry,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      _cached: true,
      _syncedAt: record.synced_at,
    };
  }

  /**
   * Save multiple chats to database
   * @param {Array} chats - Array of chat objects from API
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveChats(chats, settingId) {
    if (!chats || chats.length === 0) return;

    const records = chats.map((chat) => this.toDbRecord(chat, settingId));
    await databaseManager.batchInsert(Tables.CHATS, records);

    // Update last fetch time
    await this.updateCacheMetadata(CacheKeys.LAST_CHATS_FETCH, settingId);

    // Log:(`[ChatModel] Saved ${chats.length} chats to cache`);
  }

  /**
   * Save a single chat to database
   * @param {Object} chat - Chat object from API
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveChat(chat, settingId) {
    const record = this.toDbRecord(chat, settingId);
    await databaseManager.upsert(Tables.CHATS, record);
  }

  /**
   * Get all chats from cache for a setting
   * @param {string} settingId - Current setting ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  static async getChats(settingId, options = {}) {
    const {
      filter,
      search,
      limit,
      offset = 0,
      sortBy = 'last_message_time',
      sortOrder = 'DESC',
    } = options;

    let sql = `SELECT * FROM ${Tables.CHATS} WHERE setting_id = ?`;
    const params = [settingId];

    // Apply filters
    if (filter === 'unread') {
      sql += ' AND unread_count > 0';
    } else if (filter === 'assigned_to_me') {
      sql += ' AND assigned_to IS NOT NULL';
    }

    // Apply search
    if (search) {
      sql += ' AND (contact_name LIKE ? OR contact_phone LIKE ? OR last_message_body LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Exclude archived by default
    sql += ' AND is_archived = 0';

    // Apply sorting
    sql += ` ORDER BY is_pinned DESC, ${sortBy} ${sortOrder}`;

    // Apply pagination
    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const records = await databaseManager.query(sql, params);
    return records.map((record) => this.fromDbRecord(record));
  }

  /**
   * Get a single chat by ID
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<Object|null>}
   */
  static async getChatById(chatId, settingId) {
    const record = await databaseManager.queryFirst(
      `SELECT * FROM ${Tables.CHATS} WHERE server_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );
    return this.fromDbRecord(record);
  }

  /**
   * Update chat with new message info
   * @param {string} chatId - Chat server ID
   * @param {Object} messageData - New message data
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async updateChatWithMessage(chatId, messageData, settingId) {
    const now = Date.now();

    await databaseManager.execute(
      `UPDATE ${Tables.CHATS}
       SET last_message_id = ?,
           last_message_type = ?,
           last_message_body = ?,
           last_message_time = ?,
           last_message_direction = ?,
           unread_count = unread_count + ?,
           updated_at = ?
       WHERE server_id = ? AND setting_id = ?`,
      [
        messageData._id || messageData.id,
        messageData.type || 'text',
        this._extractMessageBody(messageData.message || messageData),
        messageData.timestamp || now,
        messageData.direction || 'inbound',
        messageData.direction === 'inbound' ? 1 : 0,
        now,
        chatId,
        settingId,
      ]
    );
  }

  /**
   * Reset unread count for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async resetUnreadCount(chatId, settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.CHATS} SET unread_count = 0, updated_at = ? WHERE server_id = ? AND setting_id = ?`,
      [Date.now(), chatId, settingId]
    );
  }

  /**
   * Delete a chat from cache
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async deleteChat(chatId, settingId) {
    await databaseManager.delete(Tables.CHATS, 'server_id = ? AND setting_id = ?', [chatId, settingId]);
  }

  /**
   * Check if cache is valid (not expired)
   * @param {string} settingId - Current setting ID
   * @returns {Promise<boolean>}
   */
  static async isCacheValid(settingId) {
    const metadata = await databaseManager.queryFirst(
      `SELECT value FROM ${Tables.CACHE_METADATA} WHERE key = ? AND setting_id = ?`,
      [CacheKeys.LAST_CHATS_FETCH, settingId]
    );

    if (!metadata) return false;

    const lastFetch = parseInt(metadata.value, 10);
    const now = Date.now();

    return (now - lastFetch) < CacheExpiry.CHATS;
  }

  /**
   * Get chat count for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<number>}
   */
  static async getChatCount(settingId) {
    const result = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.CHATS} WHERE setting_id = ?`,
      [settingId]
    );
    return result?.count || 0;
  }

  /**
   * Update cache metadata
   * @param {string} key - Metadata key
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async updateCacheMetadata(key, settingId) {
    await databaseManager.upsert(Tables.CACHE_METADATA, {
      key: `${key}_${settingId}`,
      value: Date.now().toString(),
      setting_id: settingId,
      updated_at: Date.now(),
    });
  }

  /**
   * Clear all chats for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async clearChats(settingId) {
    await databaseManager.delete(Tables.CHATS, 'setting_id = ?', [settingId]);
    // Log:(`[ChatModel] Cleared all chats for setting: ${settingId}`);
  }
}

export default ChatModel;
