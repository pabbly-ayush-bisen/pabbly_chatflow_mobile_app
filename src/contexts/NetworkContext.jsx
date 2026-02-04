/**
 * NetworkContext - React Context for Network Status Management
 *
 * This context provides network connectivity status to the entire app,
 * enabling offline-first functionality and user notifications.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

// Create the context
const NetworkContext = createContext(null);

/**
 * NetworkProvider Component
 *
 * Wraps the app and provides network status to all child components.
 * Handles network state changes and provides offline detection.
 */
export function NetworkProvider({ children }) {
  // Network state
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [connectionType, setConnectionType] = useState(null);
  const [networkDetails, setNetworkDetails] = useState(null);

  // Track if this is the first check (to avoid showing alert on app start)
  const isFirstCheck = useRef(true);

  // Track previous connection state for change detection
  const previousIsConnected = useRef(true);

  // Callback for when network status changes
  const [onNetworkChange, setOnNetworkChange] = useState(null);

  /**
   * Handle network state updates
   */
  const handleNetworkStateChange = useCallback((state) => {
    const connected = state.isConnected ?? false;
    const reachable = state.isInternetReachable ?? connected;

    setIsConnected(connected);
    setIsInternetReachable(reachable);
    setConnectionType(state.type);
    setNetworkDetails(state.details);

    // Detect network status change (not on first check)
    if (!isFirstCheck.current) {
      const wasConnected = previousIsConnected.current;
      const isNowConnected = connected && reachable;

      // Network went offline
      if (wasConnected && !isNowConnected) {
        if (onNetworkChange) {
          onNetworkChange({ type: 'offline', state });
        }
      }

      // Network came back online
      if (!wasConnected && isNowConnected) {
        if (onNetworkChange) {
          onNetworkChange({ type: 'online', state });
        }
      }
    }

    isFirstCheck.current = false;
    previousIsConnected.current = connected && reachable;
  }, [onNetworkChange]);

  /**
   * Subscribe to network state changes
   */
  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(handleNetworkStateChange);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkStateChange);

    return () => {
      unsubscribe();
    };
  }, [handleNetworkStateChange]);

  /**
   * Refresh network state when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh network state when app becomes active
        NetInfo.fetch().then(handleNetworkStateChange);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleNetworkStateChange]);

  /**
   * Manual refresh of network state
   */
  const refreshNetworkState = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      handleNetworkStateChange(state);
      return state;
    } catch (error) {
      return null;
    }
  }, [handleNetworkStateChange]);

  /**
   * Check if network is available (connected AND reachable)
   */
  const isNetworkAvailable = isConnected && isInternetReachable;

  /**
   * Get human-readable connection type
   */
  const getConnectionTypeLabel = useCallback(() => {
    if (!isConnected) return 'Offline';

    switch (connectionType) {
      case 'wifi':
        return 'Wi-Fi';
      case 'cellular':
        return 'Mobile Data';
      case 'ethernet':
        return 'Ethernet';
      case 'bluetooth':
        return 'Bluetooth';
      case 'vpn':
        return 'VPN';
      default:
        return 'Connected';
    }
  }, [isConnected, connectionType]);

  /**
   * Register callback for network changes
   */
  const registerNetworkChangeCallback = useCallback((callback) => {
    setOnNetworkChange(() => callback);
    return () => setOnNetworkChange(null);
  }, []);

  // Context value
  const value = {
    // State
    isConnected,
    isInternetReachable,
    isNetworkAvailable,
    connectionType,
    networkDetails,

    // Methods
    refreshNetworkState,
    getConnectionTypeLabel,
    registerNetworkChangeCallback,

    // Computed
    isOffline: !isNetworkAvailable,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Custom hook to use the network context
 */
export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }

  return context;
}

/**
 * Custom hook that returns only the offline status (for simple use cases)
 */
export function useIsOffline() {
  const { isOffline } = useNetwork();
  return isOffline;
}

/**
 * Custom hook that returns only the connected status
 */
export function useIsConnected() {
  const { isNetworkAvailable } = useNetwork();
  return isNetworkAvailable;
}

export default NetworkContext;
