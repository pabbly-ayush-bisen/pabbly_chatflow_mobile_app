/**
 * QuickReplyModel - SQLite model for quick replies
 *
 * Handles saving, retrieving, and managing quick replies in the local SQLite cache.
 * Follows the same pattern as ChatModel and MessageModel.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

class QuickReplyModel {
  /**
   * Convert API quick reply object to database record
   * @param {Object} qr - Quick reply from API
   * @param {string} settingId - Current setting ID
   * @returns {Object} Database record
   */
  static toDbRecord(qr, settingId) {
    return {
      id: generateUUID(),
      server_id: qr._id || qr.id,
      setting_id: settingId,
      shortcut: qr.shortcut || qr.title || '',
      message: qr.message || qr.body || '',
      attachment_type: qr.attachmentType || qr.attachment_type || null,
      attachment_url: qr.attachmentUrl || qr.attachment_url || null,
      created_at: qr.createdAt ? new Date(qr.createdAt).getTime() : Date.now(),
      updated_at: qr.updatedAt ? new Date(qr.updatedAt).getTime() : Date.now(),
      synced_at: Date.now(),
    };
  }

  /**
   * Convert database row back to API-shaped quick reply object
   * @param {Object} row - SQLite row
   * @returns {Object} Quick reply object
   */
  static _rowToQuickReply(row) {
    return {
      _id: row.server_id,
      id: row.server_id,
      shortcut: row.shortcut,
      title: row.shortcut,
      message: row.message,
      body: row.message,
      attachmentType: row.attachment_type || undefined,
      attachmentUrl: row.attachment_url || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  /**
   * Save quick replies to SQLite (bulk upsert)
   * @param {Array} quickReplies - Array of quick reply objects from API
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async saveQuickReplies(quickReplies, settingId) {
    if (!quickReplies || quickReplies.length === 0) return;

    const records = quickReplies.map((qr) => this.toDbRecord(qr, settingId));
    await databaseManager.batchInsert(Tables.QUICK_REPLIES, records);
  }

  /**
   * Get all quick replies for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<Array>}
   */
  static async getQuickReplies(settingId) {
    const rows = await databaseManager.query(
      `SELECT * FROM ${Tables.QUICK_REPLIES} WHERE setting_id = ? ORDER BY updated_at DESC`,
      [settingId]
    );
    return rows.map((row) => this._rowToQuickReply(row));
  }

  /**
   * Check if quick replies are cached for this setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<boolean>}
   */
  static async hasQuickReplies(settingId) {
    const result = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.QUICK_REPLIES} WHERE setting_id = ?`,
      [settingId]
    );
    return (result?.count || 0) > 0;
  }

  /**
   * Clear all quick replies for a setting
   * @param {string} settingId - Current setting ID
   * @returns {Promise<void>}
   */
  static async clearQuickReplies(settingId) {
    await databaseManager.execute(
      `DELETE FROM ${Tables.QUICK_REPLIES} WHERE setting_id = ?`,
      [settingId]
    );
  }
}

export default QuickReplyModel;
