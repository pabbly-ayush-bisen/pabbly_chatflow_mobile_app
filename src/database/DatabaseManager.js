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
      console.log('[DatabaseManager] Initializing database...');

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
      console.log('[DatabaseManager] Database initialized successfully');
    } catch (error) {
      console.error('[DatabaseManager] Initialization error:', error);
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
        console.log(`[DatabaseManager] Migrating from version ${currentVersion} to ${SCHEMA_VERSION}`);
        await this._runMigrations(currentVersion, SCHEMA_VERSION);

        // Update schema version
        await this.db.runAsync(
          `INSERT OR REPLACE INTO ${Tables.CACHE_METADATA} (key, value, updated_at) VALUES (?, ?, ?)`,
          [CacheKeys.SCHEMA_VERSION, SCHEMA_VERSION.toString(), Date.now()]
        );
      }
    } catch (error) {
      console.error('[DatabaseManager] Migration check error:', error);
      // If error, try to create fresh tables
    }
  }

  /**
   * Run migrations between versions
   */
  async _runMigrations(fromVersion, toVersion) {
    // For version 1, we just create fresh tables
    if (fromVersion === 0 && toVersion >= 1) {
      console.log('[DatabaseManager] Creating initial schema...');
      // Tables will be created in _createTables
    }

    // Add future migrations here
    // if (fromVersion < 2 && toVersion >= 2) {
    //   await this._migrateToV2();
    // }
  }

  /**
   * Create all database tables
   */
  async _createTables() {
    try {
      for (const [tableName, sql] of Object.entries(CREATE_TABLES_SQL)) {
        await this.db.execAsync(sql);
        console.log(`[DatabaseManager] Created/verified table: ${tableName}`);
      }
    } catch (error) {
      console.error('[DatabaseManager] Error creating tables:', error);
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
      console.log('[DatabaseManager] Indexes created successfully');
    } catch (error) {
      console.error('[DatabaseManager] Error creating indexes:', error);
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
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.execute(sql, values);
  }

  /**
   * Insert multiple records in a batch
   * @param {string} table - Table name
   * @param {Array<Object>} records - Array of record objects
   * @returns {Promise<void>}
   */
  async batchInsert(table, records) {
    if (!records || records.length === 0) return;

    const db = await this.getDatabase();

    await db.withTransactionAsync(async () => {
      for (const record of records) {
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        await db.runAsync(sql, values);
      }
    });
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

    console.log(`[DatabaseManager] Cleared all data for setting: ${settingId}`);
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

    console.log('[DatabaseManager] All data cleared');
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
      console.log('[DatabaseManager] Database connection closed');
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();

export default databaseManager;
