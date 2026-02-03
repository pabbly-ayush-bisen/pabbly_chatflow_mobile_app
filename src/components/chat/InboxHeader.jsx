import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, TextInput, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, chatColors } from '../../theme/colors';

const InboxHeader = ({
  title = 'Chats',
  onMenuPress,
  onSearchChange,
  onSearchSubmit,
  onSearchClose,
  onAddContact,
  connectionStatus,
  isSearchLoading = false,
}) => {
  const insets = useSafeAreaInsets();
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef(null);
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSearchMode) {
      Animated.timing(animatedWidth, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        searchInputRef.current?.focus();
      });
    } else {
      Animated.timing(animatedWidth, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isSearchMode]);

  const handleSearchPress = () => {
    setIsSearchMode(true);
  };

  const handleSearchClose = () => {
    setIsSearchMode(false);
    setSearchText('');
    onSearchClose?.();
  };

  // Update local text without triggering search
  const handleSearchTextChange = (text) => {
    setSearchText(text);
    // Only notify parent of text change for local filtering (optional)
    onSearchChange?.(text);
  };

  // Trigger actual search when Enter/Submit is pressed
  const handleSearchSubmitEditing = () => {
    if (searchText.trim()) {
      onSearchSubmit?.(searchText.trim());
    }
  };

  // Clear search text and results
  const handleClearSearch = () => {
    setSearchText('');
    onSearchClose?.();
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return null;
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection error';
      default:
        return null;
    }
  };

  const connectionStatusText = getConnectionStatusText();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} />

      {!isSearchMode ? (
        // Normal header
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
            <Icon name="menu" size={24} color={colors.common.white} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {connectionStatusText && (
              <Text style={styles.connectionStatus}>{connectionStatusText}</Text>
            )}
          </View>

          <View style={styles.actions}>
            <IconButton
              icon="magnify"
              iconColor={colors.common.white}
              size={24}
              onPress={handleSearchPress}
              style={styles.actionButton}
            />
            <IconButton
              icon="account-plus"
              iconColor={colors.common.white}
              size={24}
              onPress={onAddContact}
              style={styles.actionButton}
            />
          </View>
        </View>
      ) : (
        // Search mode header
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={handleSearchClose} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.common.white} />
          </TouchableOpacity>

          <View style={styles.searchInputContainer}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search and press Enter..."
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={searchText}
              onChangeText={handleSearchTextChange}
              onSubmitEditing={handleSearchSubmitEditing}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSearchLoading}
            />
            {isSearchLoading ? (
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="small" color={colors.common.white} />
              </View>
            ) : searchText.length > 0 ? (
              <TouchableOpacity
                onPress={handleClearSearch}
                style={styles.clearButton}
              >
                <Icon name="close" size={20} color={colors.common.white} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: chatColors.headerBg,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.common.white,
    letterSpacing: 0.3,
  },
  connectionStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    margin: 0,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    minHeight: 56,
  },
  backButton: {
    padding: 12,
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: colors.common.white,
    fontSize: 16,
    fontWeight: '400',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
  },
  clearButton: {
    padding: 4,
  },
  loadingIndicator: {
    padding: 4,
  },
});

export default InboxHeader;
