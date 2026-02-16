/**
 * TemplateModel - SQLite model for WhatsApp message templates
 *
 * Handles saving, retrieving, searching, and filtering templates in the local SQLite cache.
 * Templates are setting-specific (tied to a WhatsApp number via setting_id).
 * Uses per-status-pill cache buckets via cache_key ('all', 'approved', 'pending', 'draft', 'rejected').
 * Each bucket has independent sort_order and pagination — same template can exist in multiple buckets.
 * Stores full API response in metadata column for zero data loss.
 */

import { databaseManager } from '../DatabaseManager';
import { Tables } from '../schema';
import { generateUUID } from '../../utils/helpers';

const DEFAULT_CACHE_KEY = 'all';

class TemplateModel {
  /**
   * Normalize cacheKey: null/undefined → 'all'.
   * @param {string|null} cacheKey
   * @returns {string}
   */
  static _normalizeCacheKey(cacheKey) {
    return cacheKey || DEFAULT_CACHE_KEY;
  }

  /**
   * Convert API template object to database record.
   * Extracts indexable fields for SQL queries and stores the full JSON in metadata.
   * @param {Object} template - Template object from API
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @param {number} [sortOrder=0] - Sort order for maintaining API order
   * @returns {Object} Database record
   */
  static toDbRecord(template, settingId, cacheKey = 'all', sortOrder = 0) {
    const now = Date.now();

    let metadataJson = null;
    try {
      metadataJson = JSON.stringify(template);
    } catch (e) {
      // Failed to stringify — individual columns will serve as fallback
    }

    let componentsJson = null;
    try {
      if (template.components) {
        componentsJson = JSON.stringify(template.components);
      }
    } catch (e) {
      // ignore
    }

    let buttonsJson = null;
    try {
      if (template.buttons) {
        buttonsJson = JSON.stringify(template.buttons);
      }
    } catch (e) {
      // ignore
    }

    return {
      id: generateUUID(),
      server_id: template._id || template.id,
      setting_id: settingId,
      name: template.name || null,
      language: template.language || null,
      category: template.category || null,
      status: template.status || null,
      components: componentsJson,
      header_type: template.headerType || template.header_type || null,
      header_content: template.headerContent || template.header_content || null,
      body_text: template.bodyText || template.body_text || null,
      footer_text: template.footerText || template.footer_text || null,
      buttons: buttonsJson,
      metadata: metadataJson,
      cache_key: this._normalizeCacheKey(cacheKey),
      sort_order: sortOrder,
      created_at: template.createdAt ? new Date(template.createdAt).getTime() : now,
      updated_at: template.updatedAt ? new Date(template.updatedAt).getTime() : now,
      synced_at: now,
    };
  }

  /**
   * Convert database record back to API-shaped template object.
   * Parses metadata JSON first; falls back to reconstructing from individual columns.
   * @param {Object} record - SQLite row
   * @returns {Object} Template object matching the API response shape
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
    let components = null;
    try {
      if (record.components) components = JSON.parse(record.components);
    } catch (e) { /* ignore */ }

    let buttons = null;
    try {
      if (record.buttons) buttons = JSON.parse(record.buttons);
    } catch (e) { /* ignore */ }

    return {
      _id: record.server_id,
      name: record.name || '',
      language: record.language || '',
      category: record.category || '',
      status: record.status || '',
      components: components,
      headerType: record.header_type || null,
      headerContent: record.header_content || null,
      bodyText: record.body_text || null,
      footerText: record.footer_text || null,
      buttons: buttons,
      _cached: true,
      _syncedAt: record.synced_at,
    };
  }

  /**
   * Save templates to SQLite (append mode with sort order).
   * Uses INSERT OR REPLACE — duplicates handled by UNIQUE(server_id, setting_id, cache_key).
   * Each page of templates is appended; existing templates are updated in place.
   * @param {Array} templates - Array of template objects from API
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @param {number} [startIndex=0] - Starting sort_order index (= API skip value)
   * @returns {Promise<void>}
   */
  static async saveTemplates(templates, settingId, cacheKey = 'all', startIndex = 0) {
    if (!settingId || !templates || templates.length === 0) return;

    const records = templates.map((t, i) =>
      this.toDbRecord(t, settingId, cacheKey, startIndex + i)
    );
    await databaseManager.batchInsert(Tables.TEMPLATES, records);
  }

  /**
   * Get templates from cache with pagination and search filtering.
   * Filters by cache_key bucket (not by status column).
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {Object} [options] - Query options
   * @param {number} [options.skip=0] - Number of records to skip
   * @param {number} [options.limit=10] - Max records to return
   * @param {string} [options.search] - Search term (matches name, category, language)
   * @param {string} [options.cacheKey='all'] - Cache bucket key
   * @returns {Promise<{templates: Array, totalCount: number}>}
   */
  static async getTemplates(settingId, options = {}) {
    const { skip = 0, limit = 10, search, cacheKey = 'all' } = options;

    if (!settingId) return { templates: [], totalCount: 0 };

    const dbCacheKey = this._normalizeCacheKey(cacheKey);
    const conditions = ['setting_id = ?', 'cache_key = ?'];
    const params = [settingId, dbCacheKey];

    // Search filter — case-insensitive word-prefix match on name, substring on category/language
    if (search && search.trim()) {
      const lower = search.trim().toLowerCase();
      const prefixTerm = `${lower}%`;
      const wordTerm = `% ${lower}%`;
      const substringTerm = `%${lower}%`;
      conditions.push('(LOWER(name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(language) LIKE ?)');
      params.push(prefixTerm, wordTerm, substringTerm, substringTerm);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count for pagination
    const countRow = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.TEMPLATES} WHERE ${whereClause}`,
      params
    );
    const totalCount = countRow?.count || 0;

    // Get paginated results ordered by sort_order (preserves API order)
    const rows = await databaseManager.query(
      `SELECT * FROM ${Tables.TEMPLATES} WHERE ${whereClause} ORDER BY sort_order ASC LIMIT ? OFFSET ?`,
      [...params, limit, skip]
    );

    return {
      templates: rows.map((row) => this.fromDbRecord(row)),
      totalCount,
    };
  }

  /**
   * Get ALL cached templates for a cache bucket (no pagination).
   * Used on initial load to return everything cached at once.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @returns {Promise<{templates: Array, totalCount: number}>}
   */
  static async getAllTemplates(settingId, cacheKey = 'all') {
    if (!settingId) return { templates: [], totalCount: 0 };

    const dbCacheKey = this._normalizeCacheKey(cacheKey);
    const rows = await databaseManager.query(
      `SELECT * FROM ${Tables.TEMPLATES} WHERE setting_id = ? AND cache_key = ? ORDER BY sort_order ASC`,
      [settingId, dbCacheKey]
    );

    return {
      templates: rows.map((row) => this.fromDbRecord(row)),
      totalCount: rows.length,
    };
  }

  /**
   * Search templates within a cache bucket.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} search - Search term
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @returns {Promise<{templates: Array, totalCount: number}>}
   */
  static async searchTemplates(settingId, search, cacheKey = 'all') {
    return this.getTemplates(settingId, { search, cacheKey, skip: 0, limit: 1000 });
  }

  /**
   * Check if any templates exist in cache for a setting (any bucket).
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<boolean>}
   */
  static async hasTemplates(settingId) {
    if (!settingId) return false;
    const result = await databaseManager.queryFirst(
      `SELECT 1 FROM ${Tables.TEMPLATES} WHERE setting_id = ? LIMIT 1`,
      [settingId]
    );
    return result !== null;
  }

  /**
   * Get count of cached templates for a specific cache bucket.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @returns {Promise<number>}
   */
  static async getCachedCount(settingId, cacheKey = 'all') {
    if (!settingId) return 0;

    const dbCacheKey = this._normalizeCacheKey(cacheKey);
    const result = await databaseManager.queryFirst(
      `SELECT COUNT(*) as count FROM ${Tables.TEMPLATES} WHERE setting_id = ? AND cache_key = ?`,
      [settingId, dbCacheKey]
    );
    return result?.count || 0;
  }

  /**
   * Clear cached templates for a specific cache bucket.
   * Used for pull-to-refresh on a single pill.
   * @param {string} settingId - The WhatsApp number setting ID
   * @param {string} [cacheKey='all'] - Cache bucket key
   * @returns {Promise<void>}
   */
  static async clearTemplatesForCacheKey(settingId, cacheKey = 'all') {
    if (!settingId) return;

    const dbCacheKey = this._normalizeCacheKey(cacheKey);
    await databaseManager.execute(
      `DELETE FROM ${Tables.TEMPLATES} WHERE setting_id = ? AND cache_key = ?`,
      [settingId, dbCacheKey]
    );
  }

  /**
   * Clear ALL cached templates for a setting (all buckets).
   * Used for account switch.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<void>}
   */
  static async clearTemplates(settingId) {
    if (!settingId) return;
    await databaseManager.execute(
      `DELETE FROM ${Tables.TEMPLATES} WHERE setting_id = ?`,
      [settingId]
    );
  }

  /**
   * Get template counts grouped by status for offline stats.
   * Uses the 'all' cache bucket for accurate counts.
   * Returns { total, approved, pending, draft, rejected }.
   * @param {string} settingId - The WhatsApp number setting ID
   * @returns {Promise<Object>}
   */
  static async getTemplateCount(settingId) {
    if (!settingId) return { total: 0, approved: 0, pending: 0, draft: 0, rejected: 0 };

    const rows = await databaseManager.query(
      `SELECT UPPER(status) as status, COUNT(*) as count FROM ${Tables.TEMPLATES} WHERE setting_id = ? AND cache_key = 'all' GROUP BY UPPER(status)`,
      [settingId]
    );

    const stats = { total: 0, approved: 0, pending: 0, draft: 0, rejected: 0 };
    for (const row of rows) {
      const count = row.count || 0;
      stats.total += count;
      const key = (row.status || '').toLowerCase();
      if (key in stats) {
        stats[key] = count;
      }
    }

    return stats;
  }
}

export default TemplateModel;
