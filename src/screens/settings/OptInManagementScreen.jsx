import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings, updateSettings, deleteSettings } from '../../redux/slices/settingsSlice';
import { fetchAllTemplates } from '../../redux/slices/templateSlice';
import { colors, chatColors } from '../../theme/colors';

// Message type config for badges
const MESSAGE_TYPE_CONFIG = {
  text: { label: 'Text', icon: 'format-text', color: '#64748B' },
  image: { label: 'Image', icon: 'image', color: '#0EA5E9' },
  video: { label: 'Video', icon: 'video', color: '#F97316' },
  audio: { label: 'Audio', icon: 'microphone', color: '#8B5CF6' },
  file: { label: 'Document', icon: 'file-document', color: '#DC2626' },
  template: { label: 'Template', icon: 'file-document-outline', color: '#0C68E9' },
};

export default function OptInManagementScreen() {
  const dispatch = useDispatch();

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);
  const { templates } = useSelector((state) => state.template);

  // Opt-in state
  const [optInKeywords, setOptInKeywords] = useState([]);
  const [optInKeywordInput, setOptInKeywordInput] = useState('');
  const [optInResponseEnabled, setOptInResponseEnabled] = useState(false);
  const [optInMessageType, setOptInMessageType] = useState('');
  const [optInRegularMessageType, setOptInRegularMessageType] = useState('');
  const [optInMessage, setOptInMessage] = useState('');
  const [optInFileUrl, setOptInFileUrl] = useState('');
  const [optInFileName, setOptInFileName] = useState('');
  const [optInTemplateName, setOptInTemplateName] = useState('');
  const [optInTemplateData, setOptInTemplateData] = useState(null);
  const [optInBodyParams, setOptInBodyParams] = useState({});
  const [optInHeaderParams, setOptInHeaderParams] = useState({});

  // Opt-out state
  const [optOutKeywords, setOptOutKeywords] = useState([]);
  const [optOutKeywordInput, setOptOutKeywordInput] = useState('');
  const [optOutResponseEnabled, setOptOutResponseEnabled] = useState(false);
  const [optOutMessageType, setOptOutMessageType] = useState('');
  const [optOutRegularMessageType, setOptOutRegularMessageType] = useState('');
  const [optOutMessage, setOptOutMessage] = useState('');
  const [optOutFileUrl, setOptOutFileUrl] = useState('');
  const [optOutFileName, setOptOutFileName] = useState('');
  const [optOutTemplateName, setOptOutTemplateName] = useState('');
  const [optOutTemplateData, setOptOutTemplateData] = useState(null);
  const [optOutBodyParams, setOptOutBodyParams] = useState({});
  const [optOutHeaderParams, setOptOutHeaderParams] = useState({});

  // UI state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [updatingKey, setUpdatingKey] = useState(null);

  const isLoading = getSettingsStatus === 'loading';
  const isRefreshing = getSettingsStatus === 'loading' && (optInKeywords.length > 0 || optOutKeywords.length > 0);

  useEffect(() => {
    dispatch(getSettings('optInManagement'));
    // Fetch all templates to get full template data
    dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
  }, [dispatch]);

  useEffect(() => {
    if (settings.optInManagement) {
      const optInMgmt = settings.optInManagement;

      if (optInMgmt.optInSettings) {
        const { response } = optInMgmt.optInSettings;
        setOptInKeywords(optInMgmt.optInSettings.kewords || optInMgmt.optInSettings.keywords || []);
        setOptInResponseEnabled(response?.enabled || false);
        setOptInMessageType(response?.messageType || '');
        setOptInRegularMessageType(response?.regularMessageType || '');
        setOptInMessage(response?.regularMessage || '');
        setOptInFileUrl(response?.headerFileURL || '');
        setOptInFileName(response?.fileName || response?.headerFileName || '');
        setOptInTemplateName(response?.templateName || '');
        setOptInBodyParams(response?.bodyParams || {});
        setOptInHeaderParams(response?.headerParams || {});
      }

      if (optInMgmt.optOutSettings) {
        const { response } = optInMgmt.optOutSettings;
        setOptOutKeywords(optInMgmt.optOutSettings.kewords || optInMgmt.optOutSettings.keywords || []);
        setOptOutResponseEnabled(response?.enabled || false);
        setOptOutMessageType(response?.messageType || '');
        setOptOutRegularMessageType(response?.regularMessageType || '');
        setOptOutMessage(response?.regularMessage || '');
        setOptOutFileUrl(response?.headerFileURL || '');
        setOptOutFileName(response?.fileName || response?.headerFileName || '');
        setOptOutTemplateName(response?.templateName || '');
        setOptOutBodyParams(response?.bodyParams || {});
        setOptOutHeaderParams(response?.headerParams || {});
      }
    }
  }, [settings.optInManagement]);

  // Find full template data when templates are loaded
  useEffect(() => {
    if (templates && templates.length > 0) {
      if (optInTemplateName) {
        const template = templates.find(
          (t) => t.name === optInTemplateName || t.templateName === optInTemplateName
        );
        setOptInTemplateData(template || null);
      }
      if (optOutTemplateName) {
        const template = templates.find(
          (t) => t.name === optOutTemplateName || t.templateName === optOutTemplateName
        );
        setOptOutTemplateData(template || null);
      }
    }
  }, [templates, optInTemplateName, optOutTemplateName]);

  const onRefresh = useCallback(() => {
    dispatch(getSettings('optInManagement'));
  }, [dispatch]);

  const showSnackbar = useCallback((message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  const handleAddKeyword = async (type) => {
    const input = type === 'optIn' ? optInKeywordInput.trim() : optOutKeywordInput.trim();
    const currentKeywords = type === 'optIn' ? optInKeywords : optOutKeywords;
    const otherKeywords = type === 'optIn' ? optOutKeywords : optInKeywords;

    if (!input) return;

    if (currentKeywords.includes(input)) {
      showSnackbar('Keyword already exists');
      return;
    }

    if (otherKeywords.includes(input)) {
      showSnackbar(`Already exists in ${type === 'optIn' ? 'opt-out' : 'opt-in'}`);
      return;
    }

    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.kewords'
      : 'optInManagement.optOutSettings.kewords';

    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: [input] })).unwrap();
      if (result.status === 'success') {
        showSnackbar('Keyword added');
        type === 'optIn' ? setOptInKeywordInput('') : setOptOutKeywordInput('');
        dispatch(getSettings('optInManagement'));
      } else {
        showSnackbar(result.message || 'Failed to add');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to add');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleDeleteKeyword = async (type, keyword) => {
    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.kewords'
      : 'optInManagement.optOutSettings.kewords';

    setUpdatingKey(`${key}-${keyword}`);
    try {
      const result = await dispatch(deleteSettings({ key, names: [keyword] })).unwrap();
      if (result.status === 'success') {
        showSnackbar('Keyword removed');
        dispatch(getSettings('optInManagement'));
      } else {
        showSnackbar(result.message || 'Failed to remove');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to remove');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleToggleResponse = async (type, enabled) => {
    const key = type === 'optIn'
      ? 'optInManagement.optInSettings.response.enabled'
      : 'optInManagement.optOutSettings.response.enabled';

    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        showSnackbar(`Response ${enabled ? 'enabled' : 'disabled'}`);
        type === 'optIn' ? setOptInResponseEnabled(enabled) : setOptOutResponseEnabled(enabled);
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  const renderKeywordChips = (type) => {
    const keywords = type === 'optIn' ? optInKeywords : optOutKeywords;

    if (!keywords || keywords.length === 0) {
      return (
        <View style={styles.emptyKeywords}>
          <Icon name="tag-off-outline" size={18} color={colors.grey[400]} />
          <Text style={styles.emptyKeywordsText}>No keywords added</Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {keywords.map((keyword, index) => {
          const isDeleting = updatingKey?.includes(keyword);
          return (
            <View key={`${keyword}-${index}`} style={styles.chip}>
              <Text style={styles.chipText}>{keyword}</Text>
              <TouchableOpacity
                onPress={() => handleDeleteKeyword(type, keyword)}
                disabled={isDeleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size={12} color={colors.grey[400]} />
                ) : (
                  <Icon name="close" size={14} color={colors.grey[500]} />
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderKeywordInput = (type) => {
    const value = type === 'optIn' ? optInKeywordInput : optOutKeywordInput;
    const setValue = type === 'optIn' ? setOptInKeywordInput : setOptOutKeywordInput;
    const key = type === 'optIn' ? 'optInManagement.optInSettings.kewords' : 'optInManagement.optOutSettings.kewords';
    const isAdding = updatingKey === key;

    return (
      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          placeholder="Add keyword..."
          value={value}
          onChangeText={setValue}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          dense
          onSubmitEditing={() => handleAddKeyword(type)}
          disabled={isAdding}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!value.trim() || isAdding) && styles.addBtnDisabled]}
          onPress={() => handleAddKeyword(type)}
          disabled={!value.trim() || isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size={16} color="#FFF" />
          ) : (
            <Icon name="plus" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Get message type for badge
  const getEffectiveMessageType = (msgType, regularMsgType) => {
    if (msgType === 'template') return 'template';
    return regularMsgType || 'text';
  };

  // Render message type badge
  const renderTypeBadge = (effectiveType) => {
    const config = MESSAGE_TYPE_CONFIG[effectiveType] || MESSAGE_TYPE_CONFIG.text;
    return (
      <View style={[styles.typeBadge, { backgroundColor: config.color + '15' }]}>
        <Icon name={config.icon} size={12} color={config.color} />
        <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderMessagePreview = (type) => {
    const messageType = type === 'optIn' ? optInMessageType : optOutMessageType;
    const regularMessageType = type === 'optIn' ? optInRegularMessageType : optOutRegularMessageType;
    const message = type === 'optIn' ? optInMessage : optOutMessage;
    const fileUrl = type === 'optIn' ? optInFileUrl : optOutFileUrl;
    const fileName = type === 'optIn' ? optInFileName : optOutFileName;
    const templateName = type === 'optIn' ? optInTemplateName : optOutTemplateName;
    const enabled = type === 'optIn' ? optInResponseEnabled : optOutResponseEnabled;
    const templateData = type === 'optIn' ? optInTemplateData : optOutTemplateData;
    const bodyParams = type === 'optIn' ? optInBodyParams : optOutBodyParams;
    const headerParams = type === 'optIn' ? optInHeaderParams : optOutHeaderParams;
    const headerFileUrl = fileUrl;

    const effectiveType = getEffectiveMessageType(messageType, regularMessageType);
    const hasMedia = fileUrl && ['image', 'video', 'audio', 'file'].includes(regularMessageType);

    // Disabled state
    if (!enabled) {
      return (
        <View style={styles.previewDisabled}>
          <View style={styles.previewDisabledIcon}>
            <Icon name="message-off-outline" size={24} color={colors.grey[400]} />
          </View>
          <Text style={styles.previewDisabledTitle}>Response Disabled</Text>
          <Text style={styles.previewDisabledHint}>Toggle on to send auto-reply</Text>
        </View>
      );
    }

    // Empty/Not configured state
    if (!messageType && !message && !templateName) {
      return (
        <View style={styles.previewEmpty}>
          <View style={styles.previewEmptyIcon}>
            <Icon name="message-plus-outline" size={24} color={colors.grey[400]} />
          </View>
          <Text style={styles.previewEmptyTitle}>No Message Configured</Text>
          <Text style={styles.previewEmptyHint}>Set up response in web app</Text>
        </View>
      );
    }

    // Template message - show full template content
    if (messageType === 'template' && templateName) {
      const components = templateData?.components || [];
      const headerComponent = components.find(c => c.type === 'HEADER');
      const bodyComponent = components.find(c => c.type === 'BODY');
      const footerComponent = components.find(c => c.type === 'FOOTER');
      const buttonsComponent = components.find(c => c.type === 'BUTTONS');

      // Get header type from template
      const headerType = headerComponent?.format?.toLowerCase();
      const headerMediaUrl = headerFileUrl || headerComponent?.example?.header_handle?.[0];

      // Get body text with parameter substitution
      const getBodyText = () => {
        let text = bodyComponent?.text || '';
        if (bodyParams && Object.keys(bodyParams).length > 0) {
          Object.keys(bodyParams).forEach((key) => {
            const index = parseInt(key, 10);
            if (!isNaN(index)) {
              text = text.replace(`{{${index + 1}}}`, bodyParams[key]);
            }
          });
        }
        // Also replace any remaining placeholders with example values if available
        const examples = bodyComponent?.example?.body_text?.[0] || [];
        examples.forEach((example, index) => {
          text = text.replace(`{{${index + 1}}}`, example);
        });
        return text;
      };

      // Get header text with parameter substitution
      const getHeaderText = () => {
        if (headerComponent?.format === 'TEXT') {
          let text = headerComponent?.text || '';
          if (headerParams && Object.keys(headerParams).length > 0) {
            Object.keys(headerParams).forEach((key) => {
              const index = parseInt(key, 10);
              if (!isNaN(index)) {
                text = text.replace(`{{${index + 1}}}`, headerParams[key]);
              }
            });
          }
          return text;
        }
        return null;
      };

      const bodyText = getBodyText();
      const headerText = getHeaderText();
      const footerText = footerComponent?.text || '';
      const buttons = buttonsComponent?.buttons || [];

      return (
        <View style={styles.previewContainer}>
          {/* Type Badge */}
          <View style={styles.previewHeader}>
            {renderTypeBadge('template')}
          </View>

          {/* Template Chat Bubble */}
          <View style={styles.chatArea}>
            <View style={styles.chatBubble}>
              {/* Template Name Badge */}
              <View style={styles.templateBadgeInBubble}>
                <Icon name="file-document-outline" size={12} color={colors.grey[500]} />
                <Text style={styles.templateBadgeText}>{templateName}</Text>
              </View>

              {/* Header - Image */}
              {headerType === 'image' && headerMediaUrl && (
                <View style={styles.mediaWrapper}>
                  <Image
                    source={{ uri: headerMediaUrl }}
                    style={styles.templateHeaderImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Header - Video */}
              {headerType === 'video' && headerMediaUrl && (
                <TouchableOpacity
                  style={styles.templateHeaderVideo}
                  onPress={() => headerMediaUrl && Linking.openURL(headerMediaUrl)}
                  activeOpacity={0.9}
                >
                  <View style={styles.videoPlaceholder}>
                    <View style={styles.templatePlayButton}>
                      <Icon name="play" size={24} color="#FFF" />
                    </View>
                  </View>
                  <View style={styles.videoDuration}>
                    <Icon name="video" size={12} color="#FFF" />
                    <Text style={styles.videoDurationText}>Video</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Header - Document */}
              {headerType === 'document' && headerMediaUrl && (
                <TouchableOpacity
                  style={styles.templateHeaderDocument}
                  onPress={() => headerMediaUrl && Linking.openURL(headerMediaUrl)}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateDocIconBox}>
                    <Icon name="file-document" size={24} color={chatColors.primary} />
                  </View>
                  <View style={styles.templateDocInfo}>
                    <Text style={styles.templateDocName} numberOfLines={1}>Document</Text>
                    <Text style={styles.templateDocType}>PDF/Document</Text>
                  </View>
                  <Icon name="download" size={18} color={colors.grey[400]} />
                </TouchableOpacity>
              )}

              {/* Header - Text */}
              {headerText && (
                <View style={styles.templateHeaderTextContainer}>
                  <Text style={styles.templateHeaderText}>{headerText}</Text>
                </View>
              )}

              {/* Body Text */}
              {bodyText && (
                <Text style={styles.templateBodyText}>{bodyText}</Text>
              )}

              {/* Footer Text */}
              {footerText && (
                <Text style={styles.templateFooterText}>{footerText}</Text>
              )}

              {/* Message Footer with time */}
              <View style={styles.messageFooter}>
                <Text style={styles.timeText}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Icon name="check-all" size={14} color={chatColors.tickBlue} />
              </View>

              {/* Buttons */}
              {buttons.length > 0 && (
                <View style={styles.templateButtonsContainer}>
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.templateButton}
                      activeOpacity={0.7}
                    >
                      {button.type === 'URL' && (
                        <Icon name="open-in-new" size={14} color={chatColors.primary} />
                      )}
                      {button.type === 'PHONE_NUMBER' && (
                        <Icon name="phone" size={14} color={chatColors.primary} />
                      )}
                      {button.type === 'QUICK_REPLY' && (
                        <Icon name="reply" size={14} color={chatColors.primary} />
                      )}
                      {button.type === 'COPY_CODE' && (
                        <Icon name="content-copy" size={14} color={chatColors.primary} />
                      )}
                      <Text style={styles.templateButtonText}>{button.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Template not found fallback */}
          {!templateData && (
            <View style={styles.templateNotFoundHint}>
              <Icon name="information-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.templateNotFoundText}>
                Template preview loading...
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Regular message preview in chat bubble style
    return (
      <View style={styles.previewContainer}>
        {/* Type Badge */}
        <View style={styles.previewHeader}>
          {renderTypeBadge(effectiveType)}
        </View>

        {/* Chat Preview Area */}
        <View style={styles.chatArea}>
          <View style={styles.chatBubble}>
            {/* Image with caption */}
            {regularMessageType === 'image' && fileUrl && (
              <View style={styles.mediaWrapper}>
                <Image
                  source={{ uri: fileUrl }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Icon name="image" size={16} color="#FFF" />
                </View>
              </View>
            )}

            {/* Video with thumbnail */}
            {regularMessageType === 'video' && fileUrl && (
              <View style={styles.mediaWrapper}>
                <View style={styles.videoPreview}>
                  <View style={styles.videoGradient}>
                    <View style={styles.playButton}>
                      <Icon name="play" size={24} color="#FFF" />
                    </View>
                    <View style={styles.videoDuration}>
                      <Icon name="video" size={12} color="#FFF" />
                      <Text style={styles.videoDurationText}>Video</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Audio message */}
            {regularMessageType === 'audio' && fileUrl && (
              <View style={styles.audioPreview}>
                <View style={styles.audioPlayBtn}>
                  <Icon name="play" size={16} color="#FFF" />
                </View>
                <View style={styles.audioContent}>
                  <View style={styles.audioWaveform}>
                    {[...Array(20)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.audioBar,
                          { height: 4 + Math.sin(i * 0.5) * 8 + Math.random() * 4 }
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.audioMeta}>
                    <Text style={styles.audioDuration}>0:00</Text>
                    <Icon name="microphone" size={12} color={colors.text.tertiary} />
                  </View>
                </View>
              </View>
            )}

            {/* File/Document */}
            {regularMessageType === 'file' && fileUrl && (
              <View style={styles.filePreview}>
                <View style={styles.fileIconBox}>
                  <Icon name="file-pdf-box" size={28} color="#DC2626" />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileNameText} numberOfLines={1}>
                    {fileName || 'Document'}
                  </Text>
                  <Text style={styles.fileTypeText}>PDF Document</Text>
                </View>
                <Icon name="download" size={18} color={colors.grey[400]} />
              </View>
            )}

            {/* Text message / Caption */}
            {message && (
              <Text style={[
                styles.messageText,
                (hasMedia && !['audio', 'file'].includes(regularMessageType)) && styles.messageCaption
              ]}>
                {message}
              </Text>
            )}

            {/* Text only (no media, no message shown above) */}
            {regularMessageType === 'text' && !message && (
              <Text style={styles.noTextMessage}>No text content</Text>
            )}

            {/* Time and read receipt */}
            <View style={styles.messageFooter}>
              <Text style={styles.timeText}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Icon name="check-all" size={14} color={chatColors.tickBlue} />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSection = (type) => {
    const isOptIn = type === 'optIn';
    const keywords = isOptIn ? optInKeywords : optOutKeywords;
    const enabled = isOptIn ? optInResponseEnabled : optOutResponseEnabled;
    const toggleKey = isOptIn ? 'optInManagement.optInSettings.response.enabled' : 'optInManagement.optOutSettings.response.enabled';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, isOptIn ? styles.iconBoxGreen : styles.iconBoxRed]}>
            <Icon name={isOptIn ? 'account-check' : 'account-cancel'} size={18} color={isOptIn ? '#16A34A' : '#DC2626'} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{isOptIn ? 'Opt-In Settings' : 'Opt-Out Settings'}</Text>
            <Text style={styles.cardSubtitle}>
              {isOptIn ? 'Keywords to subscribe' : 'Keywords to unsubscribe'}
            </Text>
          </View>
        </View>

        {/* Keywords */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Keywords</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{keywords.length}</Text>
            </View>
          </View>
          {renderKeywordChips(type)}
          {renderKeywordInput(type)}
        </View>

        <View style={styles.divider} />

        {/* Response */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Auto Response</Text>
              <View style={styles.readOnlyBadge}>
                <Icon name="eye" size={10} color={colors.text.tertiary} />
                <Text style={styles.readOnlyText}>Preview</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, enabled && styles.togglePillActive]}
              onPress={() => handleToggleResponse(type, !enabled)}
              disabled={updatingKey === toggleKey}
            >
              {updatingKey === toggleKey ? (
                <ActivityIndicator size={12} color={enabled ? '#FFF' : colors.grey[400]} />
              ) : (
                <>
                  <Icon name={enabled ? 'check' : 'close'} size={12} color={enabled ? '#FFF' : colors.grey[500]} />
                  <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
                    {enabled ? 'On' : 'Off'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {renderMessagePreview(type)}
        </View>
      </View>
    );
  };

  if (isLoading && optInKeywords.length === 0 && optOutKeywords.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary.main]} />
        }
      >
        {/* Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoIconBox}>
            <Icon name="information-outline" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.infoText}>
            Add or remove keywords here. Message setup requires web app.
          </Text>
        </View>

        {renderSection('optIn')}
        {renderSection('optOut')}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2000}>
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 17,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxGreen: {
    backgroundColor: '#DCFCE7',
  },
  iconBoxRed: {
    backgroundColor: '#FEE2E2',
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },

  // Section
  sectionBlock: {
    padding: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  readOnlyText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: colors.primary.main + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.main,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },

  // Keywords
  emptyKeywords: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  emptyKeywordsText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main + '12',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary.dark,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    fontSize: 13,
    height: 40,
  },
  inputOutline: {
    borderRadius: 10,
    borderColor: colors.grey[200],
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.grey[300],
  },

  // Toggle
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  togglePillActive: {
    backgroundColor: '#16A34A',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.grey[500],
  },
  toggleTextActive: {
    color: '#FFF',
  },

  // Type Badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Preview Container
  previewContainer: {
    gap: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Disabled State
  previewDisabled: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    gap: 8,
  },
  previewDisabledIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDisabledTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewDisabledHint: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Empty State
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    borderStyle: 'dashed',
    gap: 8,
  },
  previewEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewEmptyHint: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Template Card
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  templateIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary.main + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIconBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  templateNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Chat Area
  chatArea: {
    backgroundColor: chatColors.chatBg,
    borderRadius: 12,
    padding: 14,
  },
  chatBubble: {
    backgroundColor: chatColors.outgoing,
    borderRadius: 12,
    borderTopRightRadius: 4,
    padding: 0,
    alignSelf: 'flex-end',
    maxWidth: '88%',
    minWidth: 120,
    overflow: 'hidden',
  },

  // Media Wrapper
  mediaWrapper: {
    position: 'relative',
  },

  // Image Preview
  imagePreview: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grey[200],
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 4,
  },

  // Video Preview
  videoPreview: {
    width: '100%',
    height: 140,
    backgroundColor: '#1a1a2e',
  },
  videoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 100%)',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  videoDurationText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '500',
  },

  // Audio Preview
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioContent: {
    flex: 1,
    gap: 4,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 2,
  },
  audioBar: {
    width: 3,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
    opacity: 0.6,
  },
  audioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audioDuration: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // File Preview
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  fileTypeText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Message Text
  messageText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    padding: 10,
  },
  messageCaption: {
    paddingTop: 8,
  },
  noTextMessage: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    padding: 10,
  },

  // Message Footer
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: colors.text.secondary,
  },

  // Template Preview Styles
  templateBadgeInBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  templateBadgeText: {
    fontSize: 11,
    color: colors.grey[500],
    fontStyle: 'italic',
  },
  templateHeaderImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grey[200],
  },
  templateHeaderVideo: {
    width: '100%',
    height: 140,
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  templatePlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  templateHeaderDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  templateDocIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateDocInfo: {
    flex: 1,
  },
  templateDocName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  templateDocType: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  templateHeaderTextContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  templateHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  templateBodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  templateFooterText: {
    fontSize: 12,
    color: colors.text.secondary,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  templateButtonsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    marginTop: 4,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  templateButtonText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
  },
  templateNotFoundHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  templateNotFoundText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  bottomSpace: {
    height: 16,
  },
});
