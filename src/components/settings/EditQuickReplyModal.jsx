import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, chatColors } from '../../theme/colors';
import { uploadFile, validateFileSize } from '../../services/fileUploadService';
import { showError, showWarning } from '../../utils/toast';
import { CustomDialog } from '../common';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Message type configurations
const MESSAGE_TYPES = {
  text: { label: 'Text', icon: 'message-text', color: '#9E9E9E', bg: '#F5F5F5' },
  image: { label: 'Image', icon: 'image', color: '#2196F3', bg: '#E3F2FD' },
  video: { label: 'Video', icon: 'video', color: '#9C27B0', bg: '#F3E5F5' },
  audio: { label: 'Audio', icon: 'microphone', color: '#3F51B5', bg: '#E8EAF6' },
  file: { label: 'File', icon: 'file-document', color: '#FF9800', bg: '#FFF3E0' },
};

const EditQuickReplyModal = ({
  visible,
  onClose,
  onSave,
  isSaving,
  showSnackbar,
  replyToEdit,
}) => {
  // Form state
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [headerFileURL, setHeaderFileURL] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [fileSize, setFileSize] = useState('');
  const [showRemoveMediaDialog, setShowRemoveMediaDialog] = useState(false);

  // Scroll handling for bottom sheet
  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Initialize form with reply data when modal opens
  useEffect(() => {
    if (visible && replyToEdit) {
      setShortcut(replyToEdit.shortcut || '');
      setMessage(replyToEdit.message || '');
      setMessageType(replyToEdit.type || 'text');
      setHeaderFileURL(replyToEdit.headerFileURL || '');
      setFileName(replyToEdit.fileName || '');
      setSelectedFile(null);
      setScrollOffset(0);
      setShowTypeSelector(false);
      // Initialize uploadedMedia if there's existing media
      if (replyToEdit.headerFileURL && replyToEdit.type !== 'text') {
        setUploadedMedia({
          uri: replyToEdit.headerFileURL,
          type: replyToEdit.type,
          fileName: replyToEdit.fileName || '',
          fileUrl: replyToEdit.headerFileURL,
        });
        setFileSize('');
      } else {
        setUploadedMedia(null);
        setFileSize('');
      }
    }
  }, [visible, replyToEdit]);

  const handleScrollTo = (p) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo(p);
    }
  };

  const handleOnScroll = (event) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  const resetForm = useCallback(() => {
    setShortcut('');
    setMessage('');
    setMessageType('text');
    setHeaderFileURL('');
    setFileName('');
    setSelectedFile(null);
    setScrollOffset(0);
    setShowTypeSelector(false);
    setUploadedMedia(null);
    setFileSize('');
  }, []);

  const handleClose = () => {
    if (!isSaving) {
      resetForm();
      onClose();
    }
  };

  // Handle image picker - matches TemplatePreviewDialog
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Please allow access to your photo library to upload images.', 'Permission Required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size (max 5MB for images)
        if (asset.fileSize) {
          const validation = validateFileSize(asset.fileSize, 'image');
          if (!validation.valid) {
            showWarning(validation.message, 'File Too Large');
            return;
          }
        }

        const localMedia = {
          uri: asset.uri,
          type: 'image',
          fileName: asset.fileName || `IMG_${Date.now()}.jpg`,
          fileSize: asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setSelectedFile(asset);
        setHeaderFileURL(asset.uri);
        setFileName(localMedia.fileName);
        setFileSize(localMedia.fileSize);
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploading(true);
        try {
          const uploadResult = await uploadFile({
            uri: asset.uri,
            fileName: localMedia.fileName,
            fileType: 'image',
            mimeType: asset.mimeType || 'image/jpeg',
            fileSize: asset.fileSize,
          });

          // Update with server URL
          setHeaderFileURL(uploadResult.url);
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload image:', uploadError);
          showError('Failed to upload image to server. Please try again.', 'Upload Failed');
          handleClearFile();
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      showError('Failed to pick image. Please try again.');
      // Error:('Image picker error:', error);
    }
  }, []);

  // Handle video picker - matches TemplatePreviewDialog
  const handlePickVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Please allow access to your photo library to upload videos.', 'Permission Required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 120, // 2 minutes max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size (max 16MB for videos)
        if (asset.fileSize) {
          const validation = validateFileSize(asset.fileSize, 'video');
          if (!validation.valid) {
            showWarning(validation.message, 'File Too Large');
            return;
          }
        }

        const localMedia = {
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `VID_${Date.now()}.mp4`,
          fileSize: asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setSelectedFile(asset);
        setHeaderFileURL(asset.uri);
        setFileName(localMedia.fileName);
        setFileSize(localMedia.fileSize);
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploading(true);
        try {
          const uploadResult = await uploadFile({
            uri: asset.uri,
            fileName: localMedia.fileName,
            fileType: 'video',
            mimeType: asset.mimeType || 'video/mp4',
            fileSize: asset.fileSize,
          });

          // Update with server URL
          setHeaderFileURL(uploadResult.url);
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload video:', uploadError);
          showError('Failed to upload video to server. Please try again.', 'Upload Failed');
          handleClearFile();
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      showError('Failed to pick video. Please try again.');
      // Error:('Video picker error:', error);
    }
  }, []);

  // Handle audio picker
  const handlePickAudio = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      const doc = result.assets?.[0] || (result.type === 'success' ? result : null);

      if (doc && doc.uri) {
        // Check file size (max 16MB for audio)
        if (doc.size) {
          const validation = validateFileSize(doc.size, 'audio');
          if (!validation.valid) {
            showWarning(validation.message, 'File Too Large');
            return;
          }
        }

        const localMedia = {
          uri: doc.uri,
          type: 'audio',
          fileName: doc.name || `AUD_${Date.now()}.mp3`,
          fileSize: doc.size ? (doc.size / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setSelectedFile(doc);
        setHeaderFileURL(doc.uri);
        setFileName(localMedia.fileName);
        setFileSize(localMedia.fileSize);
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploading(true);
        try {
          const uploadResult = await uploadFile({
            uri: doc.uri,
            fileName: localMedia.fileName,
            fileType: 'audio',
            mimeType: doc.mimeType || 'audio/mpeg',
            fileSize: doc.size,
          });

          // Update with server URL
          setHeaderFileURL(uploadResult.url);
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload audio:', uploadError);
          showError('Failed to upload audio to server. Please try again.', 'Upload Failed');
          handleClearFile();
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      showError('Failed to pick audio. Please try again.');
      // Error:('Audio picker error:', error);
    }
  }, []);

  // Handle document picker
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      const doc = result.assets?.[0] || (result.type === 'success' ? result : null);

      if (doc && doc.uri) {
        // Check file size (max 100MB for documents)
        if (doc.size) {
          const validation = validateFileSize(doc.size, 'document');
          if (!validation.valid) {
            showWarning(validation.message, 'File Too Large');
            return;
          }
        }

        const localMedia = {
          uri: doc.uri,
          type: 'document',
          fileName: doc.name || `DOC_${Date.now()}.pdf`,
          fileSize: doc.size ? (doc.size / (1024 * 1024)).toFixed(2) : '0',
        };

        // Set local preview immediately
        setSelectedFile(doc);
        setHeaderFileURL(doc.uri);
        setFileName(localMedia.fileName);
        setFileSize(localMedia.fileSize);
        setUploadedMedia(localMedia);

        // Upload to server in background
        setIsUploading(true);
        try {
          const uploadResult = await uploadFile({
            uri: doc.uri,
            fileName: localMedia.fileName,
            fileType: 'document',
            mimeType: doc.mimeType || 'application/pdf',
            fileSize: doc.size,
          });

          // Update with server URL
          setHeaderFileURL(uploadResult.url);
          setUploadedMedia({
            ...localMedia,
            fileUrl: uploadResult.url,
            mediaId: uploadResult.fileId,
          });
        } catch (uploadError) {
          // Error:('Failed to upload document:', uploadError);
          showError('Failed to upload document to server. Please try again.', 'Upload Failed');
          handleClearFile();
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      showError('Failed to pick document. Please try again.');
      // Error:('Document picker error:', error);
    }
  }, []);

  // Handle media upload based on type
  const handlePickFile = useCallback(() => {
    if (messageType === 'image') {
      handlePickImage();
    } else if (messageType === 'video') {
      handlePickVideo();
    } else if (messageType === 'audio') {
      handlePickAudio();
    } else if (messageType === 'file') {
      handlePickDocument();
    }
  }, [messageType, handlePickImage, handlePickVideo, handlePickAudio, handlePickDocument]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setHeaderFileURL('');
    setFileName('');
    setFileSize('');
    setUploadedMedia(null);
  }, []);

  // Handle remove media with confirmation
  const handleRemoveMedia = useCallback(() => {
    setShowRemoveMediaDialog(true);
  }, []);

  // Confirm remove media
  const confirmRemoveMedia = useCallback(() => {
    handleClearFile();
    setShowRemoveMediaDialog(false);
  }, [handleClearFile]);

  const handleSave = async () => {
    const trimmedShortcut = shortcut.trim();

    if (!trimmedShortcut) {
      showSnackbar?.('Shortcut is required');
      return;
    }

    if (/\s/.test(trimmedShortcut)) {
      showSnackbar?.('Shortcut cannot contain spaces');
      return;
    }

    if (messageType === 'text' && !message.trim()) {
      showSnackbar?.('Message is required for text type');
      return;
    }

    if (messageType !== 'text' && !headerFileURL) {
      showSnackbar?.('Please select a file or enter a URL');
      return;
    }

    const replyData = {
      _id: replyToEdit?._id,
      shortcut: trimmedShortcut,
      type: messageType,
      message: message.trim(),
      ...(messageType !== 'text' && headerFileURL && { headerFileURL }),
      ...(messageType !== 'text' && fileName && { fileName }),
    };

    const success = await onSave?.(replyData);
    if (success) {
      resetForm();
    }
  };

  const getTypeConfig = (type) => {
    return MESSAGE_TYPES[type] || MESSAGE_TYPES.text;
  };

  const typeConfig = getTypeConfig(messageType);

  return (
    <>
    <Modal
        isVisible={visible}
        onBackdropPress={handleClose}
        onSwipeComplete={handleClose}
        swipeDirection={isSaving ? [] : ['down']}
        style={styles.bottomModal}
        propagateSwipe={true}
        scrollTo={handleScrollTo}
        scrollOffset={scrollOffset}
        scrollOffsetMax={400}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        avoidKeyboard={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.formSheet}>
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.formHeader}>
              <View style={styles.formHeaderLeft}>
                <View style={styles.formHeaderIconEdit}>
                  <Icon name="pencil" size={24} color={colors.warning.dark} />
                </View>
                <View>
                  <Text style={styles.formHeaderTitle}>Edit Quick Reply</Text>
                  <Text style={styles.formHeaderSubtitle}>Update your quick reply details</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.formCloseBtn}
                disabled={isSaving}
              >
                <Icon name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              onScroll={handleOnScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {/* Shortcut Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Icon name="slash-forward" size={18} color={colors.primary.main} />
                  <Text style={styles.formLabel}>
                    Shortcut <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                <View style={styles.shortcutInputContainer}>
                  <View style={styles.shortcutPrefixBox}>
                    <Text style={styles.shortcutPrefix}>/</Text>
                  </View>
                  <RNTextInput
                    value={shortcut}
                    onChangeText={(text) => setShortcut(text.replace(/\s/g, ''))}
                    placeholder="hello, thanks, welcome"
                    placeholderTextColor={colors.text.tertiary}
                    style={styles.shortcutInput}
                    editable={!isSaving}
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.formHint}>
                  Type "/" followed by this shortcut in chat to insert the reply.
                </Text>
              </View>

              {/* Message Type */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Icon name="format-list-bulleted-type" size={18} color={colors.primary.main} />
                  <Text style={styles.formLabel}>Message Type</Text>
                </View>
                <TouchableOpacity
                  style={styles.typeSelectorBtn}
                  onPress={() => setShowTypeSelector(!showTypeSelector)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <View style={[styles.typeSelectorIcon, { backgroundColor: typeConfig.bg }]}>
                    <Icon name={typeConfig.icon} size={20} color={typeConfig.color} />
                  </View>
                  <Text style={styles.typeSelectorBtnText}>{typeConfig.label}</Text>
                  <Icon name={showTypeSelector ? "chevron-up" : "chevron-down"} size={22} color={colors.text.tertiary} />
                </TouchableOpacity>

                {/* Inline Type Options */}
                {showTypeSelector && (
                  <View style={styles.typeOptionsContainer}>
                    {Object.entries(MESSAGE_TYPES).map(([key, config]) => (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.typeOption,
                          messageType === key && { backgroundColor: config.bg, borderColor: config.color },
                        ]}
                        onPress={() => {
                          if (key !== messageType) {
                            setHeaderFileURL('');
                            setFileName('');
                            setSelectedFile(null);
                          }
                          setMessageType(key);
                          setShowTypeSelector(false);
                        }}
                      >
                        <View style={[styles.typeOptionIcon, { backgroundColor: config.bg }]}>
                          <Icon name={config.icon} size={24} color={config.color} />
                        </View>
                        <Text style={[
                          styles.typeOptionText,
                          messageType === key && { color: config.color, fontWeight: '600' },
                        ]}>
                          {config.label}
                        </Text>
                        {messageType === key && (
                          <Icon name="check-circle" size={18} color={config.color} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Message Input */}
              {(messageType === 'text' || messageType === 'image' || messageType === 'video') && (
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="message-text-outline" size={18} color={colors.primary.main} />
                    <Text style={styles.formLabel}>
                      {messageType === 'text' ? 'Message' : 'Caption'}
                      {messageType === 'text' && <Text style={styles.required}> *</Text>}
                    </Text>
                    {messageType !== 'text' && (
                      <View style={styles.optionalBadge}>
                        <Text style={styles.optionalText}>Optional</Text>
                      </View>
                    )}
                  </View>
                  <RNTextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Type your message here..."
                    placeholderTextColor={colors.text.tertiary}
                    style={styles.messageInput}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!isSaving}
                  />
                  <Text style={styles.formHint}>
                    Use *bold* and _italic_ for text formatting.
                  </Text>
                </View>
              )}

              {/* File Upload Section */}
              {messageType !== 'text' && (
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="cloud-upload-outline" size={18} color={colors.primary.main} />
                    <Text style={styles.formLabel}>
                      Upload {typeConfig.label} <Text style={styles.required}>*</Text>
                    </Text>
                  </View>

                  {/* URL Input */}
                  <View style={styles.urlInputContainer}>
                    <Icon name="link" size={20} color={colors.text.tertiary} style={styles.urlInputIcon} />
                    <RNTextInput
                      value={headerFileURL}
                      onChangeText={setHeaderFileURL}
                      placeholder={`Paste ${typeConfig.label.toLowerCase()} URL here`}
                      placeholderTextColor={colors.text.tertiary}
                      style={styles.urlInput}
                      editable={!isSaving && !selectedFile}
                    />
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Upload Button - only show when no file selected */}
                  {!selectedFile && !uploadedMedia ? (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={handlePickFile}
                      disabled={isSaving || isUploading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.uploadButtonIcon}>
                        <Icon
                          name={
                            messageType === 'image' ? 'image-plus' :
                            messageType === 'video' ? 'video-plus' :
                            messageType === 'audio' ? 'microphone-plus' :
                            'file-upload'
                          }
                          size={24}
                          color={chatColors.primary}
                        />
                      </View>
                      <Text style={styles.uploadButtonText}>
                        Upload {typeConfig.label}
                      </Text>
                      <Text style={styles.uploadButtonSubtext}>
                        {messageType === 'image' && 'JPG, PNG, GIF up to 5MB'}
                        {messageType === 'video' && 'MP4, MOV up to 16MB'}
                        {messageType === 'audio' && 'MP3, WAV, OGG up to 16MB'}
                        {messageType === 'file' && 'PDF, DOC, XLS up to 100MB'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* File Preview Card - matches TemplatePreviewDialog style */}
                  {(selectedFile || uploadedMedia) && (
                    <View style={styles.uploadedMediaContainer}>
                      <View style={styles.uploadedMediaInfo}>
                        <View style={[styles.mediaTypeIcon, { backgroundColor: typeConfig.bg }]}>
                          {isUploading ? (
                            <ActivityIndicator size="small" color={typeConfig.color} />
                          ) : messageType === 'image' && (uploadedMedia?.uri || headerFileURL) ? (
                            <Image
                              source={{ uri: uploadedMedia?.uri || headerFileURL }}
                              style={styles.mediaThumb}
                              resizeMode="cover"
                            />
                          ) : (
                            <Icon name={typeConfig.icon} size={24} color={typeConfig.color} />
                          )}
                        </View>
                        <View style={styles.mediaFileInfo}>
                          <Text style={styles.mediaFileName} numberOfLines={1}>
                            {fileName || `${typeConfig.label} file`}
                          </Text>
                          <Text style={styles.mediaFileSize}>
                            {fileSize ? `${fileSize} MB` : ''} • {typeConfig.label}
                            {isUploading && ' • Uploading...'}
                            {!isUploading && uploadedMedia?.fileUrl && ' • Uploaded'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={handleRemoveMedia}
                          style={styles.removeMediaButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          disabled={isSaving || isUploading}
                        >
                          <Icon
                            name="close-circle"
                            size={24}
                            color={isUploading ? colors.grey[300] : colors.error.main}
                          />
                        </TouchableOpacity>
                      </View>

                    </View>
                  )}

                  {/* Replace Media Button - separate button matching TemplatePreviewDialog */}
                  {(selectedFile || uploadedMedia) && (
                    <TouchableOpacity
                      style={[
                        styles.replaceMediaButton,
                        isUploading && styles.replaceMediaButtonDisabled
                      ]}
                      onPress={handlePickFile}
                      activeOpacity={0.7}
                      disabled={isSaving || isUploading}
                    >
                      <Icon
                        name="refresh"
                        size={18}
                        color={isUploading ? colors.grey[400] : chatColors.primary}
                      />
                      <Text style={[
                        styles.replaceMediaText,
                        isUploading && { color: colors.grey[400] }
                      ]}>
                        Replace Media
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* File Name for document type */}
                  {messageType === 'file' && headerFileURL && (
                    <View style={styles.fileNameInputGroup}>
                      <View style={styles.labelRow}>
                        <Icon name="file-document-edit-outline" size={18} color={colors.primary.main} />
                        <Text style={styles.formLabel}>Display Name</Text>
                      </View>
                      <View style={styles.urlInputContainer}>
                        <RNTextInput
                          value={fileName}
                          onChangeText={setFileName}
                          placeholder="File display name"
                          placeholderTextColor={colors.text.tertiary}
                          style={styles.fileNameInput}
                          editable={!isSaving}
                        />
                      </View>
                    </View>
                  )}

                  {/* Message Bubble Preview - WhatsApp style */}
                  {(uploadedMedia?.uri || headerFileURL) && (
                    <View style={styles.previewSection}>
                      <View style={styles.previewSectionHeader}>
                        <Icon name="message-text-outline" size={16} color={colors.text.secondary} />
                        <Text style={styles.previewSectionTitle}>Message Preview</Text>
                      </View>
                      <View style={styles.chatBackground}>
                        <View style={styles.messageBubbleContainer}>
                          <View style={styles.messageBubble}>
                            {/* Image Preview */}
                            {messageType === 'image' && (
                              <Image
                                source={{ uri: uploadedMedia?.uri || headerFileURL }}
                                style={styles.bubbleImage}
                                resizeMode="cover"
                              />
                            )}

                            {/* Video Preview */}
                            {messageType === 'video' && (
                              <View style={styles.bubbleVideoPlaceholder}>
                                <Icon name="play-circle" size={48} color={colors.common.white} />
                                <Text style={styles.videoPlaceholderText}>Video Preview</Text>
                              </View>
                            )}

                            {/* Audio Preview */}
                            {messageType === 'audio' && (
                              <View style={styles.bubbleAudioPlaceholder}>
                                <View style={styles.audioWaveform}>
                                  <Icon name="microphone" size={24} color={chatColors.primary} />
                                  <View style={styles.audioWaveformBars}>
                                    {[...Array(12)].map((_, i) => (
                                      <View
                                        key={i}
                                        style={[
                                          styles.audioBar,
                                          { height: Math.random() * 20 + 8 }
                                        ]}
                                      />
                                    ))}
                                  </View>
                                </View>
                                <Text style={styles.audioFileName} numberOfLines={1}>
                                  {fileName || 'Audio file'}
                                </Text>
                              </View>
                            )}

                            {/* File/Document Preview */}
                            {messageType === 'file' && (
                              <View style={styles.bubbleDocumentPreview}>
                                <View style={styles.bubbleDocIcon}>
                                  <Icon name="file-document" size={28} color={colors.grey[600]} />
                                </View>
                                <View style={styles.bubbleDocInfo}>
                                  <Text style={styles.bubbleDocName} numberOfLines={1}>
                                    {fileName || 'Document'}
                                  </Text>
                                  <Text style={styles.bubbleDocMeta}>Document</Text>
                                </View>
                                <Icon name="download" size={20} color={colors.grey[500]} />
                              </View>
                            )}

                            {/* Caption/Message Text */}
                            {message && (
                              <Text style={[styles.bubbleText, messageType !== 'text' && { marginTop: 8 }]}>
                                {message}
                              </Text>
                            )}

                            {/* Time and Status */}
                            <View style={styles.bubbleMetaContainer}>
                              <Text style={styles.bubbleTimestamp}>
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                              <Icon name="check-all" size={14} color={chatColors.tickBlue} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.formActionContainer}>
              <TouchableOpacity
                style={styles.formCancelBtn}
                onPress={handleClose}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <Text style={styles.formCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formSaveBtn, isSaving && styles.formSaveBtnDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.common.white} />
                ) : (
                  <>
                    <Icon name="check" size={18} color={colors.common.white} />
                    <Text style={styles.formSaveText}>Update</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
    </Modal>

      {/* Remove Media Confirmation Dialog */}
      <CustomDialog
        visible={showRemoveMediaDialog}
        onDismiss={() => setShowRemoveMediaDialog(false)}
        icon="image-remove"
        iconColor={colors.error.main}
        title="Remove Media"
        message="Are you sure you want to remove the uploaded media?"
        actions={[
          {
            label: 'Cancel',
            onPress: () => setShowRemoveMediaDialog(false),
          },
          {
            label: 'Remove',
            onPress: confirmRemoveMedia,
            destructive: true,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bottomModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Form Sheet
  formSheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  formHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  formHeaderIconEdit: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  formHeaderSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  formCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  formScrollView: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  formScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Form Groups
  formGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  required: {
    color: colors.error.main,
  },
  optionalBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  formHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
  },

  // Shortcut Input
  shortcutInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey[300],
    borderRadius: 12,
    backgroundColor: colors.common.white,
    overflow: 'hidden',
  },
  shortcutPrefixBox: {
    width: 44,
    height: 52,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.grey[300],
  },
  shortcutPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  shortcutInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '400',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },

  // Type Selector Button
  typeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.grey[300],
    gap: 12,
  },
  typeSelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeSelectorBtnText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500',
  },

  // Inline Type Options
  typeOptionsContainer: {
    marginTop: 8,
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    gap: 12,
    backgroundColor: colors.common.white,
  },
  typeOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeOptionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500',
  },

  // Message Input
  messageInput: {
    backgroundColor: colors.common.white,
    fontSize: 15,
    minHeight: 100,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.grey[300],
    borderRadius: 12,
    color: colors.text.primary,
    fontWeight: '400',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },

  // URL Input
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey[300],
    borderRadius: 12,
    backgroundColor: colors.common.white,
    height: 52,
    paddingHorizontal: 14,
  },
  urlInputIcon: {
    marginRight: 10,
  },
  urlInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '400',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },
  fileNameInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 14,
    fontWeight: '400',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: {},
    }),
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.grey[200],
  },
  dividerText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginHorizontal: 12,
  },

  // Upload Button - matching TemplatePreviewDialog style
  uploadButton: {
    backgroundColor: colors.grey[50],
    borderWidth: 2,
    borderColor: chatColors.primary + '40',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: chatColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadButtonSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Uploaded Media Container - matches TemplatePreviewDialog
  uploadedMediaContainer: {
    marginTop: 12,
  },
  uploadedMediaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  mediaTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  mediaThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  mediaFileInfo: {
    flex: 1,
    marginRight: 12,
  },
  mediaFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  mediaFileSize: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  removeMediaButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: chatColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  replaceMediaButtonDisabled: {
    borderColor: colors.grey[300],
  },
  replaceMediaText: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.primary,
  },
  fileNameInputGroup: {
    marginTop: 16,
  },

  // Message Bubble Preview
  previewSection: {
    marginTop: 20,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatBackground: {
    backgroundColor: chatColors.chatBg,
    borderRadius: 12,
    padding: 16,
  },
  messageBubbleContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '90%',
    backgroundColor: chatColors.outgoing,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderBottomRightRadius: 2,
  },
  bubbleImage: {
    width: 200,
    height: 160,
    borderRadius: 6,
  },
  bubbleVideoPlaceholder: {
    width: 200,
    height: 140,
    borderRadius: 6,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: colors.common.white,
    fontSize: 12,
    marginTop: 8,
  },
  bubbleAudioPlaceholder: {
    width: 200,
    paddingVertical: 12,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioWaveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  audioBar: {
    width: 3,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
  },
  audioFileName: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 8,
  },
  bubbleDocumentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    minWidth: 180,
  },
  bubbleDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bubbleDocInfo: {
    flex: 1,
  },
  bubbleDocName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  bubbleDocMeta: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bubbleMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  bubbleTimestamp: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.45)',
  },

  // Form Actions
  formActionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  formCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
  },
  formCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  formSaveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    gap: 6,
  },
  formSaveBtnDisabled: {
    opacity: 0.6,
  },
  formSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },
});

export default EditQuickReplyModal;
