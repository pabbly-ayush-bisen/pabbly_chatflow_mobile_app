import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, FAB, Surface, Portal, Modal, Button, TextInput, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, updateSettings, deleteSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

const TAG_COLORS = [
  { name: 'Red', value: colors.error.main },
  { name: 'Blue', value: colors.primary.main },
  { name: 'Green', value: colors.success.main },
  { name: 'Orange', value: colors.warning.main },
  { name: 'Purple', value: '#9C27B0' },
  { name: 'Pink', value: '#E91E63' },
  { name: 'Teal', value: '#009688' },
  { name: 'Indigo', value: '#3F51B5' },
];

export default function TagsScreen() {
  const dispatch = useDispatch();

  const { settings, getSettingsStatus, updateSettingsStatus, deleteSettingsStatus, getSettingsError, updateSettingsError, deleteSettingsError } = useSelector(
    (state) => state.settings
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].value);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isLoading = getSettingsStatus === 'loading';
  const isSaving = updateSettingsStatus === 'loading';
  const isDeleting = deleteSettingsStatus === 'loading';
  const tags = settings.tags?.items || [];
  const totalCount = settings.tags?.totalCount || 0;
  const isRefreshing = isLoading && tags.length > 0;

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = () => {
    dispatch(getSettings('tags'));
  };

  const onRefresh = () => {
    loadTags();
  };

  const handleAddTag = () => {
    setEditingTag(null);
    setTagName('');
    setSelectedColor(TAG_COLORS[0].value);
    setModalVisible(true);
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setSelectedColor(tag.color || TAG_COLORS[0].value);
    setModalVisible(true);
  };

  const handleSaveTag = () => {
    if (!tagName.trim()) {
      setSnackbarMessage('Tag name is required');
      setSnackbarVisible(true);
      return;
    }

    const tagData = {
      key: 'tags',
      settingId: editingTag?._id,
      name: tagName.trim(),
      color: selectedColor,
    };

    dispatch(updateSettings(tagData))
      .unwrap()
      .then(() => {
        setSnackbarMessage(editingTag ? 'Tag updated successfully' : 'Tag created successfully');
        setSnackbarVisible(true);
        setModalVisible(false);
        loadTags();
      })
      .catch((error) => {
        setSnackbarMessage(`Error: ${error || 'Failed to save tag'}`);
        setSnackbarVisible(true);
      });
  };

  const handleDeleteTag = (tag) => {
    setTagToDelete(tag);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (!tagToDelete) return;

    dispatch(deleteSettings({ settingId: tagToDelete._id }))
      .unwrap()
      .then(() => {
        setSnackbarMessage('Tag deleted successfully');
        setSnackbarVisible(true);
        setDeleteModalVisible(false);
        setTagToDelete(null);
        loadTags();
      })
      .catch((error) => {
        setSnackbarMessage(`Error: ${error || 'Failed to delete tag'}`);
        setSnackbarVisible(true);
      });
  };

  const renderTagItem = ({ item }) => (
    <Card style={styles.tagCard}>
      <Card.Content>
        <View style={styles.tagRow}>
          <View style={styles.tagInfo}>
            <View style={styles.tagHeader}>
              <View style={[styles.colorIndicator, { backgroundColor: item.color || colors.grey[500] }]} />
              <Text variant="titleMedium" style={styles.tagName}>
                {item.name}
              </Text>
            </View>
            {item.description && (
              <Text variant="bodySmall" style={styles.tagDescription}>
                {item.description}
              </Text>
            )}
          </View>

          <View style={styles.tagActions}>
            <TouchableOpacity onPress={() => handleEditTag(item)} style={styles.actionButton}>
              <Text variant="bodyMedium" style={[styles.actionText, { color: colors.primary.main }]}>
                Edit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteTag(item)} style={styles.actionButton}>
              <Text variant="bodyMedium" style={[styles.actionText, { color: colors.error.main }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderTagModal = () => (
    <Portal>
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="headlineSmall" style={styles.modalTitle}>
          {editingTag ? 'Edit Tag' : 'Add New Tag'}
        </Text>

        <TextInput
          label="Tag Name"
          value={tagName}
          onChangeText={setTagName}
          mode="outlined"
          placeholder="Enter tag name"
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.colorPickerTitle}>
          Select Color
        </Text>
        <View style={styles.colorPicker}>
          {TAG_COLORS.map((color) => (
            <TouchableOpacity
              key={color.value}
              onPress={() => setSelectedColor(color.value)}
              style={[
                styles.colorOption,
                { backgroundColor: color.value },
                selectedColor === color.value && styles.colorOptionSelected,
              ]}
            >
              {selectedColor === color.value && (
                <Text style={styles.colorCheckmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

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
            onPress={handleSaveTag}
            style={styles.modalButton}
            loading={isSaving}
            disabled={isSaving}
          >
            {editingTag ? 'Update' : 'Create'}
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
          Delete Tag
        </Text>
        <Text variant="bodyMedium" style={styles.modalText}>
          Are you sure you want to delete "{tagToDelete?.name}"? This action cannot be undone.
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
        No tags found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Create your first tag to organize contacts
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

  if (isLoading && !isRefreshing && tags.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading tags...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Tags
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {totalCount} tags available
        </Text>
      </View>

      {renderError()}

      <FlatList
        data={tags}
        renderItem={renderTagItem}
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
        onPress={handleAddTag}
        label="Add Tag"
      />

      {renderTagModal()}
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
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  tagCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagInfo: {
    flex: 1,
  },
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  tagName: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  tagDescription: {
    color: colors.text.secondary,
    marginLeft: 24,
  },
  tagActions: {
    flexDirection: 'row',
    gap: 8,
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
    marginBottom: 20,
  },
  colorPickerTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.common.white,
    shadowColor: colors.common.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCheckmark: {
    color: colors.common.white,
    fontSize: 24,
    fontWeight: 'bold',
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
