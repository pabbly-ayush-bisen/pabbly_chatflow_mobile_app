/**
 * DatabaseManager - SQLite Database Connection Manager
 *
 * This module handles database initialization, migrations, and provides
 * a centralized interface for database operations.
 *
 * Features:
 * - Singleton pattern for single database instance
 * - Automatic table creation and migrations
 * - Transaction support
 * - Error handling and logging
 */

import * as SQLite from 'expo-sqlite';
import {
  SCHEMA_VERSION,
  Tables,
  CREATE_TABLES_SQL,
  CREATE_INDEXES_SQL,
  CacheKeys,
} from './schema';

const DATABASE_NAME = 'pabbly_chatflow_cache.db';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the database connection and create tables
   * @returns {Promise<void>}
   */
  async initialize() {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized && this.db) {
      return;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Log:('[DatabaseManager] Initializing database...');

      // Open database connection
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      // Enable foreign keys and WAL mode for better performance
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      await this.db.execAsync('PRAGMA journal_mode = WAL;');

      // Check if migration is needed
      await this._checkAndMigrate();

      // Create tables
      await this._createTables();

      // Create indexes
      await this._createIndexes();

      this.isInitialized = true;
      // Log:('[DatabaseManager] Database initialized successfully');
    } catch (error) {
      // Error:('[DatabaseManager] Initialization error:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Check schema version and perform migrations if needed
   */
  async _checkAndMigrate() {
    try {
      // Create metadata table first if not exists
      await this.db.execAsync(CREATE_TABLES_SQL[Tables.CACHE_METADATA]);

      const result = await this.db.getFirstAsync(
        `SELECT value FROM ${Tables.CACHE_METADATA} WHERE key = ?`,
        [CacheKeys.SCHEMA_VERSION]
      );

      const currentVersion = result ? parseInt(result.value, 10) : 0;

      if (currentVersion < SCHEMA_VERSION) {
        // Log:(`[DatabaseManager] Migrating from version ${currentVersion} to ${SCHEMA_VERSION}`);
        await this._runMigrations(currentVersion, SCHEMA_VERSION);

        // Update schema version
        await this.db.runAsync(
          `INSERT OR REPLACE INTO ${Tables.CACHE_METADATA} (key, value, updated_at) VALUES (?, ?, ?)`,
          [CacheKeys.SCHEMA_VERSION, SCHEMA_VERSION.toString(), Date.now()]
        );
      }
    } catch (error) {
      // Error:('[DatabaseManager] Migration check error:', error);
      // If error, try to create fresh tables
    }
  }

  /**
   * Run migrations between versions
   */
  async _runMigrations(fromVersion, toVersion) {
    if (fromVersion === 0 && toVersion >= 1) {
      // Tables will be created in _createTables
    }

    if (fromVersion < 2 && toVersion >= 2) {
      await this._migrateToV2();
    }

    if (fromVersion < 3 && toVersion >= 3) {
      await this._migrateToV3();
    }

    if (fromVersion < 4 && toVersion >= 4) {
      await this._migrateToV4();
    }

    if (fromVersion < 5 && toVersion >= 5) {
      await this._migrateToV5();
    }

    if (fromVersion < 6 && toVersion >= 6) {
      await this._migrateToV6();
    }

    if (fromVersion < 7 && toVersion >= 7) {
      await this._migrateToV7();
    }

    if (fromVersion < 8 && toVersion >= 8) {
      await this._migrateToV8();
    }

    if (fromVersion < 9 && toVersion >= 9) {
      await this._migrateToV9();
    }

    if (fromVersion < 10 && toVersion >= 10) {
      await this._migrateToV10();
    }

    if (fromVersion < 11 && toVersion >= 11) {
      await this._migrateToV11();
    }
  }

  /**
   * Migration to version 3: Remove foreign key constraint from messages table
   */
  async _migrateToV3() {
    try {
      await this.db.execAsync(`DROP TABLE IF EXISTS ${Tables.MESSAGES}`);
    } catch (error) {
      // Migration error - table will be recreated
    }
  }

  /**
   * Migration to version 4: Add media download tracking columns to messages
   * Enables local media storage for offline access
   */
  async _migrateToV4() {
    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.MESSAGES} ADD COLUMN local_media_path TEXT`);
    } catch (error) {
      // Column may already exist
    }

    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.MESSAGES} ADD COLUMN local_thumbnail_path TEXT`);
    } catch (error) {
      // Column may already exist
    }

    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.MESSAGES} ADD COLUMN media_download_status TEXT DEFAULT 'none'`);
    } catch (error) {
      // Column may already exist
    }
  }

  /**
   * Migration to version 5: Add contact_last_active column to chats
   * Stores the contact's lastActive timestamp for 24-hour window calculation
   */
  async _migrateToV5() {
    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.CHATS} ADD COLUMN contact_last_active TEXT`);
    } catch (error) {
      // Column may already exist
    }
  }

  /**
   * Migration to version 6: Deduplicate existing messages and add unique indexes
   * Fixes the bug where messages were duplicated because server_id had no unique constraint
   */
  async _migrateToV6() {
    // Step 1: Remove duplicate messages by server_id (keep the one with the latest synced_at)
    try {
      await this.db.execAsync(`
        DELETE FROM ${Tables.MESSAGES} WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY chat_id, server_id ORDER BY synced_at DESC
            ) AS rn FROM ${Tables.MESSAGES} WHERE server_id IS NOT NULL
          ) WHERE rn > 1
        )
      `);
    } catch (e) {
      // ROW_NUMBER may not be supported in older SQLite — fallback approach
      try {
        await this.db.execAsync(`
          DELETE FROM ${Tables.MESSAGES}
          WHERE server_id IS NOT NULL
            AND id NOT IN (
              SELECT MIN(id) FROM ${Tables.MESSAGES}
              WHERE server_id IS NOT NULL
              GROUP BY chat_id, server_id
            )
        `);
      } catch (e2) {
        // Ignore — dedup indexes will prevent future duplicates
      }
    }

    // Step 2: Remove duplicate messages by wa_message_id
    try {
      await this.db.execAsync(`
        DELETE FROM ${Tables.MESSAGES} WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY chat_id, wa_message_id ORDER BY synced_at DESC
            ) AS rn FROM ${Tables.MESSAGES} WHERE wa_message_id IS NOT NULL
          ) WHERE rn > 1
        )
      `);
    } catch (e) {
      try {
        await this.db.execAsync(`
          DELETE FROM ${Tables.MESSAGES}
          WHERE wa_message_id IS NOT NULL
            AND id NOT IN (
              SELECT MIN(id) FROM ${Tables.MESSAGES}
              WHERE wa_message_id IS NOT NULL
              GROUP BY chat_id, wa_message_id
            )
        `);
      } catch (e2) {
        // Ignore
      }
    }
  }

  /**
   * Migration to version 7: Clear stale chat cache with incorrect lastMessage types
   * The toDbRecord bug stored all message types as 'text' with null body.
   * Clearing forces a fresh server fetch with the corrected serialization.
   */
  async _migrateToV7() {
    try {
      await this.db.execAsync(`DELETE FROM ${Tables.CHATS}`);
    } catch (error) {
      // Non-fatal - background refresh will correct data
    }
  }

  /**
   * Migration to version 8: Add last_message_json column for zero data loss
   * Stores full lastMessage object as JSON blob alongside indexed columns.
   * Clears stale data so fresh server fetch populates the new column.
   */
  async _migrateToV8() {
    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.CHATS} ADD COLUMN last_message_json TEXT`);
    } catch (error) {
      // Column may already exist
    }
    // Clear stale data — old rows lack the JSON column data
    try {
      await this.db.execAsync(`DELETE FROM ${Tables.CHATS}`);
    } catch (error) {
      // Non-fatal - background refresh will correct data
    }
  }

  /**
   * Migration to version 9: Ensure last_message_json column exists + clear stale data
   * V8's ALTER TABLE may have failed silently. Re-attempt column addition,
   * then clear stale chats so fresh server fetch populates correct JSON blobs.
   */
  async _migrateToV9() {
    // Ensure the column exists (V8 ALTER TABLE may have failed silently)
    try {
      await this.db.execAsync(`ALTER TABLE ${Tables.CHATS} ADD COLUMN last_message_json TEXT`);
    } catch (error) {
      // Column already exists — expected
    }
    // Clear stale data
    try {
      await this.db.execAsync(`DELETE FROM ${Tables.CHATS}`);
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Migration to version 10: DROP and recreate chats table
   * ALTER TABLE failed silently in V8/V9 — last_message_json column never got added.
   * Dropping the table lets _createTables() recreate it from the DDL with all columns.
   */
  async _migrateToV10() {
    try {
      await this.db.execAsync(`DROP TABLE IF EXISTS ${Tables.CHATS}`);
    } catch (error) {
      // Non-fatal
    }
  }

  /**
   * Migration to version 11: Force drop + recreate chats table in one step.
   * V10's DROP TABLE didn't take effect — the old table (without last_message_json)
   * persisted. This migration drops it directly and recreates from DDL immediately,
   * not relying on _createTables() which uses CREATE TABLE IF NOT EXISTS (no-op if exists).
   */
  async _migrateToV11() {
    try {
      // Force drop - use raw SQL to ensure it actually runs
      await this.db.execAsync('DROP TABLE IF EXISTS chats');
    } catch (error) {
      console.warn('[Migration V11] DROP failed:', error.message);
    }
    try {
      // Recreate immediately from DDL (includes last_message_json column)
      await this.db.execAsync(CREATE_TABLES_SQL[Tables.CHATS]);
    } catch (error) {
      console.warn('[Migration V11] CREATE failed:', error.message);
    }
  }

  /**
   * Migration to version 2: Add messages_loaded tracking columns
   * These columns enable device-primary caching like WhatsApp
   */
  async _migrateToV2() {
    try {
      // Add messages_loaded column (0 = not loaded, 1 = all messages loaded)
      await this.db.execAsync(`ALTER TABLE ${Tables.CHATS} ADD COLUMN messages_loaded INTEGER DEFAULT 0`);
    } catch (error) {
      // Column may already exist if migration was partially run
      // Log:('[DatabaseManager] messages_loaded column may already exist');
    }

    try {
      // Add messages_loaded_at timestamp column
      await this.db.execAsync(`ALTER TABLE ${Tables.CHATS} ADD COLUMN messages_loaded_at INTEGER`);
    } catch (error) {
      // Column may already exist if migration was partially run
      // Log:('[DatabaseManager] messages_loaded_at column may already exist');
    }
  }

  /**
   * Create all database tables
   */
  async _createTables() {
    try {
      for (const [tableName, sql] of Object.entries(CREATE_TABLES_SQL)) {
        await this.db.execAsync(sql);
        // Log:(`[DatabaseManager] Created/verified table: ${tableName}`);
      }
    } catch (error) {
      // Error:('[DatabaseManager] Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Create all indexes for performance
   */
  async _createIndexes() {
    try {
      for (const sql of CREATE_INDEXES_SQL) {
        await this.db.execAsync(sql);
      }
      // Log:('[DatabaseManager] Indexes created successfully');
    } catch (error) {
      // Error:('[DatabaseManager] Error creating indexes:', error);
      // Non-fatal, continue without indexes
    }
  }

  /**
   * Get the database instance
   * @returns {Promise<SQLiteDatabase>}
   */
  async getDatabase() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.db;
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL statement
   * @param {Array} params - Query parameters
   * @returns {Promise<any>}
   */
  async execute(sql, params = []) {
    const db = await this.getDatabase();
    return db.runAsync(sql, params);
  }

  /**
   * Execute a query and return all results
   * @param {string} sql - SQL statement
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async query(sql, params = []) {
    const db = await this.getDatabase();
    return db.getAllAsync(sql, params);
  }

  /**
   * Execute a query and return the first result
   * @param {string} sql - SQL statement
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>}
   */
  async queryFirst(sql, params = []) {
    const db = await this.getDatabase();
    return db.getFirstAsync(sql, params);
  }

  /**
   * Run multiple operations in a transaction
   * @param {Function} callback - Async function that receives the db instance
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const db = await this.getDatabase();
    return db.withTransactionAsync(callback);
  }

  /**
   * Insert or replace a record
   * @param {string} table - Table name
   * @param {Object} data - Record data
   * @returns {Promise<any>}
   */
  async upsert(table, data) {
    const db = await this.getDatabase();
    // Validate columns against actual table schema
    const tableInfo = await db.getAllAsync(`PRAGMA table_info(${table})`);
    const tableColumns = new Set(tableInfo.map(col => col.name));

    const columns = Object.keys(data).filter(col => tableColumns.has(col));
    const values = columns.map(col => this._sanitizeValue(data[col]));
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return db.runAsync(sql, values);
  }

  /**
   * Fix lone surrogate characters in a string (Hermes-compatible)
   * Lone surrogates cause encoding issues in SQLite
   * @param {string} str - String to fix
   * @returns {string} Fixed string
   */
  _fixSurrogates(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Check if this is a high surrogate (D800-DBFF)
      if (code >= 0xD800 && code <= 0xDBFF) {
        // Check if next char is a low surrogate (DC00-DFFF)
        if (i + 1 < str.length) {
          const nextCode = str.charCodeAt(i + 1);
          if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
            // Valid surrogate pair - keep both
            result += str[i] + str[i + 1];
            i++; // Skip the low surrogate
            continue;
          }
        }
        // Lone high surrogate - replace with space
        result += ' ';
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        // Lone low surrogate (no preceding high surrogate) - replace with space
        result += ' ';
      } else {
        result += str[i];
      }
    }
    return result;
  }

  /**
   * Sanitize a value for safe SQLite insertion
   * Handles edge cases that can cause "undefined reason" errors
   * @param {any} value - Value to sanitize
   * @returns {any} Sanitized value
   */
  _sanitizeValue(value) {
    // Handle null/undefined
    if (value === undefined || value === null) {
      return null;
    }

    // Handle symbols and functions - not storable
    if (typeof value === 'symbol' || typeof value === 'function') {
      return null;
    }

    // Handle BigInt - convert to string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle NaN and Infinity
    if (typeof value === 'number') {
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        return null;
      }
      return value;
    }

    // Handle booleans - convert to 0/1 for SQLite
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.getTime();
    }

    // Handle strings
    if (typeof value === 'string') {
      let sanitized = value;

      // Limit string length to prevent SQLite issues with very large text
      const MAX_STRING_LENGTH = 100000; // 100KB
      if (sanitized.length > MAX_STRING_LENGTH) {
        sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
      }

      // Remove null bytes (most common cause of issues)
      sanitized = sanitized.replace(/\0/g, '');

      // Remove other problematic control characters (except newlines, tabs, carriage returns)
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Handle lone surrogates (invalid UTF-16) which can cause encoding issues
      // Replace with a simple character-by-character check (Hermes-compatible)
      sanitized = this._fixSurrogates(sanitized);

      // Handle invalid UTF-8 by encoding and decoding
      try {
        sanitized = decodeURIComponent(encodeURIComponent(sanitized));
      } catch (e) {
        // If encoding fails, aggressively strip non-ASCII
        sanitized = sanitized.replace(/[^\x20-\x7E\n\r\t]/g, '');
      }

      return sanitized;
    }

    // Handle ArrayBuffer and TypedArrays
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return null; // Can't store binary data directly
    }

    // Handle objects (shouldn't happen for properly formatted records)
    if (typeof value === 'object') {
      // Handle arrays
      if (Array.isArray(value)) {
        try {
          return JSON.stringify(value);
        } catch (e) {
          return null;
        }
      }

      // Handle other objects
      try {
        const jsonStr = JSON.stringify(value);
        // Sanitize the JSON string too
        return this._sanitizeValue(jsonStr);
      } catch (e) {
        return null;
      }
    }

    return value;
  }

  /**
   * Insert multiple records in a batch
   * Processes in chunks of 50 with transactions for speed.
   * Validates columns against actual table schema to prevent "no such column" errors.
   * @param {string} table - Table name
   * @param {Array<Object>} records - Array of record objects
   * @param {number} chunkSize - Records per chunk (default: 50)
   * @returns {Promise<void>}
   */
  async batchInsert(table, records, chunkSize = 50) {
    if (!records || records.length === 0) return;

    const db = await this.getDatabase();
    const totalRecords = records.length;
    let savedCount = 0;
    let errorCount = 0;

    // Get actual table columns to prevent "no such column" errors
    const tableInfo = await db.getAllAsync(`PRAGMA table_info(${table})`);
    const tableColumns = new Set(tableInfo.map(col => col.name));

    // Helper: build INSERT SQL from record, filtered to valid columns only
    const buildInsert = (record, nullifyLargeText = false) => {
      const columns = Object.keys(record).filter(col => tableColumns.has(col));
      const values = columns.map(col => {
        const v = record[col];
        if (nullifyLargeText && typeof v === 'string' && v.length > 5000) return null;
        return this._sanitizeValue(v);
      });
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      return { sql, values };
    };

    // Process in chunks
    for (let i = 0; i < totalRecords; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);

      // Fast path: try whole chunk in a transaction
      let chunkSuccess = false;
      try {
        await db.withTransactionAsync(async () => {
          for (const record of chunk) {
            const { sql, values } = buildInsert(record);
            await db.runAsync(sql, values);
          }
        });
        savedCount += chunk.length;
        chunkSuccess = true;
      } catch (txError) {
        console.warn(`[batchInsert] Chunk transaction failed for ${table}:`, txError.message);
      }

      if (chunkSuccess) continue;

      // Slow path: individual inserts with retry
      for (const record of chunk) {
        // Attempt 1: full record
        try {
          const { sql, values } = buildInsert(record);
          await db.runAsync(sql, values);
          savedCount++;
          continue;
        } catch (err1) {
          // Attempt 2: nullify large text/JSON fields (> 5KB)
          try {
            const { sql, values } = buildInsert(record, true);
            await db.runAsync(sql, values);
            savedCount++;
            continue;
          } catch (err2) {
            errorCount++;
            if (errorCount <= 3) {
              console.error(`[batchInsert] Record failed in ${table}:`, err2.message);
            }
          }
        }
      }
    }

    if (savedCount === 0 && totalRecords > 0) {
      throw new Error(`All inserts failed for ${table}: ${errorCount}/${totalRecords}`);
    }
  }

  /**
   * Delete records matching criteria
   * @param {string} table - Table name
   * @param {string} whereClause - WHERE clause
   * @param {Array} params - Query parameters
   * @returns {Promise<any>}
   */
  async delete(table, whereClause, params = []) {
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    return this.execute(sql, params);
  }

  /**
   * Clear all data from a table
   * @param {string} table - Table name
   * @returns {Promise<any>}
   */
  async clearTable(table) {
    return this.execute(`DELETE FROM ${table}`);
  }

  /**
   * Clear all cached data for a specific setting
   * @param {string} settingId - Setting ID
   * @returns {Promise<void>}
   */
  async clearSettingData(settingId) {
    const tables = [Tables.CHATS, Tables.MESSAGES, Tables.CONTACTS, Tables.TEMPLATES, Tables.QUICK_REPLIES];

    for (const table of tables) {
      await this.delete(table, 'setting_id = ?', [settingId]);
    }

    await this.delete(Tables.CACHE_METADATA, 'setting_id = ?', [settingId]);
    await this.delete(Tables.SYNC_QUEUE, 'setting_id = ?', [settingId]);

    // Log:(`[DatabaseManager] Cleared all data for setting: ${settingId}`);
  }

  /**
   * Clear entire database (for logout)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    const tables = Object.values(Tables);

    for (const table of tables) {
      if (table !== Tables.CACHE_METADATA) {
        await this.clearTable(table);
      }
    }

    // Keep schema version in metadata
    await this.delete(Tables.CACHE_METADATA, `key != ?`, [CacheKeys.SCHEMA_VERSION]);

    // Log:('[DatabaseManager] All data cleared');
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const stats = {};

    for (const table of Object.values(Tables)) {
      const result = await this.queryFirst(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result?.count || 0;
    }

    return stats;
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
      // Log:('[DatabaseManager] Database connection closed');
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();

export default databaseManager;
