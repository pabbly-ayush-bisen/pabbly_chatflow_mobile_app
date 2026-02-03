import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';
import { CustomDialog } from '../common';

// Status options when stopping AI Assistant - matches web app behavior
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', icon: 'message-outline', color: colors.info.main, description: 'Chat is open and active' },
  { value: 'intervened', label: 'Intervened', icon: 'hand-back-left', color: colors.warning.main, description: 'Manual intervention mode' },
  { value: 'on_hold', label: 'On Hold', icon: 'pause-circle-outline', color: colors.grey[600], description: 'Chat is temporarily paused' },
  { value: 'replied', label: 'Replied', icon: 'reply-outline', color: colors.success.main, description: 'Waiting for customer response' },
  { value: 'pending', label: 'Pending', icon: 'clock-outline', color: colors.warning.dark, description: 'Awaiting action' },
  { value: 'resolved', label: 'Resolved', icon: 'check-circle-outline', color: colors.success.main, description: 'Issue has been resolved' },
  { value: 'closed', label: 'Closed', icon: 'close-circle-outline', color: colors.error.main, description: 'Chat is closed' },
];

/**
 * StopAiAssistantDialog - Dialog to stop AI Assistant with status selection
 * Allows user to choose what status to move the chat to when stopping AI
 */
const StopAiAssistantDialog = ({
  visible,
  onDismiss,
  onConfirm,
  isLoading = false,
}) => {
  const [selectedStatus, setSelectedStatus] = useState('intervened'); // Default to intervened

  // Handle status selection
  const handleSelectStatus = useCallback((status) => {
    setSelectedStatus(status);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    onConfirm?.(selectedStatus);
  }, [selectedStatus, onConfirm]);

  // Reset selection when dialog closes
  const handleDismiss = useCallback(() => {
    setSelectedStatus('intervened');
    onDismiss?.();
  }, [onDismiss]);

  return (
    <CustomDialog
      visible={visible}
      onDismiss={handleDismiss}
      title="Stop AI Assistant"
      icon="robot-off"
      iconColor={colors.error.main}
      showCloseButton
      dismissable={!isLoading}
    >
      <View style={styles.container}>
        <Text style={styles.message}>
          AI Assistant will be stopped for this conversation. Select the status to move this chat to:
        </Text>

        <ScrollView
          style={styles.statusList}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {STATUS_OPTIONS.map((option) => {
            const isSelected = selectedStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  isSelected && styles.statusOptionSelected,
                  isSelected && { borderColor: option.color },
                ]}
                onPress={() => handleSelectStatus(option.value)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <View style={[styles.statusIconContainer, { backgroundColor: `${option.color}15` }]}>
                  <Icon name={option.icon} size={20} color={option.color} />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[
                    styles.statusLabel,
                    isSelected && { color: option.color, fontWeight: '600' }
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.statusDescription} numberOfLines={1}>
                    {option.description}
                  </Text>
                </View>
                {isSelected && (
                  <Icon name="check-circle" size={20} color={option.color} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleDismiss}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.common.white} />
            ) : (
              <>
                <Icon name="stop-circle" size={18} color={colors.common.white} />
                <Text style={styles.confirmButtonText}>Stop AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </CustomDialog>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  statusList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusOptionSelected: {
    backgroundColor: colors.common.white,
  },
  statusIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.error.main,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.common.white,
  },
});

export default StopAiAssistantDialog;
