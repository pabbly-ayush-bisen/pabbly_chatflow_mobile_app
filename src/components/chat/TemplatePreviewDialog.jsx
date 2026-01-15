import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * TemplatePreviewDialog Component
 * A beautifully redesigned WhatsApp-style template preview with modern UI/UX
 * Features: Smooth animations, better visual hierarchy, intuitive variable inputs
 */

const TemplatePreviewDialog = ({
  visible,
  onClose,
  template,
  onSend,
  isSending = false,
}) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State for variable values
  const [bodyVariables, setBodyVariables] = useState({});
  const [headerVariables, setHeaderVariables] = useState({});
  const [activeInputIndex, setActiveInputIndex] = useState(null);

  // Animate on visibility change
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  // Extract template components
  const headerComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'HEADER');
  }, [template]);

  const bodyComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'BODY');
  }, [template]);

  const footerComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'FOOTER');
  }, [template]);

  const buttonsComponent = useMemo(() => {
    return template?.components?.find(c => c.type === 'BUTTONS');
  }, [template]);

  // Extract variables from text ({{1}}, {{2}}, etc.)
  const extractVariables = useCallback((text) => {
    if (!text) return [];
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].map(m => m.replace(/[{}]/g, ''));
  }, []);

  // Get body variables
  const bodyVars = useMemo(() => {
    return extractVariables(bodyComponent?.text);
  }, [bodyComponent, extractVariables]);

  // Get header variables (for text headers)
  const headerVars = useMemo(() => {
    if (headerComponent?.format === 'TEXT') {
      return extractVariables(headerComponent?.text);
    }
    return [];
  }, [headerComponent, extractVariables]);

  // Check if template has any variables
  const hasVariables = bodyVars.length > 0 || headerVars.length > 0;
  const totalVariables = bodyVars.length + headerVars.length;

  // Count filled variables
  const filledCount = useMemo(() => {
    const bodyFilled = bodyVars.filter(v => bodyVariables[v]?.trim()).length;
    const headerFilled = headerVars.filter(v => headerVariables[v]?.trim()).length;
    return bodyFilled + headerFilled;
  }, [bodyVars, headerVars, bodyVariables, headerVariables]);

  // Reset variables when template changes
  useEffect(() => {
    if (template) {
      const newBodyVars = {};
      bodyVars.forEach(v => { newBodyVars[v] = ''; });
      setBodyVariables(newBodyVars);

      const newHeaderVars = {};
      headerVars.forEach(v => { newHeaderVars[v] = ''; });
      setHeaderVariables(newHeaderVars);
    }
  }, [template, bodyVars, headerVars]);

  // Replace variables in text with actual values or styled placeholders
  const replaceVariables = useCallback((text, variables, showPlaceholder = true) => {
    if (!text) return '';
    let result = text;
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      if (value?.trim()) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      } else if (showPlaceholder) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), `[Variable ${key}]`);
      }
    });
    return result;
  }, []);

  // Get preview text with variables replaced
  const previewBodyText = useMemo(() => {
    return replaceVariables(bodyComponent?.text, bodyVariables);
  }, [bodyComponent, bodyVariables, replaceVariables]);

  const previewHeaderText = useMemo(() => {
    if (headerComponent?.format === 'TEXT') {
      return replaceVariables(headerComponent?.text, headerVariables);
    }
    return headerComponent?.text || '';
  }, [headerComponent, headerVariables, replaceVariables]);

  // Check if all required variables are filled
  const allVariablesFilled = useMemo(() => {
    const bodyFilled = bodyVars.every(v => bodyVariables[v]?.trim());
    const headerFilled = headerVars.every(v => headerVariables[v]?.trim());
    return bodyFilled && headerFilled;
  }, [bodyVars, headerVars, bodyVariables, headerVariables]);

  // Handle send
  const handleSend = useCallback(() => {
    if (!allVariablesFilled && hasVariables) {
      return;
    }

    const bodyParams = bodyVars.map(v => bodyVariables[v] || '');
    const headerParams = headerVars.map(v => headerVariables[v] || '');

    onSend?.({
      template,
      bodyParams,
      headerParams,
    });
  }, [template, bodyVars, headerVars, bodyVariables, headerVariables, allVariablesFilled, hasVariables, onSend]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setBodyVariables({});
      setHeaderVariables({});
      setActiveInputIndex(null);
      onClose?.();
    });
  }, [onClose, slideAnim, fadeAnim]);

  // Get button icon
  const getButtonIcon = (type) => {
    switch (type) {
      case 'URL':
        return 'open-in-new';
      case 'PHONE_NUMBER':
        return 'phone';
      case 'QUICK_REPLY':
        return 'reply';
      case 'COPY_CODE':
        return 'content-copy';
      default:
        return 'gesture-tap-button';
    }
  };

  // Get category info
  const getCategoryInfo = (category) => {
    switch (category) {
      case 'MARKETING':
        return { color: '#8E24AA', icon: 'bullhorn', label: 'Marketing' };
      case 'UTILITY':
        return { color: colors.success.main, icon: 'wrench', label: 'Utility' };
      case 'AUTHENTICATION':
        return { color: colors.info.main, icon: 'shield-check', label: 'Authentication' };
      default:
        return { color: colors.grey[500], icon: 'file-document', label: category };
    }
  };

  if (!template) return null;

  const categoryInfo = getCategoryInfo(template.category);
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Icon name="message-text-outline" size={22} color={colors.common.white} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Send Template</Text>
                <Text style={styles.headerSubtitle}>Preview and customize your message</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={22} color={colors.grey[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Template Card */}
            <View style={styles.templateCard}>
              <View style={styles.templateCardHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: categoryInfo.color + '15' }]}>
                  <Icon name={categoryInfo.icon} size={18} color={categoryInfo.color} />
                </View>
                <View style={styles.templateCardInfo}>
                  <Text style={styles.templateName} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <View style={styles.templateBadges}>
                    <View style={[styles.badge, { backgroundColor: categoryInfo.color + '12' }]}>
                      <Text style={[styles.badgeText, { color: categoryInfo.color }]}>
                        {categoryInfo.label}
                      </Text>
                    </View>
                    <View style={styles.languageBadge}>
                      <Icon name="translate" size={12} color={colors.text.secondary} />
                      <Text style={styles.languageText}>
                        {template.language?.toUpperCase() || 'EN'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Message Preview Section */}
            <View style={styles.previewSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Icon name="eye-outline" size={16} color={chatColors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Message Preview</Text>
              </View>

              {/* WhatsApp Chat Preview */}
              <View style={styles.chatContainer}>
                {/* Chat Background Pattern */}
                <View style={styles.chatBackground}>
                  <View style={styles.messageBubbleWrapper}>
                    <View style={styles.messageBubble}>
                      {/* Message Tail */}
                      <View style={styles.bubbleTail} />

                      {/* Header */}
                      {headerComponent && (
                        <View style={styles.messageHeader}>
                          {headerComponent.format === 'TEXT' ? (
                            <Text style={styles.messageHeaderText}>
                              {previewHeaderText}
                            </Text>
                          ) : headerComponent.format === 'IMAGE' ? (
                            <View style={styles.mediaPlaceholder}>
                              <View style={styles.mediaIconWrapper}>
                                <Icon name="image-outline" size={28} color={colors.grey[400]} />
                              </View>
                              <Text style={styles.mediaLabel}>Image will appear here</Text>
                            </View>
                          ) : headerComponent.format === 'VIDEO' ? (
                            <View style={styles.mediaPlaceholder}>
                              <View style={styles.videoPlayButton}>
                                <Icon name="play" size={24} color={colors.common.white} />
                              </View>
                              <Text style={styles.mediaLabel}>Video will appear here</Text>
                            </View>
                          ) : headerComponent.format === 'DOCUMENT' ? (
                            <View style={styles.documentPreview}>
                              <View style={styles.documentIconWrapper}>
                                <Icon name="file-pdf-box" size={28} color="#E53935" />
                              </View>
                              <View style={styles.documentInfo}>
                                <Text style={styles.documentName}>Document</Text>
                                <Text style={styles.documentType}>PDF • Tap to view</Text>
                              </View>
                            </View>
                          ) : headerComponent.format === 'LOCATION' ? (
                            <View style={styles.locationPreview}>
                              <View style={styles.locationMap}>
                                <Icon name="map-marker" size={32} color="#E53935" />
                              </View>
                              <Text style={styles.locationLabel}>Location</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {/* Body */}
                      {bodyComponent && (
                        <Text style={styles.messageBody}>
                          {previewBodyText}
                        </Text>
                      )}

                      {/* Footer */}
                      {footerComponent && (
                        <Text style={styles.messageFooter}>
                          {footerComponent.text}
                        </Text>
                      )}

                      {/* Timestamp & Status */}
                      <View style={styles.messageMetaRow}>
                        <Text style={styles.messageTime}>
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Icon name="check-all" size={14} color={chatColors.tickBlue} />
                      </View>
                    </View>

                    {/* Template Buttons */}
                    {buttonsComponent?.buttons?.length > 0 && (
                      <View style={styles.buttonsWrapper}>
                        {buttonsComponent.buttons.map((button, index) => (
                          <View key={index} style={styles.templateButton}>
                            <Icon
                              name={getButtonIcon(button.type)}
                              size={15}
                              color={chatColors.primary}
                            />
                            <Text style={styles.templateButtonText} numberOfLines={1}>
                              {button.text}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Variables Section */}
            {hasVariables && (
              <View style={styles.variablesSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.warning.lighter }]}>
                    <Icon name="form-textbox" size={16} color={colors.warning.dark} />
                  </View>
                  <View style={styles.sectionHeaderContent}>
                    <Text style={styles.sectionTitle}>Customize Variables</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <Animated.View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(filledCount / totalVariables) * 100}%`,
                              backgroundColor: allVariablesFilled ? colors.success.main : colors.warning.main,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {filledCount}/{totalVariables}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.variablesDescription}>
                  Fill in the dynamic content for your personalized message
                </Text>

                {/* Header Variables */}
                {headerVars.length > 0 && (
                  <View style={styles.variableGroup}>
                    <View style={styles.variableGroupHeader}>
                      <Icon name="format-title" size={14} color={colors.text.secondary} />
                      <Text style={styles.variableGroupTitle}>Header Content</Text>
                    </View>
                    {headerVars.map((varNum, index) => {
                      const inputKey = `header-${varNum}`;
                      const isFilled = headerVariables[varNum]?.trim();
                      const isActive = activeInputIndex === inputKey;

                      return (
                        <View
                          key={inputKey}
                          style={[
                            styles.variableInputContainer,
                            isActive && styles.variableInputContainerActive,
                            isFilled && styles.variableInputContainerFilled,
                          ]}
                        >
                          <View style={styles.variableInputHeader}>
                            <View style={styles.variableLabelRow}>
                              <View style={[
                                styles.variableNumberBadge,
                                isFilled && styles.variableNumberBadgeFilled,
                              ]}>
                                <Text style={[
                                  styles.variableNumber,
                                  isFilled && styles.variableNumberFilled,
                                ]}>
                                  {varNum}
                                </Text>
                              </View>
                              <Text style={styles.variableLabel}>Variable {varNum}</Text>
                            </View>
                            {isFilled && (
                              <Icon name="check-circle" size={18} color={colors.success.main} />
                            )}
                          </View>
                          <TextInput
                            style={styles.variableTextInput}
                            placeholder={`Enter content for variable ${varNum}`}
                            placeholderTextColor={colors.grey[400]}
                            value={headerVariables[varNum] || ''}
                            onChangeText={(text) => {
                              setHeaderVariables(prev => ({ ...prev, [varNum]: text }));
                            }}
                            onFocus={() => setActiveInputIndex(inputKey)}
                            onBlur={() => setActiveInputIndex(null)}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Body Variables */}
                {bodyVars.length > 0 && (
                  <View style={styles.variableGroup}>
                    <View style={styles.variableGroupHeader}>
                      <Icon name="text" size={14} color={colors.text.secondary} />
                      <Text style={styles.variableGroupTitle}>Message Content</Text>
                    </View>
                    {bodyVars.map((varNum, index) => {
                      const inputKey = `body-${varNum}`;
                      const isFilled = bodyVariables[varNum]?.trim();
                      const isActive = activeInputIndex === inputKey;

                      return (
                        <View
                          key={inputKey}
                          style={[
                            styles.variableInputContainer,
                            isActive && styles.variableInputContainerActive,
                            isFilled && styles.variableInputContainerFilled,
                          ]}
                        >
                          <View style={styles.variableInputHeader}>
                            <View style={styles.variableLabelRow}>
                              <View style={[
                                styles.variableNumberBadge,
                                isFilled && styles.variableNumberBadgeFilled,
                              ]}>
                                <Text style={[
                                  styles.variableNumber,
                                  isFilled && styles.variableNumberFilled,
                                ]}>
                                  {varNum}
                                </Text>
                              </View>
                              <Text style={styles.variableLabel}>Variable {varNum}</Text>
                            </View>
                            {isFilled && (
                              <Icon name="check-circle" size={18} color={colors.success.main} />
                            )}
                          </View>
                          <TextInput
                            style={styles.variableTextInput}
                            placeholder={`Enter content for variable ${varNum}`}
                            placeholderTextColor={colors.grey[400]}
                            value={bodyVariables[varNum] || ''}
                            onChangeText={(text) => {
                              setBodyVariables(prev => ({ ...prev, [varNum]: text }));
                            }}
                            onFocus={() => setActiveInputIndex(inputKey)}
                            onBlur={() => setActiveInputIndex(null)}
                            multiline
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            {hasVariables && !allVariablesFilled && (
              <View style={styles.warningBanner}>
                <Icon name="information-outline" size={16} color={colors.warning.dark} />
                <Text style={styles.warningText}>
                  Complete all {totalVariables - filledCount} remaining variable{totalVariables - filledCount !== 1 ? 's' : ''} to send
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!allVariablesFilled && hasVariables) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={isSending || (!allVariablesFilled && hasVariables)}
              activeOpacity={0.8}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <>
                  <Icon
                    name={allVariablesFilled || !hasVariables ? 'send' : 'lock-outline'}
                    size={20}
                    color={colors.common.white}
                  />
                  <Text style={styles.sendButtonText}>
                    {allVariablesFilled || !hasVariables ? 'Send Template' : 'Fill Variables First'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdropTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Template Card
  templateCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grey[100],
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateCardInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  templateBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.grey[100],
    borderRadius: 6,
  },
  languageText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Preview Section
  previewSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: chatColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },

  // Chat Preview
  chatContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  chatBackground: {
    backgroundColor: '#E4DDD6',
    padding: 16,
    minHeight: 180,
    // Subtle pattern effect
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.01) 10px, rgba(0,0,0,0.01) 20px)',
  },
  messageBubbleWrapper: {
    alignItems: 'flex-start',
    maxWidth: '88%',
  },
  messageBubble: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    padding: 10,
    paddingBottom: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleTail: {
    position: 'absolute',
    left: -6,
    top: 0,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: colors.common.white,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  messageHeader: {
    marginBottom: 8,
  },
  messageHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  mediaPlaceholder: {
    backgroundColor: colors.grey[100],
    borderRadius: 10,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  mediaIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.grey[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaLabel: {
    fontSize: 12,
    color: colors.grey[500],
  },
  videoPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
    marginBottom: 4,
  },
  documentIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  documentType: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  locationPreview: {
    backgroundColor: colors.grey[100],
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  locationMap: {
    height: 80,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    padding: 8,
    textAlign: 'center',
  },
  messageBody: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  messageFooter: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.grey[500],
  },
  buttonsWrapper: {
    marginTop: 6,
    gap: 4,
    width: '100%',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.common.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  templateButtonText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // Variables Section
  variablesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.grey[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  variablesDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  variableGroup: {
    marginBottom: 16,
  },
  variableGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  variableGroupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variableInputContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    marginBottom: 10,
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  variableInputContainerActive: {
    borderColor: chatColors.primary,
    shadowColor: chatColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  variableInputContainerFilled: {
    borderColor: colors.success.light,
    backgroundColor: colors.success.lighter + '30',
  },
  variableInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  variableLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variableNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  variableNumberBadgeFilled: {
    backgroundColor: colors.success.main,
  },
  variableNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  variableNumberFilled: {
    color: colors.common.white,
  },
  variableLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  variableTextInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: 4,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 44,
  },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
    backgroundColor: colors.common.white,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning.lighter,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning.dark,
    fontWeight: '500',
    flex: 1,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    shadowColor: chatColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: colors.grey[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.common.white,
    letterSpacing: 0.2,
  },
});

export default memo(TemplatePreviewDialog);
