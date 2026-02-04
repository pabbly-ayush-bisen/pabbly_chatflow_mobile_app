import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
  Linking,
  RefreshControl,
  Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, chatColors, getAvatarColor } from '../theme/colors';
import { format, formatDistanceToNow } from 'date-fns';
import { updateContactChat, setChatStatus, updateChatInList } from '../redux/slices/inboxSlice';
import { EnableAiAssistantDialog } from '../components/chat';
import { updateContact, deleteContact } from '../redux/slices/contactSlice';
import { getSettings } from '../redux/slices/settingsSlice';
import { getOrderHistories, clearOrderHistories } from '../redux/slices/orderSlice';
import { showSuccess, showError } from '../utils/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive check for smaller screens
const isSmallScreen = SCREEN_WIDTH < 360;
const isLargeScreen = SCREEN_WIDTH > 400;

// Responsive sizing helper
const getResponsiveSize = (small, normal, large) => {
  if (isSmallScreen) return small;
  if (isLargeScreen) return large;
  return normal;
};

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Overview', icon: 'account-outline' },
  { id: 'orders', label: 'Orders', icon: 'shopping-outline' },
  { id: 'activity', label: 'Activity', icon: 'history' },
];

// Chat status configuration - matches web app STATUS array in team-queue.jsx
const CHAT_STATUS_OPTIONS = [
  { value: 'open', label: 'Open', icon: 'message-outline', color: colors.info.main, description: 'Chat is open and active' },
  { value: 'aiAssistant', label: 'AI Assistant', icon: 'robot', color: '#7C3AED', description: 'Managed by AI Assistant' },
  { value: 'intervened', label: 'Intervened', icon: 'hand-back-left', color: colors.warning.main, description: 'Manual intervention mode' },
  { value: 'on_hold', label: 'On Hold', icon: 'pause-circle-outline', color: colors.grey[600], description: 'Chat is temporarily paused' },
  { value: 'replied', label: 'Replied', icon: 'reply-outline', color: colors.success.main, description: 'Waiting for customer response' },
  { value: 'pending', label: 'Pending', icon: 'clock-outline', color: colors.warning.dark, description: 'Awaiting action' },
  { value: 'resolved', label: 'Resolved', icon: 'check-circle-outline', color: colors.success.main, description: 'Issue has been resolved' },
  { value: 'closed', label: 'Closed', icon: 'close-circle-outline', color: colors.error.main, description: 'Chat is closed' },
];

const ContactInfoScreen = ({ route, navigation }) => {
  const { contact, chatId, chat } = route.params || {};
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [displayName, setDisplayName] = useState(''); // Local state for real-time UI updates
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chat status state
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(chat?.status || 'open');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // AI Assistant selection dialog state
  const [showAiAssistantDialog, setShowAiAssistantDialog] = useState(false);

  // Block Contact dialog state
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [isBlockingContact, setIsBlockingContact] = useState(false);
  const [localIncomingBlocked, setLocalIncomingBlocked] = useState(incomingBlocked);

  // Opt-in status state
  const [showOptInPicker, setShowOptInPicker] = useState(false);
  const [localOptIn, setLocalOptIn] = useState(optInValue);
  const [isUpdatingOptIn, setIsUpdatingOptIn] = useState(false);

  // Delete Contact dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState(false);

  // Invoice dialog state
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Chat owner state
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [chatOwner, setChatOwner] = useState(chat?.assignedToMember || null);
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false);

  // Get chat status from Redux
  const { updateContactChatStatus } = useSelector((state) => state.inbox);

  // Get team members from settings
  const { settings } = useSelector((state) => state.settings);
  const teamMembers = settings?.teamMembers?.items || [];

  // Get order history from Redux (with safe fallback)
  const orderState = useSelector((state) => state.order) || {};
  const { orderHistories = [], orderHistoryStatus = 'idle', totalOrderHistory = 0 } = orderState;
  const orders = orderHistories || [];

  // Get contact data from various sources
  const contactData = contact || chat?.contact || {};
  const contactName = contactData.name || contactData.phoneNumber || 'Unknown';
  const contactPhoneNumber = contactData.phoneNumber || contactData.phone_number || '';
  const contactEmail = contactData.email || '';
  const contactTags = contactData.tags || [];
  const contactAttributes = contactData.attributes || contactData.customAttributes || {};
  const lastActive = contactData.lastActive || chat?.lastActive;
  const createdAt = contactData.createdAt || chat?.createdAt;
  // Check multiple possible locations for opt-in status
  // Web app uses 'optin' field directly as a boolean (true/false)
  const optInValue = contactData.optin ?? contactData.optIn?.status
    ?? contactData.optInStatus ?? chat?.contact?.optin ?? 'unknown';

  // Check for incoming blocked status
  const incomingBlocked = contactData.incomingBlocked ?? chat?.contact?.incomingBlocked;

  useEffect(() => {
    setEditName(contactName);
    setDisplayName(contactName);
  }, [contactName]);

  // Sync chat status from props
  useEffect(() => {
    if (chat?.status) {
      setCurrentStatus(chat.status);
    }
  }, [chat?.status]);

  // Sync chat owner from props and fetch team members
  useEffect(() => {
    if (chat?.assignedToMember) {
      setChatOwner(chat.assignedToMember);
    }
    // Fetch team members if not already loaded
    if (!settings?.teamMembers) {
      dispatch(getSettings('teamMembers'));
    }
  }, [chat?.assignedToMember, settings?.teamMembers, dispatch]);

  // Sync local incoming blocked state
  useEffect(() => {
    setLocalIncomingBlocked(incomingBlocked);
  }, [incomingBlocked]);

  // Sync local opt-in state
  useEffect(() => {
    setLocalOptIn(optInValue);
  }, [optInValue]);

  // Fetch order histories for this chat/contact
  useEffect(() => {
    const contactId = contactData._id || contact?._id;
    if (chatId || contactId) {
      dispatch(getOrderHistories({
        chatId: chatId,
        contactId: contactId,
        limit: 100,
        page: 0,
      }));
    }

    // Cleanup on unmount
    return () => {
      dispatch(clearOrderHistories());
    };
  }, [chatId, contactData._id, contact?._id, dispatch]);

  // Handle chat owner change
  const handleOwnerChange = useCallback(async (member) => {
    const newOwner = member === 'none' ? null : member;

    if ((newOwner?._id || newOwner?.id) === (chatOwner?._id || chatOwner?.id)) {
      setShowOwnerPicker(false);
      return;
    }

    setIsUpdatingOwner(true);
    try {
      // Prepare payload matching web app format
      let payload;
      if (member === 'none') {
        payload = 'none';
      } else {
        const { name, role, email, _id } = member;
        payload = { name, email, role, id: _id };
      }

      const result = await dispatch(updateContactChat({
        id: chatId,
        status: currentStatus,
        assignedToMember: payload,
        hideNotification: chat?.hideNotification || false,
      })).unwrap();

      if (result.status === 'success' || result.response?.status === 'success') {
        setChatOwner(member === 'none' ? null : payload);
        // Update the chat in the list
        dispatch(updateChatInList({
          _id: chatId,
          assignedToMember: payload,
        }));
        showSuccess( member === 'none'
          ? 'Chat owner removed'
          : `Chat assigned to ${member.name}`);
      } else {
        showError( result.message || 'Failed to update chat owner');
      }
    } catch (error) {
      showError( error?.message || error || 'Failed to update chat owner');
    } finally {
      setIsUpdatingOwner(false);
      setShowOwnerPicker(false);
    }
  }, [chatId, chat, currentStatus, chatOwner, dispatch]);

  // Handle chat status change
  const handleStatusChange = useCallback(async (newStatus) => {
    if (newStatus === currentStatus) {
      setShowStatusPicker(false);
      return;
    }

    // If AI Assistant is selected, show the AI assistant selection dialog
    if (newStatus === 'aiAssistant') {
      setShowStatusPicker(false);
      setShowAiAssistantDialog(true);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const result = await dispatch(updateContactChat({
        id: chatId,
        status: newStatus,
        assignedToMember: chat?.assignedToMember || {},
        hideNotification: chat?.hideNotification || false,
      })).unwrap();

      if (result.status === 'success' || result.response?.status === 'success') {
        setCurrentStatus(newStatus);
        dispatch(setChatStatus(newStatus));
        showSuccess(`Chat status updated to ${getStatusLabel(newStatus)}`);
      } else {
        showError(result.message || 'Failed to update chat status');
      }
    } catch (error) {
      showError(error?.message || error || 'Failed to update chat status');
    } finally {
      setIsUpdatingStatus(false);
      setShowStatusPicker(false);
    }
  }, [chatId, chat, currentStatus, dispatch]);

  // Handle AI assistant selection success
  const handleAiAssistantSuccess = useCallback((assistant) => {
    setCurrentStatus('aiAssistant');
    dispatch(setChatStatus('aiAssistant'));
    showSuccess(`AI Assistant "${assistant.name}" enabled for this chat`);
  }, [dispatch]);

  // Get status label from value
  const getStatusLabel = (statusValue) => {
    const option = CHAT_STATUS_OPTIONS.find(opt => opt.value === statusValue);
    return option?.label || statusValue;
  };

  // Get status config
  const getStatusConfig = (statusValue) => {
    return CHAT_STATUS_OPTIONS.find(opt => opt.value === statusValue) || CHAT_STATUS_OPTIONS[0];
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch {
      return 'N/A';
    }
  };

  const formatLastActive = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const handleSaveName = useCallback(async () => {
    if (!editName.trim() || editName.trim() === displayName) {
      setIsEditing(false);
      setEditName(displayName);
      return;
    }

    const contactId = contactData._id || contact?._id;
    if (!contactId) {
      showError( 'Contact ID not found. Cannot update name.');
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await dispatch(updateContact({
        _id: contactId,
        bodyData: { updateData: { name: editName.trim() } },
      })).unwrap();

      if (result.status === 'success' || result.data) {
        const newName = editName.trim();
        // Update local display name for immediate UI update
        setDisplayName(newName);
        // Update the chat in the list with the new contact name
        if (chatId) {
          dispatch(updateChatInList({
            _id: chatId,
            contact: {
              ...contactData,
              name: newName,
            },
          }));
        }
        showSuccess( 'Contact name updated successfully');
        setIsEditing(false);
      } else {
        showError( result.message || 'Failed to update contact name');
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update contact name';
      showError( errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [editName, displayName, contactData, contact, chatId, dispatch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const contactId = contactData._id || contact?._id;
      if (chatId || contactId) {
        await dispatch(getOrderHistories({
          chatId: chatId,
          contactId: contactId,
          limit: 100,
          page: 0,
        })).unwrap();
      }
    } catch (error) {
      // Silently handle refresh errors
    } finally {
      setIsRefreshing(false);
    }
  }, [chatId, contactData._id, contact?._id, dispatch]);

  // Handle block/unblock contact
  const handleToggleBlock = useCallback(async (shouldBlock) => {
    const contactId = contactData._id || contact?._id;
    if (!contactId) {
      showError('Contact ID not found');
      return;
    }

    setIsBlockingContact(true);
    try {
      const result = await dispatch(updateContact({
        _id: contactId,
        bodyData: {
          updateData: {
            incomingBlocked: shouldBlock,
          },
        },
      })).unwrap();

      if (result.status === 'success' || result.data) {
        setLocalIncomingBlocked(shouldBlock);
        // Update the chat in the list
        if (chatId) {
          dispatch(updateChatInList({
            _id: chatId,
            contact: {
              ...contactData,
              incomingBlocked: shouldBlock,
            },
          }));
        }
        showSuccess(shouldBlock ? 'Contact blocked successfully' : 'Contact unblocked successfully');
      } else {
        showError(result.message || 'Failed to update contact');
      }
    } catch (error) {
      showError(error?.message || error || 'Failed to update contact');
    } finally {
      setIsBlockingContact(false);
      setShowBlockDialog(false);
    }
  }, [contactData, contact, chatId, dispatch]);

  // Handle opt-in status change
  const handleOptInChange = useCallback(async (newOptInValue) => {
    const contactId = contactData._id || contact?._id;
    if (!contactId) {
      showError('Contact ID not found');
      return;
    }

    setIsUpdatingOptIn(true);
    try {
      const result = await dispatch(updateContact({
        _id: contactId,
        bodyData: {
          updateData: {
            optin: newOptInValue,
          },
        },
      })).unwrap();

      if (result.status === 'success' || result.data) {
        setLocalOptIn(newOptInValue);
        // Update the chat in the list
        if (chatId) {
          dispatch(updateChatInList({
            _id: chatId,
            contact: {
              ...contactData,
              optin: newOptInValue,
            },
          }));
        }
        showSuccess(newOptInValue ? 'Contact opted in successfully' : 'Contact opted out successfully');
      } else {
        showError(result.message || 'Failed to update opt-in status');
      }
    } catch (error) {
      showError(error?.message || error || 'Failed to update opt-in status');
    } finally {
      setIsUpdatingOptIn(false);
      setShowOptInPicker(false);
    }
  }, [contactData, contact, chatId, dispatch]);

  // Handle delete contact
  const handleDeleteContact = useCallback(async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteConfirmError(true);
      return;
    }

    const contactId = contactData._id || contact?._id;
    if (!contactId) {
      showError('Contact ID not found');
      return;
    }

    setDeleteConfirmError(false);
    setIsDeletingContact(true);
    try {
      const result = await dispatch(deleteContact({
        ids: [contactId],
      })).unwrap();

      if (result.status === 'success') {
        showSuccess(result.message || 'Contact deleted successfully');
        // Navigate back after deletion
        navigation.goBack();
      } else {
        showError(result.message || 'Failed to delete contact');
      }
    } catch (error) {
      showError(error?.message || error || 'Failed to delete contact');
    } finally {
      setIsDeletingContact(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  }, [deleteConfirmText, contactData, contact, dispatch, navigation]);

  const handleCall = useCallback(() => {
    if (contactPhoneNumber) {
      Linking.openURL(`tel:${contactPhoneNumber}`);
    }
  }, [contactPhoneNumber]);

  const handleWhatsApp = useCallback(() => {
    if (contactPhoneNumber) {
      const phone = contactPhoneNumber.replace(/[^0-9]/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  }, [contactPhoneNumber]);

  const handleEmail = useCallback(() => {
    if (contactEmail) {
      Linking.openURL(`mailto:${contactEmail}`);
    }
  }, [contactEmail]);

  const getOptInStatusConfig = (optinValue) => {
    // Handle boolean values (web app pattern)
    if (optinValue === true) {
      return { color: colors.success.main, bg: colors.success.lighter, label: 'Opted In', icon: 'check-circle' };
    }
    if (optinValue === false) {
      return { color: colors.error.main, bg: colors.error.lighter, label: 'Opted Out', icon: 'close-circle' };
    }

    // Handle string values
    const statusLower = optinValue?.toString?.()?.toLowerCase?.() || '';

    // Opted In states
    if (statusLower === 'opt_in' || statusLower === 'optin' || statusLower === 'opted_in' ||
        statusLower === 'active' || statusLower === 'true' || statusLower === 'yes') {
      return { color: colors.success.main, bg: colors.success.lighter, label: 'Opted In', icon: 'check-circle' };
    }

    // Opted Out states
    if (statusLower === 'opt_out' || statusLower === 'optout' || statusLower === 'opted_out' ||
        statusLower === 'inactive' || statusLower === 'false' || statusLower === 'no') {
      return { color: colors.error.main, bg: colors.error.lighter, label: 'Opted Out', icon: 'close-circle' };
    }

    // Pending state
    if (statusLower === 'pending') {
      return { color: colors.warning.main, bg: colors.warning.lighter, label: 'Pending', icon: 'clock-outline' };
    }

    // Default - Unknown
    return { color: colors.grey[500], bg: colors.grey[100], label: 'Not Set', icon: 'help-circle-outline' };
  };

  // Get incoming blocked status config
  const getIncomingBlockedConfig = (blocked) => {
    if (blocked === true) {
      return { color: colors.error.main, bg: colors.error.lighter, label: 'Blocked', icon: 'block-helper' };
    }
    if (blocked === false) {
      return { color: colors.success.main, bg: colors.success.lighter, label: 'Allowed', icon: 'check-circle-outline' };
    }
    return { color: colors.grey[500], bg: colors.grey[100], label: 'Unknown', icon: 'help-circle-outline' };
  };

  const getOrderStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return { color: colors.success.main, bg: colors.success.lighter, icon: 'check-circle' };
      case 'processing':
      case 'shipped':
        return { color: colors.info.main, bg: colors.info.lighter, icon: 'truck-delivery' };
      case 'pending':
        return { color: colors.warning.main, bg: colors.warning.lighter, icon: 'clock-outline' };
      case 'cancelled':
      case 'failed':
        return { color: colors.error.main, bg: colors.error.lighter, icon: 'close-circle' };
      default:
        return { color: colors.grey[500], bg: colors.grey[100], icon: 'package-variant' };
    }
  };

  const optInConfig = getOptInStatusConfig(localOptIn);
  const incomingBlockedConfig = getIncomingBlockedConfig(localIncomingBlocked);

  // Header opacity animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Render Tab Button
  const renderTabButton = (tab) => {
    const isActive = activeTab === tab.id;
    return (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab.id)}
        activeOpacity={0.7}
      >
        <Icon
          name={tab.icon}
          size={18}
          color={isActive ? chatColors.primary : colors.grey[500]}
        />
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render Overview Tab
  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Contact Details Card - Read-only information */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="account-details-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Contact Details</Text>
        </View>

        <View style={styles.infoList}>
          {contactPhoneNumber && (
            <View style={styles.infoItemCompact}>
              <View style={styles.infoIconSmall}>
                <Icon name="phone-outline" size={16} color={colors.grey[500]} />
              </View>
              <View style={styles.infoContentCompact}>
                <Text style={styles.infoLabelSmall}>Phone</Text>
                <Text style={styles.infoValueCompact} numberOfLines={1}>{contactPhoneNumber}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {/* Copy to clipboard */}}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="content-copy" size={16} color={colors.grey[400]} />
              </TouchableOpacity>
            </View>
          )}

          {contactEmail && (
            <View style={styles.infoItemCompact}>
              <View style={styles.infoIconSmall}>
                <Icon name="email-outline" size={16} color={colors.grey[500]} />
              </View>
              <View style={styles.infoContentCompact}>
                <Text style={styles.infoLabelSmall}>Email</Text>
                <Text style={styles.infoValueCompact} numberOfLines={1}>{contactEmail}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {/* Copy to clipboard */}}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="content-copy" size={16} color={colors.grey[400]} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoItemCompact}>
            <View style={styles.infoIconSmall}>
              <Icon name="clock-outline" size={16} color={colors.grey[500]} />
            </View>
            <View style={styles.infoContentCompact}>
              <Text style={styles.infoLabelSmall}>Last Active</Text>
              <Text style={styles.infoValueCompact}>{formatLastActive(lastActive)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Contact Settings Card - Interactive settings */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="cog-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Contact Settings</Text>
        </View>

        <View style={styles.settingsList}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowOptInPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: optInConfig.bg }]}>
                <Icon name={optInConfig.icon} size={18} color={optInConfig.color} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Opt-in Status</Text>
                <Text style={[styles.settingValue, { color: optInConfig.color }]}>
                  {optInConfig.label}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={20} color={colors.grey[400]} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowBlockDialog(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: incomingBlockedConfig.bg }]}>
                <Icon name={incomingBlockedConfig.icon} size={18} color={incomingBlockedConfig.color} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Incoming Messages</Text>
                <Text style={[styles.settingValue, { color: incomingBlockedConfig.color }]}>
                  {incomingBlockedConfig.label}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={20} color={colors.grey[400]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Status Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="message-processing-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Chat Status</Text>
        </View>

        <TouchableOpacity
          style={styles.statusSelector}
          onPress={() => setShowStatusPicker(true)}
          activeOpacity={0.7}
          disabled={isUpdatingStatus}
        >
          {isUpdatingStatus ? (
            <View style={styles.statusSelectorContent}>
              <ActivityIndicator size="small" color={chatColors.primary} />
              <Text style={styles.statusSelectorText}>Updating...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statusSelectorContent}>
                <View style={[styles.statusIconContainer, { backgroundColor: `${getStatusConfig(currentStatus).color}15` }]}>
                  <Icon
                    name={getStatusConfig(currentStatus).icon}
                    size={20}
                    color={getStatusConfig(currentStatus).color}
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusSelectorLabel}>Current Status</Text>
                  <Text style={[styles.statusSelectorValue, { color: getStatusConfig(currentStatus).color }]}>
                    {getStatusConfig(currentStatus).label}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={colors.grey[400]} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.statusDescription}>
          {getStatusConfig(currentStatus).description}
        </Text>
      </View>

      {/* Chat Owner Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="account-check-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Chat Owner</Text>
        </View>

        <TouchableOpacity
          style={styles.statusSelector}
          onPress={() => setShowOwnerPicker(true)}
          activeOpacity={0.7}
          disabled={isUpdatingOwner}
        >
          {isUpdatingOwner ? (
            <View style={styles.statusSelectorContent}>
              <ActivityIndicator size="small" color={chatColors.primary} />
              <Text style={styles.statusSelectorText}>Updating...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statusSelectorContent}>
                <View style={[styles.statusIconContainer, { backgroundColor: chatOwner ? `${chatColors.primary}15` : colors.grey[100] }]}>
                  <Icon
                    name={chatOwner ? 'account' : 'account-outline'}
                    size={20}
                    color={chatOwner ? chatColors.primary : colors.grey[500]}
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusSelectorLabel}>Team Member</Text>
                  <Text style={[styles.statusSelectorValue, { color: chatOwner ? chatColors.primary : colors.grey[500] }]}>
                    {chatOwner?.name || 'Unassigned'}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={colors.grey[400]} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.statusDescription}>
          {chatOwner
            ? `Team member ${chatOwner.name} is managing this chat.`
            : 'Select a team member to manage this chat.'}
        </Text>
      </View>

      {/* Tags Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="tag-multiple-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Tags</Text>
          <TouchableOpacity style={styles.sectionAddButton}>
            <Icon name="plus" size={18} color={chatColors.primary} />
          </TouchableOpacity>
        </View>

        {contactTags.length > 0 ? (
          <View style={styles.tagsContainer}>
            {contactTags.map((tag, index) => (
              <View
                key={tag._id || index}
                style={[
                  styles.tagChip,
                  { backgroundColor: tag.color ? `${tag.color}20` : colors.grey[100] },
                ]}
              >
                <View
                  style={[
                    styles.tagDot,
                    { backgroundColor: tag.color || colors.grey[400] },
                  ]}
                />
                <Text
                  style={[
                    styles.tagText,
                    { color: tag.color || colors.text.primary },
                  ]}
                >
                  {tag.name || tag}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Icon name="tag-off-outline" size={32} color={colors.grey[300]} />
            <Text style={styles.emptyText}>No tags assigned</Text>
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Add Tag</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Attributes Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="format-list-bulleted" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Custom Attributes</Text>
          <TouchableOpacity style={styles.sectionAddButton}>
            <Icon name="plus" size={18} color={chatColors.primary} />
          </TouchableOpacity>
        </View>

        {Object.keys(contactAttributes).length > 0 ? (
          <View style={styles.attributesList}>
            {Object.entries(contactAttributes).map(([key, value], index) => (
              <View key={index} style={styles.attributeItem}>
                <Text style={styles.attributeKey}>{key}</Text>
                <Text style={styles.attributeValue} numberOfLines={1}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Icon name="playlist-remove" size={32} color={colors.grey[300]} />
            <Text style={styles.emptyText}>No custom attributes</Text>
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Add Attribute</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Details Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="card-account-details-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Details</Text>
        </View>

        <View style={styles.detailsList}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{formatDateTime(createdAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Seen</Text>
            <Text style={styles.detailValue}>{formatDateTime(lastActive)}</Text>
          </View>
          {contactData._id && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact ID</Text>
              <Text style={styles.detailValueSmall} numberOfLines={1}>
                {contactData._id}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Danger Zone */}
      <View style={[styles.sectionCard, styles.dangerCard]}>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => setShowBlockDialog(true)}
          activeOpacity={0.7}
        >
          <Icon name={localIncomingBlocked ? 'lock-open-outline' : 'block-helper'} size={20} color={colors.error.main} />
          <Text style={styles.dangerButtonText}>
            {localIncomingBlocked ? 'Unblock Contact' : 'Block Contact'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => setShowDeleteDialog(true)}
          activeOpacity={0.7}
        >
          <Icon name="delete-outline" size={20} color={colors.error.main} />
          <Text style={styles.dangerButtonText}>Delete Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Helper to get the final order status (handles expired check like web app)
  const getOrderStatusLabel = (orderRow) => {
    const originalStatus = orderRow?.status;
    const expiryTimestamp =
      orderRow?.metaOrderDetailMessage?.action?.parameters?.order?.expiration?.timestamp;

    if (!expiryTimestamp) return originalStatus;

    const UTCTime = new Date().getTime() / 1000;

    if (originalStatus === 'expired') return 'expired';

    if (originalStatus === 'pending' && UTCTime > expiryTimestamp) return 'expired';
    return originalStatus;
  };

  // Helper to get order status config for API data
  const getApiOrderStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return { color: colors.success.main, bg: colors.success.lighter, icon: 'check-circle' };
      case 'pending':
        return { color: colors.warning.main, bg: colors.warning.lighter, icon: 'clock-outline' };
      case 'failed':
        return { color: colors.error.main, bg: colors.error.lighter, icon: 'close-circle' };
      case 'expired':
        return { color: colors.grey[500], bg: colors.grey[100], icon: 'timer-off-outline' };
      default:
        return { color: colors.grey[500], bg: colors.grey[100], icon: 'package-variant' };
    }
  };

  // Helper to extract amount from object with value/offset format (like web app)
  const extractAmountFromObject = (amountObj = {}) => {
    const value = Number(amountObj.value ?? amountObj.amount ?? 0);
    const offset = Number(amountObj.offset ?? 100);
    if (!value || !offset) return 0;
    return value / offset;
  };

  // Helper to get product quantity from various possible fields
  const getProductQuantity = (product = {}, orderMsg = null) => {
    const quantity =
      product.quantity ??
      product.qty ??
      product.count ??
      orderMsg?.additionalcharges?.perItemQuantity ??
      1;
    const parsedQuantity = Number(quantity);
    return Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
  };

  // Helper to get product unit price from various formats
  const getProductUnitPrice = (product = {}, orderMsg = null) => {
    // String price (e.g., "₹100" or "100")
    if (typeof product.price === 'string') {
      const priceNumber = parseFloat(product.price.replace(/[^0-9.-]+/g, ''));
      if (priceNumber > 0) return priceNumber;
    }

    // Direct number price
    if (typeof product.price === 'number') {
      return product.price;
    }

    // Object with value/offset format
    if (product.price && typeof product.price === 'object') {
      const derivedPrice = extractAmountFromObject(product.price);
      if (derivedPrice > 0) return derivedPrice;
    }

    // Alternative price fields
    if (product.amount) {
      const derivedPrice = extractAmountFromObject(product.amount);
      if (derivedPrice > 0) return derivedPrice;
    }

    if (product.item_price) {
      const derivedPrice = extractAmountFromObject(product.item_price);
      if (derivedPrice > 0) return derivedPrice;
    }

    if (product.priceAmount) {
      const derivedPrice = extractAmountFromObject(product.priceAmount);
      if (derivedPrice > 0) return derivedPrice;
    }

    // Fallback to order's item price
    if (orderMsg?.additionalcharges?.itemPrice) {
      const fallbackPrice = parseFloat(String(orderMsg.additionalcharges.itemPrice).replace(/[^0-9.-]+/g, ''));
      if (fallbackPrice > 0) return fallbackPrice;
    }

    return 0;
  };

  // Helper to get order items/products
  const getOrderItems = (order) => {
    const metaOrderDetails = order?.metaOrderDetailMessage || {};
    const orderHistoryData =
      metaOrderDetails?.action?.parameters?.order || metaOrderDetails?.order || {};
    return Array.isArray(orderHistoryData?.items) ? orderHistoryData.items : [];
  };

  // Helper to calculate invoice totals
  const calculateInvoiceTotals = (order) => {
    const metaOrderDetails = order?.metaOrderDetailMessage || {};
    const orderHistoryData =
      metaOrderDetails?.action?.parameters?.order || metaOrderDetails?.order || {};
    const items = getOrderItems(order);

    // Calculate derived subtotal from items
    const derivedSubtotal = items.reduce((sum, product) => {
      const quantity = getProductQuantity(product, order);
      const unitPrice = getProductUnitPrice(product, order);
      return sum + unitPrice * quantity;
    }, 0);

    const subtotal = extractAmountFromObject(orderHistoryData?.subtotal) || derivedSubtotal;
    const itemTax = extractAmountFromObject(orderHistoryData?.tax);
    const itemShipping = extractAmountFromObject(orderHistoryData?.shipping);
    const itemDiscount = extractAmountFromObject(orderHistoryData?.discount);

    // Get total from various sources
    const total =
      extractAmountFromObject(metaOrderDetails?.total_amount) ||
      extractAmountFromObject(orderHistoryData?.total) ||
      (order?.amount ? parseFloat(order.amount) : 0) ||
      (subtotal + itemTax + itemShipping - itemDiscount);

    return {
      subtotal,
      itemTax,
      itemShipping,
      itemDiscount,
      total,
    };
  };

  // Helper to format price for display
  const formatPrice = (amount) => {
    if (amount === 0 || amount === undefined || amount === null) return '₹0.00';
    return '₹' + parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate order statistics (using getOrderStatusLabel for accurate status)
  const orderStats = {
    total: orders.length,
    completed: orders.filter(o => getOrderStatusLabel(o) === 'success').length,
    totalSpent: orders.reduce((sum, o) => {
      if (getOrderStatusLabel(o) === 'success' && o.amount) {
        return sum + parseFloat(o.amount);
      }
      return sum;
    }, 0),
  };

  // Render Orders Tab
  const renderOrdersTab = () => {
    const isLoading = orderHistoryStatus === 'loading';

    return (
      <View style={styles.tabContent}>
        {/* Orders Summary Card */}
        <View style={styles.ordersSummaryCard}>
          <View style={styles.ordersSummaryItem}>
            {isLoading ? (
              <ActivityIndicator size="small" color={chatColors.primary} />
            ) : (
              <Text style={styles.ordersSummaryValue}>{orderStats.total}</Text>
            )}
            <Text style={styles.ordersSummaryLabel}>Total Orders</Text>
          </View>
          <View style={styles.ordersSummaryDivider} />
          <View style={styles.ordersSummaryItem}>
            {isLoading ? (
              <ActivityIndicator size="small" color={chatColors.primary} />
            ) : (
              <Text style={styles.ordersSummaryValue}>{orderStats.completed}</Text>
            )}
            <Text style={styles.ordersSummaryLabel}>Completed</Text>
          </View>
          <View style={styles.ordersSummaryDivider} />
          <View style={styles.ordersSummaryItem}>
            {isLoading ? (
              <ActivityIndicator size="small" color={chatColors.primary} />
            ) : (
              <Text style={[styles.ordersSummaryValue, { color: chatColors.primary }]}>
                ₹{orderStats.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
            <Text style={styles.ordersSummaryLabel}>Total Spent</Text>
          </View>
        </View>

        {/* Loading State */}
        {isLoading && orders.length === 0 ? (
          <View style={styles.emptyOrdersContainer}>
            <ActivityIndicator size="large" color={chatColors.primary} />
            <Text style={[styles.emptyOrdersSubtitle, { marginTop: 16 }]}>
              Loading order history...
            </Text>
          </View>
        ) : orders.length > 0 ? (
          /* Orders List */
          <View style={styles.ordersListContainer}>
            <Text style={styles.ordersListTitle}>Order History</Text>
            {orders.map((order, index) => {
              const finalStatus = getOrderStatusLabel(order);
              const statusConfig = getApiOrderStatusConfig(finalStatus);
              const orderId = order.orderId || order.reference_id || order._id;
              const amount = order.amount ? parseFloat(order.amount) : 0;
              const createdAt = order.createdAt || order.created_at;

              return (
                <TouchableOpacity
                  key={order._id || order.id || index}
                  style={styles.orderCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedOrder({ ...order, finalStatus, statusConfig });
                    setShowInvoiceDialog(true);
                  }}
                >
                  <View style={styles.orderCardHeader}>
                    <View style={[styles.orderStatusIcon, { backgroundColor: statusConfig.bg }]}>
                      <Icon name={statusConfig.icon} size={18} color={statusConfig.color} />
                    </View>
                    <View style={styles.orderCardInfo}>
                      <Text style={styles.orderCardId} numberOfLines={1}>{orderId}</Text>
                      <Text style={styles.orderCardDate}>{formatDate(createdAt)}</Text>
                    </View>
                    <View style={styles.orderCardAmount}>
                      <Text style={styles.orderCardTotal}>
                        ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <View style={[styles.orderStatusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.orderStatusText, { color: statusConfig.color }]}>
                          {finalStatus || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {(order.invoiceId && finalStatus === 'success') && (
                    <View style={styles.orderCardFooter}>
                      <View style={styles.orderCardMeta}>
                        <Icon name="receipt" size={14} color={colors.grey[400]} />
                        <Text style={styles.orderCardMetaText} numberOfLines={1}>
                          Invoice: {order.invoiceId}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyOrdersContainer}>
            <View style={styles.emptyOrdersIcon}>
              <Icon name="shopping-outline" size={48} color={colors.grey[300]} />
            </View>
            <Text style={styles.emptyOrdersTitle}>No orders yet</Text>
            <Text style={styles.emptyOrdersSubtitle}>
              Orders placed by this contact will appear here
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render Activity Tab
  const renderActivityTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.activityTimeline}>
        {/* Activity items would be rendered here */}
        <View style={styles.activityItem}>
          <View style={styles.activityDot} />
          <View style={styles.activityLine} />
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Contact Created</Text>
            <Text style={styles.activityTime}>{formatDateTime(createdAt)}</Text>
          </View>
        </View>

        <View style={styles.activityItem}>
          <View style={[styles.activityDot, { backgroundColor: chatColors.accent }]} />
          <View style={styles.activityLine} />
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>First Message Received</Text>
            <Text style={styles.activityTime}>{formatDateTime(createdAt)}</Text>
          </View>
        </View>

        <View style={styles.activityItem}>
          <View style={[styles.activityDot, { backgroundColor: colors.info.main }]} />
          <View style={styles.activityLine} />
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Last Active</Text>
            <Text style={styles.activityTime}>{formatLastActive(lastActive)}</Text>
          </View>
        </View>

        {orders.length > 0 && (
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: colors.success.main }]} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Latest Order</Text>
              <Text style={styles.activityTime}>{formatDate(orders[0].createdAt || orders[0].created_at)}</Text>
              <Text style={styles.activityDescription}>
                {orders[0].orderId || orders[0].reference_id || 'N/A'} - ₹{orders[0].amount ? parseFloat(orders[0].amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={24} color={colors.common.white} />
        </TouchableOpacity>

        <Animated.View style={[styles.headerTitleContainer, { opacity: headerOpacity }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
        </Animated.View>

        {/* Placeholder for header alignment */}
        <View style={styles.headerAction} />
      </View>

      <Animated.ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={chatColors.primary}
            colors={[chatColors.primary]}
          />
        }
      >
        {/* Profile Hero Section */}
        <View style={styles.profileHero}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(displayName) }]}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>

          {isEditing ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                placeholderTextColor={colors.grey[400]}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.editNameActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditName(displayName);
                    setIsEditing(false);
                  }}
                  style={styles.editNameCancel}
                >
                  <Icon name="close" size={20} color={colors.grey[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveName}
                  style={styles.editNameSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.common.white} />
                  ) : (
                    <Icon name="check" size={20} color={colors.common.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameContainer}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.name}>{displayName}</Text>
              <View style={styles.editIcon}>
                <Icon name="pencil-outline" size={14} color={colors.grey[500]} />
              </View>
            </TouchableOpacity>
          )}

          {contactPhoneNumber && (
            <Text style={styles.phoneNumber}>{contactPhoneNumber}</Text>
          )}

          {/* Status Pills Row - Display only, no interaction */}
          <View style={styles.statusPillsRow}>
            <View style={[styles.statusPill, { backgroundColor: optInConfig.bg }]}>
              <Icon name={optInConfig.icon} size={12} color={optInConfig.color} />
              <Text style={[styles.statusPillText, { color: optInConfig.color }]}>
                {optInConfig.label}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: incomingBlockedConfig.bg }]}>
              <Icon name={incomingBlockedConfig.icon} size={12} color={incomingBlockedConfig.color} />
              <Text style={[styles.statusPillText, { color: incomingBlockedConfig.color }]}>
                {incomingBlockedConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          {TABS.map(renderTabButton)}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'orders' && renderOrdersTab()}
        {activeTab === 'activity' && renderActivityTab()}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* Chat Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.statusPickerOverlay}>
          <TouchableOpacity
            style={styles.statusPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowStatusPicker(false)}
          />
          <View style={styles.statusPickerContainer}>
            <View style={styles.statusPickerHandle} />
            <Text style={styles.statusPickerTitle}>Change Chat Status</Text>
            <Text style={styles.statusPickerSubtitle}>
              Select a status to update the chat
            </Text>

            <ScrollView
              style={styles.statusPickerList}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {CHAT_STATUS_OPTIONS.map((option) => {
                const isSelected = currentStatus === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusPickerOption,
                      isSelected && styles.statusPickerOptionSelected,
                    ]}
                    onPress={() => handleStatusChange(option.value)}
                    activeOpacity={0.7}
                    disabled={isUpdatingStatus}
                  >
                    <View style={[styles.statusPickerOptionIcon, { backgroundColor: `${option.color}15` }]}>
                      <Icon name={option.icon} size={22} color={option.color} />
                    </View>
                    <View style={styles.statusPickerOptionContent}>
                      <Text style={[
                        styles.statusPickerOptionLabel,
                        isSelected && { color: option.color, fontWeight: '600' }
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.statusPickerOptionDescription}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check-circle" size={22} color={option.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.statusPickerCancel}
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={styles.statusPickerCancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: insets.bottom }} />
          </View>
        </View>
      </Modal>

      {/* Chat Owner Picker Modal */}
      <Modal
        visible={showOwnerPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOwnerPicker(false)}
      >
        <View style={styles.statusPickerOverlay}>
          <TouchableOpacity
            style={styles.statusPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowOwnerPicker(false)}
          />
          <View style={styles.statusPickerContainer}>
            <View style={styles.statusPickerHandle} />
            <Text style={styles.statusPickerTitle}>Assign Chat Owner</Text>
            <Text style={styles.statusPickerSubtitle}>
              Select a team member to manage this chat
            </Text>

            <ScrollView
              style={styles.statusPickerList}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Unassigned option */}
              <TouchableOpacity
                style={[
                  styles.statusPickerOption,
                  !chatOwner && styles.statusPickerOptionSelected,
                ]}
                onPress={() => handleOwnerChange('none')}
                activeOpacity={0.7}
                disabled={isUpdatingOwner}
              >
                <View style={[styles.statusPickerOptionIcon, { backgroundColor: colors.grey[100] }]}>
                  <Icon name="account-off-outline" size={22} color={colors.grey[500]} />
                </View>
                <View style={styles.statusPickerOptionContent}>
                  <Text style={[
                    styles.statusPickerOptionLabel,
                    !chatOwner && { color: chatColors.primary, fontWeight: '600' }
                  ]}>
                    Unassigned
                  </Text>
                  <Text style={styles.statusPickerOptionDescription}>
                    No team member assigned
                  </Text>
                </View>
                {!chatOwner && (
                  <Icon name="check-circle" size={22} color={chatColors.primary} />
                )}
              </TouchableOpacity>

              {/* Team members */}
              {teamMembers.map((member) => {
                const isSelected = (chatOwner?._id || chatOwner?.id) === member._id;
                return (
                  <TouchableOpacity
                    key={member._id}
                    style={[
                      styles.statusPickerOption,
                      isSelected && styles.statusPickerOptionSelected,
                    ]}
                    onPress={() => handleOwnerChange(member)}
                    activeOpacity={0.7}
                    disabled={isUpdatingOwner}
                  >
                    <View style={[styles.statusPickerOptionIcon, { backgroundColor: `${chatColors.primary}15` }]}>
                      <Icon name="account" size={22} color={chatColors.primary} />
                    </View>
                    <View style={styles.statusPickerOptionContent}>
                      <Text style={[
                        styles.statusPickerOptionLabel,
                        isSelected && { color: chatColors.primary, fontWeight: '600' }
                      ]}>
                        {member.name}
                      </Text>
                      <Text style={styles.statusPickerOptionDescription}>
                        {member.email || member.role || 'Team Member'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check-circle" size={22} color={chatColors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {teamMembers.length === 0 && (
                <View style={styles.emptySection}>
                  <Icon name="account-group-outline" size={32} color={colors.grey[300]} />
                  <Text style={styles.emptyText}>No team members available</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.statusPickerCancel}
              onPress={() => setShowOwnerPicker(false)}
            >
              <Text style={styles.statusPickerCancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: insets.bottom }} />
          </View>
        </View>
      </Modal>

      {/* AI Assistant Selection Dialog */}
      <EnableAiAssistantDialog
        visible={showAiAssistantDialog}
        onDismiss={() => setShowAiAssistantDialog(false)}
        chatId={chatId}
        onSuccess={handleAiAssistantSuccess}
      />

      {/* Block/Unblock Contact Dialog - Bottom Sheet Style */}
      <Modal
        visible={showBlockDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlockDialog(false)}
      >
        <View style={styles.statusPickerOverlay}>
          <TouchableOpacity
            style={styles.statusPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowBlockDialog(false)}
          />
          <View style={[styles.statusPickerContainer, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.statusPickerHandle} />
            <Text style={styles.statusPickerTitle}>
              {localIncomingBlocked ? 'Unblock Contact' : 'Block Contact'}
            </Text>
            <Text style={styles.statusPickerSubtitle}>
              {localIncomingBlocked
                ? 'Allow this contact to send you messages again'
                : 'Stop receiving messages from this contact'}
            </Text>

            <View style={styles.blockPickerOptions}>
              <TouchableOpacity
                style={[
                  styles.blockPickerOption,
                  { backgroundColor: localIncomingBlocked ? colors.success.lighter : colors.error.lighter }
                ]}
                onPress={() => handleToggleBlock(!localIncomingBlocked)}
                activeOpacity={0.7}
                disabled={isBlockingContact}
              >
                <View style={[
                  styles.blockPickerOptionIcon,
                  { backgroundColor: localIncomingBlocked ? colors.success.main : colors.error.main },
                  isBlockingContact && { opacity: 0.8 },
                ]}>
                  {isBlockingContact ? (
                    <ActivityIndicator size="small" color={colors.common.white} />
                  ) : (
                    <Icon
                      name={localIncomingBlocked ? 'lock-open-outline' : 'block-helper'}
                      size={22}
                      color={colors.common.white}
                    />
                  )}
                </View>
                <View style={styles.blockPickerOptionContent}>
                  <Text style={[
                    styles.blockPickerOptionLabel,
                    { color: localIncomingBlocked ? colors.success.main : colors.error.main }
                  ]}>
                    {isBlockingContact
                      ? (localIncomingBlocked ? 'Unblocking Contact...' : 'Blocking Contact...')
                      : (localIncomingBlocked ? 'Unblock Contact' : 'Block Contact')}
                  </Text>
                  <Text style={styles.blockPickerOptionDescription}>
                    {isBlockingContact
                      ? 'Please wait while we update the settings'
                      : (localIncomingBlocked
                          ? 'Messages from this contact will be received'
                          : 'Messages from this contact will be blocked')}
                  </Text>
                </View>
                {!isBlockingContact && (
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={localIncomingBlocked ? colors.success.main : colors.error.main}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Contact Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteDialog(false);
          setDeleteConfirmText('');
          setDeleteConfirmError(false);
        }}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <View style={[styles.dialogIconContainer, { backgroundColor: colors.error.lighter }]}>
              <Icon name="delete-outline" size={32} color={colors.error.main} />
            </View>
            <Text style={styles.dialogTitle}>Delete Contact</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to delete this contact from all contact lists? If you delete this contact, its respective chats will also get deleted.
            </Text>
            <Text style={styles.dialogConfirmLabel}>
              To confirm, type <Text style={styles.dialogConfirmBold}>DELETE</Text> below:
            </Text>
            <TextInput
              style={[
                styles.dialogInput,
                deleteConfirmError && styles.dialogInputError,
              ]}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={colors.grey[400]}
              value={deleteConfirmText}
              onChangeText={(text) => {
                setDeleteConfirmText(text);
                if (text.trim() === 'DELETE') {
                  setDeleteConfirmError(false);
                }
              }}
              autoCapitalize="characters"
              editable={!isDeletingContact}
            />
            {deleteConfirmError && (
              <Text style={styles.dialogErrorText}>
                Please type DELETE to confirm
              </Text>
            )}
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonCancel]}
                onPress={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                  setDeleteConfirmError(false);
                }}
                activeOpacity={0.7}
                disabled={isDeletingContact}
              >
                <Text style={styles.dialogButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonDanger]}
                onPress={handleDeleteContact}
                activeOpacity={0.7}
                disabled={isDeletingContact}
              >
                {isDeletingContact ? (
                  <ActivityIndicator size="small" color={colors.common.white} />
                ) : (
                  <Text style={styles.dialogButtonDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Opt-in Status Picker Modal - Bottom Sheet Style */}
      <Modal
        visible={showOptInPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptInPicker(false)}
      >
        <View style={styles.statusPickerOverlay}>
          <TouchableOpacity
            style={styles.statusPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowOptInPicker(false)}
          />
          <View style={[styles.statusPickerContainer, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.statusPickerHandle} />
            <Text style={styles.statusPickerTitle}>Update Opt-in Status</Text>
            <Text style={styles.statusPickerSubtitle}>
              Choose the opt-in status for this contact
            </Text>

            <View style={styles.optInPickerOptions}>
              <TouchableOpacity
                style={[
                  styles.optInPickerOption,
                  localOptIn === true && styles.optInPickerOptionSelected,
                ]}
                onPress={() => handleOptInChange(true)}
                activeOpacity={0.7}
                disabled={isUpdatingOptIn}
              >
                <View style={[styles.optInPickerOptionIcon, { backgroundColor: colors.success.lighter }]}>
                  <Icon name="check-circle" size={22} color={colors.success.main} />
                </View>
                <View style={styles.optInPickerOptionContent}>
                  <Text style={[styles.optInPickerOptionLabel, localOptIn === true && { color: colors.success.main, fontWeight: '600' }]}>
                    Opted In
                  </Text>
                  <Text style={styles.optInPickerOptionDescription}>
                    Contact can receive messages
                  </Text>
                </View>
                {localOptIn === true && (
                  <Icon name="check-circle" size={22} color={colors.success.main} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optInPickerOption,
                  localOptIn === false && styles.optInPickerOptionSelected,
                ]}
                onPress={() => handleOptInChange(false)}
                activeOpacity={0.7}
                disabled={isUpdatingOptIn}
              >
                <View style={[styles.optInPickerOptionIcon, { backgroundColor: colors.error.lighter }]}>
                  <Icon name="close-circle" size={22} color={colors.error.main} />
                </View>
                <View style={styles.optInPickerOptionContent}>
                  <Text style={[styles.optInPickerOptionLabel, localOptIn === false && { color: colors.error.main, fontWeight: '600' }]}>
                    Opted Out
                  </Text>
                  <Text style={styles.optInPickerOptionDescription}>
                    Contact will not receive messages
                  </Text>
                </View>
                {localOptIn === false && (
                  <Icon name="check-circle" size={22} color={colors.error.main} />
                )}
              </TouchableOpacity>
            </View>

            {isUpdatingOptIn && (
              <View style={styles.optInPickerLoading}>
                <ActivityIndicator size="small" color={chatColors.primary} />
                <Text style={styles.optInPickerLoadingText}>Updating...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Invoice/Order Details Dialog - Web App Style */}
      <Modal
        visible={showInvoiceDialog}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowInvoiceDialog(false);
          setSelectedOrder(null);
        }}
      >
        <View style={styles.invoiceModalOverlay}>
          <TouchableOpacity
            style={styles.invoiceModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowInvoiceDialog(false);
              setSelectedOrder(null);
            }}
          />
          <View style={[styles.invoiceModalContainer, { paddingBottom: insets.bottom + 16 }]}>
            {/* Modal Handle */}
            <View style={styles.invoiceModalHandle} />

            {/* Invoice Header */}
            <View style={styles.invoiceHeader}>
              <View style={styles.invoiceHeaderLeft}>
                <View style={styles.invoiceHeaderTitleRow}>
                  <Text style={styles.invoiceTitle}>
                    {selectedOrder?.finalStatus === 'success' ? 'Order Invoice' : 'Order Receipt'}
                  </Text>
                  {selectedOrder?.finalStatus && (
                    <View style={[
                      styles.invoiceStatusBadge,
                      { backgroundColor: selectedOrder?.statusConfig?.bg || colors.grey[100] }
                    ]}>
                      <Icon
                        name={selectedOrder?.statusConfig?.icon || 'package-variant'}
                        size={14}
                        color={selectedOrder?.statusConfig?.color || colors.grey[500]}
                      />
                      <Text style={[
                        styles.invoiceStatusBadgeText,
                        { color: selectedOrder?.statusConfig?.color || colors.grey[500] }
                      ]}>
                        {selectedOrder?.finalStatus === 'success' ? 'Paid' :
                         selectedOrder?.finalStatus === 'pending' ? 'Pending' :
                         selectedOrder?.finalStatus === 'failed' ? 'Failed' :
                         selectedOrder?.finalStatus === 'expired' ? 'Expired' : 'N/A'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.invoiceCloseButton}
                onPress={() => {
                  setShowInvoiceDialog(false);
                  setSelectedOrder(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={22} color={colors.grey[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.invoiceContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Invoice Receipt Card */}
              <View style={styles.invoiceReceiptCard}>
                {/* Order IDs Section */}
                <View style={styles.invoiceIdsSection}>
                  <View style={styles.invoiceIdRow}>
                    <Text style={styles.invoiceIdLabel}>Order ID</Text>
                    <Text style={styles.invoiceIdValue} numberOfLines={1}>
                      {selectedOrder?.orderId || '-'}
                    </Text>
                  </View>
                  {selectedOrder?.referenceId && (
                    <View style={styles.invoiceIdRow}>
                      <Text style={styles.invoiceIdLabel}>Reference ID</Text>
                      <Text style={styles.invoiceIdValue} numberOfLines={1}>
                        {selectedOrder.referenceId}
                      </Text>
                    </View>
                  )}
                  {selectedOrder?.invoiceId && (
                    <View style={styles.invoiceIdRow}>
                      <Text style={styles.invoiceIdLabel}>Invoice ID</Text>
                      <Text style={styles.invoiceIdValue} numberOfLines={1}>
                        {selectedOrder.invoiceId}
                      </Text>
                    </View>
                  )}
                  <View style={styles.invoiceIdRow}>
                    <Text style={styles.invoiceIdLabel}>Date</Text>
                    <Text style={styles.invoiceIdValue}>
                      {selectedOrder?.createdAt
                        ? format(new Date(selectedOrder.createdAt), 'MMM d, yyyy, h:mm a')
                        : '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                {/* Products/Items Section */}
                {(() => {
                  const items = getOrderItems(selectedOrder);
                  if (items.length === 0) return null;

                  return (
                    <>
                      <View style={styles.invoiceItemsSection}>
                        <Text style={styles.invoiceSectionLabel}>Items</Text>

                        {/* Items Header */}
                        <View style={styles.invoiceItemsHeader}>
                          <Text style={[styles.invoiceItemsHeaderText, { flex: 2 }]}>Item</Text>
                          <Text style={[styles.invoiceItemsHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                          <Text style={[styles.invoiceItemsHeaderText, { flex: 1, textAlign: 'right' }]}>Price</Text>
                          <Text style={[styles.invoiceItemsHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
                        </View>

                        {/* Items List */}
                        {items.map((item, index) => {
                          const quantity = getProductQuantity(item, selectedOrder);
                          const unitPrice = getProductUnitPrice(item, selectedOrder);
                          const itemTotal = unitPrice * quantity;

                          return (
                            <View key={index} style={styles.invoiceItemRow}>
                              <Text style={[styles.invoiceItemText, { flex: 2 }]} numberOfLines={2}>
                                {item.name || `Product ${index + 1}`}
                              </Text>
                              <Text style={[styles.invoiceItemText, { flex: 1, textAlign: 'center' }]}>
                                {quantity}
                              </Text>
                              <Text style={[styles.invoiceItemText, { flex: 1, textAlign: 'right' }]}>
                                {formatPrice(unitPrice)}
                              </Text>
                              <Text style={[styles.invoiceItemText, { flex: 1, textAlign: 'right', fontWeight: '500' }]}>
                                {formatPrice(itemTotal)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.invoiceDivider} />
                    </>
                  );
                })()}

                {/* Totals Section */}
                {(() => {
                  const totals = calculateInvoiceTotals(selectedOrder);
                  const items = getOrderItems(selectedOrder);
                  const hasItems = items.length > 0;

                  return (
                    <View style={styles.invoiceTotalSection}>
                      {hasItems && (
                        <>
                          <View style={styles.invoiceTotalsRow}>
                            <Text style={styles.invoiceTotalsLabel}>Subtotal</Text>
                            <Text style={styles.invoiceTotalsValue}>
                              {totals.subtotal > 0 ? formatPrice(totals.subtotal) : 'Not Applied'}
                            </Text>
                          </View>
                          <View style={styles.invoiceTotalsRow}>
                            <Text style={styles.invoiceTotalsLabel}>Tax</Text>
                            <Text style={[
                              styles.invoiceTotalsValue,
                              totals.itemTax === 0 && styles.invoiceTotalsNotApplied
                            ]}>
                              {totals.itemTax > 0 ? formatPrice(totals.itemTax) : 'Not Applied'}
                            </Text>
                          </View>
                          <View style={styles.invoiceTotalsRow}>
                            <Text style={styles.invoiceTotalsLabel}>Shipping</Text>
                            <Text style={[
                              styles.invoiceTotalsValue,
                              totals.itemShipping === 0 && styles.invoiceTotalsNotApplied
                            ]}>
                              {totals.itemShipping > 0 ? formatPrice(totals.itemShipping) : 'Not Applied'}
                            </Text>
                          </View>
                          <View style={styles.invoiceTotalsRow}>
                            <Text style={styles.invoiceTotalsLabel}>Discount</Text>
                            <Text style={[
                              styles.invoiceTotalsValue,
                              totals.itemDiscount > 0 ? { color: colors.success.main } : styles.invoiceTotalsNotApplied
                            ]}>
                              {totals.itemDiscount > 0 ? `-${formatPrice(totals.itemDiscount)}` : 'Not Applied'}
                            </Text>
                          </View>
                          <View style={styles.invoiceTotalsDivider} />
                        </>
                      )}
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceTotalLabel}>Total</Text>
                        <Text style={styles.invoiceTotalValue}>
                          {formatPrice(totals.total)}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={styles.invoiceDivider} />

                {/* Customer Section */}
                <View style={styles.invoiceCustomerSection}>
                  <Text style={styles.invoiceSectionLabel}>Customer</Text>
                  <View style={styles.invoiceCustomerRow}>
                    <View style={[styles.invoiceCustomerAvatar, { backgroundColor: getAvatarColor(displayName) }]}>
                      <Text style={styles.invoiceCustomerAvatarText}>{getInitials(displayName)}</Text>
                    </View>
                    <View style={styles.invoiceCustomerInfo}>
                      <Text style={styles.invoiceCustomerName}>{displayName}</Text>
                      {contactPhoneNumber && (
                        <Text style={styles.invoiceCustomerPhone}>{contactPhoneNumber}</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Status Message */}
                {selectedOrder?.finalStatus === 'pending' && (
                  <>
                    <View style={styles.invoiceDivider} />
                    <View style={styles.invoiceStatusMessage}>
                      <Icon name="clock-outline" size={18} color={colors.warning.main} />
                      <Text style={[styles.invoiceStatusMessageText, { color: colors.warning.main }]}>
                        Payment is pending for this order
                      </Text>
                    </View>
                  </>
                )}

                {selectedOrder?.finalStatus === 'expired' && (
                  <>
                    <View style={styles.invoiceDivider} />
                    <View style={styles.invoiceStatusMessage}>
                      <Icon name="timer-off-outline" size={18} color={colors.grey[500]} />
                      <Text style={[styles.invoiceStatusMessageText, { color: colors.grey[500] }]}>
                        This order has expired
                      </Text>
                    </View>
                  </>
                )}

                {selectedOrder?.finalStatus === 'failed' && (
                  <>
                    <View style={styles.invoiceDivider} />
                    <View style={styles.invoiceStatusMessage}>
                      <Icon name="alert-circle-outline" size={18} color={colors.error.main} />
                      <Text style={[styles.invoiceStatusMessageText, { color: colors.error.main }]}>
                        Payment failed for this order
                      </Text>
                    </View>
                  </>
                )}

                {selectedOrder?.finalStatus === 'success' && (
                  <>
                    <View style={styles.invoiceDivider} />
                    <View style={styles.invoiceStatusMessage}>
                      <Icon name="check-circle" size={18} color={colors.success.main} />
                      <Text style={[styles.invoiceStatusMessageText, { color: colors.success.main }]}>
                        Payment completed successfully
                      </Text>
                    </View>
                  </>
                )}

                {/* Thank You Footer */}
                <View style={styles.invoiceThankYou}>
                  <Text style={styles.invoiceThankYouText}>Thank you for your business!</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.grey[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatColors.headerBg,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.common.white,
  },
  headerAction: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  profileHero: {
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.common.white,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  editIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editNameInput: {
    fontSize: 20,
    fontWeight: '400',
    color: colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: chatColors.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 150,
    textAlign: 'center',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
  },
  editNameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editNameCancel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNameSave: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNumber: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Tab Navigation
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: colors.common.white,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: `${chatColors.primary}12`,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.grey[500],
  },
  tabButtonTextActive: {
    color: chatColors.primary,
    fontWeight: '600',
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Quick Actions
  quickActionsCard: {
    flexDirection: 'row',
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // Section Card
  sectionCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${chatColors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info List - Compact style for read-only contact details
  infoList: {
    gap: 12,
  },
  infoItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoContentCompact: {
    flex: 1,
    marginRight: 8,
  },
  infoLabelSmall: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 1,
    ...Platform.select({
      ios: { fontWeight: '500' },
      android: { fontWeight: '500' },
    }),
  },
  infoValueCompact: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  copyButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.grey[50],
  },

  // Settings List - Interactive contact settings
  settingsList: {
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.common.white,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.grey[100],
    marginLeft: 60,
  },

  // Legacy info styles (kept for compatibility)
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Chat Status Selector
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  statusSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextContainer: {
    gap: 2,
  },
  statusSelectorLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  statusSelectorValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusSelectorText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 10,
    paddingHorizontal: 4,
  },

  // Status Picker Modal
  statusPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  statusPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  statusPickerContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  statusPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[300],
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  statusPickerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  statusPickerList: {
    maxHeight: 400,
  },
  statusPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.grey[50],
  },
  statusPickerOptionSelected: {
    backgroundColor: `${chatColors.primary}08`,
    borderWidth: 1,
    borderColor: `${chatColors.primary}30`,
  },
  statusPickerOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusPickerOptionContent: {
    flex: 1,
  },
  statusPickerOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  statusPickerOptionDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  statusPickerCancel: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
  },
  statusPickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Empty Section
  emptySection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: `${chatColors.primary}12`,
    borderRadius: 20,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: chatColors.primary,
  },

  // Attributes
  attributesList: {
    gap: 8,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.grey[50],
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  attributeKey: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  attributeValue: {
    fontSize: 13,
    color: colors.text.secondary,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // Details
  detailsList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  detailValueSmall: {
    fontSize: 11,
    color: colors.text.secondary,
    maxWidth: '60%',
  },

  // Danger Zone
  dangerCard: {
    backgroundColor: colors.error.lighter,
    gap: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.common.white,
    borderRadius: 10,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error.main,
  },

  // Orders Tab
  ordersSummaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  ordersSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  ordersSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  ordersSummaryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  ordersSummaryDivider: {
    width: 1,
    backgroundColor: colors.grey[200],
    marginVertical: 4,
  },
  ordersListContainer: {
    gap: 12,
  },
  ordersListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  orderCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderCardInfo: {
    flex: 1,
  },
  orderCardId: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  orderCardDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  orderCardAmount: {
    alignItems: 'flex-end',
  },
  orderCardTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  orderCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 16,
  },
  orderCardMetaText: {
    fontSize: 12,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },

  // Empty Orders
  emptyOrdersContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: colors.common.white,
    borderRadius: 16,
  },
  emptyOrdersIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyOrdersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyOrdersSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Activity Tab
  activityTimeline: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 20,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: chatColors.primary,
    marginTop: 4,
    marginRight: 16,
  },
  activityLine: {
    position: 'absolute',
    left: 5,
    top: 20,
    width: 2,
    height: '100%',
    backgroundColor: colors.grey[200],
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  activityDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 6,
    backgroundColor: colors.grey[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // Info Edit Chip
  infoEditChip: {
    backgroundColor: `${chatColors.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoEditChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: chatColors.primary,
  },

  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dialogIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  dialogConfirmLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  dialogConfirmBold: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  dialogInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.grey[300],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.grey[50],
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  dialogInputError: {
    borderColor: colors.error.main,
    backgroundColor: colors.error.lighter,
  },
  dialogErrorText: {
    fontSize: 12,
    color: colors.error.main,
    marginBottom: 12,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonCancel: {
    backgroundColor: colors.grey[100],
  },
  dialogButtonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  dialogButtonDanger: {
    backgroundColor: colors.error.main,
  },
  dialogButtonSuccess: {
    backgroundColor: colors.success.main,
  },
  dialogButtonDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },

  // Opt-in Picker Styles (Bottom Sheet)
  optInPickerOptions: {
    paddingHorizontal: 4,
    gap: 10,
  },
  optInPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[50],
  },
  optInPickerOptionSelected: {
    backgroundColor: `${chatColors.primary}08`,
    borderWidth: 1,
    borderColor: `${chatColors.primary}30`,
  },
  optInPickerOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optInPickerOptionContent: {
    flex: 1,
  },
  optInPickerOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  optInPickerOptionDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  optInPickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  optInPickerLoadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Block Picker Styles (Bottom Sheet)
  blockPickerOptions: {
    paddingHorizontal: 4,
  },
  blockPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    minHeight: 72,
  },
  blockPickerOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  blockPickerOptionContent: {
    flex: 1,
  },
  blockPickerOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  blockPickerOptionDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  // Invoice Dialog Styles
  invoiceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  invoiceModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  invoiceModalContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  invoiceModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[200],
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  invoiceHeaderLeft: {
    flex: 1,
  },
  invoiceHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  invoiceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  invoiceStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceContent: {
    paddingHorizontal: 20,
  },
  invoiceReceiptCard: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  invoiceIdsSection: {
    gap: 12,
  },
  invoiceIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceIdLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  invoiceIdValue: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.grey[100],
    marginVertical: 20,
  },
  // Invoice Items Section Styles
  invoiceItemsSection: {
    gap: 12,
  },
  invoiceItemsHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.grey[50],
    borderRadius: 8,
    marginBottom: 8,
  },
  invoiceItemsHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
    alignItems: 'center',
  },
  invoiceItemText: {
    fontSize: 13,
    color: colors.text.primary,
  },
  // Invoice Totals Breakdown Styles
  invoiceTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  invoiceTotalsLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  invoiceTotalsValue: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  invoiceTotalsNotApplied: {
    color: colors.grey[400],
    fontStyle: 'italic',
    fontWeight: '400',
  },
  invoiceTotalsDivider: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginVertical: 8,
  },
  invoiceTotalSection: {
    paddingVertical: 4,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  invoiceTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  invoiceCustomerSection: {
    gap: 12,
  },
  invoiceSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceCustomerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceCustomerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.common.white,
  },
  invoiceCustomerInfo: {
    flex: 1,
  },
  invoiceCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  invoiceCustomerPhone: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  invoiceStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  invoiceStatusMessageText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  invoiceThankYou: {
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  invoiceThankYouText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
});

export default ContactInfoScreen;
