import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Text, ActivityIndicator, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { colors, chatColors, getAvatarColor } from '../../theme/colors';
import { showError, showSuccess } from '../../utils/toast';
import { CustomDialog } from '../common';
import {
  deleteChat,
  toggleChatNotifications,
  updateContactChat,
  updateChatInList,
} from '../../redux/slices/inboxSlice';
import { getSettings } from '../../redux/slices/settingsSlice';

const ChatOptionsMenu = ({
  visible,
  onClose,
  chat,
  chatId,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Get team members from settings (same pattern as ContactInfoScreen)
  const { settings } = useSelector((state) => state.settings);
  const teamMembers = settings?.teamMembers?.items || [];

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch team members when showing assign modal
  useEffect(() => {
    if (showAssignModal && !settings?.teamMembers) {
      dispatch(getSettings('teamMembers'));
    }
  }, [showAssignModal, settings?.teamMembers, dispatch]);

  const isMuted = chat?.hideNotification || false;

  // Handle mute/unmute
  const handleToggleMute = useCallback(async () => {
    try {
      await dispatch(toggleChatNotifications({
        chatId,
        hideNotification: !isMuted,
      })).unwrap();
      onClose();
    } catch (error) {
      showError(error || 'Failed to update notification settings');
    }
  }, [chatId, isMuted, dispatch, onClose]);

  // Handle delete chat
  const handleDeleteChat = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  // Confirm delete action
  const confirmDeleteChat = useCallback(async () => {
    setIsDeleting(true);
    try {
      await dispatch(deleteChat(chatId)).unwrap();
      setShowDeleteDialog(false);
      onClose();
      navigation?.goBack();
    } catch (error) {
      showError(error || 'Failed to delete chat');
    } finally {
      setIsDeleting(false);
    }
  }, [chatId, dispatch, onClose, navigation]);

  // Handle assign to member - using updateContactChat pattern like ContactInfoScreen
  const handleAssignToMember = useCallback(async (member) => {
    const currentOwner = chat?.assignedToMember;

    // Check if already assigned to this member
    if ((member?._id || member?.id) === (currentOwner?._id || currentOwner?.id)) {
      setShowAssignModal(false);
      onClose();
      return;
    }

    setIsAssigning(true);
    try {
      // Prepare payload matching web app format (same as ContactInfoScreen)
      let payload;
      if (member === 'none') {
        payload = 'none';
      } else {
        const { name, role, email, _id } = member;
        payload = { name, email, role, id: _id };
      }

      const result = await dispatch(updateContactChat({
        id: chatId,
        status: chat?.status || 'open',
        assignedToMember: payload,
        hideNotification: chat?.hideNotification || false,
      })).unwrap();

      if (result.status === 'success' || result.response?.status === 'success') {
        // Update the chat in the list
        dispatch(updateChatInList({
          _id: chatId,
          assignedToMember: payload,
        }));
        setShowAssignModal(false);
        onClose();
        showSuccess(member === 'none'
          ? 'Chat owner removed'
          : `Chat assigned to ${member.name}`, 'Success');
      } else {
        showError(result.message || 'Failed to assign chat');
      }
    } catch (error) {
      showError(error?.message || error || 'Failed to assign chat');
    } finally {
      setIsAssigning(false);
    }
  }, [chatId, chat, dispatch, onClose]);

  // Handle view contact info - navigate to ContactInfoScreen
  const handleViewContactInfo = useCallback(() => {
    onClose();
    navigation.navigate('ContactInfo', {
      contact: chat?.contact,
      chatId,
      chat,
    });
  }, [onClose, navigation, chat, chatId]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.match(/\b\w/g)?.join('')?.slice(0, 2)?.toUpperCase() || '?';
  };

  const menuOptions = [
    {
      icon: 'account-details',
      label: 'Contact info',
      color: chatColors.primary,
      onPress: handleViewContactInfo,
    },
    {
      icon: 'account-plus',
      label: 'Assign to member',
      color: '#2196F3',
      onPress: () => setShowAssignModal(true),
    },
    {
      icon: isMuted ? 'bell' : 'bell-off',
      label: isMuted ? 'Unmute notifications' : 'Mute notifications',
      color: '#FF9800',
      onPress: handleToggleMute,
    },
    {
      icon: 'delete',
      label: 'Delete chat',
      color: '#F44336',
      onPress: handleDeleteChat,
      danger: true,
    },
  ];

  // Get current chat owner
  const chatOwner = chat?.assignedToMember;

  // Render team member item
  const renderTeamMember = ({ item }) => {
    const isSelected = (chatOwner?._id || chatOwner?.id) === item._id;
    return (
      <TouchableOpacity
        style={[styles.memberItem, isSelected && styles.memberItemSelected]}
        onPress={() => handleAssignToMember(item)}
        activeOpacity={0.7}
        disabled={isAssigning}
      >
        <Avatar.Text
          size={40}
          label={getInitials(item.name)}
          style={{ backgroundColor: getAvatarColor(item.name) }}
          labelStyle={styles.memberAvatarLabel}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
        </View>
        {isSelected && (
          <Icon name="check-circle" size={20} color={colors.success.main} />
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <>
      {/* Main options menu */}
      <Modal
        visible={visible && !showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.container}>
            <View style={styles.handle} />

            <Text style={styles.title}>Chat Options</Text>

            <View style={styles.optionsContainer}>
              {menuOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionItem}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                  disabled={isDeleting && option.danger}
                >
                  <View style={[styles.optionIcon, { backgroundColor: option.color + '15' }]}>
                    {isDeleting && option.danger ? (
                      <ActivityIndicator size="small" color={option.color} />
                    ) : (
                      <Icon name={option.icon} size={22} color={option.color} />
                    )}
                  </View>
                  <Text style={[styles.optionLabel, option.danger && styles.dangerLabel]}>
                    {option.label}
                  </Text>
                  <Icon name="chevron-right" size={20} color={colors.grey[400]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assign to member modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowAssignModal(false)}
        >
          <View style={[styles.container, styles.assignContainer]}>
            <View style={styles.handle} />

            <View style={styles.assignHeader}>
              <TouchableOpacity
                onPress={() => setShowAssignModal(false)}
                style={styles.backButton}
              >
                <Icon name="arrow-left" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.title}>Assign to Member</Text>
            </View>

            {isAssigning && (
              <View style={styles.assigningOverlay}>
                <ActivityIndicator size="small" color={chatColors.primary} />
                <Text style={styles.assigningText}>Assigning...</Text>
              </View>
            )}

            {/* Unassigned option */}
            <TouchableOpacity
              style={[styles.memberItem, !chatOwner && styles.memberItemSelected]}
              onPress={() => handleAssignToMember('none')}
              activeOpacity={0.7}
              disabled={isAssigning}
            >
              <View style={[styles.unassignedAvatar]}>
                <Icon name="account-off-outline" size={22} color={colors.grey[500]} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>Unassigned</Text>
                <Text style={styles.memberEmail}>Remove current assignment</Text>
              </View>
              {!chatOwner && (
                <Icon name="check-circle" size={20} color={colors.success.main} />
              )}
            </TouchableOpacity>

            {teamMembers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="account-group-outline" size={48} color={colors.grey[300]} />
                <Text style={styles.emptyText}>No team members found</Text>
              </View>
            ) : (
              <FlatList
                data={teamMembers}
                renderItem={renderTeamMember}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.membersList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Chat Confirmation Dialog */}
      <CustomDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        icon="delete-outline"
        iconColor={colors.error.main}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently removed."
        actions={[
          {
            label: 'Cancel',
            onPress: () => setShowDeleteDialog(false),
          },
          {
            label: 'Delete',
            onPress: confirmDeleteChat,
            destructive: true,
            loading: isDeleting,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  assignContainer: {
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  optionsContainer: {
    paddingHorizontal: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  dangerLabel: {
    color: colors.error.main,
  },
  // Assign modal styles
  assignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  membersList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  memberItemSelected: {
    backgroundColor: `${chatColors.primary}10`,
    borderRadius: 12,
  },
  unassignedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigningOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  assigningText: {
    fontSize: 14,
    color: chatColors.primary,
  },
  memberAvatarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  memberEmail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default ChatOptionsMenu;
