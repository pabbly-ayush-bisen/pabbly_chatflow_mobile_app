import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Clipboard,
  Share,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getMessageText, getMessageCaption } from '../../utils/messageHelpers';
import { toastActions, showWarning } from '../../utils/toast';

const REACTION_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '😢'];

const MessageActionsMenu = ({
  visible,
  onClose,
  message,
  onForward,
  onReaction,
}) => {
  // Get text content for copy
  const getTextToCopy = useCallback(() => {
    if (!message) return '';
    const text = getMessageText(message);
    const caption = getMessageCaption(message);
    return text || caption || '';
  }, [message]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const text = getTextToCopy();
    if (text) {
      Clipboard.setString(text);
      onClose();
      // Show brief feedback
      toastActions.copiedToClipboard();
    } else {
      showWarning('This message type cannot be copied', 'Cannot Copy');
    }
  }, [getTextToCopy, onClose]);

  // Handle forward
  const handleForward = useCallback(async () => {
    const text = getTextToCopy();
    if (text) {
      try {
        await Share.share({
          message: text,
        });
      } catch (error) {
        // Error:('Error sharing:', error);
      }
    }
    onForward?.(message);
    onClose();
  }, [message, getTextToCopy, onForward, onClose]);

  // Handle reaction selection
  const handleReactionSelect = useCallback((emoji) => {
    onReaction?.(emoji, message);
    onClose();
  }, [message, onReaction, onClose]);

  const actions = [
    {
      icon: 'content-copy',
      label: 'Copy',
      onPress: handleCopy,
      color: colors.grey[700],
    },
    {
      icon: 'share-variant',
      label: 'Forward',
      onPress: handleForward,
      color: colors.success.main,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Reaction emoji row */}
          <View style={styles.reactionRow}>
            {REACTION_EMOJIS.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionButton}
                onPress={() => handleReactionSelect(emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Action buttons */}
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionButton}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <Icon name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
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
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginHorizontal: 20,
    marginVertical: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});

export default MessageActionsMenu;
