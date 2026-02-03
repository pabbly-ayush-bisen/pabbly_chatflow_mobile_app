import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, AppState } from 'react-native';
import * as Updates from 'expo-updates';

const UpdateContext = createContext({
  isUpdateAvailable: false,
  isDownloading: false,
  isApplying: false,
  isChecking: false,
  lastChecked: null,
  updateError: null,
  updateMessage: '',
  checkForUpdate: () => {},
  downloadAndApplyUpdate: () => {},
});

// Default configuration for update behavior
const DEFAULT_CONFIG = {
  // Check for updates on app start
  checkOnStart: true,
  // Check for updates when app comes to foreground
  checkOnForeground: true,
  // Auto-download updates when available
  autoDownload: true,
  // Auto-apply updates after download (will reload app with loading overlay)
  autoApply: true,
  // Minimum interval between checks (in milliseconds)
  minCheckInterval: 5 * 60 * 1000, // 5 minutes
  // Delay before applying update (to show the message)
  applyDelay: 1500, // 1.5 seconds
};

// Loading overlay component shown during update
function UpdateOverlay({ visible, message, isDownloading }) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.overlayContent}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.overlayTitle}>
            {isDownloading ? 'Downloading Update' : 'Applying Update'}
          </Text>
          <Text style={styles.overlayMessage}>{message}</Text>
          <Text style={styles.overlaySubtext}>
            Please wait, the app will refresh automatically
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function UpdateProvider({ children, config = {} }) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [downloadedUpdate, setDownloadedUpdate] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Merge default config with provided config
  const settings = { ...DEFAULT_CONFIG, ...config };

  // Check if we're in a development build (updates don't work in dev)
  const isUpdateSupported = !__DEV__ && Updates.isEnabled;

  // Apply the downloaded update (reload app)
  const applyUpdate = useCallback(async () => {
    if (!isUpdateSupported) return;

    try {
      setIsApplying(true);
      setShowOverlay(true);
      setUpdateMessage('Preparing to refresh...');

      console.log('[UpdateContext] Applying update and reloading...');

      // Small delay to show the overlay message
      await new Promise(resolve => setTimeout(resolve, settings.applyDelay));

      setUpdateMessage('Refreshing app...');
      await Updates.reloadAsync();
    } catch (error) {
      console.error('[UpdateContext] Error applying update:', error);
      setUpdateError(error.message);
      setShowOverlay(false);
      setIsApplying(false);
    }
  }, [isUpdateSupported, settings.applyDelay]);

  // Download the update
  const downloadUpdate = useCallback(async () => {
    if (!isUpdateSupported) return null;

    try {
      setIsDownloading(true);
      setShowOverlay(true);
      setUpdateMessage('A new update is available. Downloading...');

      console.log('[UpdateContext] Downloading update...');

      const result = await Updates.fetchUpdateAsync();
      setDownloadedUpdate(result);

      console.log('[UpdateContext] Update downloaded successfully');
      setUpdateMessage('Download complete!');

      if (settings.autoApply) {
        // Auto-apply: reload with overlay
        setUpdateMessage('Installing update...');
        await applyUpdate();
      } else {
        setShowOverlay(false);
      }

      return result;
    } catch (error) {
      console.error('[UpdateContext] Error downloading update:', error);
      setUpdateError(error.message);
      setShowOverlay(false);
      return null;
    } finally {
      setIsDownloading(false);
    }
  }, [isUpdateSupported, settings.autoApply, applyUpdate]);

  // Check for updates
  const checkForUpdate = useCallback(async (silent = false) => {
    if (!isUpdateSupported) {
      if (!silent) {
        console.log('[UpdateContext] Updates not supported in development');
      }
      return null;
    }

    // Respect minimum check interval
    if (lastChecked && Date.now() - lastChecked < settings.minCheckInterval) {
      console.log('[UpdateContext] Skipping check - too soon since last check');
      return null;
    }

    try {
      setIsChecking(true);
      setUpdateError(null);

      console.log('[UpdateContext] Checking for updates...');
      const update = await Updates.checkForUpdateAsync();

      setLastChecked(Date.now());
      setIsUpdateAvailable(update.isAvailable);

      if (update.isAvailable) {
        console.log('[UpdateContext] Update available!');

        if (settings.autoDownload) {
          // Auto-download and apply the update
          await downloadUpdate();
        }
      } else {
        console.log('[UpdateContext] App is up to date');
      }

      return update;
    } catch (error) {
      console.error('[UpdateContext] Error checking for updates:', error);
      setUpdateError(error.message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [isUpdateSupported, lastChecked, settings.minCheckInterval, settings.autoDownload, downloadUpdate]);

  // Combined download and apply
  const downloadAndApplyUpdate = useCallback(async () => {
    if (!isUpdateSupported) return;

    if (downloadedUpdate) {
      // Already downloaded, just apply
      await applyUpdate();
    } else {
      // Download first, then apply
      await downloadUpdate();
    }
  }, [isUpdateSupported, downloadedUpdate, downloadUpdate, applyUpdate]);

  // Check for updates on mount
  useEffect(() => {
    if (settings.checkOnStart) {
      // Small delay to let app initialize first
      const timer = setTimeout(() => {
        checkForUpdate(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Check for updates when app comes to foreground
  useEffect(() => {
    if (!settings.checkOnForeground) return;

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkForUpdate(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [settings.checkOnForeground, checkForUpdate]);

  const value = {
    isUpdateAvailable,
    isDownloading,
    isApplying,
    isChecking,
    lastChecked,
    updateError,
    updateMessage,
    checkForUpdate,
    downloadAndApplyUpdate,
    applyUpdate,
    isUpdateSupported,
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
      <UpdateOverlay
        visible={showOverlay}
        message={updateMessage}
        isDownloading={isDownloading}
      />
    </UpdateContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  overlayMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  overlaySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export function useUpdates() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdates must be used within an UpdateProvider');
  }
  return context;
}

export default UpdateContext;
