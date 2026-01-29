import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Snackbar,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { getSettings, updateSettings, deleteSettings } from '../../redux/slices/settingsSlice';
import { colors, chatColors } from '../../theme/colors';
import AddQuickReplyModal from '../../components/settings/AddQuickReplyModal';
import EditQuickReplyModal from '../../components/settings/EditQuickReplyModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 10;

// Message type configurations
const MESSAGE_TYPES = {
  text: { label: 'Text', icon: 'message-text', color: '#9E9E9E', bg: '#F5F5F5' },
  image: { label: 'Image', icon: 'image', color: '#2196F3', bg: '#E3F2FD' },
  video: { label: 'Video', icon: 'video', color: '#9C27B0', bg: '#F3E5F5' },
  audio: { label: 'Audio', icon: 'microphone', color: '#3F51B5', bg: '#E8EAF6' },
  file: { label: 'File', icon: 'file-document', color: '#FF9800', bg: '#FFF3E0' },
};

// Audio Player Component for Preview
const AudioPlayerPreview = ({ audioUrl }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAndPlayAudio = async () => {
    try {
      setIsLoading(true);

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        setIsLoading(false);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.audioPlayerContainer}>
      <TouchableOpacity
        style={styles.audioPlayButton}
        onPress={loadAndPlayAudio}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.common.white} />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={colors.common.white}
          />
        )}
      </TouchableOpacity>
      <View style={styles.audioProgressContainer}>
        <View style={styles.audioProgressBar}>
          <View style={[styles.audioProgressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.audioTimeRow}>
          <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
          <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
};

export default function QuickRepliesScreen() {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef(null);

  // Pagination state - using useRef to avoid stale closure issues
  const [localReplies, setLocalReplies] = useState([]);
  const pageRef = useRef(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreReplies, setHasMoreReplies] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isLoadingRef = useRef(false);

  // Modal states - separate for Add and Edit
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Form state
  const [replyToEdit, setReplyToEdit] = useState(null);
  const [replyToDelete, setReplyToDelete] = useState(null);
  const [previewReply, setPreviewReply] = useState(null);

  // Video player ref for preview
  const videoRef = useRef(null);

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const { getSettingsStatus, updateSettingsStatus, deleteSettingsStatus } = useSelector(
    (state) => state.settings
  );

  const isLoading = getSettingsStatus === 'loading';
  const isSaving = updateSettingsStatus === 'loading';
  const isDeleting = deleteSettingsStatus === 'loading';
  const isRefreshing = isLoading && localReplies.length > 0 && !isLoadingMore;

  // Load quick replies with pagination - fixed version
  const loadReplies = useCallback(async ({ reset = false, search = '' } = {}) => {
    // Prevent duplicate calls
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const currentPage = reset ? 0 : pageRef.current;
    const skip = currentPage * PAGE_SIZE;

    let queryString = `quickReplies&skip=${skip}&limit=${PAGE_SIZE}&order=-1`;

    if (search && search.trim()) {
      queryString += `&field=shortcut&value=${encodeURIComponent(search.trim())}`;
    }

    try {
      const result = await dispatch(getSettings(queryString)).unwrap();
      const data = result.data || result;
      const repliesData = data.quickReplies || data;
      const newReplies = repliesData.items || [];
      const total = repliesData.totalCount || 0;

      setTotalCount(total);

      if (reset) {
        setLocalReplies(newReplies);
        pageRef.current = 1;
        setHasMoreReplies(newReplies.length < total);
      } else {
        setLocalReplies(prev => {
          const existingIds = new Set(prev.map(reply => reply._id));
          const uniqueNewReplies = newReplies.filter(reply => reply._id && !existingIds.has(reply._id));
          const combined = [...prev, ...uniqueNewReplies];
          setHasMoreReplies(combined.length < total);
          return combined;
        });
        pageRef.current = currentPage + 1;
      }
    } catch (error) {
      console.log('Error loading quick replies:', error);
      showSnackbar('Failed to load quick replies');
    } finally {
      isLoadingRef.current = false;
    }
  }, [dispatch]);

  useEffect(() => {
    loadReplies({ reset: true });

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    setSearchQuery('');
    pageRef.current = 0;
    loadReplies({ reset: true, search: '' });
  }, [loadReplies]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      pageRef.current = 0;
      loadReplies({ reset: true, search: text });
    }, 500);
  }, [loadReplies]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingRef.current || isLoadingMore || !hasMoreReplies) return;

    setIsLoadingMore(true);
    loadReplies({ reset: false, search: searchQuery }).finally(() => {
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMoreReplies, loadReplies, searchQuery]);

  const showSnackbar = (msg) => {
    setSnackbarMessage(msg);
    setSnackbarVisible(true);
  };

  const handleAddReply = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleEditReply = useCallback((reply) => {
    setReplyToEdit(reply);
    setShowEditModal(true);
  }, []);

  const handlePreviewReply = useCallback((reply) => {
    setPreviewReply(reply);
    setShowPreviewModal(true);
  }, []);

  const handleDeleteReply = useCallback((reply) => {
    setReplyToDelete(reply);
    setShowDeleteModal(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    // Stop video if playing
    if (videoRef.current) {
      videoRef.current.pauseAsync?.();
    }
    setShowPreviewModal(false);
    setPreviewReply(null);
  }, []);

  const handleSaveNewReply = async (replyData) => {
    try {
      const data = {
        key: 'quickReplies',
        data: [replyData],
      };

      await dispatch(updateSettings(data)).unwrap();
      showSnackbar('Quick reply created successfully');
      setShowAddModal(false);
      pageRef.current = 0;
      loadReplies({ reset: true, search: searchQuery });
      return true;
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to save quick reply';
      showSnackbar(`Error: ${errorMessage}`);
      return false;
    }
  };

  const handleSaveEditReply = async (replyData) => {
    try {
      // Match web app format: include _id in data item, don't pass settingId at top level
      const data = {
        key: 'quickReplies',
        data: [{
          _id: replyData._id,
          shortcut: replyData.shortcut,
          type: replyData.type,
          message: replyData.message,
          ...(replyData.headerFileURL && { headerFileURL: replyData.headerFileURL }),
          ...(replyData.fileName && { fileName: replyData.fileName }),
        }],
        shouldUpdate: true,
      };

      await dispatch(updateSettings(data)).unwrap();
      showSnackbar('Quick reply updated successfully');
      setShowEditModal(false);
      setReplyToEdit(null);
      pageRef.current = 0;
      loadReplies({ reset: true, search: searchQuery });
      return true;
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update quick reply';
      showSnackbar(`Error: ${errorMessage}`);
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!replyToDelete) return;

    try {
      await dispatch(deleteSettings({ settingId: replyToDelete._id })).unwrap();
      showSnackbar('Quick reply deleted successfully');
      setShowDeleteModal(false);
      setReplyToDelete(null);
      pageRef.current = 0;
      loadReplies({ reset: true, search: searchQuery });
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete quick reply';
      showSnackbar(`Error: ${errorMessage}`);
    }
  };

  const getTypeConfig = (type) => {
    return MESSAGE_TYPES[type] || MESSAGE_TYPES.text;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openFileUrl = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Failed to open URL:', err);
        showSnackbar('Failed to open file');
      });
    }
  };

  // Quick Reply Card
  const renderReplyCard = ({ item }) => {
    const typeConfig = getTypeConfig(item.type);
    const date = formatDate(item.createdAt);

    return (
      <View style={styles.replyCard}>
        <View style={styles.cardContent}>
          {/* Top Row: Shortcut and Type */}
          <View style={styles.cardTopRow}>
            <View style={styles.shortcutBadge}>
              <Text style={styles.shortcutText} numberOfLines={1}>/{item.shortcut}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
              <Icon name={typeConfig.icon} size={14} color={typeConfig.color} />
              <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
            </View>
          </View>

          {/* Bottom Row: Date, Creator, and Actions */}
          <View style={styles.cardBottomRow}>
            <View style={styles.metaInfo}>
              {date && (
                <View style={styles.metaBadge}>
                  <Icon name="calendar-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.metaText}>{date}</Text>
                </View>
              )}
              {item.createdBy && (
                <View style={styles.metaBadge}>
                  <Icon name="account-outline" size={12} color={colors.text.tertiary} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.createdBy}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handlePreviewReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="eye-outline" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleEditReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDeleteReply(item)}
                activeOpacity={0.7}
              >
                <Icon name="trash-can-outline" size={18} color={colors.error.main} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="lightning-bolt-outline" size={64} color={colors.grey[300]} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No quick replies found' : 'No quick replies yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search criteria'
          : 'Create quick replies to save time when chatting'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddReply}>
          <Icon name="plus" size={20} color={colors.common.white} />
          <Text style={styles.emptyAddBtnText}>Add Quick Reply</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Footer Component
  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={styles.footerLoaderText}>Loading more...</Text>
        </View>
      );
    }

    if (!hasMoreReplies && localReplies.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>
            Showing all {localReplies.length} quick replies
          </Text>
        </View>
      );
    }

    return <View style={styles.listFooterSpace} />;
  };

  // Preview Bottom Sheet with Message Bubble Style
  const renderPreviewModal = () => {
    if (!previewReply) return null;

    const typeConfig = getTypeConfig(previewReply.type);
    const time = formatTime();
    const createdDate = formatDate(previewReply.createdAt);
    const updatedDate = formatDate(previewReply.updatedAt);
    const messageLength = previewReply.message?.length || 0;

    return (
      <Modal
        isVisible={showPreviewModal}
        onBackdropPress={handleClosePreview}
        onSwipeComplete={handleClosePreview}
        swipeDirection={['down']}
        style={styles.bottomModal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.previewSheet}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <View style={[styles.previewHeaderIcon, { backgroundColor: typeConfig.bg }]}>
                <Icon name={typeConfig.icon} size={24} color={typeConfig.color} />
              </View>
              <View style={styles.previewHeaderInfo}>
                <Text style={styles.previewHeaderTitle}>Quick Reply Details</Text>
                <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg, alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Icon name={typeConfig.icon} size={12} color={typeConfig.color} />
                  <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClosePreview}
              style={styles.previewCloseBtn}
            >
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Message Bubble Preview */}
          <ScrollView
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Reply Info Card */}
            <View style={styles.previewInfoCard}>
              {/* Shortcut - Prominent Display */}
              <View style={styles.previewShortcutCard}>
                <View style={styles.previewShortcutIconContainer}>
                  <Icon name="lightning-bolt" size={20} color={colors.primary.main} />
                </View>
                <View style={styles.previewShortcutContent}>
                  <Text style={styles.previewShortcutTitle}>Shortcut Command</Text>
                  <Text style={styles.previewShortcutCommand} numberOfLines={1}>/{previewReply.shortcut}</Text>
                </View>
              </View>

              {/* Info Grid */}
              <View style={styles.previewInfoGrid}>
                {/* Created Date */}
                {createdDate && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="calendar-plus" size={16} color={colors.success.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Created</Text>
                      <Text style={styles.previewInfoValue}>{createdDate}</Text>
                    </View>
                  </View>
                )}

                {/* Updated Date */}
                {updatedDate && updatedDate !== createdDate && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="calendar-edit" size={16} color={colors.warning.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Updated</Text>
                      <Text style={styles.previewInfoValue}>{updatedDate}</Text>
                    </View>
                  </View>
                )}

                {/* Created By */}
                {previewReply.createdBy && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="account" size={16} color={colors.info.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Created By</Text>
                      <Text style={styles.previewInfoValue} numberOfLines={1}>{previewReply.createdBy}</Text>
                    </View>
                  </View>
                )}

                {/* Has Media */}
                {previewReply.type !== 'text' && previewReply.headerFileURL && (
                  <View style={styles.previewInfoItem}>
                    <View style={styles.previewInfoIconWrapper}>
                      <Icon name="attachment" size={16} color={colors.secondary.main} />
                    </View>
                    <View style={styles.previewInfoContent}>
                      <Text style={styles.previewInfoLabel}>Media</Text>
                      <Text style={styles.previewInfoValue}>Attached</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Section Title */}
            <View style={styles.previewSectionHeader}>
              <Icon name="message-text-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.previewSectionTitle}>Message Preview</Text>
            </View>

            {/* Chat Background */}
            <View style={styles.chatBackground}>
              {/* Message Type Label */}
              <Text style={styles.messageTypeLabel}>
                {typeConfig.label} Message
              </Text>

              {/* Message Bubble - WhatsApp outgoing style */}
              <View style={styles.messageBubbleContainer}>
                <View style={styles.messageBubble}>
                  {/* Image Preview */}
                  {previewReply.type === 'image' && previewReply.headerFileURL && (
                    <TouchableOpacity
                      onPress={() => openFileUrl(previewReply.headerFileURL)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: previewReply.headerFileURL }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}

                  {/* Video Preview */}
                  {previewReply.type === 'video' && previewReply.headerFileURL && (
                    <View style={styles.bubbleVideoContainer}>
                      <Video
                        ref={videoRef}
                        source={{ uri: previewReply.headerFileURL }}
                        style={styles.bubbleVideo}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                      />
                    </View>
                  )}

                  {/* Audio Preview */}
                  {previewReply.type === 'audio' && previewReply.headerFileURL && (
                    <View style={styles.bubbleAudioContainer}>
                      <AudioPlayerPreview audioUrl={previewReply.headerFileURL} />
                    </View>
                  )}

                  {/* File/Document Preview */}
                  {previewReply.type === 'file' && previewReply.headerFileURL && (
                    <TouchableOpacity
                      style={styles.bubbleDocumentContainer}
                      onPress={() => openFileUrl(previewReply.headerFileURL)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.bubbleDocIcon}>
                        <Icon name="file-document" size={28} color={colors.grey[600]} />
                      </View>
                      <View style={styles.bubbleDocInfo}>
                        <Text style={styles.bubbleDocName} numberOfLines={1}>
                          {previewReply.fileName || 'Document'}
                        </Text>
                        <Text style={styles.bubbleDocMeta}>Document</Text>
                      </View>
                      <Icon name="download" size={20} color={colors.grey[500]} />
                    </TouchableOpacity>
                  )}

                  {/* Text Message - Show truncated in bubble */}
                  {(previewReply.type === 'text' || previewReply.message) && (
                    <Text
                      style={[
                        styles.bubbleText,
                        (previewReply.type !== 'text' && previewReply.headerFileURL) && { marginTop: 8 }
                      ]}
                      numberOfLines={6}
                    >
                      {previewReply.message || (previewReply.type === 'text' ? 'No message content' : '')}
                    </Text>
                  )}

                  {/* Empty State for media without URL */}
                  {previewReply.type !== 'text' && !previewReply.headerFileURL && !previewReply.message && (
                    <View style={styles.bubbleEmptyState}>
                      <Icon name="file-question-outline" size={32} color={colors.grey[400]} />
                      <Text style={styles.bubbleEmptyText}>No content available</Text>
                    </View>
                  )}

                  {/* Time and Status */}
                  <View style={styles.bubbleMetaContainer}>
                    <Text style={styles.bubbleTimestamp}>{time}</Text>
                    <Icon name="check-all" size={14} color={chatColors.tickBlue} />
                  </View>
                </View>
              </View>
            </View>

            {/* Full Message Content - Show complete text for long messages */}
            {previewReply.message && messageLength > 100 && (
              <>
                <View style={[styles.previewSectionHeader, { marginTop: 20 }]}>
                  <Icon name="text-box-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.previewSectionTitle}>Full Message Content</Text>
                </View>
                <View style={styles.fullMessageContainer}>
                  <Text style={styles.fullMessageText} selectable>
                    {previewReply.message}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.previewActionContainer}>
            <TouchableOpacity
              style={styles.previewEditBtn}
              onPress={() => {
                handleClosePreview();
                setTimeout(() => handleEditReply(previewReply), 300);
              }}
              activeOpacity={0.7}
            >
              <Icon name="pencil-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.previewEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewDeleteBtn}
              onPress={() => {
                handleClosePreview();
                setTimeout(() => handleDeleteReply(previewReply), 300);
              }}
              activeOpacity={0.7}
            >
              <Icon name="trash-can-outline" size={18} color={colors.error.main} />
              <Text style={styles.previewDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Delete Modal
  const renderDeleteModal = () => (
    <Modal
      isVisible={showDeleteModal}
      onBackdropPress={() => !isDeleting && setShowDeleteModal(false)}
      style={styles.centerModal}
      backdropOpacity={0.5}
      animationIn="zoomIn"
      animationOut="zoomOut"
    >
      <View style={styles.deleteContainer}>
        <View style={styles.deleteIconCircle}>
          <Icon name="trash-can-outline" size={28} color={colors.error.main} />
        </View>
        <Text style={styles.deleteTitle}>Delete Quick Reply</Text>
        <Text style={styles.deleteMessage}>
          Are you sure you want to delete "/{replyToDelete?.shortcut}"?
        </Text>
        <Text style={styles.deleteSubtext}>
          This action cannot be undone.
        </Text>
        <View style={styles.deleteButtonRow}>
          <TouchableOpacity
            style={styles.deleteCancelBtn}
            onPress={() => setShowDeleteModal(false)}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, isDeleting && styles.deleteConfirmBtnDisabled]}
            onPress={confirmDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.common.white} />
            ) : (
              <Text style={styles.deleteConfirmText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Loading State
  if (isLoading && !isRefreshing && localReplies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading quick replies...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by shortcut..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Replies</Text>
        <Text style={styles.sectionCount}>
          {localReplies.length} of {totalCount}
        </Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={16} color={colors.primary.main} />
        <Text style={styles.infoBannerText}>
          Type "/" in chat to use quick replies
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={localReplies}
        renderItem={renderReplyCard}
        keyExtractor={(item, index) => item._id ? `qr-${item._id}` : `qr-index-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddReply} activeOpacity={0.8}>
        <Icon name="plus" size={26} color={colors.common.white} />
      </TouchableOpacity>

      {/* Modals - Separate Add and Edit */}
      <AddQuickReplyModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewReply}
        isSaving={isSaving}
        showSnackbar={showSnackbar}
      />

      <EditQuickReplyModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setReplyToEdit(null);
        }}
        onSave={handleSaveEditReply}
        isSaving={isSaving}
        showSnackbar={showSnackbar}
        replyToEdit={replyToEdit}
      />

      {renderPreviewModal()}
      {renderDeleteModal()}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchbar: {
    backgroundColor: colors.grey[100],
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 48,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoBannerText: {
    fontSize: 13,
    color: colors.primary.dark,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  footerEnd: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerEndText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  listFooterSpace: {
    height: 20,
  },

  // Card
  replyCard: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  cardContent: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  shortcutBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flex: 1,
    maxWidth: '60%',
  },
  shortcutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.text.tertiary,
    maxWidth: 80,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.common.white,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Modal Base Styles
  bottomModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  centerModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Preview Sheet
  previewSheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  previewHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeaderInfo: {
    flex: 1,
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  previewShortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  previewShortcutLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  previewShortcutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    maxWidth: 150,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewScrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  previewScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // Preview Info Card
  previewInfoCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  previewShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  previewShortcutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewShortcutContent: {
    flex: 1,
  },
  previewShortcutTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewShortcutCommand: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.darker,
  },
  previewInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  previewInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  previewInfoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewInfoContent: {
    flex: 1,
  },
  previewInfoLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 1,
  },
  previewInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Full Message Content
  fullMessageContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  fullMessageText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.primary,
  },

  // Chat Background (WhatsApp style)
  chatBackground: {
    backgroundColor: chatColors.chatBg,
    borderRadius: 12,
    padding: 16,
  },
  messageTypeLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
  },

  // Message Bubble - WhatsApp outgoing style
  messageBubbleContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    backgroundColor: chatColors.outgoing,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 2,
  },
  bubbleImage: {
    width: 220,
    height: 180,
    borderRadius: 6,
  },
  bubbleVideoContainer: {
    width: 220,
    height: 150,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  bubbleVideo: {
    width: '100%',
    height: '100%',
  },
  bubbleAudioContainer: {
    width: 220,
    paddingVertical: 8,
  },
  bubbleDocumentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    minWidth: 200,
  },
  bubbleDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bubbleDocInfo: {
    flex: 1,
  },
  bubbleDocName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  bubbleDocMeta: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bubbleEmptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  bubbleEmptyText: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  bubbleMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  bubbleTimestamp: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.45)',
  },

  // Audio Player
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioProgressContainer: {
    flex: 1,
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: chatColors.primary,
    borderRadius: 2,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  audioTimeText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Preview Actions
  previewActionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  previewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
    gap: 6,
  },
  previewEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error.lighter,
    gap: 6,
  },
  previewDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error.main,
  },

  // Delete Modal
  deleteContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteSubtext: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
    marginBottom: 20,
  },
  deleteButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  deleteConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error.main,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.6,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },
});
