import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
  fetchConversation,
  resetUnreadCount,
  updateContactChat,
  toggleAiAssistant,
  setChatStatus,
  setAiAssistantStatus,
  sendMessageReaction,
} from '../redux/slices/inboxSlice';
import { fetchAllTemplates } from '../redux/slices/templateSlice';
import { getSettings } from '../redux/slices/settingsSlice';
import { sendMessageViaSocket, resetUnreadCountViaSocket, sendTemplateViaSocket } from '../services/socketService';
import { uploadFileWithProgress, validateFileSize } from '../services/fileUploadService';
import useUploadState from '../hooks/useUploadState';
import { colors, chatColors, getAvatarColor } from '../theme/colors';
import { useSocket } from '../contexts/SocketContext';
import MessageBubble from '../components/chat/MessageBubble';
import ChatInput from '../components/chat/ChatInput';
import AttachmentPicker from '../components/chat/AttachmentPicker';
import DateSeparator from '../components/chat/DateSeparator';
import MessageActionsMenu from '../components/chat/MessageActionsMenu';
import ChatOptionsMenu from '../components/chat/ChatOptionsMenu';
import ImageLightbox from '../components/chat/ImageLightbox';
import ChatNotes from '../components/chat/ChatNotes';
import UploadingMediaMessage from '../components/chat/messages/UploadingMediaMessage';

export default function ChatDetailsScreen({ route, navigation }) {
  const { chatId, chat } = route.params;
  const dispatch = useDispatch();
  const flatListRef = useRef(null);
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

  // Upload state management for WhatsApp-style progress UI
  const {
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

  const {
    currentConversation,
    conversationStatus,
    conversationError,
    sendMessageStatus,
    chatStatus: reduxChatStatus,
    aiAssistantStatus: reduxAiAssistantStatus,
    updateContactChatStatus,
    toggleAiAssistantStatus,
  } = useSelector((state) => state.inbox);

  // Get templates from redux store
  const { templates } = useSelector((state) => state.template);

  // Get quick replies from settings
  const { settings } = useSelector((state) => state.settings);
  const quickReplies = settings?.quickReplies?.items || [];

  const isLoading = conversationStatus === 'loading';
  const messages = currentConversation?.messages || [];
  const contact = currentConversation?.contact || chat?.contact || {};
  // Get phone number from multiple possible locations (API may return it differently)
  // Web app uses contact.mobile, so check that field first
  const contactPhoneNumber = contact.mobile || contact.phoneNumber || contact.phone_number ||
    currentConversation?.phoneNumber || currentConversation?.phone_number ||
    chat?.phoneNumber || chat?.phone_number || '';
  const contactName = contact.name || contactPhoneNumber || 'Unknown';

  // Debug log to see what phone number we're getting
  console.log('[ChatDetails] Contact phone number:', {
    mobile: contact.mobile,
    phoneNumber: contact.phoneNumber,
    phone_number: contact.phone_number,
    resolved: contactPhoneNumber,
  });

  // Get chat status and AI assistant status from conversation or redux
  const chatStatus = currentConversation?.status || reduxChatStatus || chat?.status || 'open';
  const aiAssistantStatus = currentConversation?.aiAssistant?.isActive || reduxAiAssistantStatus || false;
  const isIntervened = chatStatus === 'intervened';
  const lastActiveTime = contact?.lastActive || currentConversation?.lastActive || chat?.lastActive;

  useEffect(() => {
    if (chatId) {
      dispatch(fetchConversation(chatId));
      // Reset unread count
      dispatch(resetUnreadCount(chatId));
      resetUnreadCountViaSocket(chatId);
      // Set current chat ID to prevent notifications for this chat
      setCurrentChatId(chatId);
    }

    // Fetch templates and quick replies if not already loaded
    dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
    dispatch(getSettings('quickReplies'));

    // Clear current chat ID when leaving the screen
    return () => {
      setCurrentChatId(null);
    };
  }, [chatId, dispatch, setCurrentChatId]);

  useEffect(() => {
    if (sendMessageStatus === 'succeeded') {
      setIsSending(false);
      setReplyingTo(null);
      dispatch(fetchConversation(chatId));
    } else if (sendMessageStatus === 'failed') {
      setIsSending(false);
    }
  }, [sendMessageStatus, chatId, dispatch]);

  // Group messages by date and include pending uploads
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    const usedIds = new Set();

    // Process regular messages
    if (messages.length) {
      messages.forEach((message, index) => {
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

  const handleSendMessage = useCallback(async (messageData) => {
    console.log('[ChatDetails] handleSendMessage called with:', messageData);

    // Handle both string (old) and object (new) message format
    const text = typeof messageData === 'string' ? messageData : messageData?.text;
    const file = typeof messageData === 'object' ? messageData?.file : null;
    const replyTo = typeof messageData === 'object' ? messageData?.replyTo : replyingTo?.wamid;

    console.log('[ChatDetails] Parsed values:', { text, file, replyTo, isSending });

    if ((!text?.trim() && !file) || isSending) {
      console.log('[ChatDetails] Returning early:', { noTextAndNoFile: !text?.trim() && !file, isSending });
      return;
    }

    setIsSending(true);

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
            Alert.alert('File Too Large', validation.message);
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
            console.log('[ChatDetails] Uploading file with progress...', {
              fileName: file.fileName,
              fileUrl: file.fileUrl,
              fileType: file.fileType,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
            });

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
              console.log('[ChatDetails] File uploaded successfully:', uploadedFileUrl);
              // Complete the upload (remove from UI state)
              completeUpload(uploadTempId);
            } else {
              console.error('[ChatDetails] Upload response missing URL:', uploadResult);
              throw new Error('Upload succeeded but no URL was returned');
            }
          } catch (uploadError) {
            console.error('[ChatDetails] File upload error:', uploadError);

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

      const socketData = {
        to: contactPhoneNumber,  // Backend expects 'to' field, not 'phoneNumber'
        type: uploadedFileUrl ? getMessageType(file.fileType) : 'text',
        chatId,
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

      console.log('[ChatDetails] Sending message via socket:', socketData);
      const sent = sendMessageViaSocket(socketData);
      if (sent) {
        // Message was sent successfully via socket
        console.log('[ChatDetails] Message sent successfully via socket');
        setIsSending(false);
        setReplyingTo(null);
        // Refresh conversation to show the new message
        dispatch(fetchConversation(chatId));
      } else {
        Alert.alert('Send Failed', 'Could not send message. Please check your connection.');
        setIsSending(false);
      }
    } catch (error) {
      console.error('[ChatDetails] Send message error:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
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
        const uploadData = completeUpload(tempId);

        // Send the message via socket
        const getMessageType = (fileType) => {
          if (!fileType) return 'document';
          const type = fileType.toLowerCase();
          if (type.includes('image')) return 'image';
          if (type.includes('video')) return 'video';
          if (type.includes('audio')) return 'audio';
          return 'document';
        };

        const socketData = {
          to: contactPhoneNumber,
          type: getMessageType(file.fileType),
          chatId,
          caption: file.caption || '',
          link: uploadResult.url,
          filename: uploadResult.fileName || file.fileName,
        };

        const sent = sendMessageViaSocket(socketData);
        if (sent) {
          dispatch(fetchConversation(chatId));
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

  // Handle template send - now receives template with bodyParams and headerParams from preview dialog
  const handleSendTemplate = useCallback(async (templateWithParams) => {
    if (!templateWithParams || isSending) return;

    setIsSending(true);

    // Extract the template object (may have bodyParams and headerParams attached)
    const template = templateWithParams;
    const bodyParams = template.bodyParams || [];
    const headerParams = template.headerParams || [];

    // Extract header component to check for media
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    const hasMediaHeader = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format);

    const templateData = {
      to: contactPhoneNumber,
      chatId,
      templateName: template.name,
      templateId: template._id,
      language: template.language || 'en',
      bodyParams: bodyParams,
      headerParams: headerParams,
      ...(replyingTo && { replyToWamid: replyingTo.wamid }),
      // If template has media header and user provided a link, include it
      ...(hasMediaHeader && template.headerMediaUrl && {
        link: template.headerMediaUrl,
        filename: template.headerMediaFilename,
      }),
    };

    console.log('[ChatDetails] Sending template:', templateData);

    // Use specialized template socket method
    const sent = sendTemplateViaSocket(templateData);

    if (sent) {
      // Clear replying state on success
      setReplyingTo(null);
    } else {
      setIsSending(false);
      Alert.alert('Error', 'Failed to send template. Please try again.');
    }
  }, [chatId, contactPhoneNumber, isSending, replyingTo]);

  // Handle intervene - take over conversation from AI/automation
  const handleIntervene = useCallback(async () => {
    try {
      const result = await dispatch(updateContactChat({
        id: chatId,
        status: 'intervened',
      })).unwrap();

      // Update local state
      dispatch(setChatStatus('intervened'));
      Alert.alert('Success', 'You have taken over this conversation. AI and automation are now disabled.');
    } catch (error) {
      Alert.alert('Error', error || 'Failed to intervene. Please try again.');
    }
  }, [chatId, dispatch]);

  // Handle stop AI assistant
  const handleStopAiAssistant = useCallback(async () => {
    try {
      const assistantId = currentConversation?.aiAssistant?.assistantId;

      const result = await dispatch(toggleAiAssistant({
        chatId,
        assistantId,
        isActive: false,
      })).unwrap();

      // Update local state
      dispatch(setAiAssistantStatus(false));

      // Also update chat status to intervened
      await dispatch(updateContactChat({
        id: chatId,
        status: 'intervened',
      })).unwrap();

      dispatch(setChatStatus('intervened'));
      Alert.alert('Success', 'AI Assistant has been stopped for this conversation.');
    } catch (error) {
      Alert.alert('Error', error || 'Failed to stop AI Assistant. Please try again.');
    }
  }, [chatId, currentConversation, dispatch]);

  const handleAttachmentSelect = useCallback((type) => {
    console.log('Attachment selected:', type);
    // TODO: Implement attachment handling
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Handle image press - open lightbox
  const handleImagePress = useCallback((imageUrl) => {
    setLightboxImage(imageUrl);
  }, []);

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
        Alert.alert('Forward', 'Forward functionality coming soon');
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
      Alert.alert('Error', 'Failed to send reaction');
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
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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
              <Icon name="clock-outline" size={14} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        </View>
      );
    }

    return (
      <MessageBubble
        message={item.data}
        onImagePress={handleImagePress}
        onLongPress={handleMessageLongPress}
        onReplyPress={(messageId) => {
          // Scroll to replied message
        }}
      />
    );
  }, [handleImagePress, handleMessageLongPress, handleCancelUpload, handleRetryUpload]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="message-text-outline" size={60} color={colors.grey[300]} />
      <Text variant="bodyLarge" style={styles.emptyText}>
        No messages yet. Start the conversation!
      </Text>
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
        {/* Chat background */}
        <View style={styles.chatContainer}>
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
            data={groupedMessages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesList,
              groupedMessages.length === 0 && styles.emptyList,
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (groupedMessages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onLayout={() => {
              if (groupedMessages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={renderEmptyState}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={15}
          />
        </View>

        {/* Chat input */}
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

        {/* Safe area bottom padding */}
        <View style={{ height: insets.bottom, backgroundColor: chatColors.inputBg }} />
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
    paddingHorizontal: 32,
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 16,
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
    borderRadius: 16,
    borderBottomRightRadius: 4,
    backgroundColor: chatColors.primary,
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
    color: 'rgba(255,255,255,0.7)',
  },
});
