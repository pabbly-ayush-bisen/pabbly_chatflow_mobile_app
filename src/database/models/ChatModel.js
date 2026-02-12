/**
 * ChatModel - Data model for Chat entities
 *
 * This model handles all database operations related to chats,
 * providing a clean interface between the app and SQLite storage.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables, CacheKeys } from '../schema';
import { generateUUID } from '../../utils/helpers';

class ChatModel {
  /**
   * Convert API chat object to database record format
   * @param {Object} chat - Chat object from API
   * @param {string} settingId - Current setting ID
   * @returns {Object} Database record
   */
  /**
   * Extract lastMessage from various API formats
   * Mirrors normalizeLastMessage logic in inboxSlice.jsx
   */
  static _normalizeLastMessage(chat) {
    if (!chat || typeof chat !== 'object') return null;

    // 1. Direct object properties
    const direct = chat.lastMessage || chat.last_message || chat.latestMessage || chat.latest_message || null;
    if (direct && typeof direct === 'object' && Object.keys(direct).length > 0) return direct;

    // 2. Messages array (last element)
    const msgs = Array.isArray(chat.messages) ? chat.messages : null;
    if (msgs && msgs.length > 0) return msgs[msgs.length - 1];

    // 3. Build synthetic lastMessage from flat fields
    const type = chat.lastMessageType || chat.last_message_type || null;
    const text = chat.lastMessageText || chat.last_message_text || chat.lastMessageBody || chat.last_message_body || null;
    const lastAt = chat.lastMessageAt || chat.last_message_at || chat.lastMessageTime || chat.last_message_time || chat.updatedAt || chat.createdAt || null;
    const status = chat.lastMessageStatus || chat.last_message_status || null;
    const sentBy = chat.lastMessageSentBy || chat.last_message_sent_by || null;
    const direction = chat.lastMessageDirection || chat.last_message_direction || null;

    if (!type && !text) return null;

    return {
      type: type || 'text',
      status: status || undefined,
      sentBy: sentBy || undefined,
      direction: direction || undefined,
      createdAt: lastAt || undefined,
      timestamp: lastAt || undefined,
      message: { body: text || '' },
    };
  }

  static toDbRecord(chat, settingId) {
    const now = Date.now();

    // Extract last message info — normalize from all API formats
    const lastMessage = this._normalizeLastMessage(chat) || {};
    const lastMessageData = lastMessage.message || lastMessage;
    // Type can be on lastMessage (API format) or lastMessage.message (nested format)
    const messageType = lastMessage.type || lastMessageData.type || 'text';

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
      contact_last_active: contact.lastActive || contact.last_active || null,
      contact_json: Object.keys(contact).length > 0 ? JSON.stringify(contact) : null,
      wa_id: chat.waId || chat.wa_id || null,
      phone_number_id: chat.phoneNumberId || chat.phone_number_id || null,
      last_message_id: lastMessage._id || lastMessage.id || null,
      last_message_type: messageType,
      last_message_body: this._extractMessageBody({ ...lastMessageData, type: messageType }),
      last_message_time: (() => {
        const ts = lastMessage.timestamp || lastMessage.createdAt || chat.lastMessageTime
          || chat.lastMessageAt || chat.last_message_time || chat.last_message_at
          || chat.updatedAt || chat.createdAt;
        return ts ? new Date(ts).getTime() : now;
      })(),
      last_message_direction: lastMessage.direction || (lastMessage.isFromMe ? 'outbound' : 'inbound'),
      last_message_json: (lastMessage && Object.keys(lastMessage).length > 0)
        ? JSON.stringify(lastMessage)
        : null,
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
      messages_loaded: chat.messagesLoaded || chat.messages_loaded || 0,
      messages_loaded_at: chat.messagesLoadedAt || chat.messages_loaded_at || null,
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

    // Parse full lastMessage from JSON blob (zero data loss)
    let lastMessage = null;
    if (record.last_message_json) {
      try {
        lastMessage = JSON.parse(record.last_message_json);
      } catch (e) {
        lastMessage = null;
      }
    }

    // Fallback for rows saved before V8 (without JSON blob)
    if (!lastMessage) {
      lastMessage = {
        _id: record.last_message_id,
        type: record.last_message_type,
        message: {
          type: record.last_message_type,
          body: record.last_message_body,
        },
        direction: record.last_message_direction,
        timestamp: record.last_message_time,
      };
    }

    // Parse full contact from JSON (V12+), fallback to individual columns
    let contactObj = null;
    if (record.contact_json) {
      try {
        contactObj = JSON.parse(record.contact_json);
      } catch (e) {
        contactObj = null;
      }
    }

    return {
      _id: record.server_id,
      id: record.server_id,
      waId: record.wa_id,
      phoneNumberId: record.phone_number_id,
      contact: contactObj || {
        _id: record.contact_id,
        name: record.contact_name,
        phoneNumber: record.contact_phone,
        mobile: record.contact_phone,
        profilePic: record.contact_profile_pic,
        lastActive: record.contact_last_active || null,
      },
      lastMessage,
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
      messagesLoaded: Boolean(record.messages_loaded),
      messagesLoadedAt: record.messages_loaded_at,
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
    if (!chats || chats.length === 0) {
      return;
    }

    const records = chats.map((chat) => this.toDbRecord(chat, settingId));
    await databaseManager.batchInsert(Tables.CHATS, records);

    // Update last fetch time
    await this.updateCacheMetadata(CacheKeys.LAST_CHATS_FETCH, settingId);
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
    const messageType = messageData.type || 'text';
    const extractedBody = this._extractMessageBody(messageData.message || messageData);

    // Build the lastMessage object to store as JSON
    const lastMessageObj = {
      _id: messageData._id || messageData.id,
      type: messageType,
      message: messageData.message || { type: messageType, body: extractedBody },
      direction: messageData.direction || 'inbound',
      status: messageData.status || null,
      sentBy: messageData.sentBy || null,
      timestamp: messageData.timestamp || now,
      createdAt: messageData.createdAt || messageData.timestamp || now,
    };

    await databaseManager.execute(
      `UPDATE ${Tables.CHATS}
       SET last_message_id = ?,
           last_message_type = ?,
           last_message_body = ?,
           last_message_time = ?,
           last_message_direction = ?,
           last_message_json = ?,
           unread_count = unread_count + ?,
           updated_at = ?
       WHERE server_id = ? AND setting_id = ?`,
      [
        messageData._id || messageData.id,
        messageType,
        extractedBody,
        messageData.timestamp || now,
        messageData.direction || 'inbound',
        JSON.stringify(lastMessageObj),
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
   * Check if cache is valid
   * With device-primary strategy, cache is valid as long as data exists
   * No time-based expiry - data is refreshed only via explicit refresh or socket updates
   * @param {string} settingId - Current setting ID
   * @returns {Promise<boolean>}
   */
  static async isCacheValid(settingId) {
    // Check if we have any cached data
    const count = await this.getChatCount(settingId);

    // Cache is valid if we have any data
    // This implements device-primary strategy like WhatsApp
    return count > 0;
  }

  /**
   * Check if messages have been loaded for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<boolean>}
   */
  static async areMessagesLoaded(chatId, settingId) {
    const result = await databaseManager.queryFirst(
      `SELECT messages_loaded FROM ${Tables.CHATS} WHERE server_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );
    return result?.messages_loaded === 1;
  }

  /**
   * Mark messages as loaded for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async markMessagesLoaded(chatId, settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.CHATS} SET messages_loaded = 1, messages_loaded_at = ? WHERE server_id = ? AND setting_id = ?`,
      [Date.now(), chatId, settingId]
    );
  }

  /**
   * Reset messages loaded flag for a chat (for force refresh)
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async resetMessagesLoaded(chatId, settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.CHATS} SET messages_loaded = 0, messages_loaded_at = NULL WHERE server_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );
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
