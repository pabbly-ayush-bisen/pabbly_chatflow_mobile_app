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

// Template categories with icons and colors
const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'view-grid', color: '#6366F1' },
  { id: 'MARKETING', label: 'Marketing', icon: 'bullhorn', color: '#8B5CF6' },
  { id: 'UTILITY', label: 'Utility', icon: 'wrench', color: '#0891B2' },
  { id: 'AUTHENTICATION', label: 'Auth', icon: 'shield-check', color: '#059669' },
];

// Category config (matches TemplatesScreen TYPE_CONFIG)
const CATEGORY_CONFIG = {
  marketing:      { label: 'Marketing', color: '#8B5CF6' },
  utility:        { label: 'Utility',   color: '#0891B2' },
  authentication: { label: 'Auth',      color: '#059669' },
};

// Header format config (matches TemplatesScreen FORMAT_CONFIG)
const FORMAT_CONFIG = {
  IMAGE:              { label: 'Image',    icon: 'image-outline',         color: '#0EA5E9' },
  VIDEO:              { label: 'Video',    icon: 'video-outline',         color: '#F97316' },
  DOCUMENT:           { label: 'Document', icon: 'file-document-outline', color: '#8B5CF6' },
  TEXT:               { label: 'Text',     icon: 'format-text',           color: '#64748B' },
  LOCATION:           { label: 'Location', icon: 'map-marker-outline',    color: '#10B981' },
  CAROUSEL:           { label: 'Carousel', icon: 'view-carousel-outline', color: '#EC4899' },
  LIMITED_TIME_OFFER: { label: 'LTO',      icon: 'clock-alert-outline',   color: '#F59E0B' },
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

  // Check if template has variables (both numeric {{1}} and named {{name}})
  const hasVariables = useCallback((template) => {
    const bodyText = getTemplateBodyText(template);
    return /\{\{.*?\}\}/.test(bodyText);
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

  // Get format config from header format
  const getFormatConfig = useCallback((format) => {
    return FORMAT_CONFIG[(format || 'TEXT').toUpperCase()] || FORMAT_CONFIG.TEXT;
  }, []);

  // Get category config from template category
  const getCategoryConfig = useCallback((category) => {
    return CATEGORY_CONFIG[(category || '').toLowerCase()] || { label: category || 'Other', color: '#64748B' };
  }, []);

  // Render category chip
  const renderCategoryChip = useCallback((category) => {
    const isActive = activeCategory === category.id;
    const pillColor = category.color;

    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryChip,
          isActive
            ? { backgroundColor: pillColor, borderColor: pillColor }
            : { backgroundColor: pillColor + '08', borderColor: pillColor + '25' },
        ]}
        onPress={() => setActiveCategory(category.id)}
        activeOpacity={0.7}
      >
        <Icon
          name={category.icon}
          size={14}
          color={isActive ? '#FFFFFF' : pillColor}
          style={styles.categoryChipIcon}
        />
        <Text
          style={[
            styles.categoryChipText,
            { color: isActive ? '#FFFFFF' : pillColor },
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
    const header = getTemplateHeader(item);
    const hasCarousel = item.components?.some(c => c.type === 'CAROUSEL' || c.type === 'carousel');
    const hasLTO = item.components?.some(c => c.type === 'LIMITED_TIME_OFFER' || c.type === 'limited_time_offer');
    const detectedFormat = hasCarousel ? 'CAROUSEL' : hasLTO ? 'LIMITED_TIME_OFFER' : header?.type?.toUpperCase() || 'TEXT';
    const formatConfig = getFormatConfig(detectedFormat);
    const categoryConfig = getCategoryConfig(item.category);

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
          {/* Card Content */}
          <View style={styles.cardContent}>
            {/* Title Row */}
            <View style={styles.cardTopRow}>
              <Text style={styles.templateName} numberOfLines={1}>
                {item.name?.replace(/_/g, ' ')}
              </Text>
              <Icon name="chevron-right" size={20} color={colors.grey[300]} />
            </View>

            {/* Chips Row */}
            <View style={styles.chipsRow}>
              <View style={[styles.chip, { backgroundColor: categoryConfig.color + '12' }]}>
                <Icon name="tag-outline" size={12} color={categoryConfig.color} />
                <Text style={[styles.chipText, { color: categoryConfig.color }]}>{categoryConfig.label}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: formatConfig.color + '12' }]}>
                <Icon name={formatConfig.icon} size={12} color={formatConfig.color} />
                <Text style={[styles.chipText, { color: formatConfig.color }]}>{formatConfig.label}</Text>
              </View>
              <View style={styles.langChip}>
                <Text style={styles.langChipText}>{(item.language || 'en').toUpperCase()}</Text>
              </View>
              {hasVars && (
                <View style={[styles.chip, { backgroundColor: '#F59E0B12' }]}>
                  <Icon name="code-braces" size={12} color="#F59E0B" />
                </View>
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
  }, [handleSelect, getTemplateBodyText, getTemplateButtons, hasVariables, getTemplateHeader, getFormatConfig, getCategoryConfig]);

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
    fontWeight: '400',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipIcon: {
    marginRight: 5,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 10,
    lineHeight: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  langChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.grey[100],
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
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
