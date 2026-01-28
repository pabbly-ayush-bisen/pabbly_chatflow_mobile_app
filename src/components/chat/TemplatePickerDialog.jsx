import React, { memo, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * TemplatePickerDialog Component
 * Modern, user-friendly modal for selecting WhatsApp message templates
 * Features: Smooth animations, intuitive filtering, beautiful card design
 */

// Template categories with icons
const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'view-grid' },
  { id: 'MARKETING', label: 'Marketing', icon: 'bullhorn' },
  { id: 'UTILITY', label: 'Utility', icon: 'wrench' },
  { id: 'AUTHENTICATION', label: 'Auth', icon: 'shield-check' },
];

// Category color mapping
const CATEGORY_COLORS = {
  MARKETING: { bg: '#F3E5F5', text: '#8E24AA', icon: '#AB47BC' },
  UTILITY: { bg: '#E8F5E9', text: '#2E7D32', icon: '#43A047' },
  AUTHENTICATION: { bg: '#E3F2FD', text: '#1565C0', icon: '#1E88E5' },
  default: { bg: colors.grey[100], text: colors.grey[600], icon: colors.grey[500] },
};

// Template type configuration with icons and colors
const TEMPLATE_TYPE_CONFIG = {
  TEXT: { icon: 'text', color: '#9E9E9E', bg: '#F5F5F5', label: 'Text' },
  IMAGE: { icon: 'image', color: '#2196F3', bg: '#E3F2FD', label: 'Image' },
  VIDEO: { icon: 'video', color: '#9C27B0', bg: '#F3E5F5', label: 'Video' },
  DOCUMENT: { icon: 'file-document', color: '#FF9800', bg: '#FFF3E0', label: 'Document' },
  AUDIO: { icon: 'music', color: '#3F51B5', bg: '#E8EAF6', label: 'Audio' },
  LOCATION: { icon: 'map-marker', color: '#F44336', bg: '#FFEBEE', label: 'Location' },
  CAROUSEL: { icon: 'view-carousel', color: '#2196F3', bg: '#E3F2FD', label: 'Carousel' },
  LTO: { icon: 'clock-outline', color: '#FF9800', bg: '#FFF3E0', label: 'Limited Offer' },
  CATALOG: { icon: 'shopping', color: '#4CAF50', bg: '#E8F5E9', label: 'Catalog' },
};

const TemplatePickerDialog = ({
  visible,
  onClose,
  templates = [],
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);

  // Animate modal on visibility change
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // Get template body text
  const getTemplateBodyText = useCallback((template) => {
    const components = template?.components || [];
    const bodyComponent = components.find((c) => c.type === 'BODY');
    return bodyComponent?.text || '';
  }, []);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((t) => {
        const name = (t.name || '').toLowerCase();
        const description = (t.description || '').toLowerCase();
        const bodyText = getTemplateBodyText(t).toLowerCase();
        return name.includes(query) || description.includes(query) || bodyText.includes(query);
      });
    }

    // Only show Meta-approved templates (case-insensitive check)
    return filtered.filter((t) => t.status?.toUpperCase() === 'APPROVED');
  }, [templates, searchQuery, activeCategory, getTemplateBodyText]);

  // Get template header info
  const getTemplateHeader = useCallback((template) => {
    const components = template?.components || [];
    const headerComponent = components.find((c) => c.type === 'HEADER');
    if (!headerComponent) return null;

    return {
      type: headerComponent.format || 'TEXT',
      text: headerComponent.text || '',
    };
  }, []);

  // Get template buttons
  const getTemplateButtons = useCallback((template) => {
    const components = template?.components || [];
    const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
    return buttonsComponent?.buttons || [];
  }, []);

  // Check if template has variables
  const hasVariables = useCallback((template) => {
    const bodyText = getTemplateBodyText(template);
    return /\{\{\d+\}\}/.test(bodyText);
  }, [getTemplateBodyText]);

  // Handle template selection
  const handleSelect = useCallback((template) => {
    Keyboard.dismiss();
    onSelect?.(template);
    onClose?.();
    setSearchQuery('');
    setActiveCategory('all');
  }, [onSelect, onClose]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose?.();
    setSearchQuery('');
  }, [onClose]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  // Get category styling
  const getCategoryStyle = useCallback((category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  }, []);

  // Get template type config
  const getTemplateTypeConfig = useCallback((type) => {
    const typeUpper = (type || 'TEXT').toUpperCase();
    return TEMPLATE_TYPE_CONFIG[typeUpper] || TEMPLATE_TYPE_CONFIG.TEXT;
  }, []);

  // Render category chip
  const renderCategoryChip = useCallback((category) => {
    const isActive = activeCategory === category.id;

    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryChip,
          isActive && styles.categoryChipActive,
        ]}
        onPress={() => setActiveCategory(category.id)}
        activeOpacity={0.7}
      >
        <Icon
          name={category.icon}
          size={16}
          color={isActive ? colors.common.white : colors.grey[500]}
          style={styles.categoryChipIcon}
        />
        <Text
          style={[
            styles.categoryChipText,
            isActive && styles.categoryChipTextActive,
          ]}
        >
          {category.label}
        </Text>
      </TouchableOpacity>
    );
  }, [activeCategory]);

  // Render template card
  const renderTemplateCard = useCallback(({ item }) => {
    const bodyText = getTemplateBodyText(item);
    const buttons = getTemplateButtons(item);
    const hasVars = hasVariables(item);
    const templateTypeConfig = getTemplateTypeConfig(item.type);

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: 1,
            transform: [{ scale: 1 }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.templateCard}
          onPress={() => handleSelect(item)}
          activeOpacity={0.9}
        >
          {/* Card Content */}
          <View style={styles.cardContent}>
            {/* Title and Badges Row */}
            <View style={styles.cardTopRow}>
              <Text style={styles.templateName} numberOfLines={1}>
                {item.name?.replace(/_/g, ' ')}
              </Text>
              <Icon name="chevron-right" size={20} color={colors.grey[300]} />
            </View>

            {/* Badges Row */}
            <View style={styles.metaRow}>
              <View style={[styles.typeTag, { backgroundColor: templateTypeConfig.bg }]}>
                <Icon name={templateTypeConfig.icon} size={9} color={templateTypeConfig.color} />
                <Text style={[styles.typeTagText, { color: templateTypeConfig.color }]}>
                  {templateTypeConfig.label}
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.categoryText}>
                {item.category}
              </Text>
              {hasVars && (
                <>
                  <View style={styles.divider} />
                  <Icon name="code-braces" size={11} color={colors.grey[500]} />
                </>
              )}
            </View>

            {/* Body Preview */}
            {bodyText && (
              <Text style={styles.previewBody} numberOfLines={2}>
                {bodyText}
              </Text>
            )}

            {/* Button Count Indicator */}
            {buttons.length > 0 && (
              <View style={styles.buttonCountIndicator}>
                <Icon name="gesture-tap-button" size={12} color={colors.grey[500]} />
                <Text style={styles.buttonCountText}>
                  {buttons.length} button{buttons.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [handleSelect, getTemplateBodyText, getTemplateButtons, hasVariables, getTemplateTypeConfig]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Icon name="file-search-outline" size={56} color={colors.grey[300]} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No matches found' : 'No templates available'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `We couldn't find any templates matching "${searchQuery}"`
          : 'Templates will appear here once approved in WhatsApp Business Manager'
        }
      </Text>
      {searchQuery && (
        <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
          <Icon name="refresh" size={16} color={chatColors.primary} />
          <Text style={styles.clearSearchText}>Clear search</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [searchQuery, clearSearch]);

  // Render list header
  const renderListHeader = useCallback(() => (
    <View style={styles.resultsHeader}>
      <Text style={styles.resultsCount}>
        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        {activeCategory !== 'all' && ` in ${TEMPLATE_CATEGORIES.find(c => c.id === activeCategory)?.label}`}
      </Text>
    </View>
  ), [filteredTemplates.length, activeCategory]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Icon name="file-document-multiple-outline" size={22} color={chatColors.primary} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Message Templates</Text>
                <Text style={styles.headerSubtitle}>Select a template to send</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={22} color={colors.grey[500]} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={[
              styles.searchContainer,
              isSearchFocused && styles.searchContainerFocused,
            ]}>
              <Icon
                name="magnify"
                size={20}
                color={isSearchFocused ? chatColors.primary : colors.grey[400]}
              />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search by name or content..."
                placeholderTextColor={colors.grey[400]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={clearSearch}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.clearButton}>
                    <Icon name="close" size={14} color={colors.common.white} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category Filters */}
          <View style={styles.categorySection}>
            <FlatList
              horizontal
              data={TEMPLATE_CATEGORIES}
              renderItem={({ item }) => renderCategoryChip(item)}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
          </View>

          {/* Templates List */}
          <FlatList
            data={filteredTemplates}
            renderItem={renderTemplateCard}
            keyExtractor={(item) => item._id || item.name || Math.random().toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={filteredTemplates.length > 0 ? renderListHeader : null}
            ListEmptyComponent={renderEmptyState}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.7,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${chatColors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
  },
  searchContainerFocused: {
    borderColor: chatColors.primary,
    backgroundColor: colors.common.white,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.grey[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySection: {
    paddingBottom: 8,
  },
  categoryList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: chatColors.primary,
    borderColor: chatColors.primary,
  },
  categoryChipIcon: {
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey[700],
  },
  categoryChipTextActive: {
    color: colors.common.white,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 12,
    color: colors.grey[600],
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexGrow: 1,
  },
  cardContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  templateCard: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardContent: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textTransform: 'capitalize',
    flex: 1,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.grey[300],
    marginHorizontal: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.grey[600],
  },
  previewBody: {
    fontSize: 13,
    color: colors.grey[600],
    lineHeight: 19,
    marginTop: 4,
  },
  buttonCountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  buttonCountText: {
    fontSize: 11,
    color: colors.grey[500],
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: `${chatColors.primary}10`,
    borderRadius: 20,
    gap: 6,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.primary,
  },
});

export default memo(TemplatePickerDialog);
