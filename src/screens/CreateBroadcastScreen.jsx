import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Surface, Chip, HelperText, Checkbox } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { createBroadcast, testBroadcast } from '../redux/slices/broadcastSlice';
import { getContactList } from '../redux/slices/contactSlice';
import { colors } from '../theme/colors';

export default function CreateBroadcastScreen({ navigation }) {
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    name: '',
    message: '',
  });

  const [selectedLists, setSelectedLists] = useState([]);
  const [errors, setErrors] = useState({
    name: '',
    message: '',
    lists: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const { contactListData, contactListStatus } = useSelector((state) => state.contact);

  useEffect(() => {
    // Load contact lists
    dispatch(getContactList({ skip: 1, limit: 50, all: true }));
  }, []);

  const validateForm = () => {
    const newErrors = {
      name: '',
      message: '',
      lists: '',
    };

    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Broadcast name is required';
      isValid = false;
    }

    // Message validation
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
      isValid = false;
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
      isValid = false;
    }

    // Lists validation
    if (selectedLists.length === 0) {
      newErrors.lists = 'Select at least one contact list';
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

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleListToggle = (listName) => {
    setSelectedLists((prev) => {
      if (prev.includes(listName)) {
        return prev.filter((name) => name !== listName);
      } else {
        return [...prev, listName];
      }
    });

    // Clear list error
    if (errors.lists) {
      setErrors((prev) => ({
        ...prev,
        lists: '',
      }));
    }
  };

  const handleTestBroadcast = async () => {
    if (!formData.message.trim()) {
      setErrors((prev) => ({
        ...prev,
        message: 'Message is required for testing',
      }));
      return;
    }

    setIsTesting(true);

    try {
      await dispatch(
        testBroadcast({
          message: formData.message.trim(),
        })
      ).unwrap();

      alert('Test broadcast sent successfully!');
    } catch (error) {
      alert(`Test failed: ${error || 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const bodyData = {
      name: formData.name.trim(),
      message: formData.message.trim(),
      contactLists: selectedLists,
    };

    try {
      await dispatch(createBroadcast(bodyData)).unwrap();

      // Success - navigate back
      navigation.goBack();
    } catch (error) {
      // Error handling
      setErrors((prev) => ({
        ...prev,
        name: error || 'Failed to create broadcast',
      }));
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const renderContactLists = () => {
    if (contactListStatus === 'loading') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text variant="bodySmall" style={styles.loadingText}>
            Loading contact lists...
          </Text>
        </View>
      );
    }

    if (contactListData.length === 0) {
      return (
        <Text variant="bodyMedium" style={styles.emptyText}>
          No contact lists available. Create a contact list first.
        </Text>
      );
    }

    return (
      <View style={styles.listsContainer}>
        {contactListData.map((list) => (
          <View key={list._id || list.listname} style={styles.listItem}>
            <Checkbox
              status={selectedLists.includes(list.listname) ? 'checked' : 'unchecked'}
              onPress={() => handleListToggle(list.listname)}
              color={colors.primary.main}
            />
            <View style={styles.listInfo}>
              <Text variant="bodyMedium" style={styles.listName}>
                {list.listname}
              </Text>
              <Text variant="bodySmall" style={styles.listCount}>
                {list.count || 0} contacts
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
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
              Create Broadcast
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Send a message to multiple contacts at once
            </Text>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Broadcast Name *"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                mode="outlined"
                style={styles.input}
                error={!!errors.name}
                disabled={isSubmitting}
                placeholder="e.g., Weekly Newsletter"
              />
              {errors.name ? (
                <HelperText type="error" visible={!!errors.name}>
                  {errors.name}
                </HelperText>
              ) : null}
            </View>

            {/* Message Input */}
            <View style={styles.inputGroup}>
              <TextInput
                label="Message *"
                value={formData.message}
                onChangeText={(value) => handleInputChange('message', value)}
                mode="outlined"
                style={styles.input}
                error={!!errors.message}
                disabled={isSubmitting}
                placeholder="Type your message here..."
                multiline
                numberOfLines={6}
                maxLength={1000}
              />
              <View style={styles.characterCount}>
                <Text variant="bodySmall" style={styles.characterCountText}>
                  {formData.message.length} / 1000 characters
                </Text>
              </View>
              {errors.message ? (
                <HelperText type="error" visible={!!errors.message}>
                  {errors.message}
                </HelperText>
              ) : null}
            </View>

            {/* Contact Lists Selection */}
            <View style={styles.inputGroup}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Contact Lists *
              </Text>
              {renderContactLists()}
              {errors.lists ? (
                <HelperText type="error" visible={!!errors.lists}>
                  {errors.lists}
                </HelperText>
              ) : null}
            </View>

            {/* Selected Lists Summary */}
            {selectedLists.length > 0 && (
              <View style={styles.selectedSummary}>
                <Text variant="bodyMedium" style={styles.selectedTitle}>
                  Selected Lists ({selectedLists.length}):
                </Text>
                <View style={styles.chipContainer}>
                  {selectedLists.map((listName) => (
                    <Chip
                      key={listName}
                      mode="outlined"
                      style={styles.selectedChip}
                      onClose={() => handleListToggle(listName)}
                    >
                      {listName}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Test Broadcast Button */}
            <View style={styles.testSection}>
              <Button
                mode="outlined"
                onPress={handleTestBroadcast}
                style={styles.testButton}
                disabled={isSubmitting || isTesting}
                loading={isTesting}
                icon="send-check"
              >
                {isTesting ? 'Sending Test...' : 'Send Test Broadcast'}
              </Button>
              <Text variant="bodySmall" style={styles.testHelperText}>
                Test the message before sending to all contacts
              </Text>
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
                onPress={handleSubmit}
                style={styles.saveButton}
                disabled={isSubmitting}
                loading={isSubmitting}
                icon="send"
              >
                {isSubmitting ? 'Sending...' : 'Send Broadcast'}
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
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.background.paper,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  characterCountText: {
    color: colors.text.secondary,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  listsContainer: {
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
    padding: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  listInfo: {
    flex: 1,
    marginLeft: 8,
  },
  listName: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  listCount: {
    color: colors.text.secondary,
  },
  selectedSummary: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.primary.lighter,
    borderRadius: 8,
  },
  selectedTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  testSection: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: colors.info.lighter,
    borderRadius: 8,
  },
  testButton: {
    borderColor: colors.info.main,
    marginBottom: 8,
  },
  testHelperText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: colors.text.secondary,
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
    padding: 16,
  },
});
