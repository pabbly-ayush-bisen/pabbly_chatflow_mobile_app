import React, { memo, useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

/**
 * QuickRepliesDialog Component
 * Modal for selecting and searching quick reply messages
 * Aligned with web app quick replies functionality
 */
const QuickRepliesDialog = ({
  visible,
  onClose,
  quickReplies = [],
  onSelect,
  searchText = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(searchText);

  // Filter quick replies based on search query
  const filteredReplies = useMemo(() => {
    if (!searchQuery) return quickReplies;

    const query = searchQuery.toLowerCase();
    return quickReplies.filter((reply) => {
      const shortcut = (reply.shortcut || '').toLowerCase();
      const message = (reply.message || '').toLowerCase();
      const title = (reply.title || '').toLowerCase();
      return shortcut.includes(query) || message.includes(query) || title.includes(query);
    });
  }, [quickReplies, searchQuery]);

  // Handle quick reply selection
  const handleSelect = useCallback((reply) => {
    onSelect?.(reply);
    onClose?.();
    setSearchQuery('');
  }, [onSelect, onClose]);

  // Get icon based on quick reply type
  const getTypeIcon = useCallback((type) => {
    switch (type) {
      case 'text':
        return 'message-text';
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'document':
        return 'file-document';
      case 'audio':
        return 'microphone';
      default:
        return 'message-text';
    }
  }, []);

  // Get color based on quick reply type
  const getTypeColor = useCallback((type) => {
    switch (type) {
      case 'text':
        return chatColors.primary;
      case 'image':
        return '#8E24AA';
      case 'video':
        return '#D32F2F';
      case 'document':
        return '#5E35B1';
      case 'audio':
        return '#FF6F00';
      default:
        return chatColors.primary;
    }
  }, []);

  // Render quick reply item
  const renderQuickReplyItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.replyItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.6}
    >
      <View style={[styles.replyIcon, { backgroundColor: `${getTypeColor(item.type)}15` }]}>
        <Icon
          name={getTypeIcon(item.type)}
          size={20}
          color={getTypeColor(item.type)}
        />
      </View>
      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyShortcut}>/{item.shortcut}</Text>
          {item.title && (
            <Text style={styles.replyTitle} numberOfLines={1}>
              {item.title}
            </Text>
          )}
        </View>
        <Text style={styles.replyMessage} numberOfLines={2}>
          {item.type === 'text'
            ? item.message
            : `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} attachment`
          }
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.grey[400]} />
    </TouchableOpacity>
  ), [handleSelect, getTypeIcon, getTypeColor]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Icon name="lightning-bolt-outline" size={48} color={colors.grey[300]} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No quick replies found' : 'No quick replies'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try a different search term'
          : 'Create quick replies to respond faster'
        }
      </Text>
    </View>
  ), [searchQuery]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <View style={styles.titleRow}>
              <Icon name="lightning-bolt" size={24} color={chatColors.primary} />
              <Text style={styles.title}>Quick Replies</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={colors.grey[500]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color={colors.grey[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search quick replies..."
              placeholderTextColor={colors.grey[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close" size={18} color={colors.grey[400]} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tip */}
          <View style={styles.tipContainer}>
            <Icon name="information-outline" size={16} color={chatColors.primary} />
            <Text style={styles.tipText}>
              Tip: Type "/" in the message box to trigger quick replies
            </Text>
          </View>

          {/* Quick replies list */}
          <FlatList
            data={filteredReplies}
            renderItem={renderQuickReplyItem}
            keyExtractor={(item) => item._id || item.shortcut || Math.random().toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
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
    maxHeight: '70%',
    minHeight: 300,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '400',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${chatColors.primary}10`,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: chatColors.primary,
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  replyContent: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  replyShortcut: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.primary,
    backgroundColor: `${chatColors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  replyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
  },
  replyMessage: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: 72,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default memo(QuickRepliesDialog);
