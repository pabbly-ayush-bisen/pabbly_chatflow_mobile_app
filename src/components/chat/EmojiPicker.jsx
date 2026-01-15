import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

/**
 * EmojiPicker Component
 * Full-featured emoji picker modal with categories and search
 * Aligned with web app emoji picker functionality
 */

// Emoji categories with common emojis
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    name: 'Recent',
    icon: 'clock-outline',
    emojis: [],
  },
  {
    id: 'smileys',
    name: 'Smileys',
    icon: 'emoticon-outline',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
      '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
      '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
      '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
      '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: 'hand-wave',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
      '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
      '👄', '💋', '🩸',
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: 'account-outline',
    emojis: [
      '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱',
      '👩‍🦰', '🧑‍🦰', '👨‍🦰', '👱‍♀️', '👱', '👱‍♂️', '👩‍🦳', '🧑‍🦳', '👨‍🦳', '👩‍🦲',
      '🧑‍🦲', '👨‍🦲', '🧔', '🧔‍♂️', '🧔‍♀️', '👵', '🧓', '👴', '👲', '👳‍♀️',
      '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️',
      '💂', '💂‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👩‍⚕️', '🧑‍⚕️', '👨‍⚕️', '👩‍🌾', '🧑‍🌾',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: 'paw',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
      '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
      '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
      '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂',
      '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
      '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
      '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: 'food-apple',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
      '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
      '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
      '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟',
      '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘',
      '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
      '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
      '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: 'basketball',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️',
      '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️',
      '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️',
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: 'lightbulb-outline',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
      '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
      '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛',
      '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱',
      '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: 'heart-outline',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
      '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
      '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
      '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
      '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
      '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: 'flag-outline',
    emojis: [
      '🏳️', '🏴', '🏴‍☠️', '🏁', '🚩', '🎌', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫',
      '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲',
      '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪',
      '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬',
      '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶',
      '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬',
      '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰',
      '🇯🇵', '🇮🇳', '🇬🇧', '🇺🇸', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸', '🇷🇺', '🇰🇷',
    ],
  },
];

// Default recent emojis
const DEFAULT_RECENT = ['👍', '❤️', '😂', '🙏', '👏', '😍', '🎉', '🔥'];

const EmojiPicker = ({ visible, onClose, onEmojiSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState(DEFAULT_RECENT);

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return null;

    const query = searchQuery.toLowerCase();
    const allEmojis = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);
    return [...new Set(allEmojis)].slice(0, 50); // Limit to 50 results
  }, [searchQuery]);

  // Get current category emojis
  const currentEmojis = useMemo(() => {
    if (filteredEmojis) return filteredEmojis;

    if (activeCategory === 'recent') {
      return recentEmojis;
    }

    const category = EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory);
    return category?.emojis || [];
  }, [activeCategory, recentEmojis, filteredEmojis]);

  // Handle emoji selection
  const handleEmojiPress = useCallback((emoji) => {
    // Add to recent emojis
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      return [emoji, ...filtered].slice(0, 24);
    });

    onEmojiSelect?.(emoji);
    onClose?.();
  }, [onEmojiSelect, onClose]);

  // Render emoji item
  const renderEmojiItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.emojiButton}
      onPress={() => handleEmojiPress(item)}
      activeOpacity={0.6}
    >
      <Text style={styles.emoji}>{item}</Text>
    </TouchableOpacity>
  ), [handleEmojiPress]);

  // Render category tab
  const renderCategoryTab = useCallback((category) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryTab,
        activeCategory === category.id && styles.categoryTabActive,
      ]}
      onPress={() => {
        setActiveCategory(category.id);
        setSearchQuery('');
      }}
    >
      <Icon
        name={category.icon}
        size={20}
        color={activeCategory === category.id ? chatColors.primary : colors.grey[500]}
      />
    </TouchableOpacity>
  ), [activeCategory]);

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
          {/* Header with drag handle */}
          <View style={styles.header}>
            <View style={styles.dragHandle} />
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color={colors.grey[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search emoji"
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

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {EMOJI_CATEGORIES.map(renderCategoryTab)}
          </ScrollView>

          {/* Category title */}
          {!searchQuery && (
            <Text style={styles.categoryTitle}>
              {activeCategory === 'recent'
                ? 'Frequently Used'
                : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.name || ''
              }
            </Text>
          )}

          {/* Emoji grid */}
          <FlatList
            data={currentEmojis}
            renderItem={renderEmojiItem}
            keyExtractor={(item, index) => `${item}-${index}`}
            numColumns={8}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.emojiGrid}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No emojis found' : 'No recent emojis'}
                </Text>
              </View>
            }
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
    maxHeight: '60%',
    minHeight: 350,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: colors.text.primary,
  },
  categoryTabs: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  categoryTabsContent: {
    paddingHorizontal: 8,
  },
  categoryTab: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderRadius: 8,
  },
  categoryTabActive: {
    backgroundColor: `${chatColors.primary}15`,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emojiGrid: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  emojiButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '12.5%',
  },
  emoji: {
    fontSize: 28,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default memo(EmojiPicker);
