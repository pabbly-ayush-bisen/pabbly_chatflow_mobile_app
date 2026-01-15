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

    // Only show approved templates
    return filtered.filter((t) => t.status === 'APPROVED');
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
    const header = getTemplateHeader(item);
    const bodyText = getTemplateBodyText(item);
    const buttons = getTemplateButtons(item);
    const hasVars = hasVariables(item);
    const categoryStyle = getCategoryStyle(item.category);

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
          activeOpacity={0.8}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleSection}>
              <View style={[styles.templateIcon, { backgroundColor: categoryStyle.bg }]}>
                <Icon
                  name="file-document-outline"
                  size={18}
                  color={categoryStyle.icon}
                />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.templateName} numberOfLines={1}>
                  {item.name?.replace(/_/g, ' ')}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.categoryTag, { backgroundColor: categoryStyle.bg }]}>
                    <Text style={[styles.categoryTagText, { color: categoryStyle.text }]}>
                      {item.category}
                    </Text>
                  </View>
                  <Text style={styles.languageTag}>
                    {(item.language || 'en').toUpperCase()}
                  </Text>
                  {hasVars && (
                    <View style={styles.variableIndicator}>
                      <Icon name="code-braces" size={12} color={chatColors.primary} />
                    </View>
                  )}
                </View>
              </View>
            </View>
            <Icon name="chevron-right" size={22} color={colors.grey[400]} />
          </View>

          {/* Template Preview */}
          <View style={styles.previewContainer}>
            {/* Header Preview */}
            {header && (
              <View style={styles.previewSection}>
                {header.type === 'TEXT' ? (
                  <Text style={styles.previewHeaderText} numberOfLines={1}>
                    {header.text}
                  </Text>
                ) : (
                  <View style={styles.mediaIndicator}>
                    <Icon
                      name={
                        header.type === 'IMAGE' ? 'image-outline' :
                        header.type === 'VIDEO' ? 'video-outline' :
                        header.type === 'DOCUMENT' ? 'file-document-outline' :
                        'attachment'
                      }
                      size={14}
                      color={colors.grey[500]}
                    />
                    <Text style={styles.mediaText}>
                      {header.type.charAt(0) + header.type.slice(1).toLowerCase()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Body Preview */}
            <Text style={styles.previewBody} numberOfLines={2}>
              {bodyText || 'No message content'}
            </Text>

            {/* Buttons Preview */}
            {buttons.length > 0 && (
              <View style={styles.buttonsPreview}>
                {buttons.slice(0, 3).map((button, idx) => (
                  <View key={idx} style={styles.buttonChip}>
                    <Icon
                      name={
                        button.type === 'URL' ? 'link-variant' :
                        button.type === 'PHONE_NUMBER' ? 'phone' :
                        'reply'
                      }
                      size={11}
                      color={chatColors.primary}
                    />
                    <Text style={styles.buttonChipText} numberOfLines={1}>
                      {button.text}
                    </Text>
                  </View>
                ))}
                {buttons.length > 3 && (
                  <Text style={styles.moreButtons}>+{buttons.length - 3}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [handleSelect, getTemplateHeader, getTemplateBodyText, getTemplateButtons, hasVariables, getCategoryStyle]);

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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: 400,
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 2,
    borderColor: 'transparent',
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
    paddingBottom: 12,
  },
  categoryList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: chatColors.primary,
  },
  categoryChipIcon: {
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey[600],
  },
  categoryChipTextActive: {
    color: colors.common.white,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexGrow: 1,
  },
  cardContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  templateCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  languageTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.grey[500],
    backgroundColor: colors.grey[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  variableIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${chatColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    backgroundColor: colors.grey[50],
    borderRadius: 10,
    padding: 12,
  },
  previewSection: {
    marginBottom: 8,
  },
  previewHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  mediaText: {
    fontSize: 11,
    color: colors.grey[600],
    marginLeft: 6,
    fontWeight: '500',
  },
  previewBody: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  buttonsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  buttonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `${chatColors.primary}40`,
    gap: 4,
  },
  buttonChipText: {
    fontSize: 11,
    color: chatColors.primary,
    fontWeight: '500',
    maxWidth: 80,
  },
  moreButtons: {
    fontSize: 11,
    color: colors.grey[500],
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
