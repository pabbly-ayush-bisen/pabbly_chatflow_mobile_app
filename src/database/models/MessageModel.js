/**
 * MessageModel - Data model for Message entities
 *
 * This model handles all database operations related to messages,
 * providing efficient storage and retrieval of chat messages.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables, CacheExpiry } from '../schema';
import { generateUUID } from '../../utils/helpers';

class MessageModel {
  /**
   * Convert API message object to database record format
   * @param {Object} message - Message object from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Object} Database record
   */
  static toDbRecord(message, chatId, settingId) {
    const now = Date.now();
    const msgData = message.message || message;

    // Extract media info based on message type
    const mediaInfo = this._extractMediaInfo(msgData);

    return {
      id: generateUUID(),
      server_id: message._id || message.id || null,
      chat_id: chatId,
      setting_id: settingId,
      wa_message_id: message.wamid || message.waMessageId || message.wa_message_id || null,
      direction: message.direction || (message.isFromMe ? 'outbound' : 'inbound'),
      type: msgData.type || 'text',
      body: this._extractBody(msgData),
      media_url: mediaInfo.url,
      media_mime_type: mediaInfo.mimeType,
      media_filename: mediaInfo.filename,
      media_caption: mediaInfo.caption,
      thumbnail_url: mediaInfo.thumbnail,
      status: message.status || 'sent',
      timestamp: message.timestamp
        ? new Date(message.timestamp).getTime()
        : now,
      sent_at: message.sentAt ? new Date(message.sentAt).getTime() : null,
      delivered_at: message.deliveredAt ? new Date(message.deliveredAt).getTime() : null,
      read_at: message.readAt ? new Date(message.readAt).getTime() : null,
      reaction: message.reaction ? JSON.stringify(message.reaction) : null,
      reply_to_id: message.context?.message_id || message.replyTo || null,
      context_message: message.context ? JSON.stringify(message.context) : null,
      interactive_data: msgData.interactive ? JSON.stringify(msgData.interactive) : null,
      template_data: msgData.template ? JSON.stringify(msgData.template) : null,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      is_from_me: message.isFromMe || message.direction === 'outbound' ? 1 : 0,
      sender_name: message.senderName || message.sender?.name || null,
      sender_phone: message.senderPhone || message.sender?.phone || null,
      error_code: message.error?.code || null,
      error_message: message.error?.message || null,
      created_at: message.createdAt ? new Date(message.createdAt).getTime() : now,
      updated_at: now,
      synced_at: now,
      is_dirty: 0,
      is_pending: message.isPending || message.status === 'pending' ? 1 : 0,
      temp_id: message.tempId || null,
    };
  }

  /**
   * Extract body text from message
   */
  static _extractBody(message) {
    if (!message) return null;

    switch (message.type) {
      case 'text':
        return message.body || message.text?.body || null;
      case 'image':
        return message.image?.caption || null;
      case 'video':
        return message.video?.caption || null;
      case 'document':
        return message.document?.caption || null;
      case 'interactive':
        return message.interactive?.body?.text || null;
      case 'button':
        return message.button?.text || null;
      default:
        return message.body || null;
    }
  }

  /**
   * Extract media information from message
   */
  static _extractMediaInfo(message) {
    if (!message) return {};

    const type = message.type;
    const mediaData = message[type] || {};

    return {
      url: mediaData.link || mediaData.url || null,
      mimeType: mediaData.mime_type || mediaData.mimeType || null,
      filename: mediaData.filename || null,
      caption: mediaData.caption || null,
      thumbnail: mediaData.thumbnail || null,
    };
  }

  /**
   * Convert database record to app-friendly format
   * @param {Object} record - Database record
   * @returns {Object} App-friendly message object
   */
  static fromDbRecord(record) {
    if (!record) return null;

    const message = {
      _id: record.server_id || record.temp_id,
      id: record.server_id || record.temp_id,
      wamid: record.wa_message_id,
      waMessageId: record.wa_message_id,
      chatId: record.chat_id,
      direction: record.direction,
      isFromMe: Boolean(record.is_from_me),
      status: record.status,
      timestamp: record.timestamp,
      sentAt: record.sent_at,
      deliveredAt: record.delivered_at,
      readAt: record.read_at,
      senderName: record.sender_name,
      senderPhone: record.sender_phone,
      message: {
        type: record.type,
      },
      _cached: true,
      _syncedAt: record.synced_at,
      isPending: Boolean(record.is_pending),
      tempId: record.temp_id,
    };

    // Reconstruct message content based on type
    switch (record.type) {
      case 'text':
        message.message.body = record.body;
        message.message.text = { body: record.body };
        break;
      case 'image':
        message.message.image = {
          link: record.media_url,
          url: record.media_url,
          mime_type: record.media_mime_type,
          caption: record.media_caption,
          thumbnail: record.thumbnail_url,
        };
        break;
      case 'video':
        message.message.video = {
          link: record.media_url,
          url: record.media_url,
          mime_type: record.media_mime_type,
          caption: record.media_caption,
          thumbnail: record.thumbnail_url,
        };
        break;
      case 'audio':
        message.message.audio = {
          link: record.media_url,
          url: record.media_url,
          mime_type: record.media_mime_type,
        };
        break;
      case 'document':
        message.message.document = {
          link: record.media_url,
          url: record.media_url,
          filename: record.media_filename,
          mime_type: record.media_mime_type,
          caption: record.media_caption,
        };
        break;
      case 'sticker':
        message.message.sticker = {
          link: record.media_url,
          url: record.media_url,
          mime_type: record.media_mime_type,
        };
        break;
      case 'interactive':
        message.message.interactive = record.interactive_data
          ? JSON.parse(record.interactive_data)
          : null;
        break;
      case 'template':
        message.message.template = record.template_data
          ? JSON.parse(record.template_data)
          : null;
        break;
      default:
        message.message.body = record.body;
    }

    // Add reaction if exists
    if (record.reaction) {
      message.reaction = JSON.parse(record.reaction);
    }

    // Add context if exists
    if (record.context_message) {
      message.context = JSON.parse(record.context_message);
    }

    // Add error info if exists
    if (record.error_code || record.error_message) {
      message.error = {
        code: record.error_code,
        message: record.error_message,
      };
    }

    return message;
  }

  /**
   * Save multiple messages to database
   * @param {Array} messages - Array of message objects from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveMessages(messages, chatId, settingId) {
    if (!messages || messages.length === 0) return;

    const records = messages.map((msg) => this.toDbRecord(msg, chatId, settingId));
    await databaseManager.batchInsert(Tables.MESSAGES, records);

    console.log(`[MessageModel] Saved ${messages.length} messages for chat: ${chatId}`);
  }

  /**
   * Save a single message to database
   * @param {Object} message - Message object from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveMessage(message, chatId, settingId) {
    const record = this.toDbRecord(message, chatId, settingId);
    await databaseManager.upsert(Tables.MESSAGES, record);
  }

  /**
   * Get messages for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  static async getMessages(chatId, settingId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      beforeTimestamp,
      afterTimestamp,
    } = options;

    let sql = `SELECT * FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ?`;
    const params = [chatId, settingId];

    if (beforeTimestamp) {
      sql += ' AND timestamp < ?';
      params.push(beforeTimestamp);
    }

    if (afterTimestamp) {
      sql += ' AND timestamp > ?';
      params.push(afterTimestamp);
    }

    sql += ' ORDER BY timestamp DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const records = await databaseManager.query(sql, params);

    // Return in chronological order (oldest first)
    return records.map((record) => this.fromDbRecord(record)).reverse();
  }

  /**
   * Get a single message by ID
   * @param {string} messageId - Message server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<Object|null>}
   */
  static async getMessageById(messageId, settingId) {
    const record = await databaseManager.queryFirst(
      `SELECT * FROM ${Tables.MESSAGES} WHERE (server_id = ? OR temp_id = ?) AND setting_id = ?`,
      [messageId, messageId, settingId]
    );
    return this.fromDbRecord(record);
  }

  /**
   * Update message status
   * @param {string} messageId - Message server ID or wamid
   * @param {Object} updates - Status updates
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async updateMessageStatus(messageId, updates, settingId) {
    const now = Date.now();
    const setClause = [];
    const params = [];

    if (updates.status) {
      setClause.push('status = ?');
      params.push(updates.status);
    }

    if (updates.wamid) {
      setClause.push('wa_message_id = ?');
      params.push(updates.wamid);
    }

    if (updates.serverId) {
      setClause.push('server_id = ?');
      params.push(updates.serverId);
    }

    if (updates.sentAt) {
      setClause.push('sent_at = ?');
      params.push(new Date(updates.sentAt).getTime());
    }

    if (updates.deliveredAt) {
      setClause.push('delivered_at = ?');
      params.push(new Date(updates.deliveredAt).getTime());
    }

    if (updates.readAt) {
      setClause.push('read_at = ?');
      params.push(new Date(updates.readAt).getTime());
    }

    if (updates.error) {
      setClause.push('error_code = ?, error_message = ?');
      params.push(updates.error.code, updates.error.message);
    }

    setClause.push('updated_at = ?');
    params.push(now);

    setClause.push('is_pending = ?');
    params.push(updates.status === 'pending' ? 1 : 0);

    params.push(messageId, messageId, messageId, settingId);

    await databaseManager.execute(
      `UPDATE ${Tables.MESSAGES}
       SET ${setClause.join(', ')}
       WHERE (server_id = ? OR wa_message_id = ? OR temp_id = ?) AND setting_id = ?`,
      params
    );
  }

  /**
   * Add optimistic message (for sending)
   * @param {Object} message - Optimistic message data
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<string>} Temp ID
   */
  static async addOptimisticMessage(message, chatId, settingId) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const record = {
      id: generateUUID(),
      server_id: null,
      chat_id: chatId,
      setting_id: settingId,
      wa_message_id: null,
      direction: 'outbound',
      type: message.type || 'text',
      body: message.body || message.text,
      media_url: message.mediaUrl || null,
      media_mime_type: message.mimeType || null,
      media_filename: message.filename || null,
      media_caption: message.caption || null,
      status: 'pending',
      timestamp: Date.now(),
      is_from_me: 1,
      is_pending: 1,
      temp_id: tempId,
      created_at: Date.now(),
      updated_at: Date.now(),
      synced_at: null,
      is_dirty: 1,
    };

    await databaseManager.upsert(Tables.MESSAGES, record);
    return tempId;
  }

  /**
   * Update optimistic message with server response
   * @param {string} tempId - Temporary message ID
   * @param {Object} serverMessage - Server response message
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async updateOptimisticMessage(tempId, serverMessage, settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.MESSAGES}
       SET server_id = ?,
           wa_message_id = ?,
           status = ?,
           sent_at = ?,
           is_pending = 0,
           is_dirty = 0,
           synced_at = ?,
           updated_at = ?
       WHERE temp_id = ? AND setting_id = ?`,
      [
        serverMessage._id || serverMessage.id,
        serverMessage.wamid || serverMessage.waMessageId,
        serverMessage.status || 'sent',
        Date.now(),
        Date.now(),
        Date.now(),
        tempId,
        settingId,
      ]
    );
  }

  /**
   * Mark optimistic message as failed
   * @param {string} tempId - Temporary message ID
   * @param {Object} error - Error information
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async markOptimisticMessageFailed(tempId, error, settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.MESSAGES}
       SET status = 'failed',
           error_code = ?,
           error_message = ?,
           is_pending = 0,
           updated_at = ?
       WHERE temp_id = ? AND setting_id = ?`,
      [error?.code || 'unknown', error?.message || 'Failed to send', Date.now(), tempId, settingId]
    );
  }

  /**
   * Get pending messages for sync
   * @param {string} settingId - Current setting ID
   * @returns {Promise<Array>}
   */
  static async getPendingMessages(settingId) {
    const records = await databaseManager.query(
      `SELECT * FROM ${Tables.MESSAGES}
       WHERE setting_id = ? AND is_pending = 1 AND status != 'failed'
       ORDER BY timestamp ASC`,
      [settingId]
    );
    return records.map((record) => this.fromDbRecord(record));
  }

  /**
   * Get message count for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<number>}
   */
  static async getMessageCount(chatId, settingId) {
    const result = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );
    return result?.count || 0;
  }

  /**
   * Get the latest message timestamp for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<number|null>}
   */
  static async getLatestMessageTimestamp(chatId, settingId) {
    const result = await databaseManager.queryFirst(
      `SELECT MAX(timestamp) as latest FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );
    return result?.latest || null;
  }

  /**
   * Delete messages for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async deleteMessagesForChat(chatId, settingId) {
    await databaseManager.delete(Tables.MESSAGES, 'chat_id = ? AND setting_id = ?', [chatId, settingId]);
    console.log(`[MessageModel] Deleted all messages for chat: ${chatId}`);
  }

  /**
   * Clear all messages for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async clearMessages(settingId) {
    await databaseManager.delete(Tables.MESSAGES, 'setting_id = ?', [settingId]);
    console.log(`[MessageModel] Cleared all messages for setting: ${settingId}`);
  }
}

export default MessageModel;
