/**
 * useMediaDownload - React hook for managing media download state
 *
 * Mirrors the useUploadState pattern but for downloads.
 * Tracks per-message download progress, status, and local paths.
 */

import { useState, useCallback } from 'react';
import { downloadMedia, cancelDownload } from '../services/mediaDownloadService';

const useMediaDownload = () => {
  // Map of messageId -> { progress, status, error, localPath }
  const [downloads, setDownloads] = useState({});

  /**
   * Start downloading media for a message
   * @param {Object} params
   * @param {string} params.remoteUrl - Remote media URL
   * @param {string} params.messageId - Message ID for tracking
   * @param {string} params.settingId - Current setting ID
   * @param {string} params.messageType - 'image' | 'video' | 'audio' | 'document'
   * @param {string} params.mimeType - MIME type (optional)
   * @returns {Promise<{ localPath: string, fileSize: number }>}
   */
  const startDownload = useCallback(async ({
    remoteUrl,
    messageId,
    settingId,
    messageType,
    mimeType,
  }) => {
    // Set initial downloading state
    setDownloads((prev) => ({
      ...prev,
      [messageId]: { progress: 0, status: 'downloading', error: null, localPath: null },
    }));

    try {
      const result = await downloadMedia({
        remoteUrl,
        messageId,
        settingId,
        messageType,
        mimeType,
        onProgress: (percent) => {
          setDownloads((prev) => ({
            ...prev,
            [messageId]: { ...prev[messageId], progress: percent },
          }));
        },
      });

      // Set completed state with thumbnail if available
      setDownloads((prev) => ({
        ...prev,
        [messageId]: { progress: 100, status: 'downloaded', error: null, localPath: result.localPath, thumbnailPath: result.thumbnailPath || null },
      }));

      return result;
    } catch (error) {
      setDownloads((prev) => ({
        ...prev,
        [messageId]: { progress: 0, status: 'failed', error: error.message, localPath: null },
      }));
      throw error;
    }
  }, []);

  /**
   * Cancel an active download
   * @param {string} messageId - Message ID
   * @param {string} settingId - Setting ID
   */
  const cancel = useCallback(async (messageId, settingId) => {
    await cancelDownload(messageId, settingId);
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  /**
   * Get download state for a specific message
   * @param {string} messageId - Message ID
   * @returns {{ progress: number, status: string, error: string|null, localPath: string|null } | null}
   */
  const getDownloadState = useCallback((messageId) => {
    return downloads[messageId] || null;
  }, [downloads]);

  return { downloads, startDownload, cancel, getDownloadState };
};

export default useMediaDownload;
