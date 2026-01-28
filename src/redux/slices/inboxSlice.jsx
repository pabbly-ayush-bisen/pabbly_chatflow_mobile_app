import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { callApi, endpoints, httpMethods } from '../../utils/axios';

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
      const response = await callApi(endpoints.inbox.getChats, httpMethods.GET, params);
      if (response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to fetch chats');
      }
      return response;
    } catch (error) {
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
export const toggleAiAssistant = createAsyncThunk(
  'inbox/toggleAiAssistant',
  async ({ chatId, assistantId, isActive }, { rejectWithValue }) => {
    try {
      const url = `${endpoints.inbox.toggleAiAssistant || '/chat/ai-assistant'}`;
      const response = await callApi(url, httpMethods.POST, {
        chatId,
        assistantId,
        isActive,
      });
      if (response.status !== 'success' && response.status === 'error') {
        return rejectWithValue(response.message || 'Failed to toggle AI Assistant');
      }
      return { chatId, isActive, response };
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
  // Team Members for assignment
  teamMembers: [],
  teamMembersStatus: 'idle',
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
      const index = state.chats.findIndex(chat => chat._id === incoming?._id);
      if (index !== -1) {
        // Update existing chat
        state.chats[index] = { ...state.chats[index], ...incoming };
        // Move to top if not a system message update
        if (incoming.lastMessage?.type !== 'system') {
          const [chat] = state.chats.splice(index, 1);
          state.chats.unshift(chat);
        }
      } else {
        // New chat, add to top
        state.chats.unshift(incoming);
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
        if (message.sentBy === 'user') {
          const messageText = message.message?.body || message.message?.body?.text || '';
          const messageType = message.type || 'text';
          const messageTime = new Date(message.timestamp || message.createdAt).getTime();

          const optimisticIndex = state.currentConversation.messages.findIndex(m => {
            if (!m.isOptimistic) return false;

            const optText = m.message?.body || m.message?.body?.text || '';
            const optType = m.type || 'text';
            const optTime = new Date(m.timestamp || m.createdAt).getTime();

            // Match if same type, similar content, and within 30 seconds
            const timeDiff = Math.abs(messageTime - optTime);
            const textMatch = messageType === 'text' ? messageText === optText : true; // For media, don't check text
            const typeMatch = messageType === optType;

            return typeMatch && textMatch && timeDiff < 30000;
          });

          if (optimisticIndex !== -1) {
            // Replace optimistic message with real message from server
            console.log('[inboxSlice] Replacing optimistic message with real message');
            state.currentConversation.messages[optimisticIndex] = {
              ...message,
              isOptimistic: false,
            };
            return;
          }
        }

        // Check if message already exists (by wamid or _id)
        const messageExists = state.currentConversation.messages.some(
          m => (message.wamid && m.wamid === message.wamid) ||
               (message._id && !m.isOptimistic && m._id === message._id)
        );
        if (!messageExists) {
          // Add new message to the end of the array
          state.currentConversation.messages.push(message);
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
          m => m.wamid === messageWaId || m._id === messageWaId
        );
        if (messageIndex !== -1 && messageIndex !== undefined) {
          // Initialize reactions array if not present
          if (!state.currentConversation.messages[messageIndex].reactions) {
            state.currentConversation.messages[messageIndex].reactions = [];
          }
          // Check if this user already reacted
          const existingReactionIndex = state.currentConversation.messages[messageIndex].reactions.findIndex(
            r => r.sentBy === sentBy || r.from === sentBy
          );
          if (reaction.emoji === '') {
            // Remove reaction if emoji is empty (unreact)
            if (existingReactionIndex !== -1) {
              state.currentConversation.messages[messageIndex].reactions.splice(existingReactionIndex, 1);
            }
          } else if (existingReactionIndex !== -1) {
            // Update existing reaction
            state.currentConversation.messages[messageIndex].reactions[existingReactionIndex] = {
              ...reaction,
              sentBy,
            };
          } else {
            // Add new reaction
            state.currentConversation.messages[messageIndex].reactions.push({
              ...reaction,
              sentBy,
            });
          }
        }
      }
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
    // Reset message pagination when opening a new conversation
    resetMessagePagination: (state) => {
      state.messagesSkip = 0;
      state.hasMoreMessages = true;
      state.isLoadingMoreMessages = false;
      state.loadMoreMessagesError = null;
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
        const data = action.payload.data || action.payload;
        // Sort chats by latest activity (lastMessage timestamp or updatedAt)
        const chats = (data.chats || []).map(normalizeChatForList);
        state.chats = chats.sort((a, b) => {
          const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime; // Descending order (newest first)
        });
        state.hasMoreChats = data.hasMoreChats || false;
      })
      .addCase(fetchChats.rejected, (state, action) => {
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
        // Update chat status in state
        state.chatStatus = status;
        // Update in chats list
        const chatIndex = state.chats.findIndex(chat => chat._id === id);
        if (chatIndex !== -1) {
          state.chats[chatIndex] = { ...state.chats[chatIndex], status };
        }
        // Update current conversation
        if (state.currentConversation && state.currentConversation._id === id) {
          state.currentConversation.status = status;
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
        const { chatId, isActive } = action.payload;
        state.aiAssistantStatus = isActive;
        // Update AI assistant in current conversation
        if (state.currentConversation && state.currentConversation._id === chatId) {
          state.currentConversation.aiAssistant = {
            ...state.currentConversation.aiAssistant,
            isActive,
          };
        }
        // Update in chats list
        const chatIndex = state.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          state.chats[chatIndex] = {
            ...state.chats[chatIndex],
            aiAssistant: {
              ...state.chats[chatIndex].aiAssistant,
              isActive,
            },
          };
        }
      })
      .addCase(toggleAiAssistant.rejected, (state, action) => {
        state.toggleAiAssistantStatus = 'failed';
        state.toggleAiAssistantError = action.payload;
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

    // Fetch More Chats (Pagination)
    builder
      .addCase(fetchMoreChats.pending, (state) => {
        state.isLoadingMore = true;
        state.loadMoreError = null;
      })
      .addCase(fetchMoreChats.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        const data = action.payload.data || action.payload;
        const newChats = (data.chats || []).map(normalizeChatForList);
        // Append new chats, avoiding duplicates
        const existingIds = new Set(state.chats.map(c => c._id));
        const uniqueNewChats = newChats.filter(c => !existingIds.has(c._id));
        state.chats = [...state.chats, ...uniqueNewChats];
        state.hasMoreChats = data.hasMoreChats || false;
        state.paginationCursor = data.cursor || null;
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
            state.currentConversation.messages[messageIndex].reaction = { emoji };
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
  setCurrentConversationFromCache,
  // Reaction and optimistic message exports
  updateMessageReactionInConversation,
  addOptimisticMessage,
  updateOptimisticMessage,
  markOptimisticMessageFailed,
} = inboxSlice.actions;

export default inboxSlice.reducer;
