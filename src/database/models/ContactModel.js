/**
 * ContactModel - SQLite model for contacts
 *
 * Handles saving, retrieving, searching, and paginating contacts in the local SQLite cache.
 * Contacts are setting-specific (tied to a WhatsApp number via setting_id).
 * Stores full API response in metadata column for zero data loss.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

// Sentinel value for "All Contacts" list_name (used instead of NULL for UNIQUE constraint)
const ALL_CONTACTS_LIST = '__all__';

class ContactModel {
  /**
   * Convert API contact object to database record.
   * Extracts indexable fields for SQL queries and stores the full JSON in metadata.
   * @param {Object} contact - Contact object from API
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [listName] - The list name this contact belongs to (null for "All")
   * @param {number} [sortOrder] - Sort order for maintaining API order
   * @returns {Object} Database record
   */
  static toDbRecord(contact, settingId, listName = null, sortOrder = 0) {
    const now = Date.now();

    let metadataJson = null;
    try {
      metadataJson = JSON.stringify(contact);
    } catch (e) {
      // Failed to stringify — individual columns will serve as fallback
    }

    return {
      id: generateUUID(),
      server_id: contact._id || contact.id,
      setting_id: settingId,
      name: contact.name || null,
      phone_number: contact.mobile || contact.phone || null,
      wa_id: contact.waId || null,
      email: contact.email || null,
      opt_in_status: contact.optIn?.status || null,
      list_name: listName || ALL_CONTACTS_LIST,
      metadata: metadataJson,
      sort_order: sortOrder,
      created_at: contact.createdAt ? new Date(contact.createdAt).getTime() : now,
      updated_at: contact.updatedAt ? new Date(contact.updatedAt).getTime() : now,
      synced_at: now,
    };
  }

  /**
   * Convert database record back to API-shaped contact object.
   * Parses metadata JSON first; falls back to reconstructing from individual columns.
   * @param {Object} record - SQLite row
   * @returns {Object} Contact object matching the API response shape
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

    // Fallback: reconstruct from individual columns when metadata is missing/corrupted
    return {
      _id: record.server_id,
      name: record.name || '',
      mobile: record.phone_number || '',
      email: record.email || '',
      optIn: { status: record.opt_in_status || null },
      _cached: true,
      _syncedAt: record.synced_at,
    };
  }

  /**
   * Normalize listName: null/undefined → '__all__' sentinel.
   * @param {string|null} listName
   * @returns {string}
   */
  static _normalizeListName(listName) {
    return listName || ALL_CONTACTS_LIST;
  }

  /**
   * Save contacts to SQLite for a given setting (append mode).
   * Uses INSERT OR REPLACE — duplicates are handled by UNIQUE(server_id, setting_id, list_name).
   * @param {Array} contacts - Array of contact objects from API
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [listName] - The list name filter (null for "All Contacts")
   * @param {number} [startIndex=0] - Starting sort_order index (= API skip value)
   * @returns {Promise<void>}
   */
  static async saveContacts(contacts, settingId, listName = null, startIndex = 0) {
    if (!settingId || !contacts || contacts.length === 0) return;

    console.log(`[ContactModel] saveContacts: ${contacts.length} contacts, settingId=${settingId}, listName=${listName}, startIndex=${startIndex}`);
    try {
      const records = contacts.map((c, i) =>
        this.toDbRecord(c, settingId, listName, startIndex + i)
      );
      console.log(`[ContactModel] saveContacts: ${records.length} records prepared, calling batchInsert...`);
      await databaseManager.batchInsert(Tables.CONTACTS, records);
      console.log(`[ContactModel] saveContacts: batchInsert complete`);
    } catch (error) {
      console.error(`[ContactModel] saveContacts FAILED:`, error.message, error);
      throw error;
    }
  }

  /**
   * Get contacts from cache with pagination, search, and list filtering.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {Object} [options] - Query options
   * @param {number} [options.skip=0] - Number of records to skip
   * @param {number} [options.limit=10] - Max records to return
   * @param {string} [options.search] - Search term (matches name, phone_number, email)
   * @param {string} [options.listName] - Filter by list name (null for "All Contacts")
   * @returns {Promise<{contacts: Array, totalCount: number}>}
   */
  static async getContacts(settingId, options = {}) {
    const { skip = 0, limit = 10, search, listName } = options;

    if (!settingId) return { contacts: [], totalCount: 0 };

    const dbListName = this._normalizeListName(listName);
    const conditions = ['setting_id = ?', 'list_name = ?'];
    const params = [settingId, dbListName];

    // Search filter — match name, phone_number, or email
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(name LIKE ? OR phone_number LIKE ? OR email LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    console.log(`[ContactModel] getContacts: settingId=${settingId}, listName=${dbListName}, skip=${skip}, limit=${limit}, search=${search || 'none'}`);

    try {
      // Get total count for pagination
      const countRow = await databaseManager.queryFirst(
        `SELECT COUNT(*) as count FROM ${Tables.CONTACTS} WHERE ${whereClause}`,
        params
      );
      const totalCount = countRow?.count || 0;
      console.log(`[ContactModel] getContacts: totalCount=${totalCount}`);

      // Get paginated results
      const rows = await databaseManager.query(
        `SELECT * FROM ${Tables.CONTACTS} WHERE ${whereClause} ORDER BY sort_order ASC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      );
      console.log(`[ContactModel] getContacts: returned ${rows.length} rows`);

      return {
        contacts: rows.map((row) => this.fromDbRecord(row)),
        totalCount,
      };
    } catch (error) {
      console.error(`[ContactModel] getContacts FAILED:`, error.message, error);
      throw error;
    }
  }

  /**
   * Get total count of cached contacts for a setting.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [listName] - Optional list name filter
   * @returns {Promise<number>}
   */
  static async getContactCount(settingId, listName = null) {
    if (!settingId) return 0;

    const dbListName = this._normalizeListName(listName);
    console.log(`[ContactModel] getContactCount: settingId=${settingId}, listName=${dbListName}`);
    try {
      const result = await databaseManager.queryFirst(
        `SELECT COUNT(*) as count FROM ${Tables.CONTACTS} WHERE setting_id = ? AND list_name = ?`,
        [settingId, dbListName]
      );
      const count = result?.count || 0;
      console.log(`[ContactModel] getContactCount: ${count}`);
      return count;
    } catch (error) {
      console.error(`[ContactModel] getContactCount FAILED:`, error.message, error);
      throw error;
    }
  }

  /**
   * Check if any contacts exist in cache for a setting.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<boolean>}
   */
  static async hasContacts(settingId) {
    if (!settingId) return false;
    const result = await databaseManager.queryFirst(
      `SELECT 1 FROM ${Tables.CONTACTS} WHERE setting_id = ? LIMIT 1`,
      [settingId]
    );
    return result !== null;
  }

  /**
   * Get ALL cached contacts for a setting + list (no pagination).
   * Used on initial load to return everything cached at once.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [listName] - List name filter (null for "All Contacts")
   * @returns {Promise<{contacts: Array, totalCount: number}>}
   */
  static async getAllContacts(settingId, listName = null) {
    if (!settingId) return { contacts: [], totalCount: 0 };

    const dbListName = this._normalizeListName(listName);
    console.log(`[ContactModel] getAllContacts: settingId=${settingId}, listName=${dbListName}`);
    try {
      const rows = await databaseManager.query(
        `SELECT * FROM ${Tables.CONTACTS} WHERE setting_id = ? AND list_name = ? ORDER BY sort_order ASC`,
        [settingId, dbListName]
      );
      console.log(`[ContactModel] getAllContacts: returned ${rows.length} rows`);

      return {
        contacts: rows.map((row) => this.fromDbRecord(row)),
        totalCount: rows.length,
      };
    } catch (error) {
      console.error(`[ContactModel] getAllContacts FAILED:`, error.message, error);
      throw error;
    }
  }

  /**
   * Clear all cached contacts for a setting (all lists).
   * Used for account switch.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<void>}
   */
  static async clearContacts(settingId) {
    if (!settingId) return;
    await databaseManager.execute(
      `DELETE FROM ${Tables.CONTACTS} WHERE setting_id = ?`,
      [settingId]
    );
  }

  /**
   * Clear cached contacts for a specific list only.
   * Used for pull-to-refresh on a single list.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [listName] - List name (null clears "All Contacts" rows)
   * @returns {Promise<void>}
   */
  static async clearContactsForList(settingId, listName = null) {
    if (!settingId) return;

    const dbListName = this._normalizeListName(listName);
    console.log(`[ContactModel] clearContactsForList: settingId=${settingId}, listName=${dbListName}`);
    try {
      await databaseManager.execute(
        `DELETE FROM ${Tables.CONTACTS} WHERE setting_id = ? AND list_name = ?`,
        [settingId, dbListName]
      );
      console.log(`[ContactModel] clearContactsForList: done`);
    } catch (error) {
      console.error(`[ContactModel] clearContactsForList FAILED:`, error.message, error);
      throw error;
    }
  }
}

export default ContactModel;
