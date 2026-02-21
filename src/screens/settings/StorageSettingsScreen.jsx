import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { cardStyles } from '../../theme/cardStyles';
import { getDownloadedMediaSize, clearAllDownloadedMedia } from '../../services/mediaDownloadService';

export default function StorageSettingsScreen() {
  const settingId = useSelector((state) => state.user?.settingId);
  const [mediaSize, setMediaSize] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const loadStorageInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const size = await getDownloadedMediaSize();
      setMediaSize(size);
    } catch (error) {
      setMediaSize(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  const formatSize = (bytes) => {
    if (bytes === null || bytes === undefined) return '--';
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleClearMedia = () => {
    Alert.alert(
      'Clear Downloaded Media',
      'This will delete all downloaded media files from your device. You can re-download them later. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearAllDownloadedMedia(settingId);
              setMediaSize(0);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear media files. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Storage Usage Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
            <Icon name="database" size={22} color="#2196F3" />
          </View>
          <Text style={styles.cardTitle}>Storage Usage</Text>
        </View>

        <View style={styles.storageRow}>
          <View style={styles.storageInfo}>
            <Text style={styles.storageLabel}>Downloaded Media</Text>
            <Text style={styles.storageDesc}>Images, videos, audio, and documents</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.grey[400]} />
          ) : (
            <Text style={styles.storageSize}>{formatSize(mediaSize)}</Text>
          )}
        </View>
      </View>

      {/* Actions Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
            <Icon name="broom" size={22} color="#FF9800" />
          </View>
          <Text style={styles.cardTitle}>Manage Storage</Text>
        </View>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleClearMedia}
          disabled={isClearing || mediaSize === 0}
          activeOpacity={0.7}
        >
          <View style={styles.actionInfo}>
            <Text style={[
              styles.actionLabel,
              (isClearing || mediaSize === 0) && styles.actionLabelDisabled,
            ]}>
              Clear All Downloaded Media
            </Text>
            <Text style={styles.actionDesc}>
              Remove all locally stored media files
            </Text>
          </View>
          {isClearing ? (
            <ActivityIndicator size="small" color={colors.error.main} />
          ) : (
            <Icon
              name="delete-outline"
              size={22}
              color={mediaSize === 0 ? colors.grey[300] : colors.error.main}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Icon name="information-outline" size={18} color={colors.info.main} />
        <Text style={styles.infoText}>
          Downloaded media is stored on your device for offline access. Clearing media will not delete messages — you can re-download files anytime.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.neutral,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    ...cardStyles.card,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  storageInfo: {
    flex: 1,
  },
  storageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  storageDesc: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  storageSize: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error.main,
    marginBottom: 2,
  },
  actionLabelDisabled: {
    color: colors.grey[400],
  },
  actionDesc: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info.lighter || '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.info.dark || '#1565C0',
  },
});
