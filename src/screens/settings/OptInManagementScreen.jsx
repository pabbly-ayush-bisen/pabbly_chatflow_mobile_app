import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Switch, Button, ActivityIndicator, Surface, TextInput, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, updateSettings } from '../../redux/slices/settingsSlice';
import { colors } from '../../theme/colors';

export default function OptInManagementScreen() {
  const dispatch = useDispatch();

  const { settings, getSettingsStatus, updateSettingsStatus, getSettingsError, updateSettingsError } = useSelector(
    (state) => state.settings
  );

  const [apiCampaignOptOut, setApiCampaignOptOut] = useState(false);
  const [optInEnabled, setOptInEnabled] = useState(false);
  const [optInKeywords, setOptInKeywords] = useState('');
  const [optInMessage, setOptInMessage] = useState('');
  const [optOutEnabled, setOptOutEnabled] = useState(false);
  const [optOutKeywords, setOptOutKeywords] = useState('');
  const [optOutMessage, setOptOutMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isLoading = getSettingsStatus === 'loading';
  const isSaving = updateSettingsStatus === 'loading';

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings.optInManagement) {
      const optInMgmt = settings.optInManagement;
      setApiCampaignOptOut(optInMgmt.apiCampaignOptOut || false);

      if (optInMgmt.optInSettings) {
        setOptInEnabled(optInMgmt.optInSettings.response?.enabled || false);
        setOptInKeywords((optInMgmt.optInSettings.keywords || []).join(', '));
        setOptInMessage(optInMgmt.optInSettings.response?.regularMessage || '');
      }

      if (optInMgmt.optOutSettings) {
        setOptOutEnabled(optInMgmt.optOutSettings.response?.enabled || false);
        setOptOutKeywords((optInMgmt.optOutSettings.keywords || []).join(', '));
        setOptOutMessage(optInMgmt.optOutSettings.response?.regularMessage || '');
      }
    }
  }, [settings.optInManagement]);

  const loadSettings = () => {
    dispatch(getSettings('optInManagement'));
  };

  const handleSave = () => {
    const updatedSettings = {
      key: 'optInManagement',
      apiCampaignOptOut,
      optInSettings: {
        keywords: optInKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        response: {
          enabled: optInEnabled,
          regularMessage: optInMessage,
          messageType: 'text',
          regularMessageType: 'text',
        },
      },
      optOutSettings: {
        keywords: optOutKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        response: {
          enabled: optOutEnabled,
          regularMessage: optOutMessage,
          messageType: 'text',
          regularMessageType: 'text',
        },
      },
    };

    dispatch(updateSettings(updatedSettings))
      .unwrap()
      .then(() => {
        setSnackbarMessage('Settings saved successfully');
        setSnackbarVisible(true);
      })
      .catch((error) => {
        setSnackbarMessage(`Error: ${error || 'Failed to save settings'}`);
        setSnackbarVisible(true);
      });
  };

  const renderError = () => {
    const error = getSettingsError || updateSettingsError;
    if (!error) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {error}
        </Text>
      </Surface>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Opt-in Management
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Configure opt-in and opt-out settings
        </Text>
      </View>

      {renderError()}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* API Campaign Opt-out */}
        <Surface style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text variant="titleMedium" style={styles.switchTitle}>
                API Campaign Opt-out
              </Text>
              <Text variant="bodySmall" style={styles.switchDescription}>
                Enable to allow contacts to opt-out of API campaigns
              </Text>
            </View>
            <Switch
              value={apiCampaignOptOut}
              onValueChange={setApiCampaignOptOut}
              color={colors.primary.main}
            />
          </View>
        </Surface>

        {/* Opt-in Settings */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Opt-in Settings
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text variant="titleMedium" style={styles.switchTitle}>
                Enable Opt-in Response
              </Text>
              <Text variant="bodySmall" style={styles.switchDescription}>
                Send automatic response when users opt-in
              </Text>
            </View>
            <Switch
              value={optInEnabled}
              onValueChange={setOptInEnabled}
              color={colors.primary.main}
            />
          </View>

          <TextInput
            label="Opt-in Keywords"
            value={optInKeywords}
            onChangeText={setOptInKeywords}
            mode="outlined"
            placeholder="Enter keywords separated by commas (e.g., YES, SUBSCRIBE)"
            style={styles.input}
            multiline
          />

          <TextInput
            label="Opt-in Message"
            value={optInMessage}
            onChangeText={setOptInMessage}
            mode="outlined"
            placeholder="Enter the message to send when users opt-in"
            style={styles.input}
            multiline
            numberOfLines={4}
            disabled={!optInEnabled}
          />
        </Surface>

        {/* Opt-out Settings */}
        <Surface style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Opt-out Settings
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text variant="titleMedium" style={styles.switchTitle}>
                Enable Opt-out Response
              </Text>
              <Text variant="bodySmall" style={styles.switchDescription}>
                Send automatic response when users opt-out
              </Text>
            </View>
            <Switch
              value={optOutEnabled}
              onValueChange={setOptOutEnabled}
              color={colors.primary.main}
            />
          </View>

          <TextInput
            label="Opt-out Keywords"
            value={optOutKeywords}
            onChangeText={setOptOutKeywords}
            mode="outlined"
            placeholder="Enter keywords separated by commas (e.g., STOP, UNSUBSCRIBE)"
            style={styles.input}
            multiline
          />

          <TextInput
            label="Opt-out Message"
            value={optOutMessage}
            onChangeText={setOptOutMessage}
            mode="outlined"
            placeholder="Enter the message to send when users opt-out"
            style={styles.input}
            multiline
            numberOfLines={4}
            disabled={!optOutEnabled}
          />
        </Surface>

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          loading={isSaving}
          disabled={isSaving}
        >
          Save Settings
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Close',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchDescription: {
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.background.paper,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: 8,
  },
  errorContainer: {
    backgroundColor: colors.error.lighter,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: colors.error.main,
  },
});
