/**
 * AppSettingsModel - Generic JSON key-value cache in SQLite
 *
 * Stores complex/nested data as JSON blobs keyed by (key, setting_id).
 * Used for: folders tree, team members list, shared accounts, inbox settings, user attributes.
 *
 * The setting_id column uses '_global_' as default for account-level data (not tied to a
 * specific WhatsApp number). This avoids NULL uniqueness issues in the composite unique index.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

// Setting key constants — used as the `key` column value
export const SettingKeys = {
  FOLDERS: 'folders',
  TEAM_MEMBERS: 'teamMembers',
  SHARED_ACCOUNTS: 'sharedAccounts',
  INBOX_SETTINGS: 'inboxSettings',
  USER_ATTRIBUTES: 'userAttributes',
};

// Default setting_id for account-level data (not per WhatsApp number)
const GLOBAL_SETTING_ID = '_global_';

class AppSettingsModel {
  /**
   * Save a setting (upsert by key + setting_id).
   * @param {string} key - Setting key (e.g., SettingKeys.FOLDERS)
   * @param {any} data - The data to cache (will be JSON.stringified)
   * @param {string} [settingId] - Setting ID, or '_global_' for account-level data
   * @returns {Promise<void>}
   */
  static async save(key, data, settingId = GLOBAL_SETTING_ID) {
    let dataJson = null;
    try {
      dataJson = JSON.stringify(data);
    } catch (e) {
      // Failed to stringify — skip saving
      return;
    }

    await databaseManager.upsert(Tables.APP_SETTINGS, {
      id: generateUUID(),
      key,
      setting_id: settingId || GLOBAL_SETTING_ID,
      data: dataJson,
      updated_at: Date.now(),
    });
  }

  /**
   * Get a cached setting by key and setting_id.
   * @param {string} key - Setting key (e.g., SettingKeys.FOLDERS)
   * @param {string} [settingId] - Setting ID, or '_global_' for account-level data
   * @returns {Promise<any|null>} Parsed data, or null if not found
   */
  static async get(key, settingId = GLOBAL_SETTING_ID) {
    const row = await databaseManager.queryFirst(
      `SELECT * FROM ${Tables.APP_SETTINGS} WHERE key = ? AND setting_id = ?`,
      [key, settingId || GLOBAL_SETTING_ID]
    );

    if (!row || !row.data) return null;

    try {
      return JSON.parse(row.data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the age (in milliseconds) of a cached setting.
   * Returns Infinity if the entry doesn't exist (forces a refresh).
   * @param {string} key - Setting key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<number>} Age in milliseconds
   */
  static async getAge(key, settingId = GLOBAL_SETTING_ID) {
    const row = await databaseManager.queryFirst(
      `SELECT updated_at FROM ${Tables.APP_SETTINGS} WHERE key = ? AND setting_id = ?`,
      [key, settingId || GLOBAL_SETTING_ID]
    );

    if (!row || !row.updated_at) return Infinity;

    return Date.now() - row.updated_at;
  }

  /**
   * Check if a setting exists in cache.
   * @param {string} key - Setting key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<boolean>}
   */
  static async has(key, settingId = GLOBAL_SETTING_ID) {
    const row = await databaseManager.queryFirst(
      `SELECT 1 FROM ${Tables.APP_SETTINGS} WHERE key = ? AND setting_id = ?`,
      [key, settingId || GLOBAL_SETTING_ID]
    );
    return row !== null;
  }

  /**
   * Delete a specific setting.
   * @param {string} key - Setting key
   * @param {string} [settingId] - Setting ID
   * @returns {Promise<void>}
   */
  static async remove(key, settingId = GLOBAL_SETTING_ID) {
    await databaseManager.execute(
      `DELETE FROM ${Tables.APP_SETTINGS} WHERE key = ? AND setting_id = ?`,
      [key, settingId || GLOBAL_SETTING_ID]
    );
  }

  /**
   * Clear all settings for a specific setting_id, or all settings entirely.
   * @param {string|null} [settingId] - If provided, clear only for this setting. If null, clear everything.
   * @returns {Promise<void>}
   */
  static async clearAll(settingId = null) {
    if (settingId === null) {
      await databaseManager.execute(`DELETE FROM ${Tables.APP_SETTINGS}`);
    } else {
      await databaseManager.execute(
        `DELETE FROM ${Tables.APP_SETTINGS} WHERE setting_id = ?`,
        [settingId]
      );
    }
  }
}

export { AppSettingsModel, GLOBAL_SETTING_ID };
export default AppSettingsModel;
