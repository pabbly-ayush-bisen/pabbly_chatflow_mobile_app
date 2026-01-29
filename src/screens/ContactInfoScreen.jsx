import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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
import { updateContact } from '../redux/slices/contactSlice';
import { getSettings } from '../redux/slices/settingsSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Chat owner state
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [chatOwner, setChatOwner] = useState(chat?.assignedToMember || null);
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false);

  // Get chat status from Redux
  const { updateContactChatStatus } = useSelector((state) => state.inbox);

  // Get team members from settings
  const { settings } = useSelector((state) => state.settings);
  const teamMembers = settings?.teamMembers?.items || [];

  // Mock orders data - In real app, this would come from API/Redux
  const [orders] = useState([
    {
      _id: '1',
      reference_id: 'ORD-2024-001',
      status: 'delivered',
      payment_status: 'paid',
      total: 2499.00,
      currency: 'INR',
      items_count: 3,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      _id: '2',
      reference_id: 'ORD-2024-002',
      status: 'processing',
      payment_status: 'pending',
      total: 899.00,
      currency: 'INR',
      items_count: 1,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      _id: '3',
      reference_id: 'ORD-2024-003',
      status: 'cancelled',
      payment_status: 'refunded',
      total: 1599.00,
      currency: 'INR',
      items_count: 2,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  // Get contact data from various sources
  const contactData = contact || chat?.contact || {};
  const contactName = contactData.name || contactData.phoneNumber || 'Unknown';
  const contactPhoneNumber = contactData.phoneNumber || contactData.phone_number || '';
  const contactEmail = contactData.email || '';
  const contactTags = contactData.tags || [];
  const contactAttributes = contactData.attributes || contactData.customAttributes || {};
  const lastActive = contactData.lastActive || chat?.lastActive;
  const createdAt = contactData.createdAt || chat?.createdAt;
  const optInStatus = contactData.optIn?.status || 'unknown';

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
        Alert.alert('Success', member === 'none'
          ? 'Chat owner removed'
          : `Chat assigned to ${member.name}`);
      } else {
        Alert.alert('Error', result.message || 'Failed to update chat owner');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || error || 'Failed to update chat owner');
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
        Alert.alert('Success', `Chat status updated to ${getStatusLabel(newStatus)}`);
      } else {
        Alert.alert('Error', result.message || 'Failed to update chat status');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || error || 'Failed to update chat status');
    } finally {
      setIsUpdatingStatus(false);
      setShowStatusPicker(false);
    }
  }, [chatId, chat, currentStatus, dispatch]);

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
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
      Alert.alert('Error', 'Contact ID not found. Cannot update name.');
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
        Alert.alert('Success', 'Contact name updated successfully');
        setIsEditing(false);
      } else {
        Alert.alert('Error', result.message || 'Failed to update contact name');
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update contact name';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [editName, displayName, contactData, contact, chatId, dispatch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // TODO: Refresh contact data and orders
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

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

  const getOptInStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'opted_in':
      case 'active':
        return { color: colors.success.main, bg: colors.success.lighter, label: 'Opted In', icon: 'check-circle' };
      case 'opted_out':
      case 'inactive':
        return { color: colors.error.main, bg: colors.error.lighter, label: 'Opted Out', icon: 'close-circle' };
      default:
        return { color: colors.warning.main, bg: colors.warning.lighter, label: 'Unknown', icon: 'help-circle' };
    }
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

  const optInConfig = getOptInStatusConfig(optInStatus);

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
      {/* Contact Info Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="information-outline" size={20} color={chatColors.primary} />
          <Text style={styles.sectionTitle}>Contact Information</Text>
        </View>

        <View style={styles.infoList}>
          {contactPhoneNumber && (
            <View style={styles.infoItem}>
              <View style={styles.infoIconContainer}>
                <Icon name="phone-outline" size={18} color={colors.grey[500]} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{contactPhoneNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => {/* Copy to clipboard */}}>
                <Icon name="content-copy" size={18} color={colors.grey[400]} />
              </TouchableOpacity>
            </View>
          )}

          {contactEmail && (
            <View style={styles.infoItem}>
              <View style={styles.infoIconContainer}>
                <Icon name="email-outline" size={18} color={colors.grey[500]} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{contactEmail}</Text>
              </View>
              <TouchableOpacity onPress={() => {/* Copy to clipboard */}}>
                <Icon name="content-copy" size={18} color={colors.grey[400]} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Icon name="shield-check-outline" size={18} color={colors.grey[500]} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Opt-in Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: optInConfig.bg }]}>
                <Icon name={optInConfig.icon} size={12} color={optInConfig.color} />
                <Text style={[styles.statusBadgeText, { color: optInConfig.color }]}>
                  {optInConfig.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Icon name="clock-outline" size={18} color={colors.grey[500]} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Last Active</Text>
              <Text style={styles.infoValue}>{formatLastActive(lastActive)}</Text>
            </View>
          </View>
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
        <TouchableOpacity style={styles.dangerButton}>
          <Icon name="block-helper" size={20} color={colors.error.main} />
          <Text style={styles.dangerButtonText}>Block Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton}>
          <Icon name="delete-outline" size={20} color={colors.error.main} />
          <Text style={styles.dangerButtonText}>Delete Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render Orders Tab
  const renderOrdersTab = () => (
    <View style={styles.tabContent}>
      {/* Orders Summary Card */}
      <View style={styles.ordersSummaryCard}>
        <View style={styles.ordersSummaryItem}>
          <Text style={styles.ordersSummaryValue}>{orders.length}</Text>
          <Text style={styles.ordersSummaryLabel}>Total Orders</Text>
        </View>
        <View style={styles.ordersSummaryDivider} />
        <View style={styles.ordersSummaryItem}>
          <Text style={styles.ordersSummaryValue}>
            {orders.filter(o => o.status === 'delivered').length}
          </Text>
          <Text style={styles.ordersSummaryLabel}>Completed</Text>
        </View>
        <View style={styles.ordersSummaryDivider} />
        <View style={styles.ordersSummaryItem}>
          <Text style={[styles.ordersSummaryValue, { color: chatColors.primary }]}>
            ₹{orders.reduce((sum, o) => o.status !== 'cancelled' ? sum + o.total : sum, 0).toLocaleString()}
          </Text>
          <Text style={styles.ordersSummaryLabel}>Total Spent</Text>
        </View>
      </View>

      {/* Orders List */}
      {orders.length > 0 ? (
        <View style={styles.ordersListContainer}>
          <Text style={styles.ordersListTitle}>Order History</Text>
          {orders.map((order) => {
            const statusConfig = getOrderStatusConfig(order.status);
            return (
              <TouchableOpacity
                key={order._id}
                style={styles.orderCard}
                activeOpacity={0.7}
              >
                <View style={styles.orderCardHeader}>
                  <View style={[styles.orderStatusIcon, { backgroundColor: statusConfig.bg }]}>
                    <Icon name={statusConfig.icon} size={18} color={statusConfig.color} />
                  </View>
                  <View style={styles.orderCardInfo}>
                    <Text style={styles.orderCardId}>{order.reference_id}</Text>
                    <Text style={styles.orderCardDate}>{formatDate(order.created_at)}</Text>
                  </View>
                  <View style={styles.orderCardAmount}>
                    <Text style={styles.orderCardTotal}>
                      {order.currency} {order.total.toLocaleString()}
                    </Text>
                    <View style={[styles.orderStatusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.orderStatusText, { color: statusConfig.color }]}>
                        {order.status}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.orderCardFooter}>
                  <View style={styles.orderCardMeta}>
                    <Icon name="package-variant" size={14} color={colors.grey[400]} />
                    <Text style={styles.orderCardMetaText}>
                      {order.items_count} {order.items_count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <View style={styles.orderCardMeta}>
                    <Icon
                      name={order.payment_status === 'paid' ? 'check-circle' : 'clock-outline'}
                      size={14}
                      color={order.payment_status === 'paid' ? colors.success.main : colors.warning.main}
                    />
                    <Text style={[
                      styles.orderCardMetaText,
                      { color: order.payment_status === 'paid' ? colors.success.main : colors.warning.main }
                    ]}>
                      {order.payment_status}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.grey[400]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
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
              <Text style={styles.activityTime}>{formatDate(orders[0].created_at)}</Text>
              <Text style={styles.activityDescription}>
                {orders[0].reference_id} - {orders[0].currency} {orders[0].total.toLocaleString()}
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

        <TouchableOpacity style={styles.headerAction}>
          <Icon name="dots-vertical" size={24} color={colors.common.white} />
        </TouchableOpacity>
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

          <View style={[styles.statusPill, { backgroundColor: optInConfig.bg }]}>
            <Icon name={optInConfig.icon} size={14} color={optInConfig.color} />
            <Text style={[styles.statusPillText, { color: optInConfig.color }]}>
              {optInConfig.label}
            </Text>
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
    fontWeight: '600',
    color: colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: chatColors.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 150,
    textAlign: 'center',
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  statusPillText: {
    fontSize: 12,
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

  // Info List
  infoList: {
    gap: 16,
  },
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
});

export default ContactInfoScreen;
