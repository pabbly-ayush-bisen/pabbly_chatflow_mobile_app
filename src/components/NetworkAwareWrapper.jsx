/**
 * NetworkAwareWrapper - A wrapper component that handles network-aware UI
 *
 * Shows an offline banner when the device is offline and
 * displays an alert dialog when the app starts without internet.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../contexts/NetworkContext';
import { OfflineBanner, OfflineAlert } from './common/OfflineBanner';

/**
 * NetworkAwareWrapper Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {boolean} props.showBanner - Whether to show the offline banner (default: true)
 * @param {boolean} props.showInitialAlert - Whether to show alert on app start when offline (default: true)
 */
export function NetworkAwareWrapper({
  children,
  showBanner = true,
  showInitialAlert = true,
}) {
  const insets = useSafeAreaInsets();
  const { isOffline, registerNetworkChangeCallback } = useNetwork();
  const [showAlert, setShowAlert] = useState(false);
  const [hasShownInitialAlert, setHasShownInitialAlert] = useState(false);

  // Show alert when app starts and is offline
  useEffect(() => {
    if (showInitialAlert && isOffline && !hasShownInitialAlert) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setShowAlert(true);
        setHasShownInitialAlert(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isOffline, showInitialAlert, hasShownInitialAlert]);

  // Handle network status changes
  const handleNetworkChange = useCallback(({ type }) => {
    if (type === 'offline') {
      // Show alert when network goes offline during use
      setShowAlert(true);
    }
  }, []);

  // Register network change callback
  useEffect(() => {
    const unregister = registerNetworkChangeCallback(handleNetworkChange);
    return () => unregister();
  }, [registerNetworkChangeCallback, handleNetworkChange]);

  const handleDismissAlert = () => {
    setShowAlert(false);
  };

  return (
    <View style={styles.container}>
      {/* Main content */}
      <View style={[styles.content, { paddingTop: isOffline && showBanner ? 40 : 0 }]}>
        {children}
      </View>

      {/* Offline Banner - shown at top when offline */}
      {showBanner && (
        <View style={[styles.bannerContainer, { top: insets.top }]}>
          <OfflineBanner />
        </View>
      )}

      {/* Offline Alert Dialog */}
      <OfflineAlert visible={showAlert} onDismiss={handleDismissAlert} />
    </View>
  );
}

/**
 * withNetworkAwareness HOC
 *
 * A higher-order component that wraps a screen with network awareness.
 * Use this for screens that need to handle offline state specially.
 */
export function withNetworkAwareness(WrappedComponent, options = {}) {
  return function NetworkAwareComponent(props) {
    return (
      <NetworkAwareWrapper {...options}>
        <WrappedComponent {...props} />
      </NetworkAwareWrapper>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});

export default NetworkAwareWrapper;
