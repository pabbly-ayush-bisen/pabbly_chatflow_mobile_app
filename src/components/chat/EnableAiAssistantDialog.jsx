import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { colors, chatColors } from '../../theme/colors';
import { CustomDialog } from '../common';
import { fetchAiAssistants, toggleAiAssistant } from '../../redux/slices/inboxSlice';

/**
 * EnableAiAssistantDialog - Dialog to select which AI Assistant to assign to a chat
 * Shown when user changes chat status to 'AI Assistant'
 */
const EnableAiAssistantDialog = ({
  visible,
  onDismiss,
  chatId,
  onSuccess,
}) => {
  const dispatch = useDispatch();
  const {
    aiAssistants,
    aiAssistantsStatus,
    toggleAiAssistantStatus,
  } = useSelector((state) => state.inbox);

  const isLoading = aiAssistantsStatus === 'loading';
  const isToggling = toggleAiAssistantStatus === 'loading';

  // Fetch AI assistants when dialog opens
  useEffect(() => {
    if (visible) {
      dispatch(fetchAiAssistants());
    }
  }, [visible, dispatch]);

  // Handle assistant selection
  const handleSelectAssistant = useCallback(async (assistant) => {
    if (isToggling || !chatId) return;

    try {
      await dispatch(toggleAiAssistant({
        chatId,
        assistantId: assistant._id,
        isActive: true,
      })).unwrap();

      // Call success callback
      if (onSuccess) {
        onSuccess(assistant);
      }
      onDismiss();
    } catch (error) {
      // Error is handled by the parent component
    }
  }, [chatId, isToggling, dispatch, onDismiss, onSuccess]);

  // Render assistant item
  const renderAssistantItem = (assistant) => {
    const isActive = assistant.status === 'active';

    return (
      <TouchableOpacity
        key={assistant._id}
        style={styles.assistantItem}
        onPress={() => handleSelectAssistant(assistant)}
        disabled={isToggling || !isActive}
        activeOpacity={0.7}
      >
        <View style={styles.assistantIconContainer}>
          <Icon
            name="robot"
            size={24}
            color={isActive ? '#7C3AED' : colors.grey[400]}
          />
        </View>
        <View style={styles.assistantContent}>
          <Text style={styles.assistantName}>{assistant.name}</Text>
          {assistant.description && (
            <Text style={styles.assistantDescription} numberOfLines={2}>
              {assistant.description}
            </Text>
          )}
          <View style={styles.assistantMeta}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isActive ? colors.success.main : colors.grey[400] }
            ]} />
            <Text style={[
              styles.statusText,
              { color: isActive ? colors.success.main : colors.grey[500] }
            ]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <Icon
          name="chevron-right"
          size={24}
          color={colors.grey[400]}
        />
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="robot-off-outline" size={48} color={colors.grey[300]} />
      </View>
      <Text style={styles.emptyTitle}>No AI Assistants Available</Text>
      <Text style={styles.emptyText}>
        Create an AI Assistant from the web dashboard to enable it for this chat.
      </Text>
    </View>
  );

  return (
    <CustomDialog
      visible={visible}
      onDismiss={onDismiss}
      title="Select AI Assistant"
      icon="robot"
      iconColor="#7C3AED"
      showCloseButton
      dismissable={!isToggling}
    >
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Choose an AI Assistant to handle this conversation
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Loading assistants...</Text>
          </View>
        ) : aiAssistants.length > 0 ? (
          <ScrollView
            style={styles.assistantsList}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {aiAssistants.map(renderAssistantItem)}
          </ScrollView>
        ) : (
          renderEmptyState()
        )}

        {isToggling && (
          <View style={styles.togglingOverlay}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.togglingText}>Enabling AI Assistant...</Text>
          </View>
        )}
      </View>
    </CustomDialog>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 12,
  },
  assistantsList: {
    maxHeight: 300,
  },
  assistantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  assistantIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C3AED15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assistantContent: {
    flex: 1,
  },
  assistantName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  assistantDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  assistantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  togglingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  togglingText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
    marginTop: 12,
  },
});

export default EnableAiAssistantDialog;
