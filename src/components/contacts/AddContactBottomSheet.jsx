import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import Modal from 'react-native-modal';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { colors, chatColors } from '../../theme/colors';
import { createContact, gotoChat, setShouldFetchContacts } from '../../redux/slices/contactSlice';
import { getSettings } from '../../redux/slices/settingsSlice';
import CountryCodePicker from './CountryCodePicker';
import { DEFAULT_COUNTRY } from '../../data/countries';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Opt-in status options
const OPT_STATUS_OPTIONS = [
  { value: 'opted_in', label: 'Opted In', icon: 'check-circle', color: colors.success.main, bg: colors.success.lighter },
  { value: 'opted_out', label: 'Opted Out', icon: 'close-circle', color: colors.error.main, bg: colors.error.lighter },
  { value: 'not_set', label: 'Not Set', icon: 'minus-circle', color: colors.grey[500], bg: colors.grey[100] },
];

const AddContactBottomSheet = ({
  visible,
  onClose,
  onSuccess,
  navigation,
}) => {
  const dispatch = useDispatch();
  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    phoneNumber: '',
    optStatus: 'not_set',
    name: '',
  });
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [selectedTags, setSelectedTags] = useState([]);
  const [customFields, setCustomFields] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get tags and custom attributes from settings
  const { settings } = useSelector((state) => state.settings);
  const tags = settings?.tags?.items || [];
  const userAttributes = settings?.userAttributes?.items || [];

  // Load settings when modal opens
  useEffect(() => {
    if (visible) {
      dispatch(getSettings('tags,userAttributes'));
    }
  }, [visible, dispatch]);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setFormData({
      phoneNumber: '',
      optStatus: 'not_set',
      name: '',
    });
    setSelectedCountry(DEFAULT_COUNTRY);
    setSelectedTags([]);
    setCustomFields({});
    setErrors({});
    setIsSubmitting(false);
  };

  const handleScrollTo = (p) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo(p);
    }
  };

  const handleOnScroll = (event) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setCustomFields((prev) => ({ ...prev, [fieldName]: value }));
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const tagId = tag._id || tag.name;
      const exists = prev.some((t) => (t._id || t.name) === tagId);
      if (exists) {
        return prev.filter((t) => (t._id || t.name) !== tagId);
      }
      return [...prev, tag];
    });
  };

  // Check if form is valid (without setting errors) - for button enable/disable
  const isFormValid = () => {
    const phone = formData.phoneNumber.trim().replace(/\D/g, '');
    if (!phone) return false;
    // Phone number should be at least 6 digits (without country code)
    if (phone.length < 6) return false;
    return true;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    const phone = formData.phoneNumber.trim().replace(/\D/g, '');
    if (!phone) {
      newErrors.phoneNumber = 'Phone number is required';
      isValid = false;
    } else if (phone.length < 6) {
      newErrors.phoneNumber = `Phone number is too short for ${selectedCountry.label}`;
      isValid = false;
    } else if (phone.length > 15) {
      newErrors.phoneNumber = 'Phone number is too long';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async ({ openChat = false } = {}) => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    // Build request body matching web app format
    const phoneNumber = formData.phoneNumber.trim().replace(/\D/g, '');
    const countryCode = selectedCountry.phone;
    const mobile = `${countryCode}${phoneNumber}`;

    const bodyData = {
      mobile,
      countryCode,
      source: 'manual',
    };

    // Add name if provided
    if (formData.name.trim()) {
      bodyData.name = formData.name.trim();
    }

    // Add opt-in status (web app uses 'optin' boolean)
    if (formData.optStatus && formData.optStatus !== 'not_set') {
      bodyData.optin = formData.optStatus === 'opted_in';
    }

    // Add tags
    if (selectedTags.length > 0) {
      bodyData.tags = selectedTags.map((tag) => tag._id || tag.name);
    }

    // Add custom fields/attributes
    const filledAttributes = [];
    Object.entries(customFields).forEach(([key, value]) => {
      if (value && value.toString().trim()) {
        const attr = userAttributes.find((a) => a.name === key || a.key === key);
        if (attr) {
          filledAttributes.push({
            name: key,
            __id: attr.__id || attr._id,
            value: value.toString().trim(),
          });
        }
      }
    });
    if (filledAttributes.length > 0) {
      bodyData.attributes = filledAttributes;
    }

    try {
      const createResponse = await dispatch(
        createContact({
          bodyData,
          isSingleContact: true,
          onDuplicate: 'skip',
        })
      ).unwrap();

      const createdData = createResponse?.data || createResponse || {};

      // Extract created contact from various possible response structures
      const createdContact =
        createdData.contact ||
        createdData.contacts?.[0] ||
        createdData.createdContacts?.[0] ||
        createdData.newContact ||
        createdData;

      const createdContactId = createdContact?._id || createdContact?.id;

      // Trigger contacts refresh
      dispatch(setShouldFetchContacts(true));

      // If openChat is true, navigate to chat
      if (openChat && createdContactId && navigation) {
        try {
          const gotoResponse = await dispatch(
            gotoChat({ id: createdContactId })
          ).unwrap();

          const gotoData = gotoResponse?.data || gotoResponse || {};

          // Extract chat from various possible response structures
          const chat = gotoData.chat || gotoData.chatData || gotoData;
          const chatId = chat?._id || chat?.chatId || chat?.id;

          if (chatId) {
            onClose();
            // Navigate to InboxTab first, then to ChatDetails
            // This ensures the inbox is loaded and the chat appears in the list
            navigation.navigate('DrawerNav', {
              screen: 'MainTabs',
              params: {
                screen: 'InboxTab',
              },
            });
            // Small delay to ensure inbox tab is active before navigating to chat
            setTimeout(() => {
              navigation.navigate('ChatDetails', { chatId, chat });
            }, 100);
            return;
          }
        } catch (chatError) {
          console.error('Failed to open chat:', chatError);
          // Even if chat fails, close the modal and show success for contact creation
          onClose();
          onSuccess && onSuccess(createdContact);
          return;
        }
      }

      onClose();
      onSuccess && onSuccess(createdContact);
    } catch (error) {
      console.error('Failed to create contact:', error);
      setErrors((prev) => ({
        ...prev,
        phoneNumber:
          typeof error === 'string'
            ? error
            : error?.message || 'Failed to create contact',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe={true}
      scrollTo={handleScrollTo}
      scrollOffset={scrollOffset}
      scrollOffsetMax={400}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      avoidKeyboard={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Icon name="account-plus" size={24} color={colors.primary.main} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Add New Contact</Text>
                <Text style={styles.headerSubtitle}>Enter contact details below</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            onScroll={handleOnScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Phone Number Input - Primary Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Icon name="whatsapp" size={18} color="#25D366" />
                <Text style={styles.inputLabel}>
                  Phone Number <Text style={styles.required}>*</Text>
                </Text>
              </View>
              <View style={styles.phoneInputContainer}>
                <CountryCodePicker
                  selectedCountry={selectedCountry}
                  onSelectCountry={setSelectedCountry}
                  disabled={isSubmitting}
                />
                <TextInput
                  value={formData.phoneNumber}
                  onChangeText={(value) => {
                    // Only allow digits
                    const numericValue = value.replace(/\D/g, '');
                    handleInputChange('phoneNumber', numericValue);
                  }}
                  mode="outlined"
                  style={styles.phoneInput}
                  outlineStyle={[styles.inputOutline, errors.phoneNumber && styles.inputOutlineError]}
                  error={!!errors.phoneNumber}
                  disabled={isSubmitting}
                  placeholder="Enter mobile number"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              {errors.phoneNumber ? (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              ) : (
                <Text style={styles.helperText}>
                  Enter the contact number for {selectedCountry.label} (+{selectedCountry.phone})
                </Text>
              )}
            </View>

            {/* Opt-in Status */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Icon name="shield-check" size={18} color={colors.primary.main} />
                <Text style={styles.inputLabel}>Opt-in Status</Text>
              </View>
              <View style={styles.optStatusContainer}>
                {OPT_STATUS_OPTIONS.map((option) => {
                  const isSelected = formData.optStatus === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optStatusOption,
                        isSelected && { backgroundColor: option.bg, borderColor: option.color },
                      ]}
                      onPress={() => handleInputChange('optStatus', option.value)}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name={option.icon}
                        size={18}
                        color={isSelected ? option.color : colors.text.tertiary}
                      />
                      <Text
                        style={[
                          styles.optStatusText,
                          isSelected && { color: option.color, fontWeight: '600' },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Name Input - Optional */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Icon name="account" size={18} color={colors.primary.main} />
                <Text style={styles.inputLabel}>Name</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
              </View>
              <TextInput
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
                placeholder="Enter contact name"
                placeholderTextColor={colors.text.tertiary}
                left={<TextInput.Icon icon="account-outline" color={colors.text.tertiary} />}
              />
            </View>

            {/* Tags Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.labelRow}>
                  <Icon name="tag-multiple" size={18} color={colors.primary.main} />
                  <Text style={styles.inputLabel}>Tags</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                </View>
                {selectedTags.length > 0 && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>{selectedTags.length} selected</Text>
                  </View>
                )}
              </View>

              <View style={styles.tagsContainer}>
                {tags.length > 0 ? (
                  <View style={styles.tagsGrid}>
                    {tags.map((tag, index) => {
                      const tagName = typeof tag === 'string' ? tag : tag.name || tag;
                      const tagId = tag._id || tagName;
                      const tagColor = typeof tag === 'object' ? tag.color : null;
                      const isSelected = selectedTags.some(
                        (t) => (t._id || t.name) === tagId
                      );

                      return (
                        <TouchableOpacity
                          key={tagId || index}
                          style={[
                            styles.tagChip,
                            isSelected && styles.tagChipSelected,
                            tagColor && !isSelected && { borderColor: tagColor, backgroundColor: `${tagColor}15` },
                            tagColor && isSelected && { backgroundColor: tagColor, borderColor: tagColor },
                          ]}
                          onPress={() => toggleTag(tag)}
                          disabled={isSubmitting}
                          activeOpacity={0.7}
                        >
                          {isSelected && (
                            <Icon name="check" size={14} color={tagColor ? colors.common.white : colors.common.white} />
                          )}
                          <Text
                            style={[
                              styles.tagChipText,
                              isSelected && styles.tagChipTextSelected,
                              tagColor && !isSelected && { color: tagColor },
                              tagColor && isSelected && { color: colors.common.white },
                            ]}
                          >
                            {tagName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Icon name="tag-off-outline" size={24} color={colors.grey[300]} />
                    <Text style={styles.emptyStateText}>No tags available</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Custom Fields Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.labelRow}>
                  <Icon name="form-textbox" size={18} color={colors.primary.main} />
                  <Text style={styles.inputLabel}>Custom Fields</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                </View>
                {userAttributes.length > 0 && (
                  <View style={styles.fieldCountBadge}>
                    <Text style={styles.fieldCountText}>{userAttributes.length} fields</Text>
                  </View>
                )}
              </View>

              {userAttributes.length > 0 ? (
                <View style={styles.customFieldsContainer}>
                  {userAttributes.map((attr, index) => {
                    const fieldName = attr.name || attr.key || attr;
                    const fieldType = attr.type || 'text';
                    const hasValue = customFields[fieldName] && customFields[fieldName].trim();

                    return (
                      <View
                        key={attr._id || index}
                        style={[
                          styles.customFieldCard,
                          index < userAttributes.length - 1 && styles.customFieldCardWithBorder,
                        ]}
                      >
                        <View style={styles.customFieldHeader}>
                          <View style={styles.customFieldIconContainer}>
                            <Icon
                              name={fieldType === 'number' ? 'numeric' : 'text-short'}
                              size={16}
                              color={hasValue ? colors.primary.main : colors.grey[400]}
                            />
                          </View>
                          <Text style={styles.customFieldLabel}>{fieldName}</Text>
                          {hasValue && (
                            <Icon name="check-circle" size={14} color={colors.success.main} />
                          )}
                        </View>
                        <TextInput
                          value={customFields[fieldName] || ''}
                          onChangeText={(value) => handleCustomFieldChange(fieldName, value)}
                          mode="outlined"
                          style={styles.customFieldInput}
                          outlineStyle={[
                            styles.customFieldOutline,
                            hasValue && styles.customFieldOutlineFilled,
                          ]}
                          disabled={isSubmitting}
                          placeholder={`Enter ${fieldName.toLowerCase()}`}
                          placeholderTextColor={colors.text.tertiary}
                          keyboardType={fieldType === 'number' ? 'numeric' : 'default'}
                          dense
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <View style={styles.emptyStateIconContainer}>
                    <Icon name="form-textbox" size={28} color={colors.grey[400]} />
                  </View>
                  <Text style={styles.emptyStateTitle}>No Custom Fields</Text>
                  <Text style={styles.emptyStateText}>
                    Custom fields can be configured in settings
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => handleSubmit({ openChat: false })}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <>
                  <Icon name="content-save" size={18} color={colors.common.white} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendMessageButton,
                (!isFormValid() || isSubmitting) && styles.buttonDisabled,
              ]}
              onPress={() => handleSubmit({ openChat: true })}
              disabled={!isFormValid() || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <>
                  <Icon name="send" size={18} color={colors.common.white} />
                  <Text style={styles.sendMessageButtonText}>Send Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll Content
  scrollContent: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Input Groups
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  required: {
    color: colors.error.main,
  },
  optionalBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.common.white,
    fontSize: 15,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.common.white,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: colors.grey[300],
  },
  inputOutlineError: {
    borderColor: colors.error.main,
  },
  errorText: {
    fontSize: 12,
    color: colors.error.main,
    marginTop: 6,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    marginLeft: 4,
  },

  // Opt Status
  optStatusContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optStatusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    backgroundColor: colors.common.white,
  },
  optStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectedBadge: {
    backgroundColor: colors.primary.lighter,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Tags
  tagsContainer: {
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    padding: 14,
    minHeight: 60,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.grey[300],
    backgroundColor: colors.common.white,
  },
  tagChipSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  tagChipTextSelected: {
    color: colors.common.white,
  },

  // Custom Fields
  fieldCountBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fieldCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  customFieldsContainer: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey[200],
    overflow: 'hidden',
  },
  customFieldCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.common.white,
  },
  customFieldCardWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  customFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  customFieldIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  customFieldLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  customFieldInput: {
    backgroundColor: colors.grey[50],
    fontSize: 14,
  },
  customFieldOutline: {
    borderRadius: 10,
    borderColor: colors.grey[200],
  },
  customFieldOutlineFilled: {
    borderColor: colors.primary.light,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyStateCard: {
    backgroundColor: colors.grey[50],
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey[200],
    borderStyle: 'dashed',
  },
  emptyStateIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // Action Buttons
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[100],
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey[600],
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.common.white,
  },
  sendMessageButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendMessageButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.common.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default AddContactBottomSheet;
