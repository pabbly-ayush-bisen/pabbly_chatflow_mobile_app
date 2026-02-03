import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, chatColors } from '../../theme/colors';
import { CustomDialog } from '../common';
import {
  fetchChatNotes,
  addChatNote,
  deleteChatNote,
} from '../../redux/slices/inboxSlice';
import { format } from 'date-fns';
import { showError } from '../../utils/toast';

const ChatNotes = ({ visible, onClose, chatId }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { notes, notesStatus, addNoteStatus } = useSelector((state) => state.inbox);
  const { user } = useSelector((state) => state.user);

  const [newNote, setNewNote] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch notes when modal opens
  useEffect(() => {
    if (visible && chatId) {
      dispatch(fetchChatNotes(chatId));
    }
  }, [visible, chatId, dispatch]);

  const isLoading = notesStatus === 'loading';
  const isAdding = addNoteStatus === 'loading';

  // Handle add note
  const handleAddNote = useCallback(async () => {
    if (!newNote.trim() || isAdding) return;

    try {
      await dispatch(addChatNote({ chatId, note: newNote.trim() })).unwrap();
      setNewNote('');
    } catch (error) {
      showError(error || 'Failed to add note');
    }
  }, [chatId, newNote, isAdding, dispatch]);

  // Handle delete note
  const handleDeleteNote = useCallback((noteId) => {
    setNoteToDelete(noteId);
    setShowDeleteDialog(true);
  }, []);

  // Confirm delete note
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteChatNote({ chatId, noteId: noteToDelete })).unwrap();
      setShowDeleteDialog(false);
      setNoteToDelete(null);
    } catch (error) {
      showError(error || 'Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  }, [chatId, noteToDelete, dispatch]);

  // Format date
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch {
      return '';
    }
  }, []);

  // Render note item
  const renderNoteItem = ({ item }) => (
    <View style={styles.noteItem}>
      <View style={styles.noteHeader}>
        <View style={styles.noteAuthorRow}>
          <Icon name="account-circle" size={20} color={chatColors.primary} />
          <Text style={styles.noteAuthor}>
            {item.authorName || user?.name || 'You'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteNote(item._id)}
          style={styles.deleteButton}
        >
          <Icon name="delete-outline" size={18} color={colors.error.main} />
        </TouchableOpacity>
      </View>
      <Text style={styles.noteText}>{item.note || item.text}</Text>
      <Text style={styles.noteDate}>
        {formatDate(item.createdAt || item.timestamp)}
      </Text>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="note-text-outline" size={60} color={colors.grey[300]} />
      <Text style={styles.emptyTitle}>No notes yet</Text>
      <Text style={styles.emptyText}>
        Add internal notes about this conversation
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.overlayBackground}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerContent}>
              <Text style={styles.title}>Chat Notes</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes list */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={chatColors.primary} />
              <Text style={styles.loadingText}>Loading notes...</Text>
            </View>
          ) : (
            <FlatList
              data={notes}
              renderItem={renderNoteItem}
              keyExtractor={(item) => item._id || String(Math.random())}
              contentContainerStyle={[
                styles.notesList,
                notes.length === 0 && styles.emptyList,
              ]}
              ListEmptyComponent={renderEmptyState}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Add note input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a note..."
              placeholderTextColor={colors.grey[400]}
              value={newNote}
              onChangeText={setNewNote}
              multiline
              maxLength={500}
              editable={!isAdding}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newNote.trim() || isAdding) && styles.sendButtonDisabled,
              ]}
              onPress={handleAddNote}
              disabled={!newNote.trim() || isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <Icon name="send" size={20} color={colors.common.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Delete Note Confirmation Dialog */}
      <CustomDialog
        visible={showDeleteDialog}
        onDismiss={() => {
          setShowDeleteDialog(false);
          setNoteToDelete(null);
        }}
        icon="note-remove-outline"
        iconColor={colors.error.main}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        actions={[
          {
            label: 'Cancel',
            onPress: () => {
              setShowDeleteDialog(false);
              setNoteToDelete(null);
            },
          },
          {
            label: 'Delete',
            onPress: confirmDeleteNote,
            destructive: true,
            loading: isDeleting,
          },
        ]}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  notesList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  noteItem: {
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: chatColors.primary,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: chatColors.primary,
  },
  deleteButton: {
    padding: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  noteDate: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.grey[100],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.grey[300],
  },
});

export default ChatNotes;
