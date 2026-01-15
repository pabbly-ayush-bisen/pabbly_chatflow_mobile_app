import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { colors, chatColors, getAvatarColor } from '../../theme/colors';
import {
  deleteChat,
  toggleChatNotifications,
  assignChatToMember,
  fetchTeamMembers,
} from '../../redux/slices/inboxSlice';

const ChatOptionsMenu = ({
  visible,
  onClose,
  chat,
  chatId,
  onOpenNotes,
  onOpenContactInfo,
  navigation,
}) => {
  const dispatch = useDispatch();
  const { teamMembers, teamMembersStatus } = useSelector((state) => state.inbox);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch team members when showing assign modal
  useEffect(() => {
    if (showAssignModal && teamMembersStatus === 'idle') {
      dispatch(fetchTeamMembers());
    }
  }, [showAssignModal, teamMembersStatus, dispatch]);

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
      Alert.alert('Error', error || 'Failed to update notification settings');
    }
  }, [chatId, isMuted, dispatch, onClose]);

  // Handle delete chat
  const handleDeleteChat = useCallback(() => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await dispatch(deleteChat(chatId)).unwrap();
              onClose();
              navigation?.goBack();
            } catch (error) {
              Alert.alert('Error', error || 'Failed to delete chat');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [chatId, dispatch, onClose, navigation]);

  // Handle assign to member
  const handleAssignToMember = useCallback(async (memberId) => {
    try {
      await dispatch(assignChatToMember({ chatId, memberId })).unwrap();
      setShowAssignModal(false);
      onClose();
      Alert.alert('Success', 'Chat assigned successfully');
    } catch (error) {
      Alert.alert('Error', error || 'Failed to assign chat');
    }
  }, [chatId, dispatch, onClose]);

  // Handle open notes
  const handleOpenNotes = useCallback(() => {
    onClose();
    onOpenNotes?.();
  }, [onClose, onOpenNotes]);

  // Handle view contact info
  const handleViewContactInfo = useCallback(() => {
    onClose();
    onOpenContactInfo?.();
  }, [onClose, onOpenContactInfo]);

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
      icon: 'note-plus',
      label: 'Add notes',
      color: '#4CAF50',
      onPress: handleOpenNotes,
    },
    {
      icon: 'delete',
      label: 'Delete chat',
      color: '#F44336',
      onPress: handleDeleteChat,
      danger: true,
    },
  ];

  // Render team member item
  const renderTeamMember = ({ item }) => (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => handleAssignToMember(item._id)}
      activeOpacity={0.7}
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
      {chat?.assignedToMember === item._id && (
        <Icon name="check-circle" size={20} color={colors.success.main} />
      )}
    </TouchableOpacity>
  );

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

            {teamMembersStatus === 'loading' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={chatColors.primary} />
                <Text style={styles.loadingText}>Loading team members...</Text>
              </View>
            ) : teamMembers.length === 0 ? (
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
    gap: 12,
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
