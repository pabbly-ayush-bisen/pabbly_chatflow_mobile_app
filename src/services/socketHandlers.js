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

    // Extract last message from the chat
    const lastMessage = newChat.messages && newChat.messages.length > 0
      ? newChat.messages[newChat.messages.length - 1]
      : null;

    // Handle reaction messages - update the original message's reactions instead of adding new message
    if (lastMessage?.type === 'reaction') {
      const emoji = lastMessage?.reaction?.emoji || lastMessage?.message?.emoji || '';
      const reactedToMessageId = lastMessage?.reaction?.message_id || lastMessage?.message?.message_id || lastMessage?.context?.id;

      if (reactedToMessageId) {
        dispatch(updateMessageReactionInConversation({
          chatId: newChat._id,
          messageWaId: reactedToMessageId,
          reaction: { emoji },
          sentBy: lastMessage?.sentBy || lastMessage?.from,
        }));

        // Update chat list without adding reaction as lastMessage (reactions don't show in chat list)
        const chatForList = {
          ...newChat,
          messages: undefined,
          // Don't update lastMessage for reactions
          lastMessageTime: newChat?.updatedAt || newChat?.createdAt,
          unreadCount: newChat.unreadCount || 0,
        };
        dispatch(updateChatInList(chatForList));

        return;
      }
    }

    // Create chat object for list (without full messages array)
    const chatForList = {
      ...newChat,
      messages: undefined,
      lastMessage,
      lastMessageTime: lastMessage?.timestamp || lastMessage?.createdAt || newChat?.updatedAt || newChat?.createdAt,
      // Ensure unread count is updated for incoming messages
      unreadCount: newChat.unreadCount || (lastMessage?.sentBy !== 'user' ? 1 : 0),
    };

    // Update chat list - move to top if not system message
    dispatch(updateChatInList(chatForList));

    // If we have the current conversation open, add message to it
    if (lastMessage) {
      dispatch(addMessageToCurrentConversation({
        chatId: newChat._id,
        message: lastMessage,
      }));
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
      updates: {
        status: data.status,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
        waResponse: data.waResponse,
        updatedAt: data.updatedAt,
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
      const lastMessage = newChat.messages && newChat.messages.length > 0
        ? newChat.messages[newChat.messages.length - 1]
        : null;

      const processedChat = {
        ...newChat,
        messages: undefined,
        lastMessage,
        lastMessageTime: lastMessage?.timestamp || lastMessage?.createdAt || newChat?.updatedAt,
        unreadCount: existingChatsMap.get(newChat._id)?.unreadCount || 0,
      };
      updatedChatsMap.set(newChat._id, processedChat);
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
