import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, chatColors } from '../../theme/colors';
import EmojiPicker from './EmojiPicker';
import QuickRepliesDialog from './QuickRepliesDialog';
import TemplatePickerDialog from './TemplatePickerDialog';
import TemplatePreviewDialog from './TemplatePreviewDialog';
import { MessageStatus, formatWhatsAppMessage, getTimeLeftDisplay } from '../../utils/messageHelpers';

/**
 * ChatInput Component
 * Full-featured chat input with formatting, emoji, attachments, templates, and quick replies
 * Implements 24-hour window functionality and intervene button like web app
 */
const ChatInput = ({
  onSendMessage,
  onSendTemplate,
  onAttachmentPress,
  onIntervene,
  onStopAiAssistant,
  replyingTo,
  onCancelReply,
  disabled,
  isSending,
  quickReplies = [],
  templates = [],
  // Chat state from parent
  chat,
  chatId,
  chatStatus,
  aiAssistantStatus = false,
  isIntervened = false,
  lastActiveTime,
}) => {
  // State
  const [message, setMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);

  // Text formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);

  // File attachment state
  const [filePreview, setFilePreview] = useState(null);

  // Chat input disabled for audio files
  const [chatInputDisabled, setChatInputDisabled] = useState(false);

  // Refs
  const inputRef = useRef(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  // Calculate 24-hour window status
  const { isActive, hoursLeft } = useMemo(() => {
    return MessageStatus(lastActiveTime || chat?.contact?.lastActive);
  }, [lastActiveTime, chat?.contact?.lastActive]);

  // Determine if intervened state
  const intervened = useMemo(() => {
    return isIntervened || chatStatus === 'intervened';
  }, [isIntervened, chatStatus]);

  // Determine what to show based on chat state
  // Logic aligned with web app chat-message-input.jsx lines 631-681
  const showStopAiButton = aiAssistantStatus === true;
  // Show intervene button when: AI not active, within 24-hour window, not intervened
  // This matches web app behavior: !aiAssistantStatus && isActive && !intervene
  // When chatStatus is 'open' or any other non-intervened status, show intervene button
  const showInterveneButton = !showStopAiButton && isActive && !intervened;
  // Show template only when outside 24-hour window and not intervened
  const showSendTemplateOnly = !showStopAiButton && !isActive && !intervened;
  // Show normal chat input when intervened (or when AI is stopped and intervened)
  const showChatInput = !showStopAiButton && !showInterveneButton && !showSendTemplateOnly;

  const hasText = message.trim().length > 0;
  const hasFile = filePreview !== null;
  // canSend should be true when there's text OR a file, regardless of chatInputDisabled
  // chatInputDisabled only disables the text input for audio files, not the send button
  const canSend = (hasText || hasFile) && !disabled && !isSending;

  // Disable input for audio files
  useEffect(() => {
    if (filePreview?.fileType === 'audio') {
      setChatInputDisabled(true);
    } else {
      setChatInputDisabled(false);
    }
  }, [filePreview]);

  // Handle send message with WhatsApp formatting
  const handleSend = useCallback(() => {
    console.log('[ChatInput] handleSend called', { canSend, hasText, hasFile, filePreview, isSending, disabled });

    if (!canSend) {
      console.log('[ChatInput] handleSend: canSend is false, returning early');
      return;
    }

    // Animate send button
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Format message with WhatsApp markers
    const formattedMessage = formatWhatsAppMessage(message, {
      isBold,
      isItalic,
      isStrikethrough,
    });

    const messageData = {
      text: formattedMessage,
      file: filePreview,
      replyTo: replyingTo?.wamid || replyingTo?._id,
      // Include formatting flags for reference
      formatting: { isBold, isItalic, isStrikethrough },
    };

    console.log('[ChatInput] Calling onSendMessage with:', messageData);
    onSendMessage?.(messageData);

    // Reset state
    setMessage('');
    setInputHeight(44);
    setFilePreview(null);
    setIsBold(false);
    setIsItalic(false);
    setIsStrikethrough(false);
    Keyboard.dismiss();
  }, [canSend, message, filePreview, replyingTo, isBold, isItalic, isStrikethrough, onSendMessage, sendButtonScale]);

  // Handle text change with quick replies trigger
  const handleChangeText = useCallback((text) => {
    setMessage(text);

    // Trigger quick replies on "/" character
    if (text === '/' && quickReplies.length > 0) {
      setShowQuickReplies(true);
    }
  }, [quickReplies]);

  // Handle content size change for auto-growing input
  const handleContentSizeChange = useCallback((event) => {
    const height = event.nativeEvent.contentSize.height;
    const newHeight = Math.min(Math.max(44, height + 8), 140);
    setInputHeight(newHeight);
  }, []);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji) => {
    setMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  // Handle quick reply selection
  const handleQuickReplySelect = useCallback((quickReply) => {
    if (quickReply.type === 'text') {
      setMessage(quickReply.message || '');
    } else if (quickReply.headerFileURL || quickReply.file) {
      setFilePreview({
        fileName: quickReply.fileName || quickReply.file?.name || 'File',
        fileUrl: quickReply.headerFileURL || quickReply.file?.url,
        fileType: quickReply.type,
        fileSize: quickReply.file?.size,
      });
      if (quickReply.message) {
        setMessage(quickReply.message);
      }
    }
    setShowQuickReplies(false);
    inputRef.current?.focus();
  }, []);

  // Handle template selection from picker - show preview dialog
  const handleTemplateSelect = useCallback((template) => {
    setSelectedTemplate(template);
    setShowTemplatePicker(false);
    setShowTemplatePreview(true);
  }, []);

  // Handle sending template from preview dialog
  const handleSendTemplateFromPreview = useCallback((payload) => {
    // Support both payload structures:
    // 1. Regular templates: { template, bodyParams, ... }
    // 2. Carousel/special templates: { templateName, languageCode, row, ... }
    const {
      template,
      row,
      templateName: directTemplateName,
      languageCode: directLanguageCode,
      templateType: directTemplateType,
      bodyParams,
      headerParams,
      media,
      location,
      ltoFields,
      catalogProductId,
      copyCodeParam,
      urlVariables,
      carouselBodies,
      carouselFileData,
      carouselMediaType,
      isCarousel,
    } = payload;

    // Get template reference from either template or row property
    const actualTemplate = template || row;
    const resolvedType = directTemplateType || actualTemplate?.type;

    // Ensure bodyParams and headerParams are arrays
    const resolvedBodyParams = Array.isArray(bodyParams) ? bodyParams : Object.values(bodyParams || {});
    const resolvedHeaderParams = Array.isArray(headerParams) ? headerParams : Object.values(headerParams || {});

    console.log('[ChatInput] Processing template payload:', {
      hasTemplate: !!template,
      hasRow: !!row,
      bodyParamsType: Array.isArray(bodyParams) ? 'array' : typeof bodyParams,
      bodyParamsLength: resolvedBodyParams.length,
      bodyParamsValues: resolvedBodyParams,
    });

    // Prepare the template payload for the backend
    const templatePayload = {
      templateName: directTemplateName || actualTemplate?.name,
      languageCode: directLanguageCode || actualTemplate?.language,
      templateType: resolvedType,
      bodyParams: resolvedBodyParams,
      headerParams: resolvedHeaderParams,
      // Include both template and row for backwards compatibility
      template: actualTemplate,
      row: actualTemplate,
      // Include the full media object for easier access
      media,
    };

    // For media templates, also flatten file information for convenience
    const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];
    if (media && mediaTypes.includes(resolvedType?.toUpperCase())) {
      templatePayload.fileName = media.fileName;
      templatePayload.fileUrl = media.fileUrl || media.uri;
      templatePayload.mediaId = media.mediaId;
    }

    // Add location fields for location templates
    if (location) {
      templatePayload.location = location;
    }

    // Add LTO fields for limited time offer templates
    if (ltoFields) {
      templatePayload.ltoFields = ltoFields;
    }

    // Add catalog product ID for catalog templates
    if (catalogProductId) {
      templatePayload.catalogProductId = catalogProductId;
    }

    // Add copy code param for authentication templates
    if (copyCodeParam) {
      templatePayload.copyCodeParam = copyCodeParam;
    }

    // Add URL variables for dynamic URL buttons
    if (urlVariables && urlVariables.length > 0) {
      templatePayload.urlVariables = urlVariables;
    }

    // Add carousel-specific fields
    if (isCarousel) {
      templatePayload.isCarousel = true;
      templatePayload.carouselBodies = carouselBodies;
      templatePayload.carouselFileData = carouselFileData;
      templatePayload.carouselMediaType = carouselMediaType;
    }

    console.log('[ChatInput] Sending template payload:', templatePayload);
    onSendTemplate?.(templatePayload);
    setShowTemplatePreview(false);
    setSelectedTemplate(null);
  }, [onSendTemplate]);

  // Handle intervene button press
  const handleIntervene = useCallback(() => {
    Alert.alert(
      'Intervene',
      'This will disable AI replies and automation flow. Are you sure you want to take over this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Intervene',
          onPress: () => onIntervene?.(),
          style: 'default',
        },
      ]
    );
  }, [onIntervene]);

  // Handle stop AI assistant
  const handleStopAi = useCallback(() => {
    Alert.alert(
      'Stop AI Assistant',
      'Are you sure you want to stop the AI Assistant for this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          onPress: () => onStopAiAssistant?.(),
          style: 'destructive',
        },
      ]
    );
  }, [onStopAiAssistant]);

  // Toggle formatting
  const toggleBold = useCallback(() => {
    setIsBold((prev) => !prev);
  }, []);

  const toggleItalic = useCallback(() => {
    setIsItalic((prev) => !prev);
  }, []);

  const toggleStrikethrough = useCallback(() => {
    setIsStrikethrough((prev) => !prev);
  }, []);

  // Insert formatting marker around text
  const wrapWithMarker = useCallback((marker) => {
    setMessage((prev) => `${marker}${prev}${marker}`);
  }, []);

  // Helper to extract file extension from URI
  const getFileExtension = useCallback((uri) => {
    if (!uri) return '';
    // Try to get extension from URI path
    const uriParts = uri.split('.');
    const extension = uriParts[uriParts.length - 1]?.split('?')[0]?.toLowerCase();
    // Validate it's a reasonable extension
    if (extension && extension.length <= 5 && /^[a-z0-9]+$/.test(extension)) {
      return extension;
    }
    return '';
  }, []);

  // Helper to generate file name with proper extension
  const generateFileName = useCallback((type, uri, originalName) => {
    if (originalName && originalName !== 'Image' && originalName !== 'Video' && originalName !== 'Photo') {
      return originalName;
    }
    const timestamp = Date.now();
    const extension = getFileExtension(uri);

    switch (type) {
      case 'image':
        return `IMG_${timestamp}.${extension || 'jpg'}`;
      case 'video':
        return `VID_${timestamp}.${extension || 'mp4'}`;
      case 'audio':
        return `AUD_${timestamp}.${extension || 'm4a'}`;
      default:
        return `FILE_${timestamp}.${extension || 'bin'}`;
    }
  }, [getFileExtension]);

  // Handle image pick
  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        exif: false, // Don't need EXIF data, speeds up selection
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = generateFileName('image', asset.uri, asset.fileName);

        console.log('[ChatInput] Image selected:', {
          uri: asset.uri,
          fileName,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
        });

        setFilePreview({
          fileName,
          fileUrl: asset.uri,
          fileType: 'image',
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType || (asset.uri?.includes('.png') ? 'image/png' : 'image/jpeg'),
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
    setShowAttachmentOptions(false);
  }, [generateFileName]);

  // Handle camera capture
  const handleTakePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Permission to access camera is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = generateFileName('image', asset.uri, asset.fileName);

        console.log('[ChatInput] Photo captured:', {
          uri: asset.uri,
          fileName,
          fileSize: asset.fileSize,
        });

        setFilePreview({
          fileName,
          fileUrl: asset.uri,
          fileType: 'image',
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          mimeType: 'image/jpeg', // Camera photos are typically JPEG
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
    setShowAttachmentOptions(false);
  }, [generateFileName]);

  // Handle video pick
  const handlePickVideo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 120, // Max 2 minutes to avoid huge files
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = generateFileName('video', asset.uri, asset.fileName);

        console.log('[ChatInput] Video selected:', {
          uri: asset.uri,
          fileName,
          fileSize: asset.fileSize,
          duration: asset.duration,
        });

        setFilePreview({
          fileName,
          fileUrl: asset.uri,
          fileType: 'video',
          fileSize: asset.fileSize,
          duration: asset.duration,
          mimeType: asset.mimeType || 'video/mp4',
        });
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
    setShowAttachmentOptions(false);
  }, [generateFileName]);

  // Handle document pick
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      // Handle both old and new DocumentPicker response formats
      const doc = result.assets?.[0] || (result.type === 'success' ? result : null);

      if (doc && doc.uri) {
        const fileName = doc.name || generateFileName('document', doc.uri, null);

        console.log('[ChatInput] Document selected:', {
          uri: doc.uri,
          fileName,
          fileSize: doc.size,
          mimeType: doc.mimeType,
        });

        setFilePreview({
          fileName,
          fileUrl: doc.uri,
          fileType: 'document',
          fileSize: doc.size,
          mimeType: doc.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
    setShowAttachmentOptions(false);
  }, [generateFileName]);

  // Remove file preview
  const handleRemoveFile = useCallback(() => {
    setFilePreview(null);
    setChatInputDisabled(false);
  }, []);

  // Get reply preview text
  const getReplyPreviewText = useMemo(() => {
    if (!replyingTo) return '';

    const type = replyingTo.type || 'text';
    switch (type) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Voice message';
      case 'document':
        return '📄 Document';
      case 'sticker':
        return '🎨 Sticker';
      case 'location':
        return '📍 Location';
      case 'contact':
      case 'contacts':
        return '👤 Contact';
      case 'template':
        return '📋 Template';
      case 'interactive':
        return '🔘 Interactive';
      default:
        const text = replyingTo.message?.body?.text ||
                     replyingTo.message?.body ||
                     replyingTo.text ||
                     'Message';
        return typeof text === 'string' ? text.substring(0, 60) : 'Message';
    }
  }, [replyingTo]);

  // Get file icon based on type
  const getFileIcon = useCallback((type) => {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'microphone';
      case 'document':
      default:
        return 'file-document';
    }
  }, []);

  // Get file color based on type
  const getFileColor = useCallback((type) => {
    switch (type) {
      case 'image':
        return '#8E24AA';
      case 'video':
        return '#D32F2F';
      case 'audio':
        return '#FF6F00';
      case 'document':
      default:
        return '#5E35B1';
    }
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, []);

  // Get text style based on formatting state
  const textStyle = useMemo(() => ({
    fontWeight: isBold ? 'bold' : 'normal',
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecorationLine: isStrikethrough ? 'line-through' : 'none',
  }), [isBold, isItalic, isStrikethrough]);

  // Render Stop AI Assistant button
  if (showStopAiButton) {
    return (
      <View style={styles.container}>
        <View style={styles.actionButtonContainer}>
          <TouchableOpacity
            style={[styles.actionButtonLarge, styles.stopAiButton]}
            onPress={handleStopAi}
            activeOpacity={0.7}
          >
            <Icon name="stop-circle" size={20} color={colors.error.main} />
            <Text style={[styles.actionButtonText, { color: colors.error.main }]}>
              Stop AI Assistant
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Intervene button
  if (showInterveneButton) {
    return (
      <View style={styles.container}>
        <View style={styles.actionButtonContainer}>
          <Text style={styles.windowStatusText}>
            {isActive ? `${getTimeLeftDisplay(hoursLeft)} - ` : ''}
            Chat is being handled by automation
          </Text>
          <TouchableOpacity
            style={[styles.actionButtonLarge, styles.interveneButton]}
            onPress={handleIntervene}
            activeOpacity={0.7}
          >
            <Icon name="account-voice" size={20} color={chatColors.primary} />
            <Text style={[styles.actionButtonText, { color: chatColors.primary }]}>
              Intervene
            </Text>
          </TouchableOpacity>
          <Text style={styles.interveneHint}>
            Click to reply manually. AI and automation will be disabled.
          </Text>
        </View>
      </View>
    );
  }

  // Render Send Template only button (24-hour window expired)
  if (showSendTemplateOnly) {
    return (
      <View style={styles.container}>
        <View style={styles.actionButtonContainer}>
          <View style={styles.windowExpiredBanner}>
            <Icon name="clock-alert-outline" size={18} color={colors.warning.main} />
            <Text style={styles.windowExpiredText}>
              24-hour messaging window has expired
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButtonLarge, styles.sendTemplateButton]}
            onPress={() => setShowTemplatePicker(true)}
            activeOpacity={0.7}
          >
            <Icon name="file-document-outline" size={20} color={chatColors.primary} />
            <Text style={[styles.actionButtonText, { color: chatColors.primary }]}>
              Send Template
            </Text>
          </TouchableOpacity>
          <Text style={styles.templateHint}>
            You can only send approved templates outside the 24-hour window
          </Text>
        </View>

        {/* Template Picker Dialog */}
        <TemplatePickerDialog
          visible={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          templates={templates}
          onSelect={handleTemplateSelect}
        />

        {/* Template Preview Dialog - shows selected template with variable inputs */}
        <TemplatePreviewDialog
          visible={showTemplatePreview}
          onClose={() => {
            setShowTemplatePreview(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          onSend={handleSendTemplateFromPreview}
          isSending={isSending}
        />
      </View>
    );
  }

  // Render full chat input
  return (
    <View style={styles.container}>
      {/* Reply preview bar */}
      {replyingTo && (
        <View style={styles.replyPreview}>
          <View style={styles.replyBar} />
          <View style={styles.replyContent}>
            <Text style={styles.replyTitle}>
              {replyingTo.sentBy === 'user' ? 'You' : 'Replying to'}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {getReplyPreviewText}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.cancelReplyButton}>
            <Icon name="close" size={20} color={colors.grey[500]} />
          </TouchableOpacity>
        </View>
      )}

      {/* File preview */}
      {filePreview && (
        <View style={styles.filePreview}>
          {filePreview.fileType === 'image' ? (
            <Image
              source={{ uri: filePreview.fileUrl }}
              style={styles.filePreviewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.filePreviewIcon, { backgroundColor: getFileColor(filePreview.fileType) }]}>
              <Icon name={getFileIcon(filePreview.fileType)} size={24} color={colors.common.white} />
            </View>
          )}
          <View style={styles.filePreviewInfo}>
            <Text style={styles.filePreviewName} numberOfLines={1}>
              {filePreview.fileName}
            </Text>
            {filePreview.fileSize && (
              <Text style={styles.filePreviewSize}>
                {formatFileSize(filePreview.fileSize)}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleRemoveFile} style={styles.filePreviewRemove}>
            <Icon name="close-circle" size={22} color={colors.grey[500]} />
          </TouchableOpacity>
        </View>
      )}

      {/* Formatting toolbar */}
      {showFormattingToolbar && (
        <View style={styles.formattingToolbar}>
          <TouchableOpacity
            style={[styles.formatButton, isBold && styles.formatButtonActive]}
            onPress={toggleBold}
          >
            <Icon name="format-bold" size={20} color={isBold ? chatColors.primary : colors.grey[600]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatButton, isItalic && styles.formatButtonActive]}
            onPress={toggleItalic}
          >
            <Icon name="format-italic" size={20} color={isItalic ? chatColors.primary : colors.grey[600]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatButton, isStrikethrough && styles.formatButtonActive]}
            onPress={toggleStrikethrough}
          >
            <Icon name="format-strikethrough" size={20} color={isStrikethrough ? chatColors.primary : colors.grey[600]} />
          </TouchableOpacity>
          <View style={styles.formatDivider} />
          <TouchableOpacity
            style={styles.formatButton}
            onPress={() => wrapWithMarker('`')}
          >
            <Icon name="code-tags" size={20} color={colors.grey[600]} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row - WhatsApp style */}
      <View style={styles.inputRow}>
        {/* Text input container */}
        <View style={styles.inputContainer}>
          {/* Emoji button */}
          <TouchableOpacity
            style={styles.inputIconButton}
            onPress={() => setShowEmojiPicker(true)}
            disabled={disabled || chatInputDisabled}
          >
            <Icon
              name="emoticon-outline"
              size={26}
              color={disabled || chatInputDisabled ? colors.grey[400] : colors.grey[500]}
            />
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={[styles.input, { height: inputHeight }, textStyle]}
            placeholder="Type a message"
            placeholderTextColor={colors.grey[400]}
            value={message}
            onChangeText={handleChangeText}
            onContentSizeChange={handleContentSizeChange}
            multiline
            maxLength={4096}
            editable={!disabled && !chatInputDisabled}
          />

          {/* Template button - always visible when templates available */}
          {templates.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowTemplatePicker(true)}
              style={styles.inputIconButton}
              disabled={disabled}
            >
              <Icon
                name="file-document-outline"
                size={22}
                color={disabled ? colors.grey[400] : chatColors.primary}
              />
            </TouchableOpacity>
          )}

          {/* Attachment button (inside input, right side) */}
          <TouchableOpacity
            onPress={() => setShowAttachmentOptions(true)}
            style={styles.inputIconButton}
            disabled={disabled || chatInputDisabled}
          >
            <Icon
              name="paperclip"
              size={24}
              color={disabled || chatInputDisabled ? colors.grey[400] : colors.grey[500]}
              style={{ transform: [{ rotate: '-45deg' }] }}
            />
          </TouchableOpacity>

          {/* Camera (when no text and no file) */}
          {!hasText && !hasFile && !templates.length && (
            <TouchableOpacity
              style={styles.inputIconButton}
              onPress={handleTakePhoto}
              disabled={disabled || chatInputDisabled}
            >
              <Icon
                name="camera"
                size={24}
                color={disabled || chatInputDisabled ? colors.grey[400] : colors.grey[500]}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Send button - always visible when there's content to send */}
        <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
          <TouchableOpacity
            onPress={(hasText || hasFile) ? handleSend : () => setShowAttachmentOptions(true)}
            style={[
              styles.sendButton,
              (hasText || hasFile) ? styles.sendButtonActive : styles.micButton,
            ]}
            disabled={(hasText || hasFile) ? (!canSend || isSending) : disabled}
          >
            <Icon
              name={(hasText || hasFile) ? "send" : "microphone"}
              size={(hasText || hasFile) ? 22 : 24}
              color={colors.common.white}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
      />

      {/* Quick Replies Dialog */}
      <QuickRepliesDialog
        visible={showQuickReplies}
        onClose={() => setShowQuickReplies(false)}
        quickReplies={quickReplies}
        onSelect={handleQuickReplySelect}
        searchText={message.startsWith('/') ? message.substring(1) : ''}
      />

      {/* Template Picker Dialog */}
      <TemplatePickerDialog
        visible={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        templates={templates}
        onSelect={handleTemplateSelect}
      />

      {/* Template Preview Dialog - shows selected template with variable inputs */}
      <TemplatePreviewDialog
        visible={showTemplatePreview}
        onClose={() => {
          setShowTemplatePreview(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onSend={handleSendTemplateFromPreview}
        isSending={isSending}
      />

      {/* Attachment Options Modal */}
      <Modal
        visible={showAttachmentOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentOptions(false)}
      >
        <TouchableOpacity
          style={styles.attachmentOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentOptions(false)}
        >
          <View style={styles.attachmentContainer}>
            <View style={styles.attachmentHandle} />
            <View style={styles.attachmentGrid}>
              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickDocument}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#5E35B1' }]}>
                  <Icon name="file-document" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handleTakePhoto}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#D32F2F' }]}>
                  <Icon name="camera" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#8E24AA' }]}>
                  <Icon name="image" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickVideo}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#D32F2F' }]}>
                  <Icon name="video" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={() => setShowAttachmentOptions(false)}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#FF6F00' }]}>
                  <Icon name="headphones" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Audio</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={() => setShowAttachmentOptions(false)}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#43A047' }]}>
                  <Icon name="map-marker" size={24} color={colors.common.white} />
                </View>
                <Text style={styles.attachmentLabel}>Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: chatColors.inputBg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  // Action button container (for intervene, stop AI, send template)
  actionButtonContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  stopAiButton: {
    borderColor: colors.error.main,
    backgroundColor: colors.error.lighter,
  },
  interveneButton: {
    borderColor: chatColors.primary,
    backgroundColor: `${chatColors.primary}10`,
  },
  sendTemplateButton: {
    borderColor: chatColors.primary,
    backgroundColor: `${chatColors.primary}10`,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  windowStatusText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  interveneHint: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  windowExpiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning.lighter,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  windowExpiredText: {
    fontSize: 12,
    color: colors.warning.dark,
    fontWeight: '500',
  },
  templateHint: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Reply preview styles
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  replyBar: {
    width: 4,
    height: '100%',
    minHeight: 36,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  replyContent: {
    flex: 1,
  },
  replyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: chatColors.primary,
  },
  replyText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cancelReplyButton: {
    padding: 8,
  },

  // File preview styles
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  filePreviewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  filePreviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filePreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  filePreviewName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  filePreviewSize: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  filePreviewRemove: {
    padding: 4,
  },

  // Formatting toolbar styles
  formattingToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  formatButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  formatButtonActive: {
    backgroundColor: `${chatColors.primary}15`,
  },
  formatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
    marginHorizontal: 8,
  },

  // Input row styles - WhatsApp style
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.common.white,
    borderRadius: 25,
    paddingHorizontal: 6,
    minHeight: 50,
  },
  inputIconButton: {
    width: 40,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: colors.text.primary,
    paddingVertical: 12,
    paddingHorizontal: 4,
    maxHeight: 140,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  sendButtonActive: {
    backgroundColor: chatColors.accent,
  },
  micButton: {
    backgroundColor: chatColors.accent,
  },

  // Attachment modal styles
  attachmentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  attachmentHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    width: '33%',
    marginBottom: 24,
  },
  attachmentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});

export default ChatInput;
