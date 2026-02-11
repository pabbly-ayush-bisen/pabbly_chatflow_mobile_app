import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { fetchChatsWithCache, fetchConversationWithCache, fetchQuickRepliesWithCache, searchChatsWithCache, syncMissedMessages } from '../cacheThunks';

// ----------------------------------------------------------------------------
// Chat list normalization
// Some APIs don't return `lastMessage` on the chat list. The web app relies on
// `lastMessage`, so we normalize here to keep UI consistent.
// ----------------------------------------------------------------------------
const normalizeLastMessage = (chat) => {
  if (!chat || typeof chat !== 'object') return null;

  // Common shapes
  const direct =
    chat.lastMessage ||
    chat.last_message ||
    chat.latestMessage ||
    chat.latest_message ||
    null;

  if (direct && typeof direct === 'object') return direct;

  // Sometimes API returns messages array in list (rare)
  const msgs = Array.isArray(chat.messages) ? chat.messages : null;
  if (msgs && msgs.length > 0) return msgs[msgs.length - 1];

  // Build a synthetic lastMessage from flat fields if present
  const type =
    chat.lastMessageType ||
    chat.last_message_type ||
    chat.lastMessage?.type ||
    chat.last_message?.type ||
    null;

  const text =
    chat.lastMessageText ||
    chat.last_message_text ||
    chat.lastMessageBody ||
    chat.last_message_body ||
    chat.lastMessage?.message?.body ||
    chat.last_message?.message?.body ||
    null;

  const lastAt =
    chat.lastMessageAt ||
    chat.last_message_at ||
    chat.lastMessageTime ||
    chat.last_message_time ||
    chat.updatedAt ||
    chat.createdAt ||
    null;

  const status =
    chat.lastMessageStatus ||
    chat.last_message_status ||
    null;

  const sentBy =
    chat.lastMessageSentBy ||
    chat.last_message_sent_by ||
    null;

  const direction =
    chat.lastMessageDirection ||
    chat.last_message_direction ||
    null;

  if (!type && !text) return null;

  return {
    type: type || 'text',
    status: status || undefined,
    sentBy: sentBy || undefined,
    direction: direction || undefined,
    createdAt: lastAt || undefined,
    timestamp: lastAt || undefined,
    message: {
      body: text || '',
    },
  };
};

const normalizeChatForList = (chat) => {
  if (!chat || typeof chat !== 'object') return chat;
  const lastMessage = normalizeLastMessage(chat);
  return {
    ...chat,
    lastMessage: lastMessage || null,
    // Keep a consistent "last message time" for sorting & display
    lastMessageTime:
      lastMessage?.timestamp ||
      lastMessage?.createdAt ||
      chat.lastMessageAt ||
      chat.last_message_at ||
      chat.lastMessageTime ||
      chat.updatedAt ||
      chat.createdAt ||
      null,
  };
};

// Async thunks
export const fetchChats = createAsyncThunk(
  'inbox/fetchChats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { all: fetchAll, filter } = params;
      let allChats = [];
      let lastChatUpdatedAt = null;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 50; // Safety limit to prevent infinite loops

      // Log:('[fetchChats] Starting fetch with params:', JSON.stringify(params));

      // If all: true, we need to paginate through ALL pages
      if (fetchAll === true) {
        while (hasMore && pageCount < maxPages) {
          pageCount++;
          const requestParams = {};

          // Add filter if specified
          if (filter && filter !== 'all') {
            requestParams.filter = filter;
          }

          // Add pagination cursor for subsequent pages
          if (lastChatUpdatedAt) {
            requestParams.lastChatUpdatedAt = lastChatUpdatedAt;
          }

          // Log:(`[fetchChats] Page ${pageCount} - Request params:`, JSON.stringify(requestParams));

          const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, requestParams);

          if (response.status === 'error') {
            // Error:('[fetchChats] API Error:', response.message);
            return rejectWithValue(response.message || 'Failed to fetch chats');
          }

          // Extract chats from response
          const rawChats = response.data?.chats || response.chats || response._raw?.chats || [];
          // Log:(`[fetchChats] Page ${pageCount} - Received ${rawChats.length} chats`);

          if (rawChats.length === 0) {
            hasMore = false;
            break;
          }

          // Append chats to our collection
          allChats = [...allChats, ...rawChats];

          // Check if there are more chats to fetch
          hasMore = response.data?.hasMoreChats || response.hasMoreChats || response._raw?.hasMoreChats || false;

          // Get the oldest chat's updatedAt for next page cursor
          if (hasMore && rawChats.length > 0) {
            const lastChat = rawChats[rawChats.length - 1];
            lastChatUpdatedAt = lastChat.updatedAt || lastChat.lastMessageAt || lastChat.createdAt;
          }

          // Log:(`[fetchChats] Page ${pageCount} - hasMoreChats: ${hasMore}, nextCursor: ${lastChatUpdatedAt}`);
        }

        // Deduplicate chats by _id to prevent duplicate key errors in FlatList
        const uniqueChatsMap = new Map();
        allChats.forEach(chat => {
          if (chat._id && !uniqueChatsMap.has(chat._id)) {
            uniqueChatsMap.set(chat._id, chat);
          }
        });
        const uniqueChats = Array.from(uniqueChatsMap.values());

        // Log:(`[fetchChats] Completed! Total chats fetched: ${allChats.length}, unique: ${uniqueChats.length} across ${pageCount} pages`);

        // Return all chats in the expected format
        return {
          status: 'success',
          chats: uniqueChats,
          data: { chats: uniqueChats },
          hasMoreChats: false, // We've fetched everything
          _raw: { chats: uniqueChats, hasMoreChats: false },
        };
      }

      // Regular single-page fetch (for manual pagination if needed)
      const requestParams = { ...params };
      delete requestParams.all;

      const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, requestParams);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch chats');
      }

      const rawChats = response.data?.chats || response.chats || response._raw?.chats || [];
      // Log:('[fetchChats] Single page fetch - Received:', rawChats.length, 'chats');

      return response;
    } catch (error) {
      // Error:('[fetchChats] Exception:', error.message);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchConversation = createAsyncThunk(
  'inbox/fetchConversation',
  async (arg, { rejectWithValue }) => {
    try {
      const url = endpoints.inbox.getConversation;
      const chatId = typeof arg === 'object' ? (arg.chatId || arg._id || arg.id) : arg;
      const fetchAll = typeof arg === 'object' && arg.all === true;

      // If all: true, fetch all messages without limit/skip
      const params = { _id: chatId };
      if (fetchAll) {
        params.all = true;
      } else {
        // Fallback to pagination if not fetching all
        params.limit = typeof arg === 'object' && arg.limit ? arg.limit : 50;
        params.skip = typeof arg === 'object' && arg.skip ? arg.skip : 0;
      }

      const response = await callApi(url, httpMethods.GET, params);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch conversation');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch more messages (pagination - load older messages)
export const fetchMoreMessages = createAsyncThunk(
  'inbox/fetchMoreMessages',
  async ({ chatId, skip, limit = 50 }, { rejectWithValue }) => {
    try {
      const url = endpoints.inbox.getConversation;
      const response = await callApi(url, httpMethods.GET, { _id: chatId, limit, skip });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch more messages');
      }
      return { response, skip };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateChat = createAsyncThunk(
  'inbox/updateChat',
  async ({ id, status, assignedToMember, hideNotification }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.updateChat}/${id}`;
      const response = await callApi(url, httpMethods.PUT, {
        status,
        assignedToMember,
        hideNotification,
      });
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to update chat');
      }
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteChat = createAsyncThunk(
  'inbox/deleteChat',
  async (id, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.deleteChat}/${id}`;
      const response = await callApi(url, httpMethods.DELETE);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete chat');
      }
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const sendMessage = createAsyncThunk(
  'inbox/sendMessage',
  async (messageData, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.inbox.sendMessage, httpMethods.POST, messageData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to send message');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const replyMessage = createAsyncThunk(
  'inbox/replyMessage',
  async (messageData, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.inbox.replyMessage, httpMethods.POST, messageData);
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to reply message');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Update contact chat (status, assignedTo, etc.) - for intervene and status changes
export const updateContactChat = createAsyncThunk(
  'inbox/updateContactChat',
  async ({ id, status, assignedToMember, hideNotification }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.updateChat}/${id}`;
      const response = await callApi(url, httpMethods.PUT, {
        status,
        assignedToMember,
        hideNotification,
      });
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to update contact chat');
      }
      return { id, status, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Toggle AI Assistant for a chat
// Uses the same endpoint as web app: aiassistants/toggle-chat-assistant
export const toggleAiAssistant = createAsyncThunk(
  'inbox/toggleAiAssistant',
  async ({ chatId, assistantId, isActive }, { rejectWithValue }) => {
    try {
      const url = endpoints.assistants.toggleAiAssistant;
      const response = await callApi(url, httpMethods.POST, {
        chatId,
        assistantId,
        isActive,
      });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to toggle AI Assistant');
      }
      return { chatId, assistantId, isActive, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch AI Assistants list
// Returns list of active AI assistants for selection
export const fetchAiAssistants = createAsyncThunk(
  'inbox/fetchAiAssistants',
  async (_, { rejectWithValue }) => {
    try {
      const url = endpoints.assistants.getAssistants;
      const response = await callApi(url, httpMethods.GET, { status: 'active' });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch AI assistants');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch templates
export const fetchTemplates = createAsyncThunk(
  'inbox/fetchTemplates',
  async (params = { status: 'APPROVED', all: true }, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.template?.getTemplates || '/template', httpMethods.GET, params);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch templates');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch quick replies
export const fetchQuickReplies = createAsyncThunk(
  'inbox/fetchQuickReplies',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.settings?.quickReplies || '/settings/quick-replies', httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch quick replies');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch chats by contact IDs (for updateChatOnContactUpdate socket event)
export const fetchChatsByContacts = createAsyncThunk(
  'inbox/fetchChatsByContacts',
  async (contactIds, { rejectWithValue }) => {
    try {
      const response = await callApi(
        `${endpoints.inbox.root}/by-contacts`,
        httpMethods.POST,
        { contactIds }
      );
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch chats by contacts');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch more chats (pagination)
export const fetchMoreChats = createAsyncThunk(
  'inbox/fetchMoreChats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { inbox } = getState();
      const { paginationCursor, activeFilter } = inbox;

      const requestParams = {
        ...params,
        cursor: paginationCursor,
        filter: activeFilter !== 'all' ? activeFilter : undefined,
      };

      const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, requestParams);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch more chats');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Search chats via API (triggered on Enter key press)
// Matches web app behavior: calls chats/search endpoint with search query
export const searchChats = createAsyncThunk(
  'inbox/searchChats',
  async ({ search, lastChatUpdatedAt }, { rejectWithValue }) => {
    try {
      const filters = {
        search: search?.trim() || undefined,
        lastChatUpdatedAt: lastChatUpdatedAt || undefined,
      };

      const response = await callApi(endpoints.inbox.searchChats, httpMethods.GET, filters);

      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to search chats');
      }

      // Extract chats from response
      const chats = response.data?.chats || response.chats || response._raw?.chats || [];
      const hasMoreChats = response.data?.hasMoreChats || response.hasMoreChats || response._raw?.hasMoreChats || false;

      return {
        chats,
        hasMoreChats,
        search,
      };
    } catch (error) {
      return rejectWithValue(error.message || 'Search failed');
    }
  }
);

// Fetch chat notes
export const fetchChatNotes = createAsyncThunk(
  'inbox/fetchChatNotes',
  async (chatId, { rejectWithValue }) => {
    try {
      const response = await callApi(`${endpoints.inbox.root}/${chatId}/notes`, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch notes');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Add chat note
export const addChatNote = createAsyncThunk(
  'inbox/addChatNote',
  async ({ chatId, note }, { rejectWithValue }) => {
    try {
      const response = await callApi(`${endpoints.inbox.root}/${chatId}/notes`, httpMethods.POST, { note });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to add note');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Delete chat note
export const deleteChatNote = createAsyncThunk(
  'inbox/deleteChatNote',
  async ({ chatId, noteId }, { rejectWithValue }) => {
    try {
      const response = await callApi(`${endpoints.inbox.root}/${chatId}/notes/${noteId}`, httpMethods.DELETE);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to delete note');
      }
      return { noteId, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Send message reaction
export const sendMessageReaction = createAsyncThunk(
  'inbox/sendMessageReaction',
  async ({ chatId, messageId, emoji }, { rejectWithValue }) => {
    try {
      const response = await callApi(`${endpoints.inbox.root}/${chatId}/messages/${messageId}/reaction`, httpMethods.POST, { emoji });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to send reaction');
      }
      return { chatId, messageId, emoji, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch team members for chat assignment
export const fetchTeamMembers = createAsyncThunk(
  'inbox/fetchTeamMembers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await callApi(endpoints.teamMember.addTeamMember, httpMethods.GET);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch team members');
      }
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Assign chat to team member
export const assignChatToMember = createAsyncThunk(
  'inbox/assignChatToMember',
  async ({ chatId, memberId }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.updateChat}/${chatId}`;
      const response = await callApi(url, httpMethods.PUT, { assignedToMember: memberId });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to assign chat');
      }
      return { chatId, memberId, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Toggle chat notifications (mute/unmute)
export const toggleChatNotifications = createAsyncThunk(
  'inbox/toggleChatNotifications',
  async ({ chatId, hideNotification }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.updateChat}/${chatId}`;
      const response = await callApi(url, httpMethods.PUT, { hideNotification });
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to toggle notifications');
      }
      return { chatId, hideNotification, response };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  chats: [],
  currentConversation: null,
  // In-memory cache to avoid re-fetching already loaded messages on reopen
  conversationCache: {}, // { [chatId]: { conversation, messagesSkip, hasMoreMessages, cachedAt } }
  status: 'idle',
  conversationStatus: 'idle',
  // Message pagination state
  messagesSkip: 0,
  hasMoreMessages: true,
  isLoadingMoreMessages: false,
  loadMoreMessagesError: null,
  updateChatStatus: 'idle',
  deleteChatStatus: 'idle',
  sendMessageStatus: 'idle',
  replyMessageStatus: 'idle',
  updateContactChatStatus: 'idle',
  toggleAiAssistantStatus: 'idle',
  error: null,
  conversationError: null,
  updateChatError: null,
  deleteChatError: null,
  sendMessageError: null,
  replyMessageError: null,
  contactCreateError: null,
  updateContactChatError: null,
  toggleAiAssistantError: null,
  hasMoreChats: false,
  selectedChatId: null,
  conversationId: null, // ID of newly created conversation
  socketStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  // AI Assistant state
  aiAssistantStatus: false,
  selectedAssistantId: null,
  chatStatus: null, // Current chat status: 'open', 'intervened', 'aiAssistant', etc.
  // AI Assistants list (for selection)
  aiAssistants: [],
  aiAssistantsStatus: 'idle',
  aiAssistantsError: null,
  // Templates and quick replies
  templates: [],
  templatesStatus: 'idle',
  templatesError: null,
  quickReplies: [],
  quickRepliesStatus: 'idle',
  quickRepliesError: null,
  // Chat Filters
  activeFilter: 'all', // 'all' | 'unread' | 'assigned_to_me'
  // Pagination
  paginationCursor: null,
  isLoadingMore: false,
  loadMoreError: null,
  // Chat Notes
  notes: [],
  notesStatus: 'idle',
  notesError: null,
  addNoteStatus: 'idle',
  deleteNoteStatus: 'idle',
  // Message Reactions
  reactionStatus: 'idle',
  reactionError: null,
  // Pending reaction blast animation (emoji string or null)
  pendingReactionBlast: null,
  // Team Members for assignment
  teamMembers: [],
  teamMembersStatus: 'idle',
  // Flag to trigger chat list refresh (e.g., after creating a new chat)
  shouldRefreshChats: false,
  // Search state
  searchQuery: '',
  searchResults: [],
  searchStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  searchError: null,
  isSearchActive: false,
  searchHasMore: false,
  searchLastChatDate: null,
};

// Slice
const inboxSlice = createSlice({
  name: 'inbox',
  initialState,
  reducers: {
    setCurrentConversationFromCache: (state, action) => {
      const chatId = action.payload;
      const cached = state.conversationCache?.[chatId];
      if (cached?.conversation) {
        state.currentConversation = cached.conversation;
        state.messagesSkip = cached.messagesSkip ?? (cached.conversation.messages?.length || 0);
        state.hasMoreMessages = cached.hasMoreMessages ?? true;
      }
    },
    setChats: (state, action) => {
      state.chats = (action.payload || []).map(normalizeChatForList);
    },
    setSelectedChatId: (state, action) => {
      state.selectedChatId = action.payload;
    },
    appendChat: (state, action) => {
      state.chats.unshift(normalizeChatForList(action.payload));
    },
    updateChatInList: (state, action) => {
      const incoming = normalizeChatForList(action.payload);
      if (!incoming?._id) return; // Skip if no valid _id

      const index = state.chats.findIndex(chat => chat._id === incoming._id);
      if (index !== -1) {
        // Update existing chat
        state.chats[index] = { ...state.chats[index], ...incoming };
        // Move to top if not a system message update
        if (incoming.lastMessage?.type !== 'system') {
          const [chat] = state.chats.splice(index, 1);
          state.chats.unshift(chat);
        }
      } else {
        // New chat, add to top only if not already present
        const alreadyExists = state.chats.some(chat => chat._id === incoming._id);
        if (!alreadyExists) {
          state.chats.unshift(incoming);
        }
      }
      // Also update currentConversation if it matches
      if (state.currentConversation && state.currentConversation._id === incoming?._id) {
        if (incoming.contact) {
          state.currentConversation.contact = {
            ...state.currentConversation.contact,
            ...incoming.contact,
          };
        }
      }
    },
    removeChatFromList: (state, action) => {
      state.chats = state.chats.filter(chat => chat._id !== action.payload);
    },
    resetUnreadCount: (state, action) => {
      const chatId = action.payload;
      const chat = state.chats.find(c => c._id === chatId);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    setConversationId: (state, action) => {
      state.conversationId = action.payload;
    },
    setSendMessageError: (state, action) => {
      state.sendMessageError = action.payload;
    },
    setContactCreateError: (state, action) => {
      state.contactCreateError = action.payload;
    },
    setSocketStatus: (state, action) => {
      state.socketStatus = action.payload;
    },
    // Add message to current conversation (for real-time updates)
    addMessageToCurrentConversation: (state, action) => {
      const { chatId, message } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        // Initialize messages array if it doesn't exist
        if (!state.currentConversation.messages) {
          state.currentConversation.messages = [];
        }

        // Check if this is a response to an optimistic message (match by tempId)
        if (message.tempId) {
          const optimisticIndex = state.currentConversation.messages.findIndex(
            m => m.tempId === message.tempId && m.isOptimistic
          );
          if (optimisticIndex !== -1) {
            // Replace optimistic message with real message from server
            state.currentConversation.messages[optimisticIndex] = {
              ...message,
              isOptimistic: false,
            };
            return;
          }
        }

        // For outgoing messages, check if we have an optimistic message that matches
        // Match by: same chatId, same content, same type, within 30 seconds, and marked as optimistic
        // Broaden detection: server may use different field names for outgoing messages
        const isOutgoing = message.sentBy === 'user'
          || message.direction === 'outbound'
          || message.direction === 'outgoing'
          || message.isFromMe
          || message.from?.type === 'teamMember';
        // Also try matching if the message has a wamid and there are pending optimistic messages
        const hasPendingOptimistic = state.currentConversation.messages.some(m => m.isOptimistic);
        if (isOutgoing || (message.wamid && hasPendingOptimistic)) {
          // Normalize body text extraction - server may send body as string or object
          const extractBodyText = (msg) => {
            const body = msg?.message?.body;
            if (typeof body === 'string') return body;
            if (body && typeof body === 'object' && body.text) return body.text;
            // Also check message.message.text and message.text
            if (typeof msg?.message?.text === 'string') return msg.message.text;
            if (typeof msg?.text === 'string') return msg.text;
            return '';
          };
          const messageText = extractBodyText(message);
          const messageType = message.type || 'text';
          const messageTime = new Date(message.timestamp || message.createdAt).getTime();

          const optimisticIndex = state.currentConversation.messages.findIndex(m => {
            if (!m.isOptimistic) return false;

            const optText = extractBodyText(m);
            const optType = m.type || 'text';
            const optTime = new Date(m.timestamp || m.createdAt).getTime();

            // Match if same type and similar content
            // For queued offline messages, the time gap between original send and server
            // processing can be minutes/hours, so use a generous window (10 min).
            // For live sends it's typically < 5 seconds.
            const timeDiff = Math.abs(messageTime - optTime);
            const textMatch = messageType === 'text' ? messageText === optText : true; // For media, don't check text
            const typeMatch = messageType === optType;

            return typeMatch && textMatch && timeDiff < 600000;
          });

          if (optimisticIndex !== -1) {
            // Replace optimistic message with real message from server
            // Log:('[inboxSlice] Replacing optimistic message with real message');
            state.currentConversation.messages[optimisticIndex] = {
              ...message,
              isOptimistic: false,
            };
            return;
          }
        }

        // Check if message already exists (by wamid or _id)
        // Exclude temp_ prefixed IDs from _id comparison — server IDs should not match temp IDs
        const existingIndex = state.currentConversation.messages.findIndex(
          m => (message.wamid && m.wamid === message.wamid) ||
               (message._id && m._id === message._id &&
                !String(message._id).startsWith('temp_') &&
                !String(m._id).startsWith('temp_'))
        );

        if (existingIndex !== -1) {
          // Message exists — merge reaction field if the incoming message has updated reaction data
          // This handles the case where the backend sends the target message with reaction already applied
          const existing = state.currentConversation.messages[existingIndex];
          const incomingReaction = message.reaction;
          const existingReaction = existing.reaction;
          const reactionChanged = JSON.stringify(incomingReaction) !== JSON.stringify(existingReaction);

          if (reactionChanged && incomingReaction !== undefined) {
            state.currentConversation.messages[existingIndex] = {
              ...existing,
              reaction: incomingReaction,
            };
            // Trigger blast animation for new reactions
            if (incomingReaction?.emoji) {
              state.pendingReactionBlast = incomingReaction.emoji;
            }
          }
        } else {
          // New message — add and sort by timestamp to maintain chronological order
          // Without sorting, socket messages arriving out of order would display incorrectly
          state.currentConversation.messages.push(message);
          state.currentConversation.messages.sort((a, b) => {
            const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
            const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
            return aT - bT;
          });
        }
      }
    },
    // Update message status in current conversation
    updateMessageInCurrentConversation: (state, action) => {
      const { chatId, messageWaId, tempId, updates } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        // First try to find by wamid
        let messageIndex = state.currentConversation.messages?.findIndex(
          m => m.wamid === messageWaId
        );

        // If not found by wamid and tempId is provided, try to find by tempId
        if ((messageIndex === -1 || messageIndex === undefined) && tempId) {
          messageIndex = state.currentConversation.messages?.findIndex(
            m => m.tempId === tempId
          );
        }

        // Fallback: if both wamid and tempId lookups failed, find a pending optimistic message
        // Only auto-match if exactly one pending message to avoid ambiguity
        if ((messageIndex === -1 || messageIndex === undefined) && messageWaId) {
          const pendingIndices = [];
          state.currentConversation.messages?.forEach((m, i) => {
            if (m.isOptimistic && m.status === 'pending') {
              pendingIndices.push(i);
            }
          });
          if (pendingIndices.length === 1) {
            messageIndex = pendingIndices[0];
          }
        }

        if (messageIndex !== -1 && messageIndex !== undefined) {
          state.currentConversation.messages[messageIndex] = {
            ...state.currentConversation.messages[messageIndex],
            ...updates,
            // If wamid is provided in updates or we're updating by wamid, mark as no longer optimistic
            ...(updates.wamid || messageWaId ? { isOptimistic: false, wamid: updates.wamid || messageWaId } : {}),
          };
        }
      }
      // Also update in chat list if it's the last message
      const chat = state.chats.find(c => c._id === chatId);
      if (chat && chat.lastMessage?.wamid === messageWaId) {
        chat.lastMessage = { ...chat.lastMessage, ...updates };
      }
    },
    // Update local media download metadata on a message (keeps Redux in sync with SQLite)
    updateMessageMediaMeta: (state, action) => {
      const { messageId, localMediaPath, localThumbnailPath, downloadStatus } = action.payload;
      if (!state.currentConversation?.messages) return;
      const idx = state.currentConversation.messages.findIndex(
        m => m._id === messageId || m.wamid === messageId || m.server_id === messageId
      );
      if (idx !== -1) {
        state.currentConversation.messages[idx] = {
          ...state.currentConversation.messages[idx],
          _localMediaPath: localMediaPath,
          _localThumbnailPath: localThumbnailPath || state.currentConversation.messages[idx]._localThumbnailPath,
          _mediaDownloadStatus: downloadStatus || 'downloaded',
        };
      }
    },
    clearInboxError: (state) => {
      state.error = null;
      state.conversationError = null;
      state.updateChatError = null;
      state.deleteChatError = null;
      state.sendMessageError = null;
      state.replyMessageError = null;
      state.contactCreateError = null;
      state.updateContactChatError = null;
      state.toggleAiAssistantError = null;
      state.templatesError = null;
      state.quickRepliesError = null;
    },
    // AI Assistant status management
    setAiAssistantStatus: (state, action) => {
      state.aiAssistantStatus = action.payload;
    },
    setSelectedAssistantId: (state, action) => {
      state.selectedAssistantId = action.payload;
    },
    setChatStatus: (state, action) => {
      state.chatStatus = action.payload;
      // Also update in current conversation if loaded
      if (state.currentConversation) {
        state.currentConversation.status = action.payload;
      }
    },
    // Set templates directly
    setTemplates: (state, action) => {
      state.templates = action.payload;
    },
    // Set quick replies directly
    setQuickReplies: (state, action) => {
      state.quickReplies = action.payload;
    },
    // Set active filter
    setActiveFilter: (state, action) => {
      state.activeFilter = action.payload;
      // Reset pagination when filter changes
      state.paginationCursor = null;
      state.hasMoreChats = false;
    },
    // Set pagination cursor
    setPaginationCursor: (state, action) => {
      state.paginationCursor = action.payload;
    },
    // Reset pagination
    resetPagination: (state) => {
      state.paginationCursor = null;
      state.isLoadingMore = false;
      state.loadMoreError = null;
    },
    // Set notes
    setNotes: (state, action) => {
      state.notes = action.payload;
    },
    // Add note to list
    addNoteToList: (state, action) => {
      state.notes.unshift(action.payload);
    },
    // Remove note from list
    removeNoteFromList: (state, action) => {
      state.notes = state.notes.filter(note => note._id !== action.payload);
    },
    // Set team members
    setTeamMembers: (state, action) => {
      state.teamMembers = action.payload;
    },
    // Update message reaction in conversation
    updateMessageReaction: (state, action) => {
      const { messageId, emoji } = action.payload;
      if (state.currentConversation?.messages) {
        const messageIndex = state.currentConversation.messages.findIndex(
          m => m._id === messageId || m.wamid === messageId
        );
        if (messageIndex !== -1) {
          state.currentConversation.messages[messageIndex].reaction = { emoji };
        }
      }
    },
    // Update message reaction from socket (when someone reacts to a message)
    updateMessageReactionInConversation: (state, action) => {
      const { chatId, messageWaId, reaction, sentBy } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        const messageIndex = state.currentConversation.messages?.findIndex(
          m => m.wamid === messageWaId || m._id === messageWaId || m.server_id === messageWaId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          const msg = state.currentConversation.messages[messageIndex];

          // Always update the singular reaction field (web-app compatible)
          msg.reaction = reaction.emoji ? { emoji: reaction.emoji } : null;

          // Update reactions array
          if (!msg.reactions) {
            msg.reactions = [];
          }
          // Find existing reaction from this sender
          const existingIdx = msg.reactions.findIndex(
            r => (r.sentBy && r.sentBy === sentBy) || (r.from && r.from === sentBy)
          );
          if (!reaction.emoji || reaction.emoji === '') {
            // Unreact - remove existing
            if (existingIdx !== -1) {
              msg.reactions.splice(existingIdx, 1);
            }
          } else if (existingIdx !== -1) {
            // Replace existing reaction
            msg.reactions[existingIdx] = { emoji: reaction.emoji, sentBy };
          } else {
            // Add new reaction
            msg.reactions.push({ emoji: reaction.emoji, sentBy });
          }

          // Force new message reference so memo/FlatList detects the change
          state.currentConversation.messages[messageIndex] = { ...msg };

          // Trigger blast animation
          if (reaction.emoji) {
            state.pendingReactionBlast = reaction.emoji;
          }
        }
      }
    },
    // Clear pending reaction blast after animation plays
    clearReactionBlast: (state) => {
      state.pendingReactionBlast = null;
    },
    // Add optimistic message (immediately show message with pending status)
    addOptimisticMessage: (state, action) => {
      const { chatId, message } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        if (!state.currentConversation.messages) {
          state.currentConversation.messages = [];
        }
        // Add message with pending status
        state.currentConversation.messages.push({
          ...message,
          status: 'pending',
          isOptimistic: true,
        });
      }
      // Also update the chat list with the new message as lastMessage
      const chatIndex = state.chats.findIndex(c => c._id === chatId);
      if (chatIndex !== -1) {
        state.chats[chatIndex].lastMessage = {
          ...message,
          status: 'pending',
        };
        state.chats[chatIndex].lastMessageTime = message.timestamp || message.createdAt;
        // Move chat to top
        const [chat] = state.chats.splice(chatIndex, 1);
        state.chats.unshift(chat);
      }
    },
    // Update optimistic message with server response (match by tempId)
    updateOptimisticMessage: (state, action) => {
      const { chatId, tempId, serverMessage } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        const messageIndex = state.currentConversation.messages?.findIndex(
          m => m.tempId === tempId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          // Replace optimistic message with server message
          state.currentConversation.messages[messageIndex] = {
            ...serverMessage,
            isOptimistic: false,
          };
        }
      }
    },
    // Mark optimistic message as failed
    markOptimisticMessageFailed: (state, action) => {
      const { chatId, tempId, error } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        const messageIndex = state.currentConversation.messages?.findIndex(
          m => m.tempId === tempId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          state.currentConversation.messages[messageIndex] = {
            ...state.currentConversation.messages[messageIndex],
            status: 'failed',
            error,
          };
        }
      }
    },
    // Mark optimistic message as queued (offline — will send on reconnect)
    markOptimisticMessageQueued: (state, action) => {
      const { chatId, tempId } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        const messageIndex = state.currentConversation.messages?.findIndex(
          m => m.tempId === tempId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          state.currentConversation.messages[messageIndex] = {
            ...state.currentConversation.messages[messageIndex],
            status: 'queued',
          };
        }
      }
    },
    // Update queued message status (used by sync queue processor)
    updateQueuedMessageStatus: (state, action) => {
      const { chatId, tempId, status } = action.payload;
      if (state.currentConversation && state.currentConversation._id === chatId) {
        const messageIndex = state.currentConversation.messages?.findIndex(
          m => m.tempId === tempId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          state.currentConversation.messages[messageIndex].status = status;
        }
      }
    },
    // Reset message pagination when opening a new conversation
    resetMessagePagination: (state) => {
      state.messagesSkip = 0;
      state.hasMoreMessages = true;
      state.isLoadingMoreMessages = false;
      state.loadMoreMessagesError = null;
    },
    // Set flag to trigger chat list refresh
    setShouldRefreshChats: (state, action) => {
      state.shouldRefreshChats = action.payload;
    },
    // Clear current conversation (used when navigating between chats to prevent stale data)
    clearCurrentConversation: (state) => {
      state.currentConversation = null;
      state.conversationStatus = 'idle';
      state.conversationError = null;
      state.messagesSkip = 0;
      state.hasMoreMessages = true;
      state.isLoadingMoreMessages = false;
      state.loadMoreMessagesError = null;
      state.chatStatus = null;
      state.aiAssistantStatus = false;
    },
    // Silently MERGE fresh server data into existing chats (background refresh after cache load)
    // Uses merge strategy: server data updates existing chats, preserves chats not in server response
    silentUpdateChats: (state, action) => {
      const rawChats = action.payload || [];
      state.backgroundRefreshing = false;
      if (rawChats.length === 0) {
        return;
      }

      // Build a map from existing state chats (preserves chats beyond API pagination window)
      const mergedMap = new Map();
      state.chats.forEach(chat => {
        if (chat._id) {
          mergedMap.set(chat._id, chat);
        }
      });

      // Merge server chats: update existing, add new
      const normalizedChats = rawChats.map(normalizeChatForList);
      normalizedChats.forEach(chat => {
        if (chat._id) {
          mergedMap.set(chat._id, chat); // overwrites existing with fresh server data
        }
      });

      const finalChats = Array.from(mergedMap.values()).sort((a, b) => {
        const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      state.chats = finalChats;
    },
    // Set background refreshing flag
    setBackgroundRefreshing: (state, action) => {
      state.backgroundRefreshing = action.payload;
    },
    // Clear all inbox data (used when switching accounts/team members)
    clearInboxData: (state) => {
      state.chats = [];
      state.currentConversation = null;
      state.conversationCache = {};
      state.status = 'idle';
      state.conversationStatus = 'idle';
      state.messagesSkip = 0;
      state.hasMoreMessages = true;
      state.isLoadingMoreMessages = false;
      state.loadMoreMessagesError = null;
      state.hasMoreChats = false;
      state.selectedChatId = null;
      state.conversationId = null;
      state.aiAssistantStatus = false;
      state.selectedAssistantId = null;
      state.chatStatus = null;
      state.templates = [];
      state.templatesStatus = 'idle';
      state.quickReplies = [];
      state.quickRepliesStatus = 'idle';
      state.activeFilter = 'all';
      state.paginationCursor = null;
      state.isLoadingMore = false;
      state.notes = [];
      state.notesStatus = 'idle';
      state.teamMembers = [];
      state.teamMembersStatus = 'idle';
      state.error = null;
      state.conversationError = null;
      // Clear search state
      state.searchQuery = '';
      state.searchResults = [];
      state.searchStatus = 'idle';
      state.searchError = null;
      state.isSearchActive = false;
      state.searchHasMore = false;
      state.searchLastChatDate = null;
    },
    // Set search query (for controlled input)
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    // Clear search and return to normal chat list
    clearSearch: (state) => {
      state.searchQuery = '';
      state.searchResults = [];
      state.searchStatus = 'idle';
      state.searchError = null;
      state.isSearchActive = false;
      state.searchHasMore = false;
      state.searchLastChatDate = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Chats
    builder
      .addCase(fetchChats.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const payload = action.payload || {};
        // API can return chats in different locations:
        // 1. payload.data.chats (nested in data object)
        // 2. payload.chats (top-level from callApi)
        // 3. payload._raw.chats (raw response fallback)
        const rawChats = payload.data?.chats || payload.chats || payload._raw?.chats || [];

        // Deduplicate chats by _id to prevent duplicate key errors in FlatList
        const normalizedChats = rawChats.map(normalizeChatForList);
        const uniqueChatsMap = new Map();
        normalizedChats.forEach(chat => {
          if (chat._id && !uniqueChatsMap.has(chat._id)) {
            uniqueChatsMap.set(chat._id, chat);
          }
        });
        const chats = Array.from(uniqueChatsMap.values());

        // Sort chats by latest activity (lastMessage timestamp or updatedAt)
        state.chats = chats.sort((a, b) => {
          const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime; // Descending order (newest first)
        });
        state.hasMoreChats = payload.data?.hasMoreChats || payload.hasMoreChats || payload._raw?.hasMoreChats || false;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });

    // Fetch Chats with Cache (device-primary strategy)
    builder
      .addCase(fetchChatsWithCache.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchChatsWithCache.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const payload = action.payload || {};
        const rawChats = payload.data?.chats || payload.chats || [];
        // If data came from cache, background refresh is in progress
        if (payload.fromCache) {
          state.backgroundRefreshing = true;
        } else {
          state.backgroundRefreshing = false;
        }
        // Deduplicate and normalize chats
        const normalizedChats = rawChats.map(normalizeChatForList);

        if (payload.isPartialFetch && state.chats.length > 0) {
          // MERGE mode: update existing chats + add new ones, keep rest from cache
          const existingMap = new Map(state.chats.map(c => [c._id, c]));
          normalizedChats.forEach(chat => {
            if (chat._id) {
              existingMap.set(chat._id, chat);
            }
          });
          state.chats = Array.from(existingMap.values()).sort((a, b) => {
            const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          });
        } else {
          // REPLACE mode: full fetch — deduplicate and replace entire list
          const uniqueChatsMap = new Map();
          normalizedChats.forEach(chat => {
            if (chat._id && !uniqueChatsMap.has(chat._id)) {
              uniqueChatsMap.set(chat._id, chat);
            }
          });
          state.chats = Array.from(uniqueChatsMap.values()).sort((a, b) => {
            const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          });
        }
        state.hasMoreChats = payload.hasMoreChats || false;
      })
      .addCase(fetchChatsWithCache.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });

    // Fetch Conversation
    builder
      .addCase(fetchConversation.pending, (state) => {
        state.conversationStatus = 'loading';
        state.conversationError = null;
        // Keep pagination if we already have cached messages; otherwise reset
        // (component will prefer cache and avoid calling fetch if present)
        state.isLoadingMoreMessages = false;
        state.isLoadingMoreMessages = false;
        state.loadMoreMessagesError = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.conversationStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        const arg = action.meta?.arg;
        const chatId = typeof arg === 'object' ? (arg.chatId || arg._id || arg.id) : arg;
        const fetchAll = typeof arg === 'object' && arg.all === true;

        const newMsgs = data.messages || [];

        // Sort messages by timestamp
        const sortedMsgs = [...newMsgs].sort((a, b) => {
          const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
          const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
          return aT - bT;
        });

        const conversation = {
          ...data,
          _id: data._id || chatId,
          messages: sortedMsgs,
        };

        state.currentConversation = conversation;

        // Sync chat status and AI assistant status from loaded conversation data
        // (matching web app's useEffect that dispatches setAiAssitantStatus on chat change)
        if (data.status) {
          state.chatStatus = data.status;
          state.aiAssistantStatus = data.status === 'aiAssistant' || data.aiAssistant?.isActive || false;
        }

        // When fetching all, no more messages to load
        if (fetchAll) {
          state.hasMoreMessages = false;
          state.messagesSkip = sortedMsgs.length;
        } else {
          const limit = typeof arg === 'object' && arg.limit ? arg.limit : 50;
          state.messagesSkip = sortedMsgs.length;
          state.hasMoreMessages = newMsgs.length >= limit;
        }

        // Update cache
        if (chatId) {
          state.conversationCache[chatId] = {
            conversation,
            messagesSkip: state.messagesSkip,
            hasMoreMessages: state.hasMoreMessages,
            cachedAt: Date.now(),
          };
        }
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.conversationStatus = 'failed';
        state.conversationError = action.payload;
      });

    // Fetch Conversation with Cache (device-primary strategy)
    builder
      .addCase(fetchConversationWithCache.pending, (state) => {
        state.conversationStatus = 'loading';
        state.conversationError = null;
        state.isLoadingMoreMessages = false;
        state.loadMoreMessagesError = null;
      })
      .addCase(fetchConversationWithCache.fulfilled, (state, action) => {
        state.conversationStatus = 'succeeded';
        const payload = action.payload || {};
        const data = payload.data || payload;
        const chatId = data._id;
        const newMsgs = data.messages || [];

        // Filter out orphaned optimistic messages from cache results.
        // When cache has both a temp_ optimistic message AND the real server message
        // for the same sent text, remove the optimistic to prevent duplicates.
        const realMsgs = newMsgs.filter(m => !String(m._id || '').startsWith('temp_'));
        const tempMsgs = newMsgs.filter(m => String(m._id || '').startsWith('temp_'));
        // Only keep temp messages that don't have a matching real message (by content+type+time)
        const keptTempMsgs = tempMsgs.filter(tm => {
          const tBody = typeof tm.message?.body === 'string' ? tm.message.body : tm.message?.body?.text || '';
          const tType = tm.type || 'text';
          const tTime = new Date(tm.timestamp || tm.createdAt || 0).getTime();
          return !realMsgs.some(rm => {
            const rBody = typeof rm.message?.body === 'string' ? rm.message.body : rm.message?.body?.text || '';
            const rType = rm.type || 'text';
            const rTime = new Date(rm.timestamp || rm.createdAt || 0).getTime();
            return rType === tType && rBody === tBody && Math.abs(rTime - tTime) < 60000;
          });
        });
        const filteredMsgs = [...realMsgs, ...keptTempMsgs];

        // Sort messages by timestamp
        const sortedMsgs = [...filteredMsgs].sort((a, b) => {
          const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
          const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
          return aT - bT;
        });

        const conversation = {
          ...data,
          _id: chatId,
          messages: sortedMsgs,
        };

        state.currentConversation = conversation;
        state.hasMoreMessages = payload.hasMore || false;
        state.messagesSkip = sortedMsgs.length;

        // Sync chat status and AI assistant status from loaded conversation data
        // (matching web app's useEffect that dispatches setAiAssitantStatus on chat change)
        if (data.status) {
          state.chatStatus = data.status;
          state.aiAssistantStatus = data.status === 'aiAssistant' || data.aiAssistant?.isActive || false;
        }

        // Update cache
        if (chatId) {
          state.conversationCache[chatId] = {
            conversation,
            messagesSkip: state.messagesSkip,
            hasMoreMessages: state.hasMoreMessages,
            cachedAt: Date.now(),
          };
        }
      })
      .addCase(fetchConversationWithCache.rejected, (state, action) => {
        state.conversationStatus = 'failed';
        state.conversationError = action.payload;
      });

    // Fetch More Messages (pagination)
    builder
      .addCase(fetchMoreMessages.pending, (state) => {
        state.isLoadingMoreMessages = true;
        state.loadMoreMessagesError = null;
      })
      .addCase(fetchMoreMessages.fulfilled, (state, action) => {
        state.isLoadingMoreMessages = false;
        const { response, skip } = action.payload;
        const data = response.data || response;
        const olderMessages = data.messages || [];
        const limit = action.meta?.arg?.limit || 50;

        if (state.currentConversation) {
          // Prepend older messages to the beginning (they are older)
          const existingIds = new Set(
            (state.currentConversation.messages || []).map(m => m._id || m.wamid)
          );
          const uniqueOlderMessages = olderMessages.filter(
            m => !existingIds.has(m._id) && !existingIds.has(m.wamid)
          );
          state.currentConversation.messages = [
            ...uniqueOlderMessages,
            ...(state.currentConversation.messages || []),
          ];
        }

        // Update pagination state
        state.messagesSkip = skip + olderMessages.length;
        state.hasMoreMessages = olderMessages.length >= limit;

        // Update cache
        const chatId = state.currentConversation?._id;
        if (chatId) {
          state.conversationCache[chatId] = {
            conversation: state.currentConversation,
            messagesSkip: state.messagesSkip,
            hasMoreMessages: state.hasMoreMessages,
            cachedAt: Date.now(),
          };
        }
      })
      .addCase(fetchMoreMessages.rejected, (state, action) => {
        state.isLoadingMoreMessages = false;
        state.loadMoreMessagesError = action.payload;
      });

    // Update Chat
    builder
      .addCase(updateChat.pending, (state) => {
        state.updateChatStatus = 'loading';
        state.updateChatError = null;
      })
      .addCase(updateChat.fulfilled, (state, action) => {
        state.updateChatStatus = 'succeeded';
        const { id, response } = action.payload;
        const data = response?.data || response;
        const chatIndex = state.chats.findIndex(chat => chat._id === id);
        if (chatIndex !== -1) {
          state.chats[chatIndex] = { ...state.chats[chatIndex], ...data };
        }
      })
      .addCase(updateChat.rejected, (state, action) => {
        state.updateChatStatus = 'failed';
        state.updateChatError = action.payload;
      });

    // Delete Chat
    builder
      .addCase(deleteChat.pending, (state) => {
        state.deleteChatStatus = 'loading';
        state.deleteChatError = null;
      })
      .addCase(deleteChat.fulfilled, (state, action) => {
        state.deleteChatStatus = 'succeeded';
        state.chats = state.chats.filter(chat => chat._id !== action.payload.id);
      })
      .addCase(deleteChat.rejected, (state, action) => {
        state.deleteChatStatus = 'failed';
        state.deleteChatError = action.payload;
      });

    // Send Message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.sendMessageStatus = 'loading';
        state.sendMessageError = null;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.sendMessageStatus = 'succeeded';
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sendMessageStatus = 'failed';
        state.sendMessageError = action.payload;
      });

    // Reply Message
    builder
      .addCase(replyMessage.pending, (state) => {
        state.replyMessageStatus = 'loading';
        state.replyMessageError = null;
      })
      .addCase(replyMessage.fulfilled, (state) => {
        state.replyMessageStatus = 'succeeded';
      })
      .addCase(replyMessage.rejected, (state, action) => {
        state.replyMessageStatus = 'failed';
        state.replyMessageError = action.payload;
      });

    // Update Contact Chat (for intervene/status changes)
    builder
      .addCase(updateContactChat.pending, (state) => {
        state.updateContactChatStatus = 'loading';
        state.updateContactChatError = null;
      })
      .addCase(updateContactChat.fulfilled, (state, action) => {
        state.updateContactChatStatus = 'succeeded';
        const { id, status } = action.payload;
        // Determine AI assistant status based on chat status
        const isAiAssistantActive = status === 'aiAssistant';
        // Update chat status in state
        state.chatStatus = status;
        // Update AI assistant status in state
        state.aiAssistantStatus = isAiAssistantActive;
        // Update in chats list
        const chatIndex = state.chats.findIndex(chat => chat._id === id);
        if (chatIndex !== -1) {
          state.chats[chatIndex] = {
            ...state.chats[chatIndex],
            status,
            aiAssistant: {
              ...state.chats[chatIndex].aiAssistant,
              isActive: isAiAssistantActive,
            },
          };
          // Move chat to top of list after status update
          const [updatedChat] = state.chats.splice(chatIndex, 1);
          state.chats.unshift(updatedChat);
        }
        // Update current conversation
        if (state.currentConversation && state.currentConversation._id === id) {
          state.currentConversation.status = status;
          state.currentConversation.aiAssistant = {
            ...state.currentConversation.aiAssistant,
            isActive: isAiAssistantActive,
          };
        }
      })
      .addCase(updateContactChat.rejected, (state, action) => {
        state.updateContactChatStatus = 'failed';
        state.updateContactChatError = action.payload;
      });

    // Toggle AI Assistant
    builder
      .addCase(toggleAiAssistant.pending, (state) => {
        state.toggleAiAssistantStatus = 'loading';
        state.toggleAiAssistantError = null;
      })
      .addCase(toggleAiAssistant.fulfilled, (state, action) => {
        state.toggleAiAssistantStatus = 'succeeded';
        const { chatId, assistantId, isActive } = action.payload;
        state.aiAssistantStatus = isActive;
        state.selectedAssistantId = isActive ? assistantId : null;
        // Update chat status based on AI assistant toggle
        if (isActive) {
          state.chatStatus = 'aiAssistant';
        }
        // Update AI assistant in current conversation
        if (state.currentConversation && state.currentConversation._id === chatId) {
          state.currentConversation.aiAssistant = {
            ...state.currentConversation.aiAssistant,
            isActive,
            assistantId: isActive ? assistantId : null,
          };
          if (isActive) {
            state.currentConversation.status = 'aiAssistant';
          }
        }
        // Update in chats list
        const chatIndex = state.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          state.chats[chatIndex] = {
            ...state.chats[chatIndex],
            status: isActive ? 'aiAssistant' : state.chats[chatIndex].status,
            aiAssistant: {
              ...state.chats[chatIndex].aiAssistant,
              isActive,
              assistantId: isActive ? assistantId : null,
            },
          };
          // Move chat to top of list
          const [updatedChat] = state.chats.splice(chatIndex, 1);
          state.chats.unshift(updatedChat);
        }
      })
      .addCase(toggleAiAssistant.rejected, (state, action) => {
        state.toggleAiAssistantStatus = 'failed';
        state.toggleAiAssistantError = action.payload;
      });

    // Fetch AI Assistants
    builder
      .addCase(fetchAiAssistants.pending, (state) => {
        state.aiAssistantsStatus = 'loading';
        state.aiAssistantsError = null;
      })
      .addCase(fetchAiAssistants.fulfilled, (state, action) => {
        state.aiAssistantsStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        // Filter to only active assistants
        const assistants = data.assistants || data || [];
        state.aiAssistants = Array.isArray(assistants)
          ? assistants.filter(a => a.status === 'active')
          : [];
      })
      .addCase(fetchAiAssistants.rejected, (state, action) => {
        state.aiAssistantsStatus = 'failed';
        state.aiAssistantsError = action.payload;
      });

    // Fetch Templates
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.templatesStatus = 'loading';
        state.templatesError = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.templatesStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.templates = data.templates || data || [];
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.templatesStatus = 'failed';
        state.templatesError = action.payload;
      });

    // Fetch Quick Replies
    builder
      .addCase(fetchQuickReplies.pending, (state) => {
        state.quickRepliesStatus = 'loading';
        state.quickRepliesError = null;
      })
      .addCase(fetchQuickReplies.fulfilled, (state, action) => {
        state.quickRepliesStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.quickReplies = data.quickReplies || data || [];
      })
      .addCase(fetchQuickReplies.rejected, (state, action) => {
        state.quickRepliesStatus = 'failed';
        state.quickRepliesError = action.payload;
      });

    // Fetch Quick Replies (Cache-First)
    builder
      .addCase(fetchQuickRepliesWithCache.fulfilled, (state, action) => {
        state.quickRepliesStatus = 'succeeded';
        state.quickReplies = action.payload.quickReplies || [];
      })
      .addCase(fetchQuickRepliesWithCache.rejected, (state, action) => {
        // Only mark failed if no cached data available
        if (state.quickReplies.length === 0) {
          state.quickRepliesStatus = 'failed';
        }
        state.quickRepliesError = action.payload;
      });

    // Fetch More Chats (Pagination)
    builder
      .addCase(fetchMoreChats.pending, (state) => {
        state.isLoadingMore = true;
        state.loadMoreError = null;
      })
      .addCase(fetchMoreChats.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        const payload = action.payload || {};
        // API can return chats in different locations (same as fetchChats)
        const rawChats = payload.data?.chats || payload.chats || payload._raw?.chats || [];
        const newChats = rawChats.map(normalizeChatForList);
        // Append new chats, avoiding duplicates
        const existingIds = new Set(state.chats.map(c => c._id));
        const uniqueNewChats = newChats.filter(c => !existingIds.has(c._id));
        state.chats = [...state.chats, ...uniqueNewChats];
        state.hasMoreChats = payload.data?.hasMoreChats || payload.hasMoreChats || payload._raw?.hasMoreChats || false;
        state.paginationCursor = payload.data?.cursor || payload.cursor || payload._raw?.cursor || null;
      })
      .addCase(fetchMoreChats.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.loadMoreError = action.payload;
      });

    // Fetch Chat Notes
    builder
      .addCase(fetchChatNotes.pending, (state) => {
        state.notesStatus = 'loading';
        state.notesError = null;
      })
      .addCase(fetchChatNotes.fulfilled, (state, action) => {
        state.notesStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.notes = data.notes || data || [];
      })
      .addCase(fetchChatNotes.rejected, (state, action) => {
        state.notesStatus = 'failed';
        state.notesError = action.payload;
      });

    // Add Chat Note
    builder
      .addCase(addChatNote.pending, (state) => {
        state.addNoteStatus = 'loading';
      })
      .addCase(addChatNote.fulfilled, (state, action) => {
        state.addNoteStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        if (data.note) {
          state.notes.unshift(data.note);
        }
      })
      .addCase(addChatNote.rejected, (state, action) => {
        state.addNoteStatus = 'failed';
        state.notesError = action.payload;
      });

    // Delete Chat Note
    builder
      .addCase(deleteChatNote.pending, (state) => {
        state.deleteNoteStatus = 'loading';
      })
      .addCase(deleteChatNote.fulfilled, (state, action) => {
        state.deleteNoteStatus = 'succeeded';
        const { noteId } = action.payload;
        state.notes = state.notes.filter(note => note._id !== noteId);
      })
      .addCase(deleteChatNote.rejected, (state, action) => {
        state.deleteNoteStatus = 'failed';
        state.notesError = action.payload;
      });

    // Send Message Reaction
    builder
      .addCase(sendMessageReaction.pending, (state) => {
        state.reactionStatus = 'loading';
        state.reactionError = null;
      })
      .addCase(sendMessageReaction.fulfilled, (state, action) => {
        state.reactionStatus = 'succeeded';
        const { chatId, messageId, emoji } = action.payload;
        // Update reaction in current conversation
        if (state.currentConversation && state.currentConversation._id === chatId) {
          const messageIndex = state.currentConversation.messages?.findIndex(
            m => m._id === messageId || m.wamid === messageId
          );
          if (messageIndex !== -1 && messageIndex !== undefined) {
            const msg = state.currentConversation.messages[messageIndex];
            // Update singular reaction field (for compatibility)
            msg.reaction = { emoji };
            // Also update reactions array for immediate UI rendering
            if (!msg.reactions) {
              msg.reactions = [];
            }
            // Find existing reaction from 'me' (local user)
            const existingIdx = msg.reactions.findIndex(r => r.sentBy === 'me');
            if (emoji === '') {
              // Unreact
              if (existingIdx !== -1) {
                msg.reactions.splice(existingIdx, 1);
              }
            } else if (existingIdx !== -1) {
              msg.reactions[existingIdx] = { emoji, sentBy: 'me' };
            } else {
              msg.reactions.push({ emoji, sentBy: 'me' });
            }
          }
        }
      })
      .addCase(sendMessageReaction.rejected, (state, action) => {
        state.reactionStatus = 'failed';
        state.reactionError = action.payload;
      });

    // Fetch Team Members
    builder
      .addCase(fetchTeamMembers.pending, (state) => {
        state.teamMembersStatus = 'loading';
      })
      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.teamMembersStatus = 'succeeded';
        const data = action.payload.data || action.payload;
        state.teamMembers = data.teamMembers || data || [];
      })
      .addCase(fetchTeamMembers.rejected, (state, action) => {
        state.teamMembersStatus = 'failed';
      });

    // Assign Chat to Member
    builder
      .addCase(assignChatToMember.fulfilled, (state, action) => {
        const { chatId, memberId } = action.payload;
        const chatIndex = state.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          state.chats[chatIndex].assignedToMember = memberId;
        }
        if (state.currentConversation && state.currentConversation._id === chatId) {
          state.currentConversation.assignedToMember = memberId;
        }
      });

    // Toggle Chat Notifications
    builder
      .addCase(toggleChatNotifications.fulfilled, (state, action) => {
        const { chatId, hideNotification } = action.payload;
        const chatIndex = state.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          state.chats[chatIndex].hideNotification = hideNotification;
        }
        if (state.currentConversation && state.currentConversation._id === chatId) {
          state.currentConversation.hideNotification = hideNotification;
        }
      });

    // Search Chats
    builder
      .addCase(searchChats.pending, (state) => {
        state.searchStatus = 'loading';
        state.searchError = null;
        state.isSearchActive = true;
      })
      .addCase(searchChats.fulfilled, (state, action) => {
        state.searchStatus = 'succeeded';
        const { chats, hasMoreChats, search } = action.payload;
        // Normalize chats for consistent display
        state.searchResults = (chats || []).map(normalizeChatForList);
        state.searchHasMore = hasMoreChats;
        state.searchQuery = search || '';
        // Store last chat date for pagination
        if (chats && chats.length > 0) {
          const lastChat = chats[chats.length - 1];
          state.searchLastChatDate = lastChat.updatedAt || lastChat.createdAt || null;
        }
      })
      .addCase(searchChats.rejected, (state, action) => {
        state.searchStatus = 'failed';
        state.searchError = action.payload;
        state.searchResults = [];
      });

    // Search Chats (Local Cache)
    builder
      .addCase(searchChatsWithCache.fulfilled, (state, action) => {
        const { chats, search } = action.payload;
        state.searchResults = (chats || []).map(normalizeChatForList);
        state.searchStatus = 'succeeded';
        state.searchQuery = search || '';
        state.isSearchActive = true;
      })

    // Sync missed messages — replace conversation with authoritative API data
    builder
      .addCase(syncMissedMessages.fulfilled, (state, action) => {
        const { chatId, messages, fullReplace } = action.payload;
        if (!messages || messages.length === 0) return;
        if (!state.currentConversation || state.currentConversation._id !== chatId) return;

        if (fullReplace) {
          // Full replace with sorted API data.
          const existingMsgs = state.currentConversation.messages || [];

          // Preserve in-flight optimistic messages not yet confirmed by server
          const optimisticMsgs = existingMsgs.filter(m => m.isOptimistic);

          // Build map of local media download metadata from existing messages.
          const downloadMetaMap = new Map();
          existingMsgs.forEach(m => {
            if (m._localMediaPath) {
              const id = m._id || m.wamid;
              if (id) {
                downloadMetaMap.set(id, {
                  _localMediaPath: m._localMediaPath,
                  _localThumbnailPath: m._localThumbnailPath,
                  _mediaDownloadStatus: m._mediaDownloadStatus,
                });
              }
            }
          });

          const sorted = [...messages].sort((a, b) => {
            const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
            const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
            return aT - bT;
          });

          // Merge back local download metadata into server messages
          if (downloadMetaMap.size > 0) {
            for (let i = 0; i < sorted.length; i++) {
              const meta = downloadMetaMap.get(sorted[i]._id) || downloadMetaMap.get(sorted[i].wamid);
              if (meta) {
                sorted[i] = { ...sorted[i], ...meta };
              }
            }
          }

          if (optimisticMsgs.length > 0) {
            // Build set of server message IDs for dedup
            const serverIds = new Set();
            sorted.forEach(m => {
              if (m._id) serverIds.add(m._id);
              if (m.wamid) serverIds.add(m.wamid);
            });
            // Keep optimistic messages that haven't been replaced by server messages
            const keptOptimistic = optimisticMsgs.filter(m =>
              !serverIds.has(m.tempId) && !serverIds.has(m._id) && !serverIds.has(m.wamid)
            );
            state.currentConversation.messages = [...sorted, ...keptOptimistic];
          } else {
            state.currentConversation.messages = sorted;
          }
          return;
        }

        // Fallback: merge-only mode (if fullReplace is not set)
        const existingIds = new Set();
        state.currentConversation.messages.forEach(m => {
          if (m._id) existingIds.add(m._id);
          if (m.wamid) existingIds.add(m.wamid);
        });

        const trulyNew = messages.filter(m =>
          !(m._id && existingIds.has(m._id)) &&
          !(m.wamid && existingIds.has(m.wamid))
        );

        if (trulyNew.length > 0) {
          state.currentConversation.messages.push(...trulyNew);
          state.currentConversation.messages.sort((a, b) => {
            const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
            const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
            return aT - bT;
          });
        }
      });
  },
});

export const {
  setChats,
  setSelectedChatId,
  appendChat,
  updateChatInList,
  removeChatFromList,
  resetUnreadCount,
  setConversationId,
  setSendMessageError,
  setContactCreateError,
  setSocketStatus,
  addMessageToCurrentConversation,
  updateMessageInCurrentConversation,
  updateMessageMediaMeta,
  clearInboxError,
  setAiAssistantStatus,
  setSelectedAssistantId,
  setChatStatus,
  setTemplates,
  setQuickReplies,
  // New exports
  setActiveFilter,
  setPaginationCursor,
  resetPagination,
  resetMessagePagination,
  setNotes,
  addNoteToList,
  removeNoteFromList,
  setTeamMembers,
  updateMessageReaction,
  clearReactionBlast,
  setCurrentConversationFromCache,
  // Reaction and optimistic message exports
  updateMessageReactionInConversation,
  addOptimisticMessage,
  updateOptimisticMessage,
  markOptimisticMessageFailed,
  markOptimisticMessageQueued,
  updateQueuedMessageStatus,
  // Clear current conversation (for navigation)
  clearCurrentConversation,
  // Clear inbox data (for account switching)
  clearInboxData,
  // Trigger chat refresh
  setShouldRefreshChats,
  // Search actions
  setSearchQuery,
  clearSearch,
} = inboxSlice.actions;

export default inboxSlice.reducer;
