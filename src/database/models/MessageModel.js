/**
 * MessageModel - Data model for Message entities
 *
 * This model handles all database operations related to messages,
 * providing efficient storage and retrieval of chat messages.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

class MessageModel {
  /**
   * Convert API message object to database record format
   * IMPORTANT: We store the FULL original message JSON to return exact same format from cache
   * @param {Object} message - Message object from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Object} Database record
   */
  static toDbRecord(message, chatId, settingId) {
    const now = Date.now();

    // Store the FULL original API message as JSON - this is the primary data
    // We will return this exact same object when reading from cache
    let fullMessageJson = null;
    try {
      fullMessageJson = JSON.stringify(message);

      // SQLite can have issues with very large text fields
      // Limit to 50KB per message to be safe
      const MAX_SIZE = 50000;
      if (fullMessageJson && fullMessageJson.length > MAX_SIZE) {
        const essentialMessage = {
          _id: message._id,
          id: message.id,
          direction: message.direction,
          isFromMe: message.isFromMe,
          status: message.status,
          timestamp: message.timestamp,
          wamid: message.wamid,
          message: message.message,
          senderName: message.senderName,
          senderPhone: message.senderPhone,
        };
        fullMessageJson = JSON.stringify(essentialMessage);
      }
    } catch (e) {
      // Failed to stringify message
    }

    // Extract basic fields for indexing/querying only
    const msgData = message.message || message;
    const messageType = this._extractMessageType(message, msgData);

    return {
      id: generateUUID(),
      server_id: message._id || message.id || null,
      chat_id: chatId,
      setting_id: settingId,
      wa_message_id: message.wamid || message.waMessageId || message.wa_message_id || null,
      direction: message.direction || (message.isFromMe ? 'outbound' : 'inbound'),
      type: messageType,
      body: this._extractBody(msgData, messageType), // For search only
      media_url: null, // Simplified - full data is in metadata
      media_mime_type: null,
      media_filename: null,
      media_caption: null,
      thumbnail_url: null,
      status: message.status || 'sent',
      timestamp: message.timestamp
        ? new Date(message.timestamp).getTime()
        : now,
      sent_at: message.sentAt ? new Date(message.sentAt).getTime() : null,
      delivered_at: message.deliveredAt ? new Date(message.deliveredAt).getTime() : null,
      read_at: message.readAt ? new Date(message.readAt).getTime() : null,
      reaction: null,
      reply_to_id: message.context?.message_id || message.replyTo || null,
      context_message: null,
      interactive_data: null,
      template_data: null,
      metadata: fullMessageJson, // FULL ORIGINAL MESSAGE - this is the source of truth
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
      local_media_path: null,
      local_thumbnail_path: null,
      media_download_status: 'none',
    };
  }

  /**
   * Extract message type from various API structures
   */
  static _extractMessageType(message, msgData) {
    // Try multiple locations for type
    if (msgData?.type) return msgData.type;
    if (message?.type) return message.type;

    // Infer type from content
    if (msgData?.image || message?.image) return 'image';
    if (msgData?.video || message?.video) return 'video';
    if (msgData?.audio || message?.audio) return 'audio';
    if (msgData?.document || message?.document) return 'document';
    if (msgData?.sticker || message?.sticker) return 'sticker';
    if (msgData?.location || message?.location) return 'location';
    if (msgData?.contacts || message?.contacts) return 'contacts';
    if (msgData?.interactive || message?.interactive) return 'interactive';
    if (msgData?.template || message?.template) return 'template';
    if (msgData?.button || message?.button) return 'button';

    return 'text'; // Default fallback
  }

  /**
   * Extract body text from message
   */
  static _extractBody(message, messageType) {
    if (!message) return null;

    const type = messageType || message.type;

    switch (type) {
      case 'text':
        return message.body || message.text?.body || message.text || null;
      case 'image':
        return message.image?.caption || message.caption || null;
      case 'video':
        return message.video?.caption || message.caption || null;
      case 'document':
        return message.document?.caption || message.caption || null;
      case 'interactive':
        return message.interactive?.body?.text || null;
      case 'button':
        return message.button?.text || null;
      case 'location':
        return message.location?.name || message.location?.address || '[Location]';
      case 'contacts':
        return '[Contact]';
      default:
        return message.body || message.text?.body || message.text || null;
    }
  }

  /**
   * Extract media information from message
   */
  static _extractMediaInfo(message, messageType) {
    if (!message) return {};

    const type = messageType || message.type;
    const mediaData = message[type] || {};

    // Also check direct properties on message
    return {
      url: mediaData.link || mediaData.url || mediaData.id || message.mediaUrl || null,
      mimeType: mediaData.mime_type || mediaData.mimeType || message.mimeType || null,
      filename: mediaData.filename || message.filename || null,
      caption: mediaData.caption || message.caption || null,
      thumbnail: mediaData.thumbnail || message.thumbnail || null,
    };
  }

  /**
   * Convert database record to app-friendly format
   * RETURNS THE EXACT SAME FORMAT AS THE ORIGINAL API RESPONSE
   * @param {Object} record - Database record
   * @returns {Object} Original API message object (exact same format)
   */
  static fromDbRecord(record) {
    if (!record) return null;

    // PRIMARY: Return the EXACT original message stored in metadata
    if (record.metadata) {
      try {
        const originalMessage = JSON.parse(record.metadata);

        // Return exact original message with only cache metadata added
        return {
          ...originalMessage,
          _cached: true, // Mark as from cache
          _syncedAt: record.synced_at,
          // Update status from DB in case it changed (e.g., sent -> delivered -> read)
          status: record.status || originalMessage.status,
          // Media download tracking
          _localMediaPath: record.local_media_path || null,
          _localThumbnailPath: record.local_thumbnail_path || null,
          _mediaDownloadStatus: record.media_download_status || 'none',
        };
      } catch (e) {
        // Fall through to fallback reconstruction
      }
    }

    // FALLBACK: Reconstruct basic message if metadata parsing fails
    // This should rarely happen, but provides safety

    return {
      _id: record.server_id || record.temp_id,
      id: record.server_id || record.temp_id,
      wamid: record.wa_message_id,
      waMessageId: record.wa_message_id,
      chatId: record.chat_id,
      direction: record.direction,
      isFromMe: Boolean(record.is_from_me),
      status: record.status,
      timestamp: record.timestamp,
      senderName: record.sender_name,
      senderPhone: record.sender_phone,
      message: {
        type: record.type,
        body: record.body,
      },
      _cached: true,
      _syncedAt: record.synced_at,
      isPending: Boolean(record.is_pending),
      tempId: record.temp_id,
      _localMediaPath: record.local_media_path || null,
      _localThumbnailPath: record.local_thumbnail_path || null,
      _mediaDownloadStatus: record.media_download_status || 'none',
    };
  }

  /**
   * Save multiple messages to database (with deduplication)
   * Checks existing messages by server_id/wa_message_id before inserting.
   * Existing messages are updated; new messages are batch-inserted.
   * @param {Array} messages - Array of message objects from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveMessages(messages, chatId, settingId) {
    if (!messages || messages.length === 0) return;

    // Build lookup of existing messages for this chat
    const existingRows = await databaseManager.query(
      `SELECT id, server_id, wa_message_id FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ?`,
      [chatId, settingId]
    );

    const existingByServerId = new Map();
    const existingByWamid = new Map();
    existingRows.forEach(row => {
      if (row.server_id) existingByServerId.set(row.server_id, row.id);
      if (row.wa_message_id) existingByWamid.set(row.wa_message_id, row.id);
    });

    const newMessages = [];

    for (const msg of messages) {
      const serverId = msg._id || msg.id || null;
      const wamid = msg.wamid || msg.waMessageId || msg.wa_message_id || null;
      const existingId = (serverId && existingByServerId.get(serverId)) ||
                         (wamid && existingByWamid.get(wamid));

      if (existingId) {
        // Update existing record (refresh metadata, status, etc.)
        // Exclude local-only download fields — these are set by updateMediaDownloadStatus
        // and must not be overwritten with null when syncing API data
        try {
          const record = this.toDbRecord(msg, chatId, settingId);
          delete record.id; // Keep original primary key
          delete record.local_media_path;
          delete record.local_thumbnail_path;
          delete record.media_download_status;
          const columns = Object.keys(record);
          const setClause = columns.map(k => `${k} = ?`).join(', ');
          const values = columns.map(k => databaseManager._sanitizeValue(record[k]));
          values.push(existingId);
          await databaseManager.execute(
            `UPDATE ${Tables.MESSAGES} SET ${setClause} WHERE id = ?`,
            values
          );
        } catch (e) {
          // Update failed — skip, don't create duplicate
        }
      } else {
        newMessages.push(msg);
      }
    }

    // Batch insert only truly new messages
    if (newMessages.length > 0) {
      const records = newMessages.map((msg) => this.toDbRecord(msg, chatId, settingId));
      await databaseManager.batchInsert(Tables.MESSAGES, records);
    }
  }

  /**
   * Save a single message to database (with deduplication)
   * Checks if a message with the same server_id or wa_message_id already exists.
   * If so, updates the existing row instead of creating a duplicate.
   * @param {Object} message - Message object from API
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveMessage(message, chatId, settingId) {
    const serverId = message._id || message.id || null;
    const wamid = message.wamid || message.waMessageId || message.wa_message_id || null;

    // Check if message already exists by server_id or wa_message_id
    if (serverId || wamid) {
      const conditions = [];
      const params = [chatId, settingId];

      if (serverId) {
        conditions.push('server_id = ?');
        params.push(serverId);
      }
      if (wamid) {
        conditions.push('wa_message_id = ?');
        params.push(wamid);
      }

      const existing = await databaseManager.queryFirst(
        `SELECT id FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ? AND (${conditions.join(' OR ')})`,
        params
      );

      if (existing) {
        // Update existing record instead of inserting duplicate
        // Exclude local-only download fields — these are set by updateMediaDownloadStatus
        // and must not be overwritten with null when syncing API data
        const record = this.toDbRecord(message, chatId, settingId);
        delete record.id; // Keep original primary key
        delete record.local_media_path;
        delete record.local_thumbnail_path;
        delete record.media_download_status;
        const columns = Object.keys(record);
        const setClause = columns.map(k => `${k} = ?`).join(', ');
        const values = columns.map(k => databaseManager._sanitizeValue(record[k]));
        values.push(existing.id);
        await databaseManager.execute(
          `UPDATE ${Tables.MESSAGES} SET ${setClause} WHERE id = ?`,
          values
        );
        return;
      }
    }

    // No existing match — insert new
    const record = this.toDbRecord(message, chatId, settingId);
    await databaseManager.upsert(Tables.MESSAGES, record);
  }

  /**
   * Delete optimistic messages (temp_ prefixed server_ids) for a chat.
   * Called after syncMissedMessages saves all real server messages,
   * to clean up any orphaned optimistic records that weren't matched by dedup.
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async deleteOptimisticMessages(chatId, settingId) {
    if (!chatId || !settingId) return;
    await databaseManager.execute(
      `DELETE FROM ${Tables.MESSAGES} WHERE chat_id = ? AND setting_id = ? AND server_id LIKE 'temp_%'`,
      [chatId, settingId]
    );
  }

  /**
   * Get messages for a chat
   * @param {string} chatId - Chat server ID
   * @param {string} settingId - Current setting ID
   * @param {Object} options - Query options (limit: null or 0 means no limit)
   * @returns {Promise<Array>}
   */
  static async getMessages(chatId, settingId, options = {}) {
    const {
      limit,
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

    // Only apply LIMIT if explicitly provided and > 0
    if (limit && limit > 0) {
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
    // Log:(`[MessageModel] Deleted all messages for chat: ${chatId}`);
  }

  /**
   * Clear all messages for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async clearMessages(settingId) {
    await databaseManager.delete(Tables.MESSAGES, 'setting_id = ?', [settingId]);
    // Log:(`[MessageModel] Cleared all messages for setting: ${settingId}`);
  }

  /**
   * Update media download status for a message
   * @param {string} messageId - Message server ID or wamid
   * @param {Object} updates - { localMediaPath, localThumbnailPath, downloadStatus }
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async updateMediaDownloadStatus(messageId, updates, settingId) {
    const setClause = [];
    const params = [];

    if (updates.localMediaPath !== undefined) {
      setClause.push('local_media_path = ?');
      params.push(updates.localMediaPath);
    }

    if (updates.localThumbnailPath !== undefined) {
      setClause.push('local_thumbnail_path = ?');
      params.push(updates.localThumbnailPath);
    }

    if (updates.downloadStatus) {
      setClause.push('media_download_status = ?');
      params.push(updates.downloadStatus);
    }

    if (setClause.length === 0) return;

    setClause.push('updated_at = ?');
    params.push(Date.now());

    params.push(messageId, messageId, settingId);

    await databaseManager.execute(
      `UPDATE ${Tables.MESSAGES}
       SET ${setClause.join(', ')}
       WHERE (server_id = ? OR wa_message_id = ?) AND setting_id = ?`,
      params
    );
  }

  /**
   * Reset all downloaded media records to 'none' status
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async clearAllDownloadedMedia(settingId) {
    await databaseManager.execute(
      `UPDATE ${Tables.MESSAGES}
       SET local_media_path = NULL, local_thumbnail_path = NULL, media_download_status = 'none', updated_at = ?
       WHERE setting_id = ? AND media_download_status = 'downloaded'`,
      [Date.now(), settingId]
    );
  }

  /**
   * Get all local file paths for downloaded media (for disk cleanup)
   * @param {string} settingId - Current setting ID
   * @returns {Promise<Array>} Array of { local_media_path, local_thumbnail_path }
   */
  static async getDownloadedMediaPaths(settingId) {
    return databaseManager.query(
      `SELECT local_media_path, local_thumbnail_path FROM ${Tables.MESSAGES}
       WHERE setting_id = ? AND media_download_status = 'downloaded'
         AND local_media_path IS NOT NULL`,
      [settingId]
    );
  }
}

export default MessageModel;
