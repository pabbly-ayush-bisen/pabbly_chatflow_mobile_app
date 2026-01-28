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

    console.log('[SocketHandler] Received newMessage event:', {
      chatId: newChat._id,
      incomingSettingId: newChat.settingId,
      storedSettingId: settingId,
      messagesCount: newChat.messages?.length,
    });

    // Only process messages for current setting
    if (newChat.settingId !== settingId) {
      console.log('[SocketHandler] Message not for current setting, ignoring. Incoming:', newChat.settingId, 'Stored:', settingId);
      return;
    }

    // Extract last message from the chat
    const lastMessage = newChat.messages && newChat.messages.length > 0
      ? newChat.messages[newChat.messages.length - 1]
      : null;

    console.log('[SocketHandler] Last message:', {
      hasLastMessage: !!lastMessage,
      messageType: lastMessage?.type,
      messageId: lastMessage?.wamid || lastMessage?._id,
    });

    // Handle reaction messages - update the original message's reactions instead of adding new message
    if (lastMessage?.type === 'reaction') {
      console.log('[SocketHandler] Handling reaction message:', {
        emoji: lastMessage?.reaction?.emoji || lastMessage?.message?.emoji,
        reactedToMessageId: lastMessage?.reaction?.message_id || lastMessage?.message?.message_id || lastMessage?.context?.id,
      });

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

        console.log('[SocketHandler] Reaction handling complete');
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
    console.log('[SocketHandler] Dispatching updateChatInList');
    dispatch(updateChatInList(chatForList));

    // If we have the current conversation open, add message to it
    if (lastMessage) {
      console.log('[SocketHandler] Dispatching addMessageToCurrentConversation');
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

    console.log('[SocketHandler] Message handling complete');

  } catch (error) {
    console.error('[SocketHandler] Error handling new message:', error);
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
    console.error('Error handling message status:', error);
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
  console.log('Contact created successfully:', id);
  dispatch(setConversationId(id));
};

/**
 * Handle contact create error from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} errorMsg - Error message
 */
export const handleContactCreateError = (dispatch, errorMsg) => {
  console.error('Contact create error:', errorMsg);
  dispatch(setContactCreateError(errorMsg));
};

/**
 * Handle send message error from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {string} errorMsg - Error message
 */
export const handleSendMessageError = (dispatch, errorMsg) => {
  console.error('Send message error:', errorMsg);
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
        console.log('Team member logout triggered for:', member.email);
        dispatch(logout());
        break;
      }
    }
  } catch (error) {
    console.error('Error handling team member logout:', error);
  }
};

/**
 * Handle chat update on contact update from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} response - Response with contactIds
 */
export const handleUpdateChatOnContactUpdate = async (dispatch, response) => {
  try {
    console.log('[SocketHandler] updateChatOnContactUpdate received:', response);

    if (response?.contactIds && Array.isArray(response.contactIds) && response.contactIds.length > 0) {
      // Fetch updated chats for the specific contact IDs
      const updatedChatsResponse = await dispatch(fetchChatsByContacts(response.contactIds));

      if (updatedChatsResponse.payload?.data?.chats || updatedChatsResponse.payload?.chats) {
        const chats = updatedChatsResponse.payload?.data?.chats || updatedChatsResponse.payload?.chats;
        // Merge with existing chats - this will be handled in the slice
        for (const chat of chats) {
          dispatch(updateChatInList(chat));
        }
        console.log('[SocketHandler] Updated chats for contacts:', chats.length);
      }
    }
  } catch (error) {
    console.error('[SocketHandler] Error updating chats for contact IDs:', error);
  }
};

/**
 * Handle template status update from socket
 * @param {Function} dispatch - Redux dispatch
 * @param {Object} template - Updated template data
 */
export const handleUpdateTemplateStatus = (dispatch, template) => {
  console.log('[SocketHandler] updateTemplateStatus received:', template);
  if (template && template._id) {
    dispatch(setUpdatedTemplate(template));
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
};
