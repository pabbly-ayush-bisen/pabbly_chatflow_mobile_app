/**
 * DashboardStatsModel - SQLite model for dashboard statistics
 *
 * Key-value cache for dashboard statistics like WANumberCount, totalQuota, quotaUsed.
 * Each stat type is stored as a single row with JSON data in the `data` column.
 * The composite unique index on (stat_type, setting_id) enables upsert via INSERT OR REPLACE.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

// Stat type constants used as keys in the dashboard_stats table
export const StatTypes = {
  OVERVIEW: 'overview',           // WANumberCount, totalQuota, quotaUsed
  WA_NUMBER_COUNTS: 'wa_counts',  // currentFilterCount, activeCount, inactiveCount
};

// Default setting_id sentinel — avoids NULL uniqueness issues in composite unique index.
// In SQLite NULL != NULL, so INSERT OR REPLACE never triggers a conflict on NULL values,
// causing duplicate rows instead of proper upsert. Using a sentinel fixes this.
const GLOBAL_SETTING_ID = '_global_';

class DashboardStatsModel {
  /**
   * Save a stat entry (upsert by stat_type + setting_id).
   * @param {string} statType - Type key (e.g., StatTypes.OVERVIEW)
   * @param {Object} data - The data object to cache as JSON
   * @param {string} [settingId] - Setting ID, or '_global_' for account-level stats
   * @returns {Promise<void>}
   */
  static async saveStats(statType, data, settingId = GLOBAL_SETTING_ID) {
    let dataJson = null;
    try {
      dataJson = JSON.stringify(data);
    } catch (e) {
      // Failed to stringify — skip saving
      return;
    }

    // Clean up any old NULL rows left from the previous buggy implementation
    // (NULL setting_id rows bypass the unique index, causing stale duplicates)
    try {
      await databaseManager.execute(
        `DELETE FROM ${Tables.DASHBOARD_STATS} WHERE stat_type = ? AND setting_id IS NULL`,
        [statType]
      );
    } catch (e) {
      // Non-critical cleanup — proceed with save
    }

    await databaseManager.upsert(Tables.DASHBOARD_STATS, {
      id: generateUUID(),
      stat_type: statType,
      setting_id: settingId || GLOBAL_SETTING_ID,
      data: dataJson,
      updated_at: Date.now(),
    });
  }

  /**
   * Get a cached stat entry by type and setting.
   * @param {string} statType - Type key (e.g., StatTypes.OVERVIEW)
   * @param {string} [settingId] - Setting ID, or '_global_' for account-level stats
   * @returns {Promise<Object|null>} Parsed data object, or null if not found
   */
  static async getStats(statType, settingId = GLOBAL_SETTING_ID) {
    const row = await databaseManager.queryFirst(
      `SELECT * FROM ${Tables.DASHBOARD_STATS} WHERE stat_type = ? AND setting_id = ?`,
      [statType, settingId || GLOBAL_SETTING_ID]
    );

    if (!row || !row.data) return null;

    try {
      const parsed = JSON.parse(row.data);
      parsed._cached = true;
      parsed._cachedAt = row.updated_at;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the age (in milliseconds) of a cached stat entry.
   * Returns Infinity if the entry doesn't exist (forces a refresh).
   * @param {string} statType - Type key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<number>} Age in milliseconds
   */
  static async getStatsAge(statType, settingId = GLOBAL_SETTING_ID) {
    const row = await databaseManager.queryFirst(
      `SELECT updated_at FROM ${Tables.DASHBOARD_STATS} WHERE stat_type = ? AND setting_id = ?`,
      [statType, settingId || GLOBAL_SETTING_ID]
    );

    if (!row || !row.updated_at) return Infinity;

    return Date.now() - row.updated_at;
  }

  /**
   * Check if a stat entry exists in cache.
   * @param {string} statType - Type key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<boolean>}
   */
  static async hasStats(statType, settingId = GLOBAL_SETTING_ID) {
    const stats = await this.getStats(statType, settingId);
    return stats !== null;
  }

  /**
   * Clear all dashboard stats, optionally filtered by setting.
   * @param {string|null} [settingId] - If null, clear ALL stats. Otherwise clear for that setting.
   * @returns {Promise<void>}
   */
  static async clearStats(settingId = null) {
    if (settingId === null) {
      await databaseManager.execute(`DELETE FROM ${Tables.DASHBOARD_STATS}`);
    } else {
      await databaseManager.execute(
        `DELETE FROM ${Tables.DASHBOARD_STATS} WHERE setting_id = ?`,
        [settingId]
      );
    }
  }
}

export { DashboardStatsModel };
export default DashboardStatsModel;
