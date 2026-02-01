# Pabbly Chatflow Mobile - Caching Management System

## Overview

This document describes the SQLite-based caching management system implemented for the Pabbly Chatflow mobile application. This system is the mobile equivalent of IndexedDB used in the web application, providing:

- **Instant Loading**: Cached data loads in < 100ms
- **Offline Support**: App works without network connectivity
- **Background Sync**: Fresh data is fetched while showing cached content
- **Optimistic Updates**: Messages appear instantly while being sent

## Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | expo-sqlite | SQLite database for React Native/Expo |
| ORM Layer | Custom Models | ChatModel, MessageModel with CRUD operations |
| State Management | Redux Toolkit | App-wide state with cache integration |
| Caching Strategy | Stale-While-Revalidate | Show cache, refresh in background |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Components                          │
│  (ChatsScreen, ChatDetailsScreen, etc.)                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cache Hooks Layer                            │
│  useCachedChats, useCachedMessages, useOptimisticMessage        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────────────┐
│    Redux Store        │   │      CacheManager                  │
│  + cacheMiddleware    │◄──│  (High-level cache operations)    │
│  + cacheThunks        │   └───────────────┬───────────────────┘
└───────────────────────┘                   │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │         Database Models              │
                          │   ChatModel    │   MessageModel      │
                          └────────────────┴────────────────────┘
                                            │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │        DatabaseManager               │
                          │   (SQLite connection, migrations)    │
                          └────────────────┬────────────────────┘
                                            │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │           expo-sqlite               │
                          │        (SQLite Database)            │
                          └─────────────────────────────────────┘
```

## File Structure

```
src/
├── database/
│   ├── index.js                 # Main exports
│   ├── schema.js                # Table definitions & indexes
│   ├── DatabaseManager.js       # SQLite connection manager
│   ├── CacheManager.js          # High-level cache operations
│   └── models/
│       ├── index.js             # Model exports
│       ├── ChatModel.js         # Chat CRUD operations
│       └── MessageModel.js      # Message CRUD operations
├── redux/
│   ├── cacheMiddleware.js       # Redux middleware for cache sync
│   └── cacheThunks.js           # Cache-enabled async thunks
├── hooks/
│   └── useCache.js              # React hooks for caching
├── contexts/
│   └── CacheContext.jsx         # Cache provider & context
└── screens/
    └── ChatsScreenCached.jsx    # Example cached screen
```

## Database Schema

### Tables

#### 1. Chats Table
Stores chat/conversation metadata for quick list loading.

```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  server_id TEXT UNIQUE NOT NULL,      -- MongoDB _id from server
  setting_id TEXT NOT NULL,            -- Multi-tenant support
  contact_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_profile_pic TEXT,
  wa_id TEXT,                          -- WhatsApp ID
  phone_number_id TEXT,
  last_message_id TEXT,
  last_message_type TEXT,
  last_message_body TEXT,
  last_message_time INTEGER,           -- Unix timestamp
  last_message_direction TEXT,         -- 'inbound' | 'outbound'
  unread_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  is_muted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  assigned_to TEXT,
  tags TEXT,                           -- JSON array
  folder_id TEXT,
  chat_window_status TEXT,
  chat_window_expiry INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  synced_at INTEGER,                   -- Last sync timestamp
  is_dirty INTEGER DEFAULT 0           -- Needs sync flag
);
```

#### 2. Messages Table
Stores individual messages for offline viewing.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  server_id TEXT,                      -- MongoDB _id (null for pending)
  chat_id TEXT NOT NULL,               -- Foreign key to chats
  setting_id TEXT NOT NULL,
  wa_message_id TEXT,                  -- WhatsApp message ID (wamid)
  direction TEXT NOT NULL,             -- 'inbound' | 'outbound'
  type TEXT NOT NULL,                  -- 'text', 'image', 'video', etc.
  body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  media_caption TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending',       -- 'pending', 'sent', 'delivered', 'read', 'failed'
  timestamp INTEGER NOT NULL,
  sent_at INTEGER,
  delivered_at INTEGER,
  read_at INTEGER,
  reaction TEXT,                       -- JSON object
  reply_to_id TEXT,
  context_message TEXT,                -- JSON object
  interactive_data TEXT,               -- JSON object
  template_data TEXT,                  -- JSON object
  metadata TEXT,                       -- JSON object
  is_from_me INTEGER DEFAULT 0,
  sender_name TEXT,
  sender_phone TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  synced_at INTEGER,
  is_dirty INTEGER DEFAULT 0,
  is_pending INTEGER DEFAULT 0,        -- Optimistic message flag
  temp_id TEXT                         -- Temporary ID for optimistic updates
);
```

#### 3. Cache Metadata Table
Tracks cache state and sync information.

```sql
CREATE TABLE cache_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  setting_id TEXT,
  updated_at INTEGER
);
```

#### 4. Sync Queue Table
Stores pending operations for offline sync.

```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,             -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT,                           -- JSON payload
  setting_id TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',       -- 'pending', 'completed', 'failed'
  error_message TEXT,
  created_at INTEGER,
  processed_at INTEGER
);
```

### Indexes

Performance-optimized indexes for common queries:

```sql
-- Chat queries
CREATE INDEX idx_chats_setting_id ON chats(setting_id);
CREATE INDEX idx_chats_last_message_time ON chats(last_message_time DESC);
CREATE INDEX idx_chats_contact_phone ON chats(contact_phone);

-- Message queries
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_chat_timestamp ON messages(chat_id, timestamp DESC);
CREATE INDEX idx_messages_is_pending ON messages(is_pending);
```

## Caching Strategies

### 1. Cache-First (Stale-While-Revalidate)

The primary strategy used for loading data:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User       │     │  Cache      │     │  Server     │
│  Request    │────▶│  Check      │────▶│  Fetch      │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                    ┌──────▼──────┐            │
                    │ Cache Hit?  │            │
                    └──────┬──────┘            │
                     Yes   │   No              │
              ┌────────────┴────────────┐      │
              ▼                         ▼      │
       ┌─────────────┐           ┌─────────────┐
       │ Return      │           │ Wait for    │
       │ Cached Data │           │ Server      │◀─┘
       └──────┬──────┘           └──────┬──────┘
              │                         │
              ▼                         │
       ┌─────────────┐                  │
       │ Background  │                  │
       │ Refresh     │◀─────────────────┘
       └─────────────┘
```

### 2. Optimistic Updates

For sending messages, we show them immediately:

```javascript
// 1. Create optimistic message (instant UI update)
const tempId = await cacheManager.addOptimisticMessage(message, chatId);

// 2. Send via socket/API
socket.emit('sendMessage', { ...message, tempId });

// 3. On success: update with server response
await cacheManager.updateOptimisticMessage(tempId, serverMessage);

// 4. On failure: mark as failed
await cacheManager.markMessageFailed(tempId, error);
```

### 3. Cache Expiry

Different data types have different expiry times:

| Data Type | Expiry | Rationale |
|-----------|--------|-----------|
| Chats | 5 minutes | Changes frequently (new messages) |
| Messages | 2 minutes | Real-time updates expected |
| Contacts | 10 minutes | Changes infrequently |
| Templates | 30 minutes | Rarely changes |

## Usage Guide

### 1. Initialize Cache (App Startup)

```jsx
// App.js or similar
import { CacheProvider } from './contexts/CacheContext';

export default function App() {
  return (
    <Provider store={store}>
      <CacheProvider>
        <NavigationContainer>
          {/* ... */}
        </NavigationContainer>
      </CacheProvider>
    </Provider>
  );
}
```

### 2. Fetch Chats with Cache

```jsx
import { useDispatch, useSelector } from 'react-redux';
import { fetchChatsWithCache } from '../redux/cacheThunks';
import { setChats } from '../redux/slices/inboxSlice';

function ChatsScreen() {
  const dispatch = useDispatch();
  const { chats } = useSelector((state) => state.inbox);

  useEffect(() => {
    const loadChats = async () => {
      const result = await dispatch(fetchChatsWithCache({ all: true })).unwrap();
      dispatch(setChats(result.chats));

      console.log(`Loaded ${result.chats.length} chats`);
      console.log(`From cache: ${result.fromCache}`);
      console.log(`Is stale: ${result.isStale}`);
    };

    loadChats();
  }, [dispatch]);

  return (
    <FlatList data={chats} ... />
  );
}
```

### 3. Using Cache Hooks

```jsx
import { useCachedChats, useCachedMessages } from '../hooks/useCache';

function ChatsList() {
  const { chats, isLoading, fromCache, isStale, refresh } = useCachedChats();

  return (
    <FlatList
      data={chats}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
    />
  );
}

function ChatMessages({ chatId }) {
  const { messages, isLoading, loadMore, hasMore } = useCachedMessages(chatId);

  return (
    <FlatList
      data={messages}
      onEndReached={() => hasMore && loadMore()}
    />
  );
}
```

### 4. Optimistic Message Sending

```jsx
import { useOptimisticMessage } from '../hooks/useCache';
import { sendMessageViaSocket } from '../services/socketService';

function ChatInput({ chatId }) {
  const { addOptimistic, confirmMessage, failMessage } = useOptimisticMessage(chatId);

  const handleSend = async (text) => {
    // 1. Add optimistic message (shows immediately)
    const tempId = await addOptimistic({
      type: 'text',
      body: text,
    });

    try {
      // 2. Send via socket
      const response = await sendMessageViaSocket({
        chatId,
        message: text,
        tempId,
      });

      // 3. Confirm with server response
      await confirmMessage(tempId, response);
    } catch (error) {
      // 4. Mark as failed
      await failMessage(tempId, error);
    }
  };

  return <TextInput onSubmit={handleSend} />;
}
```

### 5. Cache Management

```jsx
import { useCache, useCacheManagement } from '../hooks/useCache';

function SettingsScreen() {
  const { stats } = useCache();
  const { clearCurrentCache, clearAllCache } = useCacheManagement();

  return (
    <View>
      <Text>Cached Chats: {stats?.chats || 0}</Text>
      <Text>Cached Messages: {stats?.messages || 0}</Text>

      <Button onPress={clearCurrentCache} title="Clear Cache" />
      <Button onPress={clearAllCache} title="Clear All (Logout)" />
    </View>
  );
}
```

## Performance Benefits

### Load Time Comparison

| Scenario | Without Cache | With Cache |
|----------|--------------|------------|
| First load | 2-5 seconds | 2-5 seconds |
| Subsequent loads | 2-5 seconds | < 100ms |
| App restart | 2-5 seconds | < 100ms |
| Offline | Error | Works |

### Memory Efficiency

- SQLite uses disk storage, not RAM
- Only active data is loaded into memory
- Pagination support for large datasets

## Integration with Existing Code

### Socket Handler Integration

Update socket handlers to sync with cache:

```javascript
// In socketHandlers.js
import { cacheManager } from '../database/CacheManager';

export const handleNewMessage = async (data, dispatch) => {
  const { chat, lastMessage } = data;

  // 1. Update Redux (for immediate UI update)
  dispatch(updateChatInList(chat));
  dispatch(addMessageToCurrentConversation({ chatId: chat._id, message: lastMessage }));

  // 2. Persist to cache (for offline access)
  await cacheManager.addMessage(lastMessage, chat._id);
  await cacheManager.updateChat(chat);
};
```

### Logout Integration

Clear cache on logout:

```javascript
// In userSlice.js or auth logic
import { clearAllCacheData } from '../redux/cacheThunks';

export const logout = createAsyncThunk('user/logout', async (_, { dispatch }) => {
  // Clear cache
  await dispatch(clearAllCacheData());

  // Clear AsyncStorage
  await AsyncStorage.clear();

  return { success: true };
});
```

## Migration Guide

To migrate from the non-cached to cached implementation:

### Step 1: Install Dependencies

```bash
npx expo install expo-sqlite
```

### Step 2: Wrap App with CacheProvider

```jsx
// App.js
import { CacheProvider } from './contexts/CacheContext';

// Add CacheProvider inside Redux Provider
<Provider store={store}>
  <CacheProvider>
    {/* existing app content */}
  </CacheProvider>
</Provider>
```

### Step 3: Replace Screens

```jsx
// Option A: Replace import
// Before:
import ChatsScreen from './screens/ChatsScreen';
// After:
import ChatsScreen from './screens/ChatsScreenCached';

// Option B: Gradual migration with feature flag
const ChatsScreen = useFeatureFlag('cache_enabled')
  ? ChatsScreenCached
  : ChatsScreenOriginal;
```

### Step 4: Update Socket Handlers

Add cache sync calls to existing socket handlers (see Integration section above).

## Troubleshooting

### Cache Not Loading

1. Check if CacheProvider is properly wrapped around the app
2. Verify settingId is available in Redux state
3. Check console logs for initialization errors

### Stale Data Issues

1. Verify network connectivity
2. Check cache expiry settings in schema.js
3. Force refresh with `forceRefresh: true`

### Database Errors

1. Check for migration issues (version mismatch)
2. Clear cache and restart: `cacheManager.clearAllCache()`
3. Check SQLite logs for specific errors

## Best Practices

1. **Always use cache thunks** for data fetching instead of direct API calls
2. **Don't cache sensitive data** like passwords or tokens in the database
3. **Clear cache on logout** to prevent data leakage between accounts
4. **Use optimistic updates** for better UX when sending messages
5. **Implement proper error handling** for cache operations
6. **Monitor cache size** and implement cleanup for old data if needed

## Future Enhancements

- [ ] Add data encryption for sensitive messages
- [ ] Implement selective sync (only changed data)
- [ ] Add cache compression for media metadata
- [ ] Implement cache size limits with LRU eviction
- [ ] Add analytics for cache hit rates
