/**
 * OfflineBanner - A banner component that shows when the device is offline
 *
 * Displays at the top of the screen when network connectivity is lost,
 * informing users that they're viewing cached data.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../../contexts/NetworkContext';

/**
 * OfflineBanner Component
 *
 * @param {Object} props
 * @param {boolean} props.showRetry - Whether to show the retry button
 * @param {Function} props.onRetry - Callback when retry is pressed
 * @param {string} props.customMessage - Custom message to display
 */
export function OfflineBanner({ showRetry = true, onRetry, customMessage }) {
  const { isOffline, refreshNetworkState, getConnectionTypeLabel } = useNetwork();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOffline) {
      // Slide in and fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOffline, slideAnim, opacityAnim]);

  const handleRetry = async () => {
    await refreshNetworkState();
    if (onRetry) {
      onRetry();
    }
  };

  if (!isOffline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
        <Text style={styles.text}>
          {customMessage || 'You are offline. Showing cached data.'}
        </Text>
      </View>
      {showRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

/**
 * OfflineAlert - A more prominent alert for critical offline situations
 */
export function OfflineAlert({ visible, onDismiss }) {
  const { isOffline, getConnectionTypeLabel } = useNetwork();

  if (!visible || !isOffline) {
    return null;
  }

  return (
    <View style={styles.alertOverlay}>
      <View style={styles.alertContainer}>
        <View style={styles.alertIconContainer}>
          <Ionicons name="wifi-outline" size={40} color="#f44336" />
          <View style={styles.alertIconCross}>
            <Ionicons name="close" size={20} color="#f44336" />
          </View>
        </View>
        <Text style={styles.alertTitle}>No Internet Connection</Text>
        <Text style={styles.alertMessage}>
          Please check your mobile data or Wi-Fi connection.{'\n'}
          You can still view previously loaded data.
        </Text>
        <TouchableOpacity style={styles.alertButton} onPress={onDismiss}>
          <Text style={styles.alertButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  retryButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Alert styles
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  alertIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  alertIconCross: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OfflineBanner;
