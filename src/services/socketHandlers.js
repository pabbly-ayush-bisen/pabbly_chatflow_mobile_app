import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setChats,
  appendChat,
  updateChatInList,
  resetUnreadCount,
  setConversationId,
  setSendMessageError,
  setContactCreateError,
  addMessageToCurrentConversation,
  updateMessageInCurrentConversation,
  updateMessageReactionInConversation,
  fetchChatsByContacts,
} from '../redux/slices/inboxSlice';
import { logout } from '../redux/slices/userSlice';
import { setUpdatedTemplate } from '../redux/slices/templateSlice';
import { handleNewMessageCache, updateMessageStatusInCache, resetUnreadCountInCache } from '../redux/cacheThunks';
import { cacheManager } from '../database/CacheManager';

/**
 * Handle new message from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} newChat - New chat data with messages
 */
export const handleNewMessage = async (dispatch, newChat) => {
  try {
    // Try both possible keys for settingId (for backwards compatibility)
    let settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');
    if (!settingId) {
      settingId = await AsyncStorage.getItem('settingId');
    }

    // Only process messages for current setting
    if (newChat.settingId !== settingId) {
      return;
    }

    // Extract ALL messages from the chat (matching web app's bulkInsertChats pattern)
    // Previously only the last message was extracted, causing earlier messages to be lost
    // when the server sends multiple messages in one event (e.g., incoming + flow response)
    const allMessages = newChat.messages && newChat.messages.length > 0
      ? newChat.messages
      : [];

    if (allMessages.length === 0) {
      // No messages — just update chat list metadata
      const chatForList = {
        ...newChat,
        messages: undefined,
        lastMessageTime: newChat?.updatedAt || newChat?.createdAt,
        unreadCount: newChat.unreadCount || 0,
      };
      dispatch(updateChatInList(chatForList));
      try { await cacheManager.updateChat(chatForList); } catch (e) {}
      return;
    }

    // Use the LAST message for chat list preview (correct — shows most recent)
    const lastMessage = allMessages[allMessages.length - 1];

    // Handle reaction messages - try direct update via reducer (safety net)
    // Do NOT return early — continue processing all non-reaction messages below
    // so that the target message with reaction already applied by the backend gets merged
    if (lastMessage?.type === 'reaction') {
      const emoji = lastMessage?.reaction?.emoji || lastMessage?.message?.emoji
        || lastMessage?.message?.reaction?.emoji || '';
      const reactedToMessageId = lastMessage?.reaction?.message_id
        || lastMessage?.message?.message_id
        || lastMessage?.reaction?.messageId
        || lastMessage?.message?.reaction?.message_id
        || lastMessage?.context?.id || '';

      if (reactedToMessageId) {
        dispatch(updateMessageReactionInConversation({
          chatId: newChat._id,
          messageWaId: reactedToMessageId,
          reaction: { emoji },
          sentBy: lastMessage?.sentBy || lastMessage?.from,
        }));
      }

      // Don't return — fall through to process all non-reaction messages below
      // The backend may include the target message with reaction already applied
      // and the dedup merge in addMessageToCurrentConversation will pick it up
    }

    // Create chat object for list (still uses last message for preview — correct behavior)
    // For reaction events, lastMessage is the reaction itself — use a non-reaction message if available
    const previewMessage = lastMessage?.type === 'reaction'
      ? allMessages.filter(m => m.type !== 'reaction').pop() || lastMessage
      : lastMessage;
    const chatForList = {
      ...newChat,
      messages: undefined,
      lastMessage: previewMessage,
      lastMessageTime: previewMessage?.timestamp || previewMessage?.createdAt || newChat?.updatedAt || newChat?.createdAt,
      unreadCount: newChat.unreadCount || (previewMessage?.sentBy !== 'user' ? 1 : 0),
    };

    // Update chat list - move to top if not system message
    dispatch(updateChatInList(chatForList));

    // Add EACH message to current conversation (not just the last one)
    // The dedup check in addMessageToCurrentConversation (by wamid/_id) prevents duplicates
    // The sort-after-push ensures correct chronological ordering
    for (const msg of allMessages) {
      if (msg && msg.type !== 'reaction') {
        dispatch(addMessageToCurrentConversation({
          chatId: newChat._id,
          message: msg,
        }));
      }
    }

    // Cache EACH message to SQLite (matches web app's bulkInsertChats pattern)
    // Previously only the last message was cached, so other messages were lost from SQLite
    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      if (msg && msg.type !== 'reaction') {
        dispatch(handleNewMessageCache({
          chatId: newChat._id,
          message: msg,
          chatData: i === 0 ? chatForList : undefined, // Update chat metadata only once
        }));
      }
    }

    // Update last fetch time
    const lastFetchTime = await AsyncStorage.getItem('@pabbly_chatflow_lastFetchTime');
    const fetchTimeObj = lastFetchTime ? JSON.parse(lastFetchTime) : {};
    fetchTimeObj[settingId] = new Date().toISOString();
    await AsyncStorage.setItem('@pabbly_chatflow_lastFetchTime', JSON.stringify(fetchTimeObj));

  } catch (error) {
    // Error handling new message
  }
};

/**
 * Handle message status update from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} data - Status update data { chatId, messageWaId, status, sentAt, deliveredAt, readAt }
 */
export const handleMessageStatus = async (dispatch, data) => {
  try {
    const settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');

    // Update the message in current conversation if open
    dispatch(updateMessageInCurrentConversation({
      chatId: data.chatId,
      messageWaId: data.messageWaId,
      tempId: data.tempId, // Pass tempId if server includes it (fallback matching)
      updates: {
        status: data.status,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
        waResponse: data.waResponse,
        updatedAt: data.updatedAt,
      },
    }));

    // Sync message status to SQLite cache
    dispatch(updateMessageStatusInCache({
      messageId: data.messageWaId,
      updates: {
        status: data.status,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
      },
    }));

  } catch (error) {
    // Error handling message status
  }
};

/**
 * Handle reset unread count from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} chatId - Chat ID
 */
export const handleResetUnreadCount = (dispatch, chatId) => {
  dispatch(resetUnreadCount(chatId));
  // Sync unread count reset to SQLite cache
  dispatch(resetUnreadCountInCache(chatId));
};

/**
 * Handle contact created event from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} id - Conversation ID
 */
export const handleContactCreated = (dispatch, id) => {
  dispatch(setConversationId(id));
};

/**
 * Handle contact create error from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} errorMsg - Error message
 */
export const handleContactCreateError = (dispatch, errorMsg) => {
  dispatch(setContactCreateError(errorMsg));
};

/**
 * Handle send message error from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} errorMsg - Error message
 */
export const handleSendMessageError = (dispatch, errorMsg) => {
  dispatch(setSendMessageError(errorMsg));
};

/**
 * Handle team member logout from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Array} emailsToLogout - Array of team members to logout
 */
export const handleTeamMemberLogout = async (dispatch, emailsToLogout, getState) => {
  try {
    const userStr = await AsyncStorage.getItem('@pabbly_chatflow_user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) return;

    for (const member of emailsToLogout) {
      if (user.email === member.email) {
        dispatch(logout());
        break;
      }
    }
  } catch (error) {
    // Error handling team member logout
  }
};

/**
 * Handle chat update on contact update from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} response - Response with contactIds
 */
export const handleUpdateChatOnContactUpdate = async (dispatch, response) => {
  try {
    if (response?.contactIds && Array.isArray(response.contactIds) && response.contactIds.length > 0) {
      // Fetch updated chats for the specific contact IDs
      const updatedChatsResponse = await dispatch(fetchChatsByContacts(response.contactIds));

      const payload = updatedChatsResponse.payload || {};
      const chats = payload.data?.chats || payload.chats || payload._raw?.chats || [];
      if (chats.length > 0) {
        // Merge with existing chats - this will be handled in the slice
        for (const chat of chats) {
          dispatch(updateChatInList(chat));
          // Sync contact-updated chat to SQLite cache
          try { await cacheManager.updateChat(chat); } catch (e) {}
        }
      }
    }
  } catch (error) {
    // Error updating chats for contact IDs
  }
};

/**
 * Handle template status update from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} template - Updated template data
 */
export const handleUpdateTemplateStatus = (dispatch, template) => {
  if (template && template._id) {
    dispatch(setUpdatedTemplate(template));
  }
};

/**
 * Handle bulk new messages from socket (matching web app behavior)
 * @param {Function} dispatch - Redux dispatch
 * @param {Array} newChats - Array of new chat objects with messages
 * @param {Function} getState - Redux getState function
 */
export const handleNewMessagesBulk = async (dispatch, newChats, getState) => {
  try {
    if (!Array.isArray(newChats) || newChats.length === 0) return;

    // Try both possible keys for settingId
    let settingId = await AsyncStorage.getItem('@pabbly_chatflow_settingId');
    if (!settingId) {
      settingId = await AsyncStorage.getItem('settingId');
    }

    // Filter chats that belong to current setting
    const relevantChats = newChats.filter(chat => chat.settingId === settingId);
    if (relevantChats.length === 0) {
      return;
    }

    // Get current chats from Redux store
    const state = getState();
    const currentChats = state.inbox?.chats || [];

    // Create a map of existing chats for quick lookup
    const existingChatsMap = new Map(currentChats.map(chat => [chat._id, chat]));

    // Process bulk chats - update existing or add new
    const updatedChatsMap = new Map(existingChatsMap);

    relevantChats.forEach(newChat => {
      const allMessages = newChat.messages && newChat.messages.length > 0
        ? newChat.messages
        : [];
      const lastMessage = allMessages.length > 0
        ? allMessages[allMessages.length - 1]
        : null;

      const processedChat = {
        ...newChat,
        messages: undefined,
        lastMessage,
        lastMessageTime: lastMessage?.timestamp || lastMessage?.createdAt || newChat?.updatedAt,
        unreadCount: existingChatsMap.get(newChat._id)?.unreadCount || 0,
      };
      updatedChatsMap.set(newChat._id, processedChat);

      // Handle reaction messages from bulk events
      for (const msg of allMessages) {
        if (msg && msg.type === 'reaction') {
          const emoji = msg?.reaction?.emoji || msg?.message?.emoji
            || msg?.message?.reaction?.emoji || '';
          const reactedToMessageId = msg?.reaction?.message_id
            || msg?.message?.message_id
            || msg?.reaction?.messageId
            || msg?.message?.reaction?.message_id
            || msg?.context?.id;
          if (reactedToMessageId) {
            dispatch(updateMessageReactionInConversation({
              chatId: newChat._id,
              messageWaId: reactedToMessageId,
              reaction: { emoji },
              sentBy: msg?.sentBy || msg?.from,
            }));
          }
        }
      }

      // Add ALL non-reaction messages to current conversation
      for (const msg of allMessages) {
        if (msg && msg.type !== 'reaction') {
          dispatch(addMessageToCurrentConversation({
            chatId: newChat._id,
            message: msg,
          }));
        }
      }
    });

    // Convert map back to array and sort by lastMessageTime
    const updatedChats = Array.from(updatedChatsMap.values()).sort(
      (a, b) => {
        const aTime = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime; // Descending order (newest first)
      }
    );

    dispatch(setChats(updatedChats));

    // Sync ALL messages from each bulk chat to SQLite cache (not just the last one)
    relevantChats.forEach(newChat => {
      const allMessages = newChat.messages && newChat.messages.length > 0
        ? newChat.messages
        : [];
      const chatData = { ...newChat, messages: undefined };
      for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];
        if (msg && msg.type !== 'reaction') {
          dispatch(handleNewMessageCache({
            chatId: newChat._id,
            message: msg,
            chatData: i === 0 ? chatData : undefined,
          }));
        }
      }
    });

    // Update last fetch time
    const lastFetchTime = await AsyncStorage.getItem('@pabbly_chatflow_lastFetchTime');
    const fetchTimeObj = lastFetchTime ? JSON.parse(lastFetchTime) : {};
    fetchTimeObj[settingId] = new Date().toISOString();
    await AsyncStorage.setItem('@pabbly_chatflow_lastFetchTime', JSON.stringify(fetchTimeObj));
  } catch (error) {
    // Error handling bulk messages
  }
};

export default {
  handleNewMessage,
  handleMessageStatus,
  handleResetUnreadCount,
  handleContactCreated,
  handleContactCreateError,
  handleSendMessageError,
  handleTeamMemberLogout,
  handleUpdateChatOnContactUpdate,
  handleUpdateTemplateStatus,
  handleNewMessagesBulk,
};
