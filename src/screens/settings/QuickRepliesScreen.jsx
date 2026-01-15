import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar, FAB, Surface, Portal, Modal, Button, TextInput, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, updateSettings, deleteSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

export default function QuickRepliesScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const { settings, getSettingsStatus, updateSettingsStatus, deleteSettingsStatus, getSettingsError, updateSettingsError, deleteSettingsError } = useSelector(
    (state) => state.settings
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [replyToDelete, setReplyToDelete] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isLoading = getSettingsStatus === 'loading';
  const isSaving = updateSettingsStatus === 'loading';
  const isDeleting = deleteSettingsStatus === 'loading';
  const quickReplies = settings.quickReplies?.items || [];
  const totalCount = settings.quickReplies?.totalCount || 0;
  const isRefreshing = isLoading && quickReplies.length > 0;

  useEffect(() => {
    loadQuickReplies();
  }, []);

  const loadQuickReplies = () => {
    dispatch(getSettings('quickReplies'));
  };

  const onRefresh = () => {
    loadQuickReplies();
  };

  const handleAddReply = () => {
    setEditingReply(null);
    setShortcut('');
    setMessage('');
    setModalVisible(true);
  };

  const handleEditReply = (reply) => {
    setEditingReply(reply);
    setShortcut(reply.shortcut || '');
    setMessage(reply.message || '');
    setModalVisible(true);
  };

  const handleSaveReply = () => {
    if (!shortcut.trim()) {
      setSnackbarMessage('Shortcut is required');
      setSnackbarVisible(true);
      return;
    }

    if (!message.trim()) {
      setSnackbarMessage('Message is required');
      setSnackbarVisible(true);
      return;
    }

    const replyData = {
      key: 'quickReplies',
      settingId: editingReply?._id,
      shortcut: shortcut.trim(),
      message: message.trim(),
    };

    dispatch(updateSettings(replyData))
      .unwrap()
      .then(() => {
        setSnackbarMessage(editingReply ? 'Quick reply updated successfully' : 'Quick reply created successfully');
        setSnackbarVisible(true);
        setModalVisible(false);
        loadQuickReplies();
      })
      .catch((error) => {
        setSnackbarMessage(`Error: ${error || 'Failed to save quick reply'}`);
        setSnackbarVisible(true);
      });
  };

  const handleDeleteReply = (reply) => {
    setReplyToDelete(reply);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (!replyToDelete) return;

    dispatch(deleteSettings({ settingId: replyToDelete._id }))
      .unwrap()
      .then(() => {
        setSnackbarMessage('Quick reply deleted successfully');
        setSnackbarVisible(true);
        setDeleteModalVisible(false);
        setReplyToDelete(null);
        loadQuickReplies();
      })
      .catch((error) => {
        setSnackbarMessage(`Error: ${error || 'Failed to delete quick reply'}`);
        setSnackbarVisible(true);
      });
  };

  const filteredReplies = quickReplies.filter((reply) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const shortcutText = reply.shortcut?.toLowerCase() || '';
    const messageText = reply.message?.toLowerCase() || '';

    return shortcutText.includes(query) || messageText.includes(query);
  });

  const renderReplyItem = ({ item }) => (
    <Card style={styles.replyCard}>
      <Card.Content>
        <View style={styles.replyRow}>
          <View style={styles.replyInfo}>
            <View style={styles.shortcutContainer}>
              <Text variant="labelLarge" style={styles.shortcutLabel}>
                /{item.shortcut}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.replyMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>

          <View style={styles.replyActions}>
            <TouchableOpacity onPress={() => handleEditReply(item)} style={styles.actionButton}>
              <Text variant="bodyMedium" style={[styles.actionText, { color: colors.primary.main }]}>
                Edit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteReply(item)} style={styles.actionButton}>
              <Text variant="bodyMedium" style={[styles.actionText, { color: colors.error.main }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderReplyModal = () => (
    <Portal>
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="headlineSmall" style={styles.modalTitle}>
          {editingReply ? 'Edit Quick Reply' : 'Add Quick Reply'}
        </Text>

        <TextInput
          label="Shortcut"
          value={shortcut}
          onChangeText={setShortcut}
          mode="outlined"
          placeholder="e.g., hello, thanks, welcome"
          style={styles.input}
          left={<TextInput.Affix text="/" />}
        />

        <TextInput
          label="Message"
          value={message}
          onChangeText={setMessage}
          mode="outlined"
          placeholder="Enter the reply message"
          style={styles.input}
          multiline
          numberOfLines={4}
        />

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setModalVisible(false)}
            style={styles.modalButton}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSaveReply}
            style={styles.modalButton}
            loading={isSaving}
            disabled={isSaving}
          >
            {editingReply ? 'Update' : 'Create'}
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderDeleteModal = () => (
    <Portal>
      <Modal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="headlineSmall" style={styles.modalTitle}>
          Delete Quick Reply
        </Text>
        <Text variant="bodyMedium" style={styles.modalText}>
          Are you sure you want to delete "/{replyToDelete?.shortcut}"? This action cannot be undone.
        </Text>

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setDeleteModalVisible(false)}
            style={styles.modalButton}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={confirmDelete}
            style={[styles.modalButton, { backgroundColor: colors.error.main }]}
            loading={isDeleting}
            disabled={isDeleting}
          >
            Delete
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No quick replies found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search'
          : 'Create your first quick reply to save time'}
      </Text>
    </View>
  );

  const renderError = () => {
    const error = getSettingsError || updateSettingsError || deleteSettingsError;
    if (!error) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {error}
        </Text>
      </Surface>
    );
  };

  if (isLoading && !isRefreshing && quickReplies.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading quick replies...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Quick Replies
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {totalCount} quick replies available
        </Text>

        <Searchbar
          placeholder="Search quick replies"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {renderError()}

      <FlatList
        data={filteredReplies}
        renderItem={renderReplyItem}
        keyExtractor={(item, index) => item._id || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddReply}
        label="Add Reply"
      />

      {renderReplyModal()}
      {renderDeleteModal()}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Close',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
    marginBottom: 16,
  },
  searchbar: {
    backgroundColor: colors.background.neutral,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  replyCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  replyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  replyInfo: {
    flex: 1,
    marginRight: 8,
  },
  shortcutContainer: {
    marginBottom: 8,
  },
  shortcutLabel: {
    color: colors.primary.main,
    fontWeight: '700',
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  replyMessage: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  replyActions: {
    flexDirection: 'column',
    gap: 4,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.error.lighter,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: colors.error.main,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary.main,
  },
  modalContent: {
    backgroundColor: colors.background.paper,
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalText: {
    color: colors.text.secondary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.background.paper,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});
