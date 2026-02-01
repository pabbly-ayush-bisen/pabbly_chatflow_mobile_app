import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Snackbar,
  Switch,
  Button,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSettings, updateSettings } from '../../redux/slices/settingsSlice';
import { fetchAllTemplates } from '../../redux/slices/templateSlice';
import { colors, chatColors } from '../../theme/colors';

// Generate hours array (0-23)
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Generate minutes array (0-59, step 5)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

// Message type config for badges
const MESSAGE_TYPE_CONFIG = {
  text: { label: 'Text', icon: 'format-text', color: '#64748B' },
  image: { label: 'Image', icon: 'image', color: '#0EA5E9' },
  video: { label: 'Video', icon: 'video', color: '#F97316' },
  audio: { label: 'Audio', icon: 'microphone', color: '#8B5CF6' },
  file: { label: 'Document', icon: 'file-document', color: '#DC2626' },
  template: { label: 'Template', icon: 'file-document-outline', color: '#0C68E9' },
};

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const defaultWorkingHours = {
  monday: { enabled: false, from: null, to: null },
  tuesday: { enabled: false, from: null, to: null },
  wednesday: { enabled: false, from: null, to: null },
  thursday: { enabled: false, from: null, to: null },
  friday: { enabled: false, from: null, to: null },
  saturday: { enabled: false, from: null, to: null },
  sunday: { enabled: false, from: null, to: null },
};

export default function InboxSettingsScreen() {
  const dispatch = useDispatch();

  const { settings, getSettingsStatus } = useSelector((state) => state.settings);
  const { templates } = useSelector((state) => state.template);

  // Read Receipt state
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(false);

  // Welcome Message state (read-only)
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(false);
  const [welcomeMessageType, setWelcomeMessageType] = useState('');
  const [welcomeRegularMessageType, setWelcomeRegularMessageType] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeFileUrl, setWelcomeFileUrl] = useState('');
  const [welcomeFileName, setWelcomeFileName] = useState('');
  const [welcomeTemplateName, setWelcomeTemplateName] = useState('');
  const [welcomeTemplateData, setWelcomeTemplateData] = useState(null);
  const [welcomeBodyParams, setWelcomeBodyParams] = useState({});
  const [welcomeHeaderParams, setWelcomeHeaderParams] = useState({});

  // Off-Hour (Offer) Message state (read-only)
  const [offHourMessageEnabled, setOffHourMessageEnabled] = useState(false);
  const [offHourMessageType, setOffHourMessageType] = useState('');
  const [offHourRegularMessageType, setOffHourRegularMessageType] = useState('');
  const [offHourMessage, setOffHourMessage] = useState('');
  const [offHourFileUrl, setOffHourFileUrl] = useState('');
  const [offHourFileName, setOffHourFileName] = useState('');
  const [offHourTemplateName, setOffHourTemplateName] = useState('');
  const [offHourTemplateData, setOffHourTemplateData] = useState(null);
  const [offHourBodyParams, setOffHourBodyParams] = useState({});
  const [offHourHeaderParams, setOffHourHeaderParams] = useState({});

  // Working Hours state (fully functional)
  const [workingHours, setWorkingHours] = useState(defaultWorkingHours);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingWorkingHours, setSavingWorkingHours] = useState(false);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTimeType, setSelectedTimeType] = useState(null);
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);

  // Auto Reply state (read-only)
  const [aiAutoReplyActive, setAiAutoReplyActive] = useState(false);
  const [aiPriorityList, setAiPriorityList] = useState([]);

  // UI state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [updatingKey, setUpdatingKey] = useState(null);

  const isLoading = getSettingsStatus === 'loading';
  const isRefreshing = getSettingsStatus === 'loading' && readReceiptsEnabled !== undefined;

  useEffect(() => {
    dispatch(getSettings('inboxSettings'));
    dispatch(fetchAllTemplates({ all: true, status: 'APPROVED' }));
  }, [dispatch]);

  useEffect(() => {
    if (settings.inboxSettings) {
      const inbox = settings.inboxSettings;

      // Read Receipts
      setReadReceiptsEnabled(inbox.readReceipts || false);

      // Welcome Message
      if (inbox.wellcomeMessage || inbox.welcomeMessage) {
        const welcome = inbox.wellcomeMessage || inbox.welcomeMessage;
        setWelcomeMessageEnabled(welcome.enabled || false);
        setWelcomeMessageType(welcome.messageType || '');
        setWelcomeRegularMessageType(welcome.regularMessageType || '');
        setWelcomeMessage(welcome.regularMessage || '');
        setWelcomeFileUrl(welcome.headerFileURL || '');
        setWelcomeFileName(welcome.fileName || welcome.headerFileName || '');
        setWelcomeTemplateName(welcome.templateName || '');
        setWelcomeBodyParams(welcome.bodyParams || {});
        setWelcomeHeaderParams(welcome.headerParams || {});
      }

      // Off-Hour Message
      if (inbox.offHourMessage) {
        const offHour = inbox.offHourMessage;
        setOffHourMessageEnabled(offHour.enabled || false);
        setOffHourMessageType(offHour.messageType || '');
        setOffHourRegularMessageType(offHour.regularMessageType || '');
        setOffHourMessage(offHour.regularMessage || '');
        setOffHourFileUrl(offHour.headerFileURL || '');
        setOffHourFileName(offHour.fileName || offHour.headerFileName || '');
        setOffHourTemplateName(offHour.templateName || '');
        setOffHourBodyParams(offHour.bodyParams || {});
        setOffHourHeaderParams(offHour.headerParams || {});
      }

      // Working Hours
      if (inbox.workingHours?.days) {
        setWorkingHours({
          ...defaultWorkingHours,
          ...inbox.workingHours.days,
        });
      }

      // AI Auto Reply
      if (inbox.aiAutoReply) {
        setAiAutoReplyActive(inbox.aiAutoReply.isActive || false);
        setAiPriorityList(inbox.aiAutoReply.priorityList || []);
      }
    }
  }, [settings.inboxSettings]);

  // Find full template data when templates are loaded
  useEffect(() => {
    if (templates && templates.length > 0) {
      if (welcomeTemplateName) {
        const template = templates.find(
          (t) => t.name === welcomeTemplateName || t.templateName === welcomeTemplateName
        );
        setWelcomeTemplateData(template || null);
      }
      if (offHourTemplateName) {
        const template = templates.find(
          (t) => t.name === offHourTemplateName || t.templateName === offHourTemplateName
        );
        setOffHourTemplateData(template || null);
      }
    }
  }, [templates, welcomeTemplateName, offHourTemplateName]);

  // Track unsaved changes for working hours
  useEffect(() => {
    const initialWorkingHours = settings.inboxSettings?.workingHours?.days || defaultWorkingHours;
    setHasUnsavedChanges(JSON.stringify(workingHours) !== JSON.stringify(initialWorkingHours));
  }, [workingHours, settings.inboxSettings]);

  const onRefresh = useCallback(() => {
    dispatch(getSettings('inboxSettings'));
  }, [dispatch]);

  const showSnackbar = useCallback((message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  // Handle Read Receipt Toggle
  const handleToggleReadReceipts = async (enabled) => {
    const key = 'inboxSettings.readReceipts';
    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        setReadReceiptsEnabled(enabled);
        showSnackbar(`Read receipts ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  // Handle Welcome Message Toggle
  const handleToggleWelcomeMessage = async (enabled) => {
    // Use wellcomeMessage to match backend typo
    const key = 'inboxSettings.wellcomeMessage.enabled';
    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        setWelcomeMessageEnabled(enabled);
        showSnackbar(`Welcome message ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  // Handle Off-Hour Message Toggle
  const handleToggleOffHourMessage = async (enabled) => {
    const key = 'inboxSettings.offHourMessage.enabled';
    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        setOffHourMessageEnabled(enabled);
        showSnackbar(`Off-hours message ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  // Handle AI Auto Reply Toggle
  const handleToggleAiAutoReply = async (enabled) => {
    const key = 'inboxSettings.aiAutoReply.isActive';
    setUpdatingKey(key);
    try {
      const result = await dispatch(updateSettings({ key, data: enabled })).unwrap();
      if (result.status === 'success') {
        setAiAutoReplyActive(enabled);
        showSnackbar(`AI Auto Reply ${enabled ? 'activated' : 'deactivated'}`);
      } else {
        showSnackbar(result.message || 'Failed to update');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to update');
    } finally {
      setUpdatingKey(null);
    }
  };

  // Working Hours handlers
  const handleToggleDay = (day) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }));
  };

  const handleOpenTimePicker = (day, type) => {
    setSelectedDay(day);
    setSelectedTimeType(type);

    // Initialize with current value or default
    const timeStr = workingHours[day]?.[type];
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      setTempHour(hours);
      setTempMinute(Math.floor(minutes / 5) * 5); // Round to nearest 5
    } else {
      setTempHour(type === 'from' ? 9 : 18);
      setTempMinute(0);
    }
    setShowTimePicker(true);
  };

  const handleTimeConfirm = () => {
    if (!selectedDay || !selectedTimeType) {
      setShowTimePicker(false);
      return;
    }

    const hours = tempHour.toString().padStart(2, '0');
    const minutes = tempMinute.toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    setWorkingHours((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        [selectedTimeType]: timeString,
      },
    }));
    setShowTimePicker(false);
  };

  const handleTimeCancel = () => {
    setShowTimePicker(false);
  };

  const isTimeValid = () =>
    Object.keys(workingHours).every((day) => {
      const { enabled, from, to } = workingHours[day];
      return !enabled || (from && to);
    });

  const handleSaveWorkingHours = async () => {
    setSavingWorkingHours(true);
    try {
      const result = await dispatch(
        updateSettings({
          key: 'inboxSettings.workingHours.days',
          data: workingHours,
        })
      ).unwrap();

      if (result.status === 'success') {
        showSnackbar('Working hours saved successfully');
        setHasUnsavedChanges(false);
      } else {
        showSnackbar(result.message || 'Failed to save');
      }
    } catch (error) {
      showSnackbar(error || 'Failed to save');
    } finally {
      setSavingWorkingHours(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
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

  // Render message preview (similar to OptInManagement)
  const renderMessagePreview = (type) => {
    const isWelcome = type === 'welcome';
    const messageType = isWelcome ? welcomeMessageType : offHourMessageType;
    const regularMessageType = isWelcome ? welcomeRegularMessageType : offHourRegularMessageType;
    const message = isWelcome ? welcomeMessage : offHourMessage;
    const fileUrl = isWelcome ? welcomeFileUrl : offHourFileUrl;
    const fileName = isWelcome ? welcomeFileName : offHourFileName;
    const templateName = isWelcome ? welcomeTemplateName : offHourTemplateName;
    const enabled = isWelcome ? welcomeMessageEnabled : offHourMessageEnabled;
    const templateData = isWelcome ? welcomeTemplateData : offHourTemplateData;
    const bodyParams = isWelcome ? welcomeBodyParams : offHourBodyParams;
    const headerParams = isWelcome ? welcomeHeaderParams : offHourHeaderParams;
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
          <Text style={styles.previewDisabledTitle}>Message Disabled</Text>
          <Text style={styles.previewDisabledHint}>Enable in web app to activate</Text>
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
          <Text style={styles.previewEmptyHint}>Set up message in web app</Text>
        </View>
      );
    }

    // Template message
    if (messageType === 'template' && templateName) {
      const components = templateData?.components || [];
      const headerComponent = components.find((c) => c.type === 'HEADER');
      const bodyComponent = components.find((c) => c.type === 'BODY');
      const footerComponent = components.find((c) => c.type === 'FOOTER');
      const buttonsComponent = components.find((c) => c.type === 'BUTTONS');

      const headerType = headerComponent?.format?.toLowerCase();
      const headerMediaUrl = headerFileUrl || headerComponent?.example?.header_handle?.[0];

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
        const examples = bodyComponent?.example?.body_text?.[0] || [];
        examples.forEach((example, index) => {
          text = text.replace(`{{${index + 1}}}`, example);
        });
        return text;
      };

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
          <View style={styles.previewHeader}>
            {renderTypeBadge('template')}
          </View>
          <View style={styles.chatArea}>
            <View style={styles.chatBubble}>
              <View style={styles.templateBadgeInBubble}>
                <Icon name="file-document-outline" size={12} color={colors.grey[500]} />
                <Text style={styles.templateBadgeText}>{templateName}</Text>
              </View>

              {headerType === 'image' && headerMediaUrl && (
                <View style={styles.mediaWrapper}>
                  <Image source={{ uri: headerMediaUrl }} style={styles.templateHeaderImage} resizeMode="cover" />
                </View>
              )}

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
                </TouchableOpacity>
              )}

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

              {headerText && (
                <View style={styles.templateHeaderTextContainer}>
                  <Text style={styles.templateHeaderText}>{headerText}</Text>
                </View>
              )}

              {bodyText && <Text style={styles.templateBodyText}>{bodyText}</Text>}

              {footerText && <Text style={styles.templateFooterText}>{footerText}</Text>}

              <View style={styles.messageFooter}>
                <Text style={styles.timeText}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Icon name="check-all" size={14} color={chatColors.tickBlue} />
              </View>

              {buttons.length > 0 && (
                <View style={styles.templateButtonsContainer}>
                  {buttons.map((button, index) => (
                    <TouchableOpacity key={index} style={styles.templateButton} activeOpacity={0.7}>
                      {button.type === 'URL' && <Icon name="open-in-new" size={14} color={chatColors.primary} />}
                      {button.type === 'PHONE_NUMBER' && <Icon name="phone" size={14} color={chatColors.primary} />}
                      {button.type === 'QUICK_REPLY' && <Icon name="reply" size={14} color={chatColors.primary} />}
                      {button.type === 'COPY_CODE' && <Icon name="content-copy" size={14} color={chatColors.primary} />}
                      <Text style={styles.templateButtonText}>{button.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {!templateData && (
            <View style={styles.templateNotFoundHint}>
              <Icon name="information-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.templateNotFoundText}>Template preview loading...</Text>
            </View>
          )}
        </View>
      );
    }

    // Regular message preview
    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          {renderTypeBadge(effectiveType)}
        </View>
        <View style={styles.chatArea}>
          <View style={styles.chatBubble}>
            {regularMessageType === 'image' && fileUrl && (
              <View style={styles.mediaWrapper}>
                <Image source={{ uri: fileUrl }} style={styles.imagePreview} resizeMode="cover" />
              </View>
            )}

            {regularMessageType === 'video' && fileUrl && (
              <View style={styles.mediaWrapper}>
                <View style={styles.videoPreview}>
                  <View style={styles.videoGradient}>
                    <View style={styles.playButton}>
                      <Icon name="play" size={24} color="#FFF" />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {regularMessageType === 'audio' && fileUrl && (
              <View style={styles.audioPreview}>
                <View style={styles.audioPlayBtn}>
                  <Icon name="play" size={16} color="#FFF" />
                </View>
                <View style={styles.audioContent}>
                  <View style={styles.audioWaveform}>
                    {[...Array(20)].map((_, i) => (
                      <View key={i} style={[styles.audioBar, { height: 4 + Math.sin(i * 0.5) * 8 + Math.random() * 4 }]} />
                    ))}
                  </View>
                  <View style={styles.audioMeta}>
                    <Text style={styles.audioDuration}>0:00</Text>
                    <Icon name="microphone" size={12} color={colors.text.tertiary} />
                  </View>
                </View>
              </View>
            )}

            {regularMessageType === 'file' && fileUrl && (
              <View style={styles.filePreview}>
                <View style={styles.fileIconBox}>
                  <Icon name="file-pdf-box" size={28} color="#DC2626" />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileNameText} numberOfLines={1}>{fileName || 'Document'}</Text>
                  <Text style={styles.fileTypeText}>PDF Document</Text>
                </View>
                <Icon name="download" size={18} color={colors.grey[400]} />
              </View>
            )}

            {message && (
              <Text style={[styles.messageText, hasMedia && !['audio', 'file'].includes(regularMessageType) && styles.messageCaption]}>
                {message}
              </Text>
            )}

            {regularMessageType === 'text' && !message && (
              <Text style={styles.noTextMessage}>No text content</Text>
            )}

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

  // Render Read Receipt Section - Enhanced Visual Design
  const renderReadReceiptSection = () => {
    const key = 'inboxSettings.readReceipts';
    const isUpdating = updatingKey === key;

    return (
      <View style={styles.readReceiptCard}>
        {/* Header with prominent icon */}
        <View style={styles.readReceiptHeader}>
          <View style={styles.readReceiptIconContainer}>
            <View style={styles.readReceiptIconOuter}>
              <View style={styles.readReceiptIconInner}>
                <Icon name="check-all" size={28} color="#0EA5E9" />
              </View>
            </View>
          </View>
          <Text style={styles.readReceiptTitle}>Manage Read Receipts</Text>
          <Text style={styles.readReceiptSubtitle}>Control who can see when you've read messages</Text>
        </View>

        {/* Visual Preview Section */}
        <View style={styles.readReceiptPreview}>
          <View style={styles.previewLabelContainer}>
            <Icon name="message-text-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.previewLabel}>How ticks appear</Text>
          </View>
          <View style={styles.tickPreviewContainer}>
            {/* Sent indicator */}
            <View style={styles.tickItem}>
              <View style={styles.tickIconBox}>
                <Icon name="check" size={20} color={colors.grey[400]} />
              </View>
              <Text style={styles.tickLabel}>Sent</Text>
            </View>

            <View style={styles.tickArrow}>
              <Icon name="chevron-right" size={16} color={colors.grey[300]} />
            </View>

            {/* Delivered indicator */}
            <View style={styles.tickItem}>
              <View style={styles.tickIconBox}>
                <Icon name="check-all" size={20} color={colors.grey[400]} />
              </View>
              <Text style={styles.tickLabel}>Delivered</Text>
            </View>

            <View style={styles.tickArrow}>
              <Icon name="chevron-right" size={16} color={colors.grey[300]} />
            </View>

            {/* Read indicator */}
            <View style={styles.tickItem}>
              <View style={[styles.tickIconBox, readReceiptsEnabled ? styles.tickIconBoxActive : styles.tickIconBoxDisabled]}>
                <Icon name="check-all" size={20} color={readReceiptsEnabled ? chatColors.tickBlue : colors.grey[300]} />
              </View>
              <Text style={[styles.tickLabel, readReceiptsEnabled && styles.tickLabelActive]}>Read</Text>
              {!readReceiptsEnabled && (
                <View style={styles.tickHiddenBadge}>
                  <Icon name="eye-off" size={10} color="#DC2626" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Toggle Section */}
        <View style={styles.readReceiptToggleSection}>
          <View style={styles.readReceiptToggleRow}>
            <View style={styles.readReceiptToggleInfo}>
              <Text style={styles.readReceiptToggleLabel}>Show Read Status</Text>
              <Text style={styles.readReceiptToggleHint}>
                {readReceiptsEnabled
                  ? 'Blue ticks visible to senders'
                  : 'Read status hidden from senders'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.togglePillLarge, readReceiptsEnabled && styles.togglePillLargeActive]}
              onPress={() => handleToggleReadReceipts(!readReceiptsEnabled)}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              {isUpdating ? (
                <ActivityIndicator size={14} color={readReceiptsEnabled ? '#FFF' : colors.grey[400]} />
              ) : (
                <>
                  <Icon
                    name={readReceiptsEnabled ? 'eye' : 'eye-off'}
                    size={16}
                    color={readReceiptsEnabled ? '#FFF' : colors.grey[500]}
                  />
                  <Text style={[styles.toggleTextLarge, readReceiptsEnabled && styles.toggleTextLargeActive]}>
                    {readReceiptsEnabled ? 'On' : 'Off'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.readReceiptInfoBox}>
          <View style={styles.readReceiptInfoIcon}>
            <Icon name="information" size={16} color="#0EA5E9" />
          </View>
          <Text style={styles.readReceiptInfoText}>
            When disabled, you also won't see read receipts from others.
          </Text>
        </View>
      </View>
    );
  };

  // Render Message Settings Section (toggle enabled, config read-only)
  const renderMessageSettingsSection = () => {
    const welcomeKey = 'inboxSettings.wellcomeMessage.enabled';
    const offHourKey = 'inboxSettings.offHourMessage.enabled';
    const isUpdatingWelcome = updatingKey === welcomeKey;
    const isUpdatingOffHour = updatingKey === offHourKey;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, styles.iconBoxGreen]}>
            <Icon name="message-text-outline" size={18} color="#16A34A" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Message Settings</Text>
            <Text style={styles.cardSubtitle}>Welcome & off-hours messages</Text>
          </View>
        </View>

        {/* Welcome Message */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Welcome Message</Text>
              <View style={styles.readOnlyBadge}>
                <Icon name="eye" size={10} color={colors.text.tertiary} />
                <Text style={styles.readOnlyText}>Preview</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, welcomeMessageEnabled && styles.togglePillActive]}
              onPress={() => handleToggleWelcomeMessage(!welcomeMessageEnabled)}
              disabled={isUpdatingWelcome}
            >
              {isUpdatingWelcome ? (
                <ActivityIndicator size={12} color={welcomeMessageEnabled ? '#FFF' : colors.grey[400]} />
              ) : (
                <>
                  <Icon name={welcomeMessageEnabled ? 'check' : 'close'} size={12} color={welcomeMessageEnabled ? '#FFF' : colors.grey[500]} />
                  <Text style={[styles.toggleText, welcomeMessageEnabled && styles.toggleTextActive]}>
                    {welcomeMessageEnabled ? 'On' : 'Off'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {renderMessagePreview('welcome')}
        </View>

        <View style={styles.divider} />

        {/* Off-Hour Message */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Off-Hours Message</Text>
              <View style={styles.readOnlyBadge}>
                <Icon name="eye" size={10} color={colors.text.tertiary} />
                <Text style={styles.readOnlyText}>Preview</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, offHourMessageEnabled && styles.togglePillActive]}
              onPress={() => handleToggleOffHourMessage(!offHourMessageEnabled)}
              disabled={isUpdatingOffHour}
            >
              {isUpdatingOffHour ? (
                <ActivityIndicator size={12} color={offHourMessageEnabled ? '#FFF' : colors.grey[400]} />
              ) : (
                <>
                  <Icon name={offHourMessageEnabled ? 'check' : 'close'} size={12} color={offHourMessageEnabled ? '#FFF' : colors.grey[500]} />
                  <Text style={[styles.toggleText, offHourMessageEnabled && styles.toggleTextActive]}>
                    {offHourMessageEnabled ? 'On' : 'Off'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {renderMessagePreview('offHour')}
        </View>
      </View>
    );
  };

  // Render Working Hours Section (fully functional) - Compact Design with Instructions
  const renderWorkingHoursSection = () => {
    const isSaveDisabled = !hasUnsavedChanges || !isTimeValid() || savingWorkingHours;
    const enabledDaysCount = DAYS_OF_WEEK.filter(day => workingHours[day]?.enabled).length;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, styles.iconBoxPurple]}>
            <Icon name="clock-time-four-outline" size={18} color="#8B5CF6" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Working Hours</Text>
            <Text style={styles.cardSubtitle}>Configure day-wise working hours</Text>
          </View>
          {hasUnsavedChanges && (
            <View style={styles.unsavedBadge}>
              <Text style={styles.unsavedBadgeText}>Unsaved</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          {/* Instructions */}
          <View style={styles.workingHoursInstructions}>
            <View style={styles.instructionRow}>
              <View style={styles.instructionStep}>
                <Text style={styles.instructionStepNumber}>1</Text>
              </View>
              <Text style={styles.instructionText}>Tap day pill to enable/disable</Text>
            </View>
            <View style={styles.instructionRow}>
              <View style={styles.instructionStep}>
                <Text style={styles.instructionStepNumber}>2</Text>
              </View>
              <Text style={styles.instructionText}>Tap time to change hours</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.workingHoursSummary}>
            <Icon name="calendar-check" size={14} color={enabledDaysCount > 0 ? '#16A34A' : colors.grey[400]} />
            <Text style={[styles.summaryText, enabledDaysCount > 0 && styles.summaryTextActive]}>
              {enabledDaysCount > 0 ? `${enabledDaysCount} day${enabledDaysCount > 1 ? 's' : ''} enabled` : 'All days closed'}
            </Text>
          </View>

          {/* Days List */}
          <View style={styles.daysContainer}>
            {DAYS_OF_WEEK.map((day, index) => (
              <View key={day} style={[styles.compactDayRow, index < DAYS_OF_WEEK.length - 1 && styles.compactDayRowBorder]}>
                {/* Day name and toggle */}
                <View style={styles.compactDayInfo}>
                  <TouchableOpacity
                    style={[styles.dayTogglePill, workingHours[day]?.enabled && styles.dayTogglePillActive]}
                    onPress={() => handleToggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.compactDayName, workingHours[day]?.enabled && styles.compactDayNameActive]}>
                      {day.substring(0, 3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Time selection or Closed */}
                {workingHours[day]?.enabled ? (
                  <View style={styles.compactTimeRow}>
                    <TouchableOpacity
                      style={styles.compactTimeButton}
                      onPress={() => handleOpenTimePicker(day, 'from')}
                      activeOpacity={0.7}
                    >
                      <Icon name="clock-outline" size={12} color={colors.primary.main} style={styles.timeIcon} />
                      <Text style={styles.compactTimeText}>
                        {formatTime(workingHours[day]?.from)}
                      </Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={14} color={colors.grey[400]} />
                    <TouchableOpacity
                      style={styles.compactTimeButton}
                      onPress={() => handleOpenTimePicker(day, 'to')}
                      activeOpacity={0.7}
                    >
                      <Icon name="clock-outline" size={12} color={colors.primary.main} style={styles.timeIcon} />
                      <Text style={styles.compactTimeText}>
                        {formatTime(workingHours[day]?.to)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.closedIndicator}>
                    <Icon name="minus-circle-outline" size={14} color={colors.grey[400]} />
                    <Text style={styles.compactClosedText}>Closed</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
            onPress={handleSaveWorkingHours}
            disabled={isSaveDisabled}
          >
            {savingWorkingHours ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="content-save-outline" size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render Auto Reply Settings Section - Toggle enabled, rules read-only
  const renderAutoReplySection = () => {
    // Filter valid priority items - check for contactList or assistantId (actual API fields)
    const validRules = aiPriorityList.filter(item => item && (item.contactList || item.assistantId));
    const aiAutoReplyKey = 'inboxSettings.aiAutoReply.isActive';
    const isUpdatingAiAutoReply = updatingKey === aiAutoReplyKey;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, styles.iconBoxOrange]}>
            <Icon name="robot-outline" size={18} color="#F97316" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>AI Auto Reply</Text>
            <Text style={styles.cardSubtitle}>Automated response rules</Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          {/* AI Auto Reply Toggle */}
          <View style={styles.aiToggleRow}>
            <View style={styles.aiToggleInfo}>
              <Text style={styles.aiToggleLabel}>Auto Reply Status</Text>
              <Text style={styles.aiToggleHint}>
                {aiAutoReplyActive ? 'AI is responding to messages' : 'AI responses are disabled'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, aiAutoReplyActive && styles.togglePillActive]}
              onPress={() => handleToggleAiAutoReply(!aiAutoReplyActive)}
              disabled={isUpdatingAiAutoReply}
            >
              {isUpdatingAiAutoReply ? (
                <ActivityIndicator size={12} color={aiAutoReplyActive ? '#FFF' : colors.grey[400]} />
              ) : (
                <>
                  <Icon name={aiAutoReplyActive ? 'check' : 'close'} size={12} color={aiAutoReplyActive ? '#FFF' : colors.grey[500]} />
                  <Text style={[styles.toggleText, aiAutoReplyActive && styles.toggleTextActive]}>
                    {aiAutoReplyActive ? 'On' : 'Off'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.aiSectionDivider} />

          {/* Rules Section */}
          {validRules.length > 0 ? (
            <View style={styles.rulesContainer}>
              <View style={styles.rulesHeader}>
                <Icon name="format-list-numbered" size={16} color={colors.text.secondary} />
                <Text style={styles.rulesHeaderText}>Priority Rules ({validRules.length})</Text>
                <View style={styles.rulesReadOnlyBadge}>
                  <Icon name="eye" size={10} color={colors.text.tertiary} />
                  <Text style={styles.rulesReadOnlyText}>View only</Text>
                </View>
              </View>

              {validRules.map((item, index) => (
                <View key={index} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <View style={styles.rulePriorityBadge}>
                      <Text style={styles.rulePriorityText}>{index + 1}</Text>
                    </View>
                    <View style={styles.ruleInfo}>
                      {item.contactList && (
                        <View style={styles.ruleDetailInline}>
                          <Icon name="account-group-outline" size={14} color={colors.primary.main} />
                          <Text style={styles.ruleName} numberOfLines={1}>
                            {item.contactList}
                          </Text>
                        </View>
                      )}
                      {item.assistantId && (
                        <View style={styles.ruleAssistantRow}>
                          <Icon name="robot" size={12} color={colors.text.tertiary} />
                          <Text style={styles.ruleAssistantText} numberOfLines={1}>
                            AI Assistant: {item.assistantId}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noRulesContainer}>
              <View style={styles.noRulesIcon}>
                <Icon name="robot-off-outline" size={32} color={colors.grey[400]} />
              </View>
              <Text style={styles.noRulesTitle}>No Rules Configured</Text>
              <Text style={styles.noRulesHint}>
                Configure AI auto-reply rules in the web app
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading && !readReceiptsEnabled) {
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
        {/* Info Box */}
        <View style={styles.infoBox}>
          <View style={styles.infoIconBox}>
            <Icon name="information-outline" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.infoText}>
            Manage read receipts and working hours here. Message settings require web app.
          </Text>
        </View>

        {renderReadReceiptSection()}
        {renderMessageSettingsSection()}
        {renderWorkingHoursSection()}
        {renderAutoReplySection()}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Custom Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={handleTimeCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>
                Select {selectedTimeType === 'from' ? 'Start' : 'End'} Time
              </Text>
              <Text style={styles.timePickerSubtitle}>
                {selectedDay?.charAt(0).toUpperCase() + selectedDay?.slice(1)}
              </Text>
            </View>

            <View style={styles.timePickerContent}>
              {/* Hour Selection */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hour</Text>
                <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                  {HOURS.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeOption,
                        tempHour === hour && styles.timeOptionSelected,
                      ]}
                      onPress={() => setTempHour(hour)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          tempHour === hour && styles.timeOptionTextSelected,
                        ]}
                      >
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeSeparatorLarge}>:</Text>

              {/* Minute Selection */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Minute</Text>
                <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeOption,
                        tempMinute === minute && styles.timeOptionSelected,
                      ]}
                      onPress={() => setTempMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          tempMinute === minute && styles.timeOptionTextSelected,
                        ]}
                      >
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Preview */}
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewLabel}>Selected Time:</Text>
              <Text style={styles.timePreviewValue}>
                {tempHour.toString().padStart(2, '0')}:{tempMinute.toString().padStart(2, '0')}
                {' '}({tempHour >= 12 ? 'PM' : 'AM'})
              </Text>
            </View>

            <View style={styles.timePickerActions}>
              <Button
                mode="outlined"
                onPress={handleTimeCancel}
                style={styles.timePickerButton}
                textColor={colors.text.secondary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleTimeConfirm}
                style={styles.timePickerButton}
                buttonColor={colors.primary.main}
              >
                Confirm
              </Button>
            </View>
          </View>
        </View>
      </Modal>

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
  iconBoxBlue: {
    backgroundColor: '#E0F2FE',
  },
  iconBoxGreen: {
    backgroundColor: '#DCFCE7',
  },
  iconBoxPurple: {
    backgroundColor: '#EDE9FE',
  },
  iconBoxOrange: {
    backgroundColor: '#FFEDD5',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: colors.grey[100],
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#16A34A',
  },
  statusTextInactive: {
    color: colors.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },

  // Toggle Pill (same as OptInManagement)
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

  // Enhanced Read Receipt Section
  readReceiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  readReceiptHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2FE',
  },
  readReceiptIconContainer: {
    marginBottom: 12,
  },
  readReceiptIconOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readReceiptIconInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  readReceiptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  readReceiptSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  readReceiptPreview: {
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  previewLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tickPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tickItem: {
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  tickIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tickIconBoxActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  tickIconBoxDisabled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  tickArrow: {
    marginHorizontal: 4,
  },
  tickLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tickLabelActive: {
    color: '#0EA5E9',
  },
  tickHiddenBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  readReceiptToggleSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  readReceiptToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readReceiptToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  readReceiptToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  readReceiptToggleHint: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  togglePillLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  togglePillLargeActive: {
    backgroundColor: '#16A34A',
  },
  toggleTextLarge: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey[500],
  },
  toggleTextLargeActive: {
    color: '#FFF',
  },
  readReceiptInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  readReceiptInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readReceiptInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 17,
  },

  // Working Hours - Compact Design with Instructions
  unsavedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unsavedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  workingHoursInstructions: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  instructionStep: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionStepNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  instructionText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
  },
  workingHoursSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  summaryTextActive: {
    color: '#16A34A',
  },
  daysContainer: {
    marginBottom: 4,
  },
  compactDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  compactDayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  compactDayInfo: {
    width: 54,
  },
  dayTogglePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayTogglePillActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  compactDayName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.grey[500],
  },
  compactDayNameActive: {
    color: '#FFF',
  },
  compactTimeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  compactTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main + '10',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.main + '30',
    gap: 4,
  },
  timeIcon: {
    marginRight: 2,
  },
  compactTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },
  closedIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  compactClosedText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  saveButtonDisabled: {
    backgroundColor: colors.grey[300],
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },

  // Auto Reply - Enhanced Design
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusIndicatorActive: {
    backgroundColor: '#DCFCE7',
  },
  statusIndicatorInactive: {
    backgroundColor: colors.grey[100],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotInactive: {
    backgroundColor: colors.grey[400],
  },
  statusIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // AI Auto Reply Toggle Section
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  aiToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  aiToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  aiToggleHint: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  aiSectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },

  // Rules Container
  rulesContainer: {
    gap: 10,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rulesHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  rulesReadOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  rulesReadOnlyText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  ruleCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rulePriorityBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulePriorityText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  ruleInfo: {
    flex: 1,
    gap: 4,
  },
  ruleDetailInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  ruleAssistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ruleAssistantText: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
  },
  ruleDescription: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  ruleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  ruleStatusActive: {
    backgroundColor: '#DCFCE7',
  },
  ruleStatusInactive: {
    backgroundColor: colors.grey[100],
  },
  ruleStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ruleStatusTextActive: {
    color: '#16A34A',
  },
  ruleStatusTextInactive: {
    color: colors.grey[500],
  },
  ruleDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  ruleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleDetailText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // No Rules State
  noRulesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noRulesIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noRulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  noRulesHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
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

  // Time Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  timePickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  timePickerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  timePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  timeColumn: {
    alignItems: 'center',
    flex: 1,
  },
  timeColumnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeScrollView: {
    maxHeight: 180,
  },
  timeOption: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginVertical: 2,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary.main + '15',
  },
  timeOptionText: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: colors.primary.main,
    fontWeight: '700',
  },
  timeSeparatorLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginHorizontal: 8,
  },
  timePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey[50],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  timePreviewLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  timePreviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.main,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  timePickerButton: {
    flex: 1,
    borderRadius: 10,
  },
});
