import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { createContact, gotoChat } from '../redux/slices/contactSlice';
import { sendMessageViaSocket } from '../services/socketService';
import { colors } from '../theme/colors';

export default function AddContactScreen({ navigation }) {
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    message: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    phoneNumber: '',
    email: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {
      name: '',
      phoneNumber: '',
      email: '',
    };

    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    // Phone number validation
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
      isValid = false;
    } else if (!/^[+]?[\d\s()-]{10,}$/.test(formData.phoneNumber.trim())) {
      newErrors.phoneNumber = 'Invalid phone number format';
      isValid = false;
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleSubmit = async ({ sendMessageAlso = false } = {}) => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const bodyData = {
      name: formData.name.trim(),
      phoneNumber: formData.phoneNumber.trim(),
    };

    if (formData.email.trim()) {
      bodyData.email = formData.email.trim();
    }

    try {
      const createResponse = await dispatch(
        createContact({
          bodyData,
          isSingleContact: true,
          onDuplicate: 'skip',
        })
      ).unwrap();

      const createdData = createResponse?.data || {};
      const createdContact =
        createdData.contact ||
        createdData.contacts?.[0] ||
        createdData.newContact ||
        createdData;

      const createdContactId = createdContact?._id;

      const trimmedMessage = formData.message.trim();

      if (sendMessageAlso && trimmedMessage && createdContactId) {
        try {
          const gotoResponse = await dispatch(
            gotoChat({ id: createdContactId })
          ).unwrap();

          const gotoData = gotoResponse?.data || {};
          const chat = gotoData.chat || gotoData.chatData || gotoData;
          const chatId = chat?._id || chat?.chatId || chat?.id;

          const phoneNumber =
            createdContact.phoneNumber ||
            createdContact.phone_number ||
            createdContact.mobile;

          if (chatId && phoneNumber) {
            // Send initial message via socket
            sendMessageViaSocket({
              to: phoneNumber,
              type: 'text',
              chatId,
              message: trimmedMessage,
            });

            // Navigate straight into the conversation
            navigation.navigate('ChatDetails', { chatId, chat });
          } else {
            // Fallback: just go back if we cannot open chat reliably
            navigation.goBack();
          }
        } catch (gotoError) {
          // Error:('Failed to open chat from contact:', gotoError);
          Alert.alert(
            'Contact Saved',
            'The contact was saved, but we could not open the chat. Please try from the Inbox.'
          );
          navigation.goBack();
        }
      } else {
        // Simple save – go back to previous screen
        navigation.goBack();
      }
    } catch (error) {
      // Error handling
      setErrors((prev) => ({
        ...prev,
        phoneNumber:
          typeof error === 'string'
            ? error
            : error?.message || 'Failed to create contact',
      }));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Surface style={styles.formContainer}>
            <Text variant="headlineSmall" style={styles.title}>
              Add New Contact
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Fill in the contact details below
            </Text>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Name *"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                mode="outlined"
                style={styles.input}
                error={!!errors.name}
                disabled={isSubmitting}
                placeholder="Enter contact name"
              />
              {errors.name ? (
                <HelperText type="error" visible={!!errors.name}>
                  {errors.name}
                </HelperText>
              ) : null}
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Phone Number *"
                value={formData.phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value)}
                mode="outlined"
                style={styles.input}
                error={!!errors.phoneNumber}
                disabled={isSubmitting}
                placeholder="+1234567890"
                keyboardType="phone-pad"
              />
              {errors.phoneNumber ? (
                <HelperText type="error" visible={!!errors.phoneNumber}>
                  {errors.phoneNumber}
                </HelperText>
              ) : (
                <HelperText type="info" visible={true}>
                  Include country code (e.g., +1 for US)
                </HelperText>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Email (Optional)"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                mode="outlined"
                style={styles.input}
                error={!!errors.email}
                disabled={isSubmitting}
                placeholder="contact@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? (
                <HelperText type="error" visible={!!errors.email}>
                  {errors.email}
                </HelperText>
              ) : null}
            </View>

            {/* Optional first message */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Message (Optional)"
                value={formData.message}
                onChangeText={(value) => handleInputChange('message', value)}
                mode="outlined"
                style={[styles.input, styles.messageInput]}
                disabled={isSubmitting}
                placeholder="Type a message to send right after saving this contact"
                multiline
                numberOfLines={3}
              />
              <HelperText type="info" visible={true}>
                If you type a message and tap "Save &amp; Send", we will open a chat and send it instantly.
              </HelperText>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.cancelButton}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                mode="contained"
                onPress={() => handleSubmit({ sendMessageAlso: false })}
                style={styles.saveButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Contact'}
              </Button>
            </View>

            <View style={styles.secondaryButtonRow}>
              <Button
                mode="contained-tonal"
                onPress={() => handleSubmit({ sendMessageAlso: true })}
                style={styles.saveAndMessageButton}
                disabled={isSubmitting || !formData.message.trim()}
              >
                Save &amp; Send Message
              </Button>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  formContainer: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.text.secondary,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.background.paper,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.grey[400],
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary.main,
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  secondaryButtonRow: {
    marginTop: 12,
  },
  saveAndMessageButton: {
    backgroundColor: colors.secondary?.main || colors.primary.light,
  },
});
