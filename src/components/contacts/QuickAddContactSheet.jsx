import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import Modal from 'react-native-modal';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { colors, chatColors } from '../../theme/colors';
import { createContact, gotoChat, setShouldFetchContacts } from '../../redux/slices/contactSlice';
import { setShouldRefreshChats } from '../../redux/slices/inboxSlice';
import CountryCodeDropdown from './CountryCodeDropdown';
import { DEFAULT_COUNTRY } from '../../data/countries';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * QuickAddContactSheet - A simplified contact creation sheet
 * Only asks for name and phone number, then creates a chat
 */
const QuickAddContactSheet = ({
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
    name: '',
  });
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setFormData({
      phoneNumber: '',
      name: '',
    });
    setSelectedCountry(DEFAULT_COUNTRY);
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
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate phone number
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{6,15}$/.test(formData.phoneNumber.trim())) {
      newErrors.phoneNumber = 'Enter a valid phone number (6-15 digits)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.phoneNumber.trim().length >= 6;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    // Build request body matching web app format
    const phoneNumber = formData.phoneNumber.trim().replace(/\D/g, '');
    const countryCode = selectedCountry.phone;
    const mobile = `${countryCode}${phoneNumber}`;

    const bodyData = {
      optin: true,
      mobile,
      countryCode,
      source: 'manual',
      tags: [],
      attributes: [],
    };

    // Add name if provided
    if (formData.name.trim()) {
      bodyData.name = formData.name.trim();
    }

    try {
      // Use onDuplicate: 'error' to get error if contact already exists
      const createResponse = await dispatch(
        createContact({
          bodyData,
          isSingleContact: true,
          onDuplicate: 'error',
        })
      ).unwrap();

      const createdData = createResponse?.data || createResponse || {};

      // Check if there are failed contacts (duplicates)
      if (createdData.failedContacts && createdData.failedContacts.length > 0) {
        const failedContact = createdData.failedContacts[0];
        setErrors((prev) => ({
          ...prev,
          phoneNumber: failedContact.error || 'This phone number already exists',
        }));
        setIsSubmitting(false);
        return;
      }

      // Extract created contact from various possible response structures
      const createdContact =
        createdData.contact ||
        createdData.contacts?.[0] ||
        createdData.createdContacts?.[0] ||
        createdData.newContact ||
        createdData;

      const createdContactId = createdContact?._id || createdContact?.id;

      // Trigger contacts and chats refresh
      dispatch(setShouldFetchContacts(true));
      dispatch(setShouldRefreshChats(true));

      // Navigate to chat
      if (createdContactId && navigation) {
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
          // Even if chat fails, close the modal and show success for contact creation
          onClose();
          onSuccess && onSuccess(createdContact);
          return;
        }
      }

      onClose();
      onSuccess && onSuccess(createdContact);
    } catch (error) {
      // Check for duplicate error in the response
      const errorMessage = typeof error === 'string' ? error : error?.message || '';

      if (errorMessage.toLowerCase().includes('duplicate') ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('exists')) {
        setErrors((prev) => ({
          ...prev,
          phoneNumber: 'This phone number already exists in contacts',
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          phoneNumber: errorMessage || 'Failed to create contact',
        }));
      }
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
      scrollOffsetMax={200}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      avoidKeyboard={true}
    >
      <View style={styles.container}>
        {/* Handle Bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Icon name="message-plus" size={24} color={chatColors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>New Chat</Text>
              <Text style={styles.headerSubtitle}>Start a conversation</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentWrapper}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            onScroll={handleOnScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
          {/* Phone Number Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Icon name="whatsapp" size={18} color="#25D366" />
              <Text style={styles.inputLabel}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
            </View>
            <View style={styles.phoneInputRow}>
              <CountryCodeDropdown
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
                disabled={isSubmitting}
              />
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  mode="outlined"
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.phoneNumber}
                  onChangeText={(text) => handleInputChange('phoneNumber', text)}
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                  outlineStyle={[
                    styles.inputOutline,
                    errors.phoneNumber && styles.inputOutlineError,
                  ]}
                  contentStyle={styles.inputContent}
                  disabled={isSubmitting}
                />
              </View>
            </View>
            {errors.phoneNumber && (
              <View style={styles.errorRow}>
                <Icon name="alert-circle" size={14} color={colors.error.main} />
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              </View>
            )}
          </View>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Icon name="account" size={18} color={colors.primary.main} />
              <Text style={styles.inputLabel}>Name</Text>
              <Text style={styles.optionalText}>(Optional)</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="Enter contact name"
              placeholderTextColor={colors.text.tertiary}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              style={styles.textInput}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              disabled={isSubmitting}
            />
          </View>
          </ScrollView>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.startChatButton,
              (!isFormValid() || isSubmitting) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.common.white} />
            ) : (
              <>
                <Icon name="message-text" size={20} color={colors.common.white} />
                <Text style={styles.startChatButtonText}>Start Chat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  contentWrapper: {
    flexShrink: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${chatColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexShrink: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  required: {
    color: colors.error.main,
  },
  optionalText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    backgroundColor: colors.common.white,
    height: 48,
    fontSize: 15,
  },
  inputContent: {
    paddingLeft: 14,
  },
  textInput: {
    backgroundColor: colors.common.white,
    height: 48,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: colors.grey[300],
  },
  inputOutlineError: {
    borderColor: colors.error.main,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.error.main,
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startChatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.common.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default QuickAddContactSheet;
