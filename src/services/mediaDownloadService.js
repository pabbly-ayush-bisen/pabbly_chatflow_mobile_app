/**
 * Media Download Service
 *
 * Handles downloading media files from server to local device storage.
 * Follows the pattern of fileUploadService.js but for downloads.
 * Uses expo-file-system for persistent local storage.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform, Linking } from 'react-native';
import MessageModel from '../database/models/MessageModel';

// Persistent storage directory for downloaded media
const MEDIA_BASE_DIR = `${FileSystem.documentDirectory}chatflow_media/`;

// Active downloads map (messageId -> downloadResumable) for cancellation
const activeDownloads = new Map();

/**
 * Ensure the media directory structure exists
 */
const ensureMediaDirectory = async () => {
  const dirInfo = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_BASE_DIR, { intermediates: true });
  }
};

/**
 * Generate a unique local filename for a downloaded file
 */
const generateLocalFilename = (remoteUrl, mimeType, messageType) => {
  let extension = '';

  // Try to extract extension from URL
  try {
    const urlPath = remoteUrl.split('?')[0]; // Remove query params
    const parts = urlPath.split('.');
    const urlExt = parts.length > 1 ? parts.pop().toLowerCase() : '';
    if (urlExt && urlExt.length <= 5 && /^[a-z0-9]+$/.test(urlExt)) {
      extension = urlExt;
    }
  } catch (e) {
    // URL parsing failed
  }

  // Fallback: derive from MIME type
  if (!extension && mimeType) {
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'video/quicktime': 'mov',
      'audio/aac': 'aac',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mp4': 'aac',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/csv': 'csv',
    };
    extension = mimeToExt[mimeType] || '';
  }

  // Fallback: derive from message type
  if (!extension) {
    const typeToExt = { image: 'jpg', video: 'mp4', audio: 'aac', document: 'bin', file: 'bin' };
    extension = typeToExt[messageType] || 'bin';
  }

  const prefix = { image: 'IMG', video: 'VID', audio: 'AUD', document: 'DOC', file: 'DOC' }[messageType] || 'FILE';
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  return `${prefix}_${uniqueId}.${extension}`;
};

/**
 * Download a media file to local persistent storage
 * @param {Object} params
 * @param {string} params.remoteUrl - The remote URL to download from
 * @param {string} params.messageId - Message server_id or wa_message_id (for DB update)
 * @param {string} params.settingId - Current setting ID
 * @param {string} params.messageType - 'image' | 'video' | 'audio' | 'document'
 * @param {string} params.mimeType - MIME type of the file (optional)
 * @param {Function} params.onProgress - Progress callback receiving 0-100
 * @returns {Promise<{ localPath: string, fileSize: number }>}
 */
export const downloadMedia = async ({
  remoteUrl,
  messageId,
  settingId,
  messageType,
  mimeType,
  onProgress,
}) => {
  if (!remoteUrl) throw new Error('No remote URL provided');

  await ensureMediaDirectory();

  const localFilename = generateLocalFilename(remoteUrl, mimeType, messageType);
  const localPath = `${MEDIA_BASE_DIR}${localFilename}`;

  // Mark as downloading in DB
  await MessageModel.updateMediaDownloadStatus(messageId, {
    downloadStatus: 'downloading',
  }, settingId);

  try {
    // Create a download resumable for progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      remoteUrl,
      localPath,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0) {
          const percent = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );
          onProgress?.(percent);
        }
      }
    );

    // Store for cancellation support
    activeDownloads.set(messageId, downloadResumable);

    const result = await downloadResumable.downloadAsync();

    // Remove from active downloads
    activeDownloads.delete(messageId);

    if (!result || !result.uri) {
      throw new Error('Download completed but no file URI returned');
    }

    // Verify file exists on disk
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists) {
      throw new Error('Downloaded file does not exist at expected path');
    }

    // For video files, generate a thumbnail from the local file
    let thumbnailPath = null;
    if (messageType === 'video') {
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(result.uri, {
          time: 1000, // 1 second into the video
        });
        if (thumbUri) {
          // Copy thumbnail to our persistent media directory
          const thumbFilename = `THUMB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.jpg`;
          const persistentThumbPath = `${MEDIA_BASE_DIR}${thumbFilename}`;
          await FileSystem.copyAsync({ from: thumbUri, to: persistentThumbPath });
          thumbnailPath = persistentThumbPath;
        }
      } catch (thumbError) {
        // Thumbnail generation is non-critical, continue without it
      }
    }

    // Update DB with local path, thumbnail, and downloaded status
    await MessageModel.updateMediaDownloadStatus(messageId, {
      localMediaPath: result.uri,
      localThumbnailPath: thumbnailPath,
      downloadStatus: 'downloaded',
    }, settingId);

    return {
      localPath: result.uri,
      thumbnailPath,
      fileSize: fileInfo.size || 0,
    };
  } catch (error) {
    activeDownloads.delete(messageId);

    // Clean up partial download
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    // Mark as failed in DB
    await MessageModel.updateMediaDownloadStatus(messageId, {
      downloadStatus: 'failed',
    }, settingId);

    throw error;
  }
};

/**
 * Cancel an active download
 * @param {string} messageId - Message ID
 * @param {string} settingId - Setting ID
 */
export const cancelDownload = async (messageId, settingId) => {
  const downloadResumable = activeDownloads.get(messageId);
  if (downloadResumable) {
    try {
      await downloadResumable.pauseAsync();
    } catch (e) {
      // Ignore pause errors
    }
    activeDownloads.delete(messageId);
  }

  await MessageModel.updateMediaDownloadStatus(messageId, {
    downloadStatus: 'none',
  }, settingId);
};

/**
 * Delete a single downloaded file from disk
 * @param {string} localPath - Local file path
 */
export const deleteDownloadedFile = async (localPath) => {
  if (!localPath) return;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }
  } catch (e) {
    // Ignore deletion errors
  }
};

/**
 * Clear all downloaded media files and reset DB records
 * @param {string} settingId - Setting ID
 */
export const clearAllDownloadedMedia = async (settingId) => {
  // Get all downloaded file paths from DB
  const records = await MessageModel.getDownloadedMediaPaths(settingId);

  // Delete each file from disk
  for (const record of records) {
    await deleteDownloadedFile(record.local_media_path);
    await deleteDownloadedFile(record.local_thumbnail_path);
  }

  // Try to remove entire media directory and let it be recreated on next download
  try {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(MEDIA_BASE_DIR, { idempotent: true });
    }
  } catch (e) {
    // Ignore directory deletion errors
  }

  // Reset all DB records
  await MessageModel.clearAllDownloadedMedia(settingId);
};

/**
 * Get total size of downloaded media directory
 * @returns {Promise<number>} Size in bytes
 */
export const getDownloadedMediaSize = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);
    if (!dirInfo.exists) return 0;

    // Enumerate files and sum sizes since directory size isn't always available
    const files = await FileSystem.readDirectoryAsync(MEDIA_BASE_DIR);
    let totalSize = 0;

    for (const file of files) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(`${MEDIA_BASE_DIR}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return totalSize;
  } catch (e) {
    return 0;
  }
};

/**
 * Check if a local file still exists and is valid
 * @param {string} localPath - Local file path
 * @returns {Promise<boolean>}
 */
export const isLocalFileValid = async (localPath) => {
  if (!localPath) return false;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists && (info.size > 0);
  } catch (e) {
    return false;
  }
};

/**
 * Open a locally downloaded file using the system's default app
 * On Android: converts file:// to content:// URI and uses IntentLauncher
 * On iOS: uses Sharing sheet
 * @param {string} localPath - Local file:// URI
 * @param {string} [mimeType] - Optional MIME type hint
 */
export const openLocalFile = async (localPath, mimeType) => {
  if (!localPath) return;

  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(localPath);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: mimeType || '*/*',
      });
    } catch (e) {
      // Fallback: try Linking as last resort
      Linking.openURL(localPath);
    }
  } else {
    // iOS: use share sheet to open with available apps
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localPath, { mimeType: mimeType || undefined });
      } else {
        Linking.openURL(localPath);
      }
    } catch (e) {
      Linking.openURL(localPath);
    }
  }
};

export default {
  downloadMedia,
  cancelDownload,
  deleteDownloadedFile,
  clearAllDownloadedMedia,
  getDownloadedMediaSize,
  isLocalFileValid,
  openLocalFile,
};
