/**
 * WANumberModel - SQLite model for WhatsApp numbers
 *
 * Handles saving, retrieving, and managing WhatsApp numbers in the local SQLite cache.
 * WA numbers are account-level (not per setting_id).
 * Stores full API response in metadata column for zero data loss.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

class WANumberModel {
  /**
   * Convert API WA number object to database record.
   * Extracts indexable fields for SQL queries and stores the full JSON in metadata.
   * @param {Object} waNumber - WA number object from API
   * @returns {Object} Database record
   */
  static toDbRecord(waNumber) {
    const account = waNumber.account || {};
    const phoneInfo = account.waPhoneNumberInfo || {};
    const businessProfile = account.waBusinessProfile || {};
    const now = Date.now();

    let metadataJson = null;
    try {
      metadataJson = JSON.stringify(waNumber);
    } catch (e) {
      // Failed to stringify — individual columns will serve as fallback
    }

    return {
      id: generateUUID(),
      server_id: waNumber._id || waNumber.id,
      status: account.status || null,
      phone_number: account.waNumber || null,
      country_code: account.countryCode || null,
      display_name: phoneInfo.verified_name || null,
      quality_score: phoneInfo.quality_score?.score || null,
      messaging_limit_tier: phoneInfo.messaging_limit_tier || null,
      profile_picture_url: businessProfile.profile_picture_url || null,
      upper_cap_used: waNumber.upperCapUsed || 0,
      upper_cap_limit: waNumber.upperCapLimit || 0,
      folder_id: waNumber.folderId || null,
      metadata: metadataJson,
      created_at: waNumber.createdAt ? new Date(waNumber.createdAt).getTime() : now,
      updated_at: waNumber.updatedAt ? new Date(waNumber.updatedAt).getTime() : now,
      synced_at: now,
    };
  }

  /**
   * Convert database record back to API-shaped WA number object.
   * Parses metadata JSON first; falls back to reconstructing from individual columns.
   * @param {Object} record - SQLite row
   * @returns {Object} WA number object matching the API response shape
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
      id: record.server_id,
      account: {
        status: record.status,
        waNumber: record.phone_number,
        countryCode: record.country_code,
        waPhoneNumberInfo: {
          verified_name: record.display_name,
          quality_score: record.quality_score ? { score: record.quality_score } : undefined,
          messaging_limit_tier: record.messaging_limit_tier,
        },
        waBusinessProfile: {
          profile_picture_url: record.profile_picture_url,
        },
      },
      upperCapUsed: record.upper_cap_used || 0,
      upperCapLimit: record.upper_cap_limit || 0,
      folderId: record.folder_id || null,
      _cached: true,
      _syncedAt: record.synced_at,
    };
  }

  /**
   * Save WA numbers to SQLite (replace-all strategy).
   * Clears existing records first so that numbers removed on the server don't persist locally.
   * @param {Array} waNumbers - Array of WA number objects from API
   * @returns {Promise<void>}
   */
  static async saveWANumbers(waNumbers) {
    // Always clear existing — ensures deleted/moved numbers don't persist
    await databaseManager.execute(`DELETE FROM ${Tables.WA_NUMBERS}`);

    // Insert fresh records (if any)
    if (!waNumbers || waNumbers.length === 0) return;
    const records = waNumbers.map((wn) => this.toDbRecord(wn));
    await databaseManager.batchInsert(Tables.WA_NUMBERS, records);
  }

  /**
   * Get all WA numbers, optionally filtered by folder or status.
   * @param {Object} [options] - Query options
   * @param {string} [options.folderId] - Filter by folder ID
   * @param {string} [options.status] - Filter by status ('active' | 'inactive')
   * @returns {Promise<Array>} Array of WA number objects in API shape
   */
  static async getWANumbers(options = {}) {
    const { folderId, status } = options;
    let sql = `SELECT * FROM ${Tables.WA_NUMBERS}`;
    const params = [];
    const conditions = [];

    if (folderId) {
      conditions.push('folder_id = ?');
      params.push(folderId);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = await databaseManager.query(sql, params);
    return rows.map((row) => this.fromDbRecord(row));
  }

  /**
   * Get count of cached WA numbers.
   * @returns {Promise<number>}
   */
  static async getWANumberCount() {
    const result = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.WA_NUMBERS}`
    );
    return result?.count || 0;
  }

  /**
   * Check if any WA numbers exist in cache.
   * @returns {Promise<boolean>}
   */
  static async hasWANumbers() {
    const count = await this.getWANumberCount();
    return count > 0;
  }

  /**
   * Clear all cached WA numbers.
   * @returns {Promise<void>}
   */
  static async clearWANumbers() {
    await databaseManager.execute(`DELETE FROM ${Tables.WA_NUMBERS}`);
  }
}

export default WANumberModel;
