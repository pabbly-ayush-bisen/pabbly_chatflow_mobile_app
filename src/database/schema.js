/**
 * Database Schema Definitions
 *
 * This file defines the SQLite table structures for caching chat data.
 * Similar to IndexedDB object stores but with relational database benefits.
 *
 * Schema Version: 1
 */

export const SCHEMA_VERSION = 13;

// Table Names
export const Tables = {
  CHATS: 'chats',
  MESSAGES: 'messages',
  CONTACTS: 'contacts',
  TEMPLATES: 'templates',
  QUICK_REPLIES: 'quick_replies',
  CACHE_METADATA: 'cache_metadata',
  SYNC_QUEUE: 'sync_queue',
};

// SQL statements to create tables
export const CREATE_TABLES_SQL = {
  // Chats table - stores chat/conversation metadata
  [Tables.CHATS]: `
    CREATE TABLE IF NOT EXISTS ${Tables.CHATS} (
      id TEXT PRIMARY KEY,
      server_id TEXT UNIQUE NOT NULL,
      setting_id TEXT NOT NULL,
      contact_id TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_profile_pic TEXT,
      contact_last_active TEXT,
      wa_id TEXT,
      phone_number_id TEXT,
      last_message_id TEXT,
      last_message_type TEXT,
      last_message_body TEXT,
      last_message_time INTEGER,
      last_message_direction TEXT,
      last_message_json TEXT,
      unread_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_muted INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      assigned_to TEXT,
      tags TEXT,
      folder_id TEXT,
      chat_window_status TEXT,
      chat_window_expiry INTEGER,
      messages_loaded INTEGER DEFAULT 0,
      messages_loaded_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      synced_at INTEGER,
      is_dirty INTEGER DEFAULT 0,
      UNIQUE(server_id, setting_id)
    )
  `,

  // Messages table - stores individual messages
  [Tables.MESSAGES]: `
    CREATE TABLE IF NOT EXISTS ${Tables.MESSAGES} (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      chat_id TEXT NOT NULL,
      setting_id TEXT NOT NULL,
      wa_message_id TEXT,
      direction TEXT NOT NULL,
      type TEXT NOT NULL,
      body TEXT,
      media_url TEXT,
      media_mime_type TEXT,
      media_filename TEXT,
      media_caption TEXT,
      thumbnail_url TEXT,
      status TEXT DEFAULT 'pending',
      timestamp INTEGER NOT NULL,
      sent_at INTEGER,
      delivered_at INTEGER,
      read_at INTEGER,
      reaction TEXT,
      reply_to_id TEXT,
      context_message TEXT,
      interactive_data TEXT,
      template_data TEXT,
      metadata TEXT,
      is_from_me INTEGER DEFAULT 0,
      sender_name TEXT,
      sender_phone TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      synced_at INTEGER,
      is_dirty INTEGER DEFAULT 0,
      is_pending INTEGER DEFAULT 0,
      temp_id TEXT,
      local_media_path TEXT,
      local_thumbnail_path TEXT,
      media_download_status TEXT DEFAULT 'none',
      sender_type TEXT,
      sender_id TEXT,
      system_message_type TEXT,
      system_metadata TEXT,
      reactions_json TEXT
    )
  `,

  // Contacts table - stores contact information
  [Tables.CONTACTS]: `
    CREATE TABLE IF NOT EXISTS ${Tables.CONTACTS} (
      id TEXT PRIMARY KEY,
      server_id TEXT UNIQUE NOT NULL,
      setting_id TEXT NOT NULL,
      name TEXT,
      phone_number TEXT NOT NULL,
      wa_id TEXT,
      email TEXT,
      profile_pic TEXT,
      tags TEXT,
      custom_fields TEXT,
      notes TEXT,
      is_blocked INTEGER DEFAULT 0,
      opt_in_status TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      synced_at INTEGER,
      is_dirty INTEGER DEFAULT 0,
      UNIQUE(server_id, setting_id)
    )
  `,

  // Templates table - stores WhatsApp message templates
  [Tables.TEMPLATES]: `
    CREATE TABLE IF NOT EXISTS ${Tables.TEMPLATES} (
      id TEXT PRIMARY KEY,
      server_id TEXT UNIQUE NOT NULL,
      setting_id TEXT NOT NULL,
      name TEXT NOT NULL,
      language TEXT,
      category TEXT,
      status TEXT,
      components TEXT,
      header_type TEXT,
      header_content TEXT,
      body_text TEXT,
      footer_text TEXT,
      buttons TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      synced_at INTEGER,
      UNIQUE(server_id, setting_id)
    )
  `,

  // Quick Replies table - stores quick reply messages
  [Tables.QUICK_REPLIES]: `
    CREATE TABLE IF NOT EXISTS ${Tables.QUICK_REPLIES} (
      id TEXT PRIMARY KEY,
      server_id TEXT UNIQUE NOT NULL,
      setting_id TEXT NOT NULL,
      shortcut TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_type TEXT,
      attachment_url TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      synced_at INTEGER,
      UNIQUE(server_id, setting_id)
    )
  `,

  // Cache Metadata table - tracks cache state and sync info
  [Tables.CACHE_METADATA]: `
    CREATE TABLE IF NOT EXISTS ${Tables.CACHE_METADATA} (
      key TEXT PRIMARY KEY,
      value TEXT,
      setting_id TEXT,
      updated_at INTEGER
    )
  `,

  // Sync Queue table - stores pending operations for offline sync
  [Tables.SYNC_QUEUE]: `
    CREATE TABLE IF NOT EXISTS ${Tables.SYNC_QUEUE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data TEXT,
      setting_id TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER,
      processed_at INTEGER
    )
  `,
};

// Index creation SQL for performance optimization
export const CREATE_INDEXES_SQL = [
  // Chat indexes
  `CREATE INDEX IF NOT EXISTS idx_chats_setting_id ON ${Tables.CHATS}(setting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_last_message_time ON ${Tables.CHATS}(last_message_time DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_contact_phone ON ${Tables.CHATS}(contact_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_status ON ${Tables.CHATS}(status)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_assigned_to ON ${Tables.CHATS}(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_is_dirty ON ${Tables.CHATS}(is_dirty)`,

  // Message indexes
  `CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON ${Tables.MESSAGES}(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_setting_id ON ${Tables.MESSAGES}(setting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON ${Tables.MESSAGES}(timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_status ON ${Tables.MESSAGES}(status)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_is_dirty ON ${Tables.MESSAGES}(is_dirty)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_is_pending ON ${Tables.MESSAGES}(is_pending)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp ON ${Tables.MESSAGES}(chat_id, timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_download_status ON ${Tables.MESSAGES}(media_download_status)`,

  // Contact indexes
  `CREATE INDEX IF NOT EXISTS idx_contacts_setting_id ON ${Tables.CONTACTS}(setting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON ${Tables.CONTACTS}(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_name ON ${Tables.CONTACTS}(name)`,

  // Template indexes
  `CREATE INDEX IF NOT EXISTS idx_templates_setting_id ON ${Tables.TEMPLATES}(setting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_templates_status ON ${Tables.TEMPLATES}(status)`,

  // Sync queue indexes
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON ${Tables.SYNC_QUEUE}(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_setting_id ON ${Tables.SYNC_QUEUE}(setting_id)`,

  // Message deduplication indexes (partial unique — only where NOT NULL)
  // Prevents duplicate messages with the same server_id or wa_message_id within a chat
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_server_id_unique ON ${Tables.MESSAGES}(chat_id, server_id) WHERE server_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wamid_unique ON ${Tables.MESSAGES}(chat_id, wa_message_id) WHERE wa_message_id IS NOT NULL`,
];

// Cache metadata keys
export const CacheKeys = {
  LAST_SYNC_TIME: 'last_sync_time',
  LAST_CHATS_FETCH: 'last_chats_fetch',
  LAST_CONTACTS_FETCH: 'last_contacts_fetch',
  LAST_TEMPLATES_FETCH: 'last_templates_fetch',
  SCHEMA_VERSION: 'schema_version',
  USER_SETTING_ID: 'user_setting_id',
};

// Cache expiry durations (in milliseconds)
// NOTE: CHATS, MESSAGES, and CONTACTS are set to never expire (device-primary strategy)
// Data is refreshed only via pull-to-refresh, socket updates, or explicit refresh
export const CacheExpiry = {
  CHATS: Infinity,             // Never expires - device-primary like WhatsApp
  MESSAGES: Infinity,          // Never expires - messages stored permanently once fetched
  CONTACTS: Infinity,          // Never expires - contacts stored permanently
  TEMPLATES: 30 * 60 * 1000,   // 30 minutes - templates may change on server
  QUICK_REPLIES: 15 * 60 * 1000, // 15 minutes - quick replies may change
};

export default {
  SCHEMA_VERSION,
  Tables,
  CREATE_TABLES_SQL,
  CREATE_INDEXES_SQL,
  CacheKeys,
  CacheExpiry,
};
