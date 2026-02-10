import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, StatusBar, TouchableOpacity, Modal, ScrollView, ImageBackground } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showError, showSuccess, showWarning, toastActions } from '../utils/toast';
import {
  resetUnreadCount,
  updateContactChat,
  toggleAiAssistant,
  setChatStatus,
  setAiAssistantStatus,
  sendMessageReaction,
  clearInboxError,
  addOptimisticMessage,
  markOptimisticMessageFailed,
  markOptimisticMessageQueued,
  clearCurrentConversation,
  updateMessageMediaMeta,
} from '../redux/slices/inboxSlice';
import { fetchConversationWithCache, fetchQuickRepliesWithCache, syncMissedMessages } from '../redux/cacheThunks';
import { fetchAllTemplates } from '../redux/slices/templateSlice';
import { sendMessageViaSocket, resetUnreadCountViaSocket, sendTemplateViaSocket } from '../services/socketService';
import { uploadFileWithProgress, validateFileSize } from '../services/fileUploadService';
import { cacheManager } from '../database/CacheManager';
import useUploadState from '../hooks/useUploadState';
import useMediaDownload from '../hooks/useMediaDownload';
import { getMediaUrl } from '../utils/messageHelpers';
import { colors, chatColors, getAvatarColor } from '../theme/colors';
import { useSocket } from '../contexts/SocketContext';
import MessageBubble from '../components/chat/MessageBubble';
import ChatInput from '../components/chat/ChatInput';
import AttachmentPicker from '../components/chat/AttachmentPicker';
import DateSeparator from '../components/chat/DateSeparator';
import MessageActionsMenu from '../components/chat/MessageActionsMenu';
import ChatOptionsMenu from '../components/chat/ChatOptionsMenu';
import ImageLightbox from '../components/chat/ImageLightbox';
import VideoPlayerModal from '../components/chat/VideoPlayerModal';
import ChatNotes from '../components/chat/ChatNotes';
import UploadingMediaMessage from '../components/chat/messages/UploadingMediaMessage';

// Chat wallpaper background image
const chatWallpaper = require('../../assets/chat-wallpaper.png');

export default function ChatDetailsScreen({ route, navigation }) {
  const { chatId, chat } = route.params;
  const dispatch = useDispatch();
  const flatListRef = useRef(null);
  const prevChatIdRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { setCurrentChatId } = useSocket();

  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showChatNotes, setShowChatNotes] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState(null);
  const [sharedContacts, setSharedContacts] = useState([]);
  const [showSharedContactSheet, setShowSharedContactSheet] = useState(false);

  // Upload state management for WhatsApp-style progress UI
  const {
    uploads, // For FlatList extraData to trigger re-renders on progress update
    addUpload,
    updateProgress,
    completeUpload,
    failUpload,
    cancelUpload,
    prepareRetry,
    getAbortController,
    getAllUploads,
    cleanup: cleanupUploads,
  } = useUploadState();

  // Media download state management for local media storage
  const { downloads, startDownload, getDownloadState } = useMediaDownload();

  // Setting ID for media download DB operations
  const settingId = useSelector((state) => state.user?.settingId);

  const {
    currentConversation,
    conversationStatus,
    conversationError,
    sendMessageStatus,
    sendMessageError,
    chatStatus: reduxChatStatus,
    aiAssistantStatus: reduxAiAssistantStatus,
    updateContactChatStatus,
    toggleAiAssistantStatus,
    chats: inboxChats,
  } = useSelector((state) => state.inbox);

  // Get templates from redux store
  const { templates } = useSelector((state) => state.template);

  // Get quick replies from settings
  const { settings } = useSelector((state) => state.settings);
  const quickReplies = settings?.quickReplies?.items || [];

  // Get current user info for optimistic messages sender display
  // Only show team member info if actually logged in as a team member
  const { user, teamMemberStatus } = useSelector((state) => state.user);
  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;
  const currentUserName = isTeamMemberLoggedIn ? teamMemberStatus?.name : null;
  const currentUserId = isTeamMemberLoggedIn ? teamMemberStatus?._id : null;

  const isLoading = conversationStatus === 'loading';
  const messages = currentConversation?.messages || [];
  const contact = currentConversation?.contact || chat?.contact || {};
  // Get phone number from multiple possible locations (API may return it differently)
  // Web app uses contact.mobile, so check that field first
  const contactPhoneNumber = contact.mobile || contact.phoneNumber || contact.phone_number ||
    currentConversation?.phoneNumber || currentConversation?.phone_number ||
    chat?.phoneNumber || chat?.phone_number || '';
  const contactName = contact.name || contactPhoneNumber || 'Unknown';

  // Get chat status and AI assistant status from conversation or redux
  const chatStatus = currentConversation?.status || reduxChatStatus || chat?.status || 'open';
  // Derive AI assistant active state — also check chatStatus since aiAssistant.isActive may not be
  // present in conversation data (e.g., cache-loaded or API response without nested aiAssistant field).
  // Web app syncs this via: dispatch(setAiAssitantStatus(chat?.aiAssistant?.isActive)) in chat-room-single.jsx
  const aiAssistantStatus = currentConversation?.aiAssistant?.isActive || reduxAiAssistantStatus || chatStatus === 'aiAssistant';
  const isIntervened = chatStatus === 'intervened';
  // Get lastActive from multiple sources - the inbox chats array (populated by chat list API
  // and socket events) is the most reliable source, matching how the web app reads from IndexedDB.
  const inboxChat = useMemo(() => inboxChats?.find(c => c._id === chatId), [inboxChats, chatId]);
  const lastActiveTime = contact?.lastActive || inboxChat?.contact?.lastActive ||
    currentConversation?.lastActive || chat?.lastActive;

  useEffect(() => {
    if (chatId) {
      const isSameChat = prevChatIdRef.current === chatId;
      const hasMessagesLoaded = isSameChat && currentConversation?.messages?.length > 0;

      if (!isSameChat) {
        // Switching to a different chat — clear old state and load fresh
        dispatch(clearCurrentConversation());
      }
      prevChatIdRef.current = chatId;

      if (hasMessagesLoaded) {
        // Re-opening the same chat that already has messages in Redux.
        // Skip cache reload (which causes ordering flash) and just background-sync
        // to pick up any missed messages from the server.
        dispatch(syncMissedMessages({ chatId }));
      } else {
        // New chat or no messages — load from cache first, then sync
        dispatch(fetchConversationWithCache({ chatId }))
          .then((result) => {
            if (result.payload?.fromCache) {
              dispatch(syncMissedMessages({ chatId }));
            }
          });
      }

      // Reset unread count
      dispatch(resetUnreadCount(chatId));
      resetUnreadCountViaSocket(chatId);
      // Set current chat ID to prevent notifications for this chat
      setCurrentChatId(chatId);
    }

    // Fetch templates and quick replies if not already loaded
    dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
    dispatch(fetchQuickRepliesWithCache());

    // Clear current chat ID and conversation when leaving the screen
    return () => {
      setCurrentChatId(null);
      dispatch(clearCurrentConversation());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, dispatch]);

  useEffect(() => {
    // With optimistic updates, we no longer need to refresh on success
    // The message is already in the UI and socket handlers update the status
    if (sendMessageStatus === 'failed') {
      setIsSending(false);
    }
  }, [sendMessageStatus]);

  // Display socket send message errors as toast
  useEffect(() => {
    if (sendMessageError) {
      setIsSending(false);
      toastActions.messageFailed(
        typeof sendMessageError === 'string' ? sendMessageError : 'Failed to send message. Please try again.'
      );
      dispatch(clearInboxError());
      // Refresh templates in case the error was due to stale template data
      dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
    }
  }, [sendMessageError, dispatch]);

  // Group messages by date and include pending uploads
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    const usedIds = new Set();

    // Process regular messages (sort by timestamp to guarantee chronological order)
    if (messages.length) {
      const sortedMessages = [...messages].sort((a, b) => {
        const aT = new Date(a.timestamp || a.createdAt || 0).getTime();
        const bT = new Date(b.timestamp || b.createdAt || 0).getTime();
        return aT - bT;
      });
      sortedMessages.forEach((message, index) => {
        const messageDate = new Date(message.timestamp || message.createdAt);
        const dateKey = messageDate.toDateString();

        if (dateKey !== currentDate) {
          currentDate = dateKey;
          groups.push({
            type: 'date',
            date: messageDate,
            id: `date-${dateKey}`,
          });
        }

        // Generate unique key - prefer _id, then wamid, then fallback with index
        let messageId = message._id || message.wamid;
        if (!messageId || usedIds.has(messageId)) {
          // If ID is missing or duplicate, create a unique fallback
          messageId = `msg-${index}-${message.timestamp || Date.now()}`;
        }
        usedIds.add(messageId);

        groups.push({
          type: 'message',
          data: message,
          id: messageId,
        });
      });
    }

    // Add pending uploads at the end (they appear as optimistic messages)
    const pendingUploads = getAllUploads();
    if (pendingUploads.length > 0) {
      // Add today's date separator if needed
      const today = new Date();
      const todayKey = today.toDateString();
      if (currentDate !== todayKey && groups.length > 0) {
        groups.push({
          type: 'date',
          date: today,
          id: `date-${todayKey}`,
        });
      }

      // Add each pending upload as a message
      pendingUploads.forEach((upload) => {
        groups.push({
          type: 'uploading',
          data: upload,
          id: upload.tempId,
        });
      });
    }

    return groups;
  }, [messages, getAllUploads]);

  // For inverted list (no jump): reverse grouped items so latest appears at bottom.
  const groupedMessagesInverted = useMemo(
    () => [...groupedMessages].reverse(),
    [groupedMessages]
  );


  const handleSendMessage = useCallback(async (messageData) => {
    // Handle both string (old) and object (new) message format
    const text = typeof messageData === 'string' ? messageData : messageData?.text;
    const file = typeof messageData === 'object' ? messageData?.file : null;
    const replyTo = typeof messageData === 'object' ? messageData?.replyTo : replyingTo?.wamid;

    if ((!text?.trim() && !file) || isSending) {
      return;
    }

    setIsSending(true);

    // Generate a unique temp ID for optimistic message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    try {
      let uploadedFileUrl = null;
      let uploadedFileName = null;
      let uploadTempId = null;

      // If there's a file, upload it with progress tracking
      if (file) {
        // Validate file size
        if (file.fileSize) {
          const validation = validateFileSize(file.fileSize, file.fileType);
          if (!validation.valid) {
            showError(validation.message, 'File Too Large');
            setIsSending(false);
            return;
          }
        }

        // Check if file already has a remote URL (from quick replies or media library)
        const isRemoteUrl = file.fileUrl && (
          file.fileUrl.startsWith('http://') ||
          file.fileUrl.startsWith('https://')
        );

        if (isRemoteUrl) {
          // File already uploaded, use existing URL
          uploadedFileUrl = file.fileUrl;
          uploadedFileName = file.fileName;
        } else {
          // Upload local file with progress tracking (WhatsApp-style UI)
          try {
            // Add upload to state for UI display
            uploadTempId = addUpload({
              ...file,
              caption: text?.trim() || '',
            });

            // Get abort controller for cancellation support
            const abortController = getAbortController(uploadTempId);

            // Upload with progress tracking
            const uploadResult = await uploadFileWithProgress(
              file,
              (progress) => {
                updateProgress(uploadTempId, progress);
              },
              abortController
            );

            if (uploadResult.success && uploadResult.url) {
              uploadedFileUrl = uploadResult.url;
              uploadedFileName = uploadResult.fileName || file.fileName;
              // Complete the upload (remove from UI state)
              completeUpload(uploadTempId);
            } else {
              throw new Error('Upload succeeded but no URL was returned');
            }
          } catch (uploadError) {
            // Check if it was cancelled
            if (uploadError.message === 'Upload cancelled') {
              setIsSending(false);
              return;
            }

            // Mark upload as failed (show retry button)
            if (uploadTempId) {
              failUpload(uploadTempId, uploadError.message || 'Upload failed');
            }
            setIsSending(false);
            return;
          }
        }
      }

      // Determine message type based on file type
      const getMessageType = (fileType) => {
        if (!fileType) return 'text';
        const type = fileType.toLowerCase();
        if (type.includes('image')) return 'image';
        if (type.includes('video')) return 'video';
        if (type.includes('audio')) return 'audio';
        return 'document';
      };

      const messageType = uploadedFileUrl ? getMessageType(file.fileType) : 'text';

      // Create optimistic message for immediate UI display (WhatsApp-style)
      const optimisticMessage = {
        tempId,
        _id: tempId,
        type: messageType,
        status: 'pending', // Clock icon
        sentBy: 'user',
        timestamp,
        createdAt: timestamp,
        // Only include from property if logged in as a team member
        ...(isTeamMemberLoggedIn && currentUserName && {
          from: {
            type: 'teamMember',
            name: currentUserName,
            id: currentUserId,
          },
        }),
        ...(messageType === 'text' ? {
          message: { body: text?.trim() || '' },
        } : {
          message: {
            [messageType]: {
              link: uploadedFileUrl,
              url: uploadedFileUrl,
              caption: text?.trim() || '',
            },
            caption: text?.trim() || '',
          },
        }),
        ...(replyTo && { replyToWamid: replyTo, context: { id: replyTo } }),
      };

      // Immediately add optimistic message to UI
      dispatch(addOptimisticMessage({
        chatId,
        message: optimisticMessage,
      }));

      // Also save optimistic message to SQLite cache so it persists across navigation
      // Without this, going back and re-opening the chat would lose the sent message
      // until syncMissedMessages fetches it from the API (which may take multiple re-opens)
      try {
        await cacheManager.addMessage(optimisticMessage, chatId);
      } catch (cacheErr) {
        // Non-critical - message is still in Redux for the current session
      }

      // Clear reply state immediately for better UX
      setReplyingTo(null);

      const socketData = {
        to: contactPhoneNumber,  // Backend expects 'to' field, not 'phoneNumber'
        type: messageType,
        chatId,
        tempId, // Include tempId so server can echo it back
        // For text messages, send message field; for media, send caption
        ...(uploadedFileUrl
          ? { caption: text?.trim() || '' }
          : { message: text?.trim() || '' }
        ),
        ...(replyTo && { replyToWamid: replyTo }),  // Backend expects 'replyToWamid', not 'context'
        ...(uploadedFileUrl && {
          link: uploadedFileUrl,  // Backend expects 'link', not nested attachment.url
          filename: uploadedFileName || file.fileName,
        }),
      };

      const sent = sendMessageViaSocket(socketData);

      if (sent) {
        // Message was sent successfully via socket
        setIsSending(false);
        // Don't refresh conversation - socket handlers will update the message status
        // The optimistic message is already in the UI with pending status
      } else {
        // Socket not connected — queue the message for sending on reconnect
        try {
          await cacheManager.addToSyncQueue('sendMessage', 'messages', tempId, {
            socketData,
            chatId,
            tempId,
            messageType,
            timestamp,
          });
          dispatch(markOptimisticMessageQueued({ chatId, tempId }));
          toastActions.info('Message queued. Will send when connected.');
        } catch (queueError) {
          // Fallback to failed if queue save fails
          dispatch(markOptimisticMessageFailed({
            chatId,
            tempId,
            error: 'Could not send message. Please check your connection.',
          }));
          toastActions.messageFailed('Could not send message. Please check your connection.');
        }
        setIsSending(false);
      }
    } catch (error) {
      // Mark the optimistic message as failed
      dispatch(markOptimisticMessageFailed({
        chatId,
        tempId,
        error: error.message || 'Failed to send message',
      }));
      toastActions.messageFailed(error.message || 'Failed to send message. Please try again.');
      setIsSending(false);
    }
  }, [chatId, contactPhoneNumber, isSending, replyingTo, dispatch, addUpload, updateProgress, completeUpload, failUpload, getAbortController]);

  // Handle upload cancellation from UI
  const handleCancelUpload = useCallback((tempId) => {
    cancelUpload(tempId);
  }, [cancelUpload]);

  // Handle upload retry from UI
  const handleRetryUpload = useCallback(async (tempId) => {
    const file = prepareRetry(tempId);
    if (!file) return;

    // Generate new temp ID for the optimistic message
    const msgTempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    try {
      const abortController = getAbortController(tempId);

      const uploadResult = await uploadFileWithProgress(
        file.originalFile || file,
        (progress) => {
          updateProgress(tempId, progress);
        },
        abortController
      );

      if (uploadResult.success && uploadResult.url) {
        // Complete upload and send message
        completeUpload(tempId);

        // Send the message via socket
        const getMessageType = (fileType) => {
          if (!fileType) return 'document';
          const type = fileType.toLowerCase();
          if (type.includes('image')) return 'image';
          if (type.includes('video')) return 'video';
          if (type.includes('audio')) return 'audio';
          return 'document';
        };

        const messageType = getMessageType(file.fileType);

        // Create optimistic message
        const optimisticMessage = {
          tempId: msgTempId,
          _id: msgTempId,
          type: messageType,
          status: 'pending',
          sentBy: 'user',
          timestamp,
          createdAt: timestamp,
          // Only include from property if logged in as a team member
          ...(isTeamMemberLoggedIn && currentUserName && {
            from: {
              type: 'teamMember',
              name: currentUserName,
              id: currentUserId,
            },
          }),
          message: {
            [messageType]: {
              link: uploadResult.url,
              url: uploadResult.url,
              caption: file.caption || '',
            },
            caption: file.caption || '',
          },
        };

        // Add optimistic message to UI
        dispatch(addOptimisticMessage({
          chatId,
          message: optimisticMessage,
        }));

        const socketData = {
          to: contactPhoneNumber,
          type: messageType,
          chatId,
          tempId: msgTempId,
          caption: file.caption || '',
          link: uploadResult.url,
          filename: uploadResult.fileName || file.fileName,
        };

        const sent = sendMessageViaSocket(socketData);
        if (!sent) {
          dispatch(markOptimisticMessageFailed({
            chatId,
            tempId: msgTempId,
            error: 'Failed to send message',
          }));
        }
      }
    } catch (error) {
      if (error.message !== 'Upload cancelled') {
        failUpload(tempId, error.message || 'Upload failed');
      }
    }
  }, [prepareRetry, getAbortController, updateProgress, completeUpload, failUpload, contactPhoneNumber, chatId, dispatch]);

  // Cleanup uploads on unmount
  useEffect(() => {
    return () => {
      cleanupUploads();
    };
  }, [cleanupUploads]);

  // Handle template send - receives payload from ChatInput with templateName, bodyParams, headerParams, etc.
  const handleSendTemplate = useCallback(async (templatePayload) => {
    if (!templatePayload || isSending) return;

    setIsSending(true);

    // Generate a unique temp ID for optimistic message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Extract values from the payload sent by ChatInput/TemplatePreviewDialog
    // The payload structure is: { templateName, languageCode, templateType, bodyParams, headerParams, row (actual template), media, fileName, fileUrl, mediaId }
    // For carousel: { template, isCarousel, carouselBodies, carouselMedia, fileData, carouselMediaType }
    const template = templatePayload.template || templatePayload.row || templatePayload;
    const templateName = templatePayload.templateName || template?.name;
    const languageCode = templatePayload.languageCode || template?.language || 'en';
    const templateType = templatePayload.templateType || template?.type || 'TEXT';
    const bodyParams = templatePayload.bodyParams || [];
    const headerParams = templatePayload.headerParams || [];
    const media = templatePayload.media;

    // Check if this is a carousel template
    const isCarouselTemplate = templatePayload.isCarousel || templateType?.toUpperCase() === 'CAROUSEL';

    // Handle carousel template separately
    if (isCarouselTemplate) {
      // Create optimistic message for carousel
      const carouselOptimisticMessage = {
        tempId,
        _id: tempId,
        type: 'template',
        status: 'pending',
        sentBy: 'user',
        timestamp,
        createdAt: timestamp,
        // Only include from property if logged in as a team member
        ...(isTeamMemberLoggedIn && currentUserName && {
          from: {
            type: 'teamMember',
            name: currentUserName,
            id: currentUserId,
          },
        }),
        message: {
          template: {
            name: templateName,
            language: { code: languageCode },
            templateId: template._id,
            components: template.components,
          },
          body: { text: `Carousel: ${templateName}` },
          type: 'CAROUSEL',
          isCarousel: true,
          ...(templatePayload.carouselFileData?.[0]?.fileUrl && { link: templatePayload.carouselFileData[0].fileUrl }),
        },
        templateName: templateName,
        ...(replyingTo && { replyToWamid: replyingTo.wamid, context: { id: replyingTo.wamid } }),
      };

      // Add optimistic message to UI
      dispatch(addOptimisticMessage({
        chatId,
        message: carouselOptimisticMessage,
      }));

      setReplyingTo(null);

      // Build carousel socket payload EXACTLY like web app's handleSendTemplate:
      // dispatch({ type: 'socket/sendMessage', payload: {
      //   to, type: 'template', chatId, ...payload,
      //   bodyParams: Object.values(payload.bodyParams || {}),
      //   headerParams: Object.values(payload.headerParams || {}),
      //   filename: payload.fileName, link: payload.fileUrl, replyToWamid
      // }})
      const carouselTemplateData = {
        to: contactPhoneNumber,
        type: 'template',
        chatId,
        // Spread ALL fields from templatePayload (like web app does with ...payload)
        ...templatePayload,
        // Web app converts bodyParams/headerParams from objects to arrays
        bodyParams: Object.values(templatePayload.bodyParams || {}),
        headerParams: Object.values(templatePayload.headerParams || {}),
        // Web app uses 'filename' and 'link' (not fileName/fileUrl)
        filename: templatePayload.fileName || '',
        link: templatePayload.fileUrl || '',
        ...(replyingTo && { replyToWamid: replyingTo.wamid }),
      };

      // Use sendMessageViaSocket (no transformation) like web app does
      // Web app: socket.emit('sendMessage', action.payload) - direct, no transformation
      const sent = sendMessageViaSocket(carouselTemplateData);

      if (sent) {
        setIsSending(false);
      } else {
        dispatch(markOptimisticMessageFailed({
          chatId,
          tempId,
          error: 'Failed to send carousel template. Please try again.',
        }));
        setIsSending(false);
        showError('Failed to send carousel template. Please try again.');
      }
      return;
    }

    // Extract header component to check for media (case-insensitive)
    const headerComponent = template.components?.find(c => c.type?.toUpperCase() === 'HEADER');
    const headerFormat = headerComponent?.format?.toUpperCase();
    const hasMediaHeader = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);

    // Also check if template type itself indicates media (for templates where type is IMAGE/VIDEO/DOCUMENT)
    const templateTypeUpper = templateType?.toUpperCase();
    const isMediaTemplate = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(templateTypeUpper);

    // Get template body text for optimistic message preview
    const bodyComponent = template.components?.find(c => c.type?.toUpperCase() === 'BODY');
    let bodyText = bodyComponent?.text || templateName || 'Template message';

    // Replace placeholders with params
    bodyParams.forEach((param, index) => {
      const placeholder = `{{${index + 1}}}`;
      bodyText = bodyText.replace(placeholder, param);
    });

    // Get media link for optimistic message (needed for immediate rendering)
    const mediaLink = media?.fileUrl || media?.uri || templatePayload.fileUrl || null;

    // Create optimistic message for immediate UI display
    const optimisticMessage = {
      tempId,
      _id: tempId,
      type: 'template',
      status: 'pending',
      sentBy: 'user',
      timestamp,
      createdAt: timestamp,
      // Only include from property if logged in as a team member
      ...(isTeamMemberLoggedIn && currentUserName && {
        from: {
          type: 'teamMember',
          name: currentUserName,
          id: currentUserId,
        },
      }),
      message: {
        template: {
          name: templateName,
          language: { code: languageCode },
          templateId: template._id,
          components: template.components, // Include components for variable substitution in display
        },
        body: { text: bodyText },
        // Include body and header params for display
        bodyParams: bodyParams,
        headerParams: headerParams,
        // Include media link for immediate rendering
        ...(mediaLink && { link: mediaLink }),
        // Include template type for header rendering
        type: templateTypeUpper,
      },
      templateName: templateName,
      ...(replyingTo && { replyToWamid: replyingTo.wamid, context: { id: replyingTo.wamid } }),
    };

    // Immediately add optimistic message to UI
    dispatch(addOptimisticMessage({
      chatId,
      message: optimisticMessage,
    }));

    // Clear reply state immediately for better UX
    setReplyingTo(null);

    // Build the socket payload
    const templateData = {
      to: contactPhoneNumber,
      chatId,
      tempId, // Include tempId so server can echo it back
      templateName: templateName,
      templateId: template._id,
      languageCode: languageCode,
      bodyParams: bodyParams,
      headerParams: headerParams,
      templateType: templateType,
      ...(replyingTo && { replyToWamid: replyingTo.wamid }),
      // LTO (Limited Time Offer) fields
      ...(templatePayload.ltoFields && { ltoFields: templatePayload.ltoFields }),
      // Location fields
      ...(templatePayload.location && { location: templatePayload.location }),
      // Catalog product ID
      ...(templatePayload.catalogProductId && { catalogProductId: templatePayload.catalogProductId }),
      // Copy code/Authentication param
      ...(templatePayload.copyCodeParam && { copyCodeParam: templatePayload.copyCodeParam }),
      // URL button variables
      ...(templatePayload.urlVariables && templatePayload.urlVariables.length > 0 && { urlVariables: templatePayload.urlVariables }),
    };

    // If template has media header or is a media type template, include file info
    // Check both hasMediaHeader and isMediaTemplate to cover all cases
    const needsMedia = hasMediaHeader || isMediaTemplate;

    if (needsMedia && media) {
      templateData.link = media.fileUrl || media.uri;
      templateData.filename = media.fileName;
      if (media.mediaId) {
        templateData.mediaId = media.mediaId;
      }
    } else if (needsMedia && templatePayload.fileUrl) {
      // Also check for fileUrl directly on payload
      templateData.link = templatePayload.fileUrl;
      templateData.filename = templatePayload.fileName;
      if (templatePayload.mediaId) {
        templateData.mediaId = templatePayload.mediaId;
      }
    }

    // Use specialized template socket method
    const sent = sendTemplateViaSocket(templateData);

    if (sent) {
      // Clear sending state - socket handlers will update the message status
      setIsSending(false);
    } else {
      // Mark the optimistic message as failed
      dispatch(markOptimisticMessageFailed({
        chatId,
        tempId,
        error: 'Failed to send template. Please try again.',
      }));
      setIsSending(false);
      showError('Failed to send template. Please try again.');
    }
  }, [chatId, contactPhoneNumber, isSending, replyingTo, dispatch]);

  // Handle intervene - take over conversation from AI/automation
  const handleIntervene = useCallback(async () => {
    try {
      const result = await dispatch(updateContactChat({
        id: chatId,
        status: 'intervened',
      })).unwrap();

      // Update local state
      dispatch(setChatStatus('intervened'));
      showSuccess('You have taken over this conversation. AI and automation are now disabled.', 'Intervened');
    } catch (error) {
      showError(error || 'Failed to intervene. Please try again.');
    }
  }, [chatId, dispatch]);

  // Handle stop AI assistant with selected status
  const handleStopAiAssistant = useCallback(async (selectedStatus = 'intervened') => {
    try {
      const assistantId = currentConversation?.aiAssistant?.assistantId;

      const result = await dispatch(toggleAiAssistant({
        chatId,
        assistantId,
        isActive: false,
      })).unwrap();

      // Update local state
      dispatch(setAiAssistantStatus(false));

      // Update chat status to the selected status
      await dispatch(updateContactChat({
        id: chatId,
        status: selectedStatus,
      })).unwrap();

      dispatch(setChatStatus(selectedStatus));

      // Get readable status label for success message
      const statusLabels = {
        open: 'Open',
        intervened: 'Intervened',
        on_hold: 'On Hold',
        replied: 'Replied',
        pending: 'Pending',
        resolved: 'Resolved',
        closed: 'Closed',
      };
      const statusLabel = statusLabels[selectedStatus] || selectedStatus;
      showSuccess(`AI Assistant stopped. Chat status changed to "${statusLabel}".`, 'AI Stopped');
    } catch (error) {
      showError(error || 'Failed to stop AI Assistant. Please try again.');
    }
  }, [chatId, currentConversation, dispatch]);

  const handleAttachmentSelect = useCallback((type) => {
    // TODO: Implement attachment handling
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Handle image press - open lightbox
  const handleImagePress = useCallback((imageUrl) => {
    setLightboxImage(imageUrl);
  }, []);

  // Handle video press - open in-app video player
  const handleVideoPress = useCallback((videoUrl) => {
    setVideoPlayerUrl(videoUrl);
  }, []);

  // Handle media download - user taps download button on a media message
  const handleMediaDownload = useCallback((message) => {
    const remoteUrl = getMediaUrl(message);
    if (!remoteUrl) return;

    const messageId = message?._id || message?.wamid || message?.server_id;
    if (!messageId || !settingId) return;

    const msgType = message?.type || message?.message?.type || 'document';
    // MIME type can be at message.message.mime_type or nested under the media type key
    // e.g., message.message.video.mime_type, message.message.image.mime_type
    const msgData = message?.message;
    const mimeType =
      msgData?.mime_type ||
      msgData?.[msgType]?.mime_type ||
      msgData?.video?.mime_type ||
      msgData?.image?.mime_type ||
      msgData?.audio?.mime_type ||
      msgData?.document?.mime_type ||
      message?.mime_type ||
      '';

    startDownload({
      remoteUrl,
      messageId,
      settingId,
      messageType: msgType,
      mimeType,
    }).then((result) => {
      if (result?.localPath) {
        dispatch(updateMessageMediaMeta({
          messageId,
          localMediaPath: result.localPath,
          localThumbnailPath: result.thumbnailPath || null,
          downloadStatus: 'downloaded',
        }));
      }
    }).catch(() => {
      // Download failure already handled by useMediaDownload hook
    });
  }, [settingId, startDownload, dispatch]);

  // Handle message long press - show actions menu
  const handleMessageLongPress = useCallback((message) => {
    setSelectedMessage(message);
    setShowMessageActions(true);
  }, []);

  // Handle message action selection
  const handleMessageAction = useCallback((action, message) => {
    setShowMessageActions(false);

    switch (action) {
      case 'reply':
        setReplyingTo(message);
        break;
      case 'copy':
        // Copy is handled in MessageActionsMenu
        break;
      case 'forward':
        // TODO: Implement forward functionality
        showWarning('Forward functionality coming soon', 'Coming Soon');
        break;
      default:
        break;
    }
  }, []);

  // Handle reaction selection
  const handleReaction = useCallback(async (emoji, message) => {
    setShowMessageActions(false);
    try {
      await dispatch(sendMessageReaction({
        chatId,
        messageId: message._id || message.wamid,
        emoji,
      })).unwrap();
    } catch (error) {
      showError('Failed to send reaction');
    }
  }, [chatId, dispatch]);

  // Handle chat options menu actions
  const handleChatOptionsAction = useCallback((action) => {
    setShowChatOptions(false);

    switch (action) {
      case 'contact_info':
        navigation.navigate('ContactInfo', {
          contact,
          chatId,
          chat: currentConversation || chat,
        });
        break;
      case 'notes':
        setShowChatNotes(true);
        break;
      default:
        break;
    }
  }, [navigation, contact, chatId, currentConversation, chat]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const handleSharedContactPress = useCallback((contactsArray) => {
    if (!contactsArray || !Array.isArray(contactsArray) || contactsArray.length === 0) return;
    setSharedContacts(contactsArray);
    setShowSharedContactSheet(true);
  }, []);

  // Scroll to a particular message (used when tapping reply preview)
  const scrollToMessage = useCallback((targetId) => {
    if (!flatListRef.current || !targetId) return;

    try {
      // Find index of the message in the non-inverted grouped list
      const baseIndex = groupedMessages.findIndex(
        (item) =>
          item.type === 'message' &&
          (item.data?._id === targetId || item.data?.wamid === targetId)
      );
      if (baseIndex === -1) return;

      // Convert to index in the inverted data array
      const invertedIndex = groupedMessages.length - 1 - baseIndex;
      flatListRef.current.scrollToIndex({ index: invertedIndex, animated: true });
    } catch (e) {
      // Scroll error, ignore
    }
  }, [groupedMessages]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return <DateSeparator date={item.date} />;
    }

    // Render uploading message with progress UI
    if (item.type === 'uploading') {
      return (
        <View style={styles.uploadingMessageContainer}>
          <View style={styles.uploadingBubble}>
            <UploadingMediaMessage
              upload={item.data}
              onCancel={() => handleCancelUpload(item.data.tempId)}
              onRetry={() => handleRetryUpload(item.data.tempId)}
              isOutgoing={true}
            />
            {/* Timestamp placeholder */}
            <View style={styles.uploadingMeta}>
              <Text style={styles.uploadingTimestamp}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Icon name="clock-outline" size={14} color={chatColors.tickGrey} />
            </View>
          </View>
        </View>
      );
    }

    const msg = item.data;
    const replyId = msg?.replyToWamid || msg?.context?.id;
    const originalMessage = replyId
      ? messages.find(
          (m) =>
            m?._id === replyId ||
            m?.wamid === replyId
        )
      : null;

    const messageId = msg?._id || msg?.wamid || msg?.server_id;

    return (
      <MessageBubble
        message={msg}
        originalMessage={originalMessage}
        onImagePress={handleImagePress}
        onVideoPress={handleVideoPress}
        onLongPress={handleMessageLongPress}
        onMediaDownload={handleMediaDownload}
        downloadState={messageId ? getDownloadState(messageId) : null}
        // onReplyPress is used both for tapping reply preview and right-swipe-to-reply
        onReplyPress={(target) => {
          // If target looks like an ID of another message → scroll to it (tap on reply preview)
          if (typeof target === 'string' && (target.startsWith('msg-') || target.length > 16)) {
            scrollToMessage(target);
          } else {
            // Otherwise treat as current message → start replying
            setReplyingTo(msg);
          }
        }}
        onContactPress={handleSharedContactPress}
      />
    );
  }, [handleImagePress, handleVideoPress, handleMessageLongPress, handleMediaDownload, getDownloadState, handleCancelUpload, handleRetryUpload, messages, scrollToMessage]);

  const renderEmptyState = () => (
    // Apply scaleY(-1) to counteract the FlatList's inverted prop
    <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}>
      {/* Icon */}
      <View style={styles.emptyIconWrapper}>
        <Icon name="message-text-outline" size={48} color={chatColors.primary} />
      </View>

      {/* Text content */}
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Send a template message to start{'\n'}the conversation with this contact
      </Text>

      {/* Template hint */}
      <View style={styles.emptyTemplateHint}>
        <Icon name="file-document-outline" size={18} color={chatColors.primary} />
        <Text style={styles.emptyTemplateText}>Tap the template icon below</Text>
      </View>
    </View>
  );


  // Custom header
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} />

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Icon name="arrow-left" size={24} color={colors.common.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerContent}
        onPress={() => navigation.navigate('ContactInfo', {
          contact,
          chatId,
          chat: currentConversation || chat,
        })}
      >
        <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(contactName) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(contactName)}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {contactName}
          </Text>
          <Text style={styles.headerStatus}>
            {contactPhoneNumber || 'tap for more info'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.headerAction} onPress={() => setShowChatOptions(true)}>
          <Icon name="dots-vertical" size={22} color={colors.common.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && !messages.length) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={chatColors.primary} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading conversation...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={0}
      >
        {/* Chat background with wallpaper */}
        <ImageBackground
          source={chatWallpaper}
          style={styles.chatContainer}
          resizeMode="cover"
        >
          {conversationError && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={16} color={colors.error.main} />
              <Text style={styles.errorText}>
                {typeof conversationError === 'string' ? conversationError : 'An error occurred'}
              </Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={groupedMessagesInverted}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            inverted
            extraData={[uploads, downloads]} // Ensure re-render on upload/download progress change
            contentContainerStyle={[
              styles.messagesList,
              groupedMessagesInverted.length === 0 && styles.emptyList,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            initialNumToRender={30}
            maxToRenderPerBatch={20}
            windowSize={21}
          />
        </ImageBackground>

        {/* Chat input - handles safe area internally */}
        <ChatInput
          onSendMessage={handleSendMessage}
          onSendTemplate={handleSendTemplate}
          onAttachmentPress={() => setShowAttachmentPicker(true)}
          onIntervene={handleIntervene}
          onStopAiAssistant={handleStopAiAssistant}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
          disabled={updateContactChatStatus === 'loading' || toggleAiAssistantStatus === 'loading'}
          isSending={isSending}
          quickReplies={quickReplies}
          templates={templates}
          chat={currentConversation || chat}
          chatId={chatId}
          chatStatus={chatStatus}
          aiAssistantStatus={aiAssistantStatus}
          isIntervened={isIntervened}
          lastActiveTime={lastActiveTime}
        />
      </KeyboardAvoidingView>

      {/* Attachment picker */}
      <AttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onSelect={handleAttachmentSelect}
      />

      {/* Message actions menu (long-press) */}
      <MessageActionsMenu
        visible={showMessageActions}
        onClose={() => setShowMessageActions(false)}
        message={selectedMessage}
        onAction={handleMessageAction}
        onReaction={handleReaction}
      />

      {/* Chat options menu (header dots) */}
      <ChatOptionsMenu
        visible={showChatOptions}
        onClose={() => setShowChatOptions(false)}
        chatId={chatId}
        chat={currentConversation || chat}
        onAction={handleChatOptionsAction}
      />

      {/* Chat notes modal */}
      <ChatNotes
        visible={showChatNotes}
        onClose={() => setShowChatNotes(false)}
        chatId={chatId}
      />

      {/* Image lightbox */}
      <ImageLightbox
        visible={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      {/* Video player modal */}
      <VideoPlayerModal
        visible={!!videoPlayerUrl}
        videoUrl={videoPlayerUrl}
        onClose={() => setVideoPlayerUrl(null)}
      />

      {/* Shared contact bottom sheet */}
      <Modal
        visible={showSharedContactSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSharedContactSheet(false)}
      >
        <View style={styles.contactSheetOverlay}>
          <TouchableOpacity
            style={styles.contactSheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowSharedContactSheet(false)}
          />
          <View style={styles.contactSheetContainer}>
            <View style={styles.contactSheetHandle} />
            {sharedContacts && sharedContacts.length > 0 && (
              <ScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={styles.contactSheetScrollContent}
                bounces
              >
                {sharedContacts.map((c, contactIdx) => (
                  <View
                    key={contactIdx}
                    style={styles.contactSheetSection}
                  >
                    <View style={styles.contactSheetContactHeaderRow}>
                      <View
                        style={[
                          styles.contactSheetContactAvatarSmall,
                          { backgroundColor: getAvatarColor(c.name) },
                        ]}
                      >
                        <Text style={styles.contactSheetAvatarText}>
                          {getInitials(c.name)}
                        </Text>
                      </View>
                      <View style={styles.contactSheetRowText}>
                        <Text style={styles.contactSheetContactName} numberOfLines={1}>
                          {c.name}
                        </Text>
                      </View>
                    </View>
                    {(c.phones || []).length > 0 ? (
                      c.phones.map((p, idx) => (
                        <View key={idx} style={styles.contactSheetRow}>
                          <View style={styles.contactSheetRowIcon}>
                            <Icon name="phone" size={18} color={chatColors.primary} />
                          </View>
                          <View style={styles.contactSheetRowText}>
                            <Text style={styles.contactSheetPhone}>
                              {p.phone || 'N/A'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.contactSheetEmptyText}>
                        No phone numbers in this contact.
                      </Text>
                    )}

                    {c.wa_id && (
                      <View style={styles.contactSheetRow}>
                        <View style={styles.contactSheetRowIcon}>
                          <Icon name="whatsapp" size={18} color="#25D366" />
                        </View>
                        <Text style={styles.contactSheetPhone}>{c.wa_id}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: chatColors.chatBg,
  },
  keyboardAvoid: {
    flex: 1,
  },
  // Header styles - WhatsApp teal
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatColors.headerBg,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  backButton: {
    padding: 10,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: colors.common.white,
    fontSize: 17,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.common.white,
  },
  headerStatus: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    padding: 10,
  },
  // Chat container - WhatsApp beige background
  chatContainer: {
    flex: 1,
    backgroundColor: chatColors.chatBg,
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: chatColors.chatBg,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${chatColors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  emptyTemplateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${chatColors.primary}10`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${chatColors.primary}20`,
  },
  emptyTemplateText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
  },
  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.lighter,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: {
    color: colors.error.main,
    fontSize: 13,
  },
  // Uploading message styles
  uploadingMessageContainer: {
    marginVertical: 2,
    marginHorizontal: 8,
    alignItems: 'flex-end',
  },
  uploadingBubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 2,
    backgroundColor: chatColors.outgoing, // Same as outgoing message bubble
  },
  uploadingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  uploadingTimestamp: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.45)', // Same as outgoing message timestamp
  },

  // Shared contact bottom sheet styles
  contactSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contactSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  contactSheetContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    height: '70%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  contactSheetScrollContent: {
    paddingBottom: 4,
  },
  contactSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[300],
    alignSelf: 'center',
    marginBottom: 12,
  },
  contactSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactSheetAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactSheetAvatarText: {
    color: colors.common.white,
    fontSize: 18,
    fontWeight: '600',
  },
  contactSheetHeaderInfo: {
    flex: 1,
  },
  contactSheetName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  contactSheetLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  contactSheetSection: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactSheetSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  contactSheetContactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  contactSheetSectionDivider: {
    // no explicit border; spacing handled by contactSheetSection margin
  },
  contactSheetContactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactSheetContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  contactSheetContactAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactSheetRowIcon: {
    width: 28,
    alignItems: 'center',
  },
  contactSheetRowText: {
    flex: 1,
  },
  contactSheetPhone: {
    fontSize: 15,
    color: colors.text.primary,
  },
  contactSheetPhoneLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  contactSheetEmptyText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
});
