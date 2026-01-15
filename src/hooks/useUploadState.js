import { useState, useCallback, useRef } from 'react';

/**
 * useUploadState Hook
 * Manages multiple concurrent media uploads with progress tracking
 * Supports cancellation and retry functionality
 */
const useUploadState = () => {
  // State to track all pending uploads
  const [uploads, setUploads] = useState({});

  // Store abort controllers for each upload
  const abortControllers = useRef({});

  /**
   * Add a new upload to the state
   * @param {Object} uploadData - Upload data object
   * @returns {string} - The temporary ID for this upload
   */
  const addUpload = useCallback((uploadData) => {
    const tempId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create abort controller for this upload
    abortControllers.current[tempId] = new AbortController();

    const upload = {
      tempId,
      status: 'uploading',
      progress: 0,
      fileType: uploadData.fileType || 'document',
      localUri: uploadData.fileUrl || uploadData.uri,
      fileName: uploadData.fileName,
      fileSize: uploadData.fileSize,
      caption: uploadData.caption || '',
      mimeType: uploadData.mimeType,
      error: null,
      createdAt: Date.now(),
      // Store original file data for retry
      originalFile: uploadData,
    };

    setUploads((prev) => ({
      ...prev,
      [tempId]: upload,
    }));

    return tempId;
  }, []);

  /**
   * Update upload progress
   * @param {string} tempId - The temporary ID of the upload
   * @param {number} progress - Progress percentage (0-100)
   */
  const updateProgress = useCallback((tempId, progress) => {
    setUploads((prev) => {
      if (!prev[tempId]) return prev;
      return {
        ...prev,
        [tempId]: {
          ...prev[tempId],
          progress: Math.min(100, Math.max(0, progress)),
        },
      };
    });
  }, []);

  /**
   * Mark upload as completed and remove from state
   * @param {string} tempId - The temporary ID of the upload
   * @param {Object} result - The upload result with URL, etc.
   */
  const completeUpload = useCallback((tempId, result) => {
    // Clean up abort controller
    if (abortControllers.current[tempId]) {
      delete abortControllers.current[tempId];
    }

    setUploads((prev) => {
      const newUploads = { ...prev };
      delete newUploads[tempId];
      return newUploads;
    });

    return result;
  }, []);

  /**
   * Mark upload as failed
   * @param {string} tempId - The temporary ID of the upload
   * @param {string} error - Error message
   */
  const failUpload = useCallback((tempId, error) => {
    setUploads((prev) => {
      if (!prev[tempId]) return prev;
      return {
        ...prev,
        [tempId]: {
          ...prev[tempId],
          status: 'failed',
          error: error || 'Upload failed',
          progress: 0,
        },
      };
    });
  }, []);

  /**
   * Cancel an upload
   * @param {string} tempId - The temporary ID of the upload
   */
  const cancelUpload = useCallback((tempId) => {
    // Abort the XMLHttpRequest
    if (abortControllers.current[tempId]) {
      abortControllers.current[tempId].abort();
      delete abortControllers.current[tempId];
    }

    // Remove from state
    setUploads((prev) => {
      const newUploads = { ...prev };
      delete newUploads[tempId];
      return newUploads;
    });
  }, []);

  /**
   * Prepare for retry by resetting status
   * @param {string} tempId - The temporary ID of the upload
   * @returns {Object|null} - The original file data for retry, or null if not found
   */
  const prepareRetry = useCallback((tempId) => {
    const upload = uploads[tempId];
    if (!upload) return null;

    // Create new abort controller
    abortControllers.current[tempId] = new AbortController();

    // Reset status to uploading
    setUploads((prev) => ({
      ...prev,
      [tempId]: {
        ...prev[tempId],
        status: 'uploading',
        progress: 0,
        error: null,
      },
    }));

    return upload.originalFile;
  }, [uploads]);

  /**
   * Get abort controller for an upload
   * @param {string} tempId - The temporary ID of the upload
   * @returns {AbortController|null}
   */
  const getAbortController = useCallback((tempId) => {
    return abortControllers.current[tempId] || null;
  }, []);

  /**
   * Get an upload by ID
   * @param {string} tempId - The temporary ID of the upload
   * @returns {Object|null}
   */
  const getUpload = useCallback((tempId) => {
    return uploads[tempId] || null;
  }, [uploads]);

  /**
   * Get all uploads as an array
   * @returns {Array}
   */
  const getAllUploads = useCallback(() => {
    return Object.values(uploads).sort((a, b) => a.createdAt - b.createdAt);
  }, [uploads]);

  /**
   * Check if there are any active uploads
   * @returns {boolean}
   */
  const hasActiveUploads = useCallback(() => {
    return Object.values(uploads).some((u) => u.status === 'uploading');
  }, [uploads]);

  /**
   * Clean up all uploads (for unmount)
   */
  const cleanup = useCallback(() => {
    // Abort all active uploads
    Object.keys(abortControllers.current).forEach((tempId) => {
      abortControllers.current[tempId].abort();
    });
    abortControllers.current = {};
    setUploads({});
  }, []);

  return {
    uploads,
    addUpload,
    updateProgress,
    completeUpload,
    failUpload,
    cancelUpload,
    prepareRetry,
    getAbortController,
    getUpload,
    getAllUploads,
    hasActiveUploads,
    cleanup,
  };
};

export default useUploadState;
