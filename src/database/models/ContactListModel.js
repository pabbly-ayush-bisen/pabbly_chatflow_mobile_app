/**
 * ContactListModel - SQLite model for contact lists
 *
 * Handles saving and retrieving contact list groups (e.g., "Leads", "Customers")
 * that appear as filter chips on the ContactsScreen.
 * Stores full API response in metadata column for zero data loss.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

class ContactListModel {
  /**
   * Convert API contact list object to database record.
   * @param {Object} list - Contact list object from API (e.g., { _id, listName, count, contactsCount })
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Object} Database record
   */
  static toDbRecord(list, settingId) {
    const now = Date.now();

    let metadataJson = null;
    try {
      metadataJson = JSON.stringify(list);
    } catch (e) {
      // Failed to stringify — individual columns will serve as fallback
    }

    return {
      id: generateUUID(),
      server_id: list._id || list.id,
      setting_id: settingId,
      list_name: list.listName || list.name || '',
      contacts_count: list.count ?? list.contactsCount ?? 0,
      metadata: metadataJson,
      created_at: now,
      updated_at: now,
      synced_at: now,
    };
  }

  /**
   * Convert database record back to API-shaped contact list object.
   * Parses metadata JSON first; falls back to reconstructing from individual columns.
   * @param {Object} record - SQLite row
   * @returns {Object} Contact list object matching the API response shape
   */
  static fromDbRecord(record) {
    // Primary path: parse full JSON from metadata column
    if (record.metadata) {
      try {
        const original = JSON.parse(record.metadata);
        original._cached = true;
        original._syncedAt = record.synced_at;
        return original;
      } catch (e) {
        // Fall through to fallback reconstruction
      }
    }

    // Fallback: reconstruct from individual columns
    return {
      _id: record.server_id,
      listName: record.list_name,
      count: record.contacts_count || 0,
      contactsCount: record.contacts_count || 0,
      _cached: true,
      _syncedAt: record.synced_at,
    };
  }

  /**
   * Save contact lists to SQLite (replace-all strategy per setting).
   * Uses a single transaction so DELETE + INSERT is atomic — if the app
   * is killed mid-save, the old data is preserved instead of being lost.
   * @param {Array} lists - Array of contact list objects from API
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<void>}
   */
  static async saveContactLists(lists, settingId) {
    if (!settingId) return;
    if (!lists || lists.length === 0) return;

    const records = lists.map((list) => this.toDbRecord(list, settingId));

    try {
      // Atomic: DELETE old + INSERT new in one transaction
      await databaseManager.transaction(async () => {
        const db = await databaseManager.getDatabase();
        await db.runAsync(
          `DELETE FROM ${Tables.CONTACT_LISTS} WHERE setting_id = ?`,
          [settingId]
        );
        for (const record of records) {
          const columns = Object.keys(record);
          const placeholders = columns.map(() => '?').join(', ');
          await db.runAsync(
            `INSERT INTO ${Tables.CONTACT_LISTS} (${columns.join(', ')}) VALUES (${placeholders})`,
            columns.map((col) => record[col] ?? null)
          );
        }
      });
    } catch (txError) {
      // Transaction failed — fall back to non-atomic save (better than no save)
      await databaseManager.execute(
        `DELETE FROM ${Tables.CONTACT_LISTS} WHERE setting_id = ?`,
        [settingId]
      );
      await databaseManager.batchInsert(Tables.CONTACT_LISTS, records);
    }
  }

  /**
   * Get all contact lists for a setting.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<Array>} Array of contact list objects in API shape
   */
  static async getContactLists(settingId) {
    if (!settingId) return [];

    const rows = await databaseManager.query(
      `SELECT * FROM ${Tables.CONTACT_LISTS} WHERE setting_id = ? ORDER BY list_name ASC`,
      [settingId]
    );

    return rows.map((row) => this.fromDbRecord(row));
  }

  /**
   * Check if any contact lists exist in cache for a setting.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<boolean>}
   */
  static async hasContactLists(settingId) {
    if (!settingId) return false;
    const result = await databaseManager.queryFirst(
      `SELECT 1 FROM ${Tables.CONTACT_LISTS} WHERE setting_id = ? LIMIT 1`,
      [settingId]
    );
    return result !== null;
  }

  /**
   * Clear all cached contact lists for a setting.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<void>}
   */
  static async clearContactLists(settingId) {
    if (!settingId) return;
    await databaseManager.execute(
      `DELETE FROM ${Tables.CONTACT_LISTS} WHERE setting_id = ?`,
      [settingId]
    );
  }
}

export default ContactListModel;
