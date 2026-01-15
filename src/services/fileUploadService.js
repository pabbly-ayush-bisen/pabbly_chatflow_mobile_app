import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { APP_CONFIG } from '../config/app.config';

/**
 * Upload a file to the server using fetch API with proper React Native FormData handling
 * This handles React Native file URIs properly for both iOS and Android
 * @param {Object} file - File object with uri, name, type
 * @param {Function} onProgress - Progress callback (0-100) - Note: fetch doesn't support progress
 * @returns {Promise<Object>} - Upload result with file URL
 */
export const uploadFile = async (file, onProgress = null) => {
  try {
    const settingId = await AsyncStorage.getItem('settingId');

    console.log('[FileUpload] Auth check:', {
      hasSettingId: !!settingId,
      settingId: settingId
    });

    if (!settingId) {
      throw new Error('Setting ID required - please select a WhatsApp number first');
    }

    // Get file URI - handle different possible field names
    let fileUri = file.fileUrl || file.uri;

    // Normalize the URI for React Native
    // On Android, content:// URIs need to be handled specially
    // On iOS, ph:// or file:// URIs may need conversion
    if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
      // For Android content:// URIs, copy to cache directory first
      try {
        const fileName = file.fileName || file.name || `file_${Date.now()}`;
        const extension = fileName.split('.').pop() || getExtensionFromType(file.fileType);
        const destUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;

        await FileSystem.copyAsync({
          from: fileUri,
          to: destUri,
        });
        fileUri = destUri;
        console.log('[FileUpload] Copied content:// URI to cache:', destUri);
      } catch (copyError) {
        console.warn('[FileUpload] Could not copy content:// URI, using original:', copyError);
      }
    }

    // Handle iOS file URIs - copy to cache for reliable upload access
    // iOS ImagePicker URIs from ExponentExperienceData cache need to be copied
    if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
      try {
        const fileName = file.fileName || file.name || `file_${Date.now()}`;
        let extension = fileName.split('.').pop()?.toLowerCase() || getExtensionFromType(file.fileType);
        // Normalize extension for backend compatibility (e.g., .mov -> .mp4)
        const extensionNormMap = { mov: 'mp4', avi: 'mp4', mkv: 'mp4', m4v: 'mp4' };
        extension = extensionNormMap[extension] || extension;
        const destUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;

        // Check if file exists at source
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.copyAsync({
            from: fileUri,
            to: destUri,
          });
          fileUri = destUri;
          console.log('[FileUpload] iOS: Copied file to cache:', destUri);
        }
      } catch (copyError) {
        console.warn('[FileUpload] iOS: Could not copy file, using original:', copyError);
      }
    }

    // Ensure URI has proper prefix for React Native
    if (Platform.OS === 'ios' && !fileUri.startsWith('file://') && !fileUri.startsWith('http')) {
      fileUri = `file://${fileUri}`;
    }

    // Determine file name and MIME type
    const rawFileName = file.fileName || file.name || generateFileName(file.fileType);
    // Get MIME type and normalize it for backend compatibility
    const rawMimeType = file.mimeType || getMimeType(rawFileName, file.fileType);
    const mimeType = normalizeMimeType(rawMimeType);
    // Normalize filename extension for backend compatibility (e.g., .mov -> .mp4)
    const fileName = normalizeFileName(rawFileName, mimeType);

    console.log('[FileUpload] Preparing upload:', {
      rawFileName,
      fileName,
      rawMimeType,
      mimeType,
      fileType: file.fileType,
      originalUri: file.fileUrl || file.uri,
      processedUri: fileUri,
    });

    // Create FormData with proper React Native format
    const formData = new FormData();

    // React Native requires this specific format for file upload
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    });

    // Add isPerm field like the web app does
    formData.append('isPerm', 'false');

    // Use fetch API - it handles React Native FormData better than axios
    // Do NOT set Content-Type header - fetch will set it automatically with boundary
    const response = await fetch(`${APP_CONFIG.apiUrl}/files`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        settingId: settingId,
      },
      body: formData,
      credentials: 'include', // Send cookies for session auth
    });

    const responseData = await response.json();

    console.log('[FileUpload] Response:', {
      status: response.status,
      ok: response.ok,
      data: responseData,
    });

    if (!response.ok) {
      throw new Error(responseData.message || `Upload failed with status ${response.status}`);
    }

    // Extract the file URL from response - handle various response formats
    const fileData = responseData.data?.[0] || responseData.data || responseData;
    const uploadedUrl = fileData.url || fileData.fileUrl || fileData.link ||
                        fileData.file?.url || fileData.file?.link;

    if (!uploadedUrl) {
      console.error('[FileUpload] No URL in response:', responseData);
      throw new Error('Upload succeeded but no URL returned');
    }

    return {
      success: true,
      url: uploadedUrl,
      fileName: fileData.fileName || fileData.file?.name || fileName,
      fileId: fileData._id || fileData.id || fileData.file?._id,
      mimeType: mimeType,
      ...fileData,
    };
  } catch (error) {
    console.error('[FileUpload] Error:', error);
    throw error;
  }
};

/**
 * Generate a file name based on file type
 */
const generateFileName = (fileType) => {
  const timestamp = Date.now();
  switch (fileType) {
    case 'image':
      return `IMG_${timestamp}.jpg`;
    case 'video':
      return `VID_${timestamp}.mp4`;
    case 'audio':
      return `AUD_${timestamp}.m4a`;
    case 'document':
    default:
      return `DOC_${timestamp}`;
  }
};

/**
 * Get file extension from type
 */
const getExtensionFromType = (fileType) => {
  switch (fileType) {
    case 'image':
      return 'jpg';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'm4a';
    case 'document':
    default:
      return 'bin';
  }
};

/**
 * Upload file to media library
 * Uses fetch API with proper React Native FormData handling (same as uploadFile)
 * @param {Object} file - File object
 * @param {Function} onProgress - Progress callback - Note: fetch doesn't support progress
 * @returns {Promise<Object>} - Upload result
 */
export const uploadToMediaLibrary = async (file, onProgress = null) => {
  try {
    const settingId = await AsyncStorage.getItem('settingId');

    if (!settingId) {
      throw new Error('Setting ID required - please select a WhatsApp number first');
    }

    // Get file URI - handle different possible field names
    let fileUri = file.fileUrl || file.uri;

    // Normalize the URI for React Native (same as uploadFile)
    if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
      try {
        const fileName = file.fileName || file.name || `file_${Date.now()}`;
        const extension = fileName.split('.').pop() || getExtensionFromType(file.fileType);
        const destUri = `${FileSystem.cacheDirectory}media_${Date.now()}.${extension}`;

        await FileSystem.copyAsync({
          from: fileUri,
          to: destUri,
        });
        fileUri = destUri;
      } catch (copyError) {
        console.warn('[MediaUpload] Could not copy content:// URI:', copyError);
      }
    }

    // Handle iOS file URIs - copy to cache for reliable upload access
    if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
      try {
        const fileName = file.fileName || file.name || `file_${Date.now()}`;
        let extension = fileName.split('.').pop()?.toLowerCase() || getExtensionFromType(file.fileType);
        // Normalize extension for backend compatibility (e.g., .mov -> .mp4)
        const extensionNormMap = { mov: 'mp4', avi: 'mp4', mkv: 'mp4', m4v: 'mp4' };
        extension = extensionNormMap[extension] || extension;
        const destUri = `${FileSystem.cacheDirectory}media_${Date.now()}.${extension}`;

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.copyAsync({
            from: fileUri,
            to: destUri,
          });
          fileUri = destUri;
          console.log('[MediaUpload] iOS: Copied file to cache:', destUri);
        }
      } catch (copyError) {
        console.warn('[MediaUpload] iOS: Could not copy file, using original:', copyError);
      }
    }

    if (Platform.OS === 'ios' && !fileUri.startsWith('file://') && !fileUri.startsWith('http')) {
      fileUri = `file://${fileUri}`;
    }

    const rawFileName = file.fileName || file.name || generateFileName(file.fileType);
    // Get MIME type and normalize it for backend compatibility
    const rawMimeType = file.mimeType || getMimeType(rawFileName, file.fileType);
    const mimeType = normalizeMimeType(rawMimeType);
    // Normalize filename extension for backend compatibility (e.g., .mov -> .mp4)
    const fileName = normalizeFileName(rawFileName, mimeType);

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    });
    formData.append('isPerm', 'false');

    // Use fetch API - it handles React Native FormData better than axios
    const response = await fetch(`${APP_CONFIG.apiUrl}/media`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        settingId: settingId,
      },
      body: formData,
      credentials: 'include',
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || `Upload failed with status ${response.status}`);
    }

    const fileData = responseData.data?.[0] || responseData.data || responseData;
    const uploadedUrl = fileData.url || fileData.fileUrl || fileData.link ||
                        fileData.file?.url || fileData.file?.link;

    return {
      success: true,
      url: uploadedUrl,
      fileName: fileData.fileName || fileData.file?.name || fileName,
      fileId: fileData._id || fileData.id || fileData.file?._id,
      mimeType: mimeType,
      ...fileData,
    };
  } catch (error) {
    console.error('[MediaUpload] Error:', error);
    throw error;
  }
};

/**
 * Get MIME type from filename and file type
 * Enhanced for mobile file handling with comprehensive MIME type support
 * @param {string} fileName - File name
 * @param {string} fileType - File type category (image, video, audio, document)
 * @returns {string} - MIME type
 */
const getMimeType = (fileName, fileType) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();

  // Comprehensive MIME types by extension
  const mimeTypes = {
    // Images - including mobile camera formats
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    heic: 'image/heic',      // iOS format
    heif: 'image/heif',      // iOS format
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',

    // Videos - including mobile recording formats
    // Note: Using video/mp4 for iOS .mov files as backend may not accept video/quicktime
    mp4: 'video/mp4',
    mov: 'video/mp4',        // iOS default - send as mp4 for backend compatibility
    avi: 'video/mp4',        // Send as mp4 for compatibility
    mkv: 'video/mp4',        // Send as mp4 for compatibility
    webm: 'video/webm',
    '3gp': 'video/3gpp',     // Android format
    '3g2': 'video/3gpp2',
    m4v: 'video/mp4',        // Send as mp4 for compatibility
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',

    // Audio - including mobile recording formats
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',        // iOS voice memo format
    aac: 'audio/aac',
    amr: 'audio/amr',        // Android voice format
    flac: 'audio/flac',
    wma: 'audio/x-ms-wma',
    opus: 'audio/opus',
    caf: 'audio/x-caf',      // iOS Core Audio Format

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    htm: 'text/html',
    rtf: 'application/rtf',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };

  if (extension && mimeTypes[extension]) {
    return mimeTypes[extension];
  }

  // Fallback by file type - using WhatsApp-preferred formats
  switch (fileType) {
    case 'image':
      return 'image/jpeg';  // Most compatible for WhatsApp
    case 'video':
      return 'video/mp4';   // Most compatible for WhatsApp
    case 'audio':
      return 'audio/mp4';   // m4a/mp4 audio - compatible with WhatsApp
    case 'document':
    default:
      return 'application/octet-stream';
  }
};

/**
 * Normalize MIME type for backend compatibility
 * Some MIME types like video/quicktime are not accepted by the backend
 * @param {string} mimeType - Original MIME type
 * @returns {string} - Normalized MIME type
 */
const normalizeMimeType = (mimeType) => {
  if (!mimeType) return mimeType;

  // Video MIME types that should be converted to video/mp4
  const videoMimeTypeMap = {
    'video/quicktime': 'video/mp4',      // iOS .mov files
    'video/x-msvideo': 'video/mp4',      // .avi files
    'video/x-matroska': 'video/mp4',     // .mkv files
    'video/x-m4v': 'video/mp4',          // .m4v files
  };

  return videoMimeTypeMap[mimeType] || mimeType;
};

/**
 * Normalize filename extension for backend compatibility
 * Some file extensions like .mov are not accepted by the backend
 * @param {string} fileName - Original filename
 * @param {string} mimeType - MIME type (used to determine correct extension)
 * @returns {string} - Normalized filename
 */
const normalizeFileName = (fileName, mimeType) => {
  if (!fileName) return fileName;

  // Extensions that should be converted to .mp4
  const extensionMap = {
    '.mov': '.mp4',
    '.avi': '.mp4',
    '.mkv': '.mp4',
    '.m4v': '.mp4',
  };

  const lowerFileName = fileName.toLowerCase();
  for (const [oldExt, newExt] of Object.entries(extensionMap)) {
    if (lowerFileName.endsWith(oldExt)) {
      return fileName.slice(0, -oldExt.length) + newExt;
    }
  }

  return fileName;
};

/**
 * Check if file size is within WhatsApp limits
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - File type category
 * @returns {Object} - { valid: boolean, maxSize: number, message: string }
 */
export const validateFileSize = (fileSize, fileType) => {
  // WhatsApp file size limits
  const limits = {
    image: 5 * 1024 * 1024,     // 5 MB
    video: 16 * 1024 * 1024,    // 16 MB
    audio: 16 * 1024 * 1024,    // 16 MB
    document: 100 * 1024 * 1024, // 100 MB
    sticker: 500 * 1024,        // 500 KB
  };

  const maxSize = limits[fileType] || limits.document;
  const valid = fileSize <= maxSize;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    valid,
    maxSize,
    maxSizeFormatted: formatSize(maxSize),
    fileSizeFormatted: formatSize(fileSize),
    message: valid
      ? 'File size is within limits'
      : `File size (${formatSize(fileSize)}) exceeds the ${formatSize(maxSize)} limit for ${fileType} files`,
  };
};

/**
 * Upload a file with progress tracking using XMLHttpRequest
 * Supports cancellation via AbortController
 * @param {Object} file - File object with uri, name, type
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {AbortController} abortController - Optional AbortController for cancellation
 * @returns {Promise<Object>} - Upload result with file URL
 */
export const uploadFileWithProgress = async (file, onProgress = null, abortController = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      const settingId = await AsyncStorage.getItem('settingId');

      if (!settingId) {
        reject(new Error('Setting ID required - please select a WhatsApp number first'));
        return;
      }

      // Get file URI - handle different possible field names
      let fileUri = file.fileUrl || file.uri;

      // Normalize the URI for React Native
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        try {
          const fileName = file.fileName || file.name || `file_${Date.now()}`;
          const extension = fileName.split('.').pop() || getExtensionFromType(file.fileType);
          const destUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;

          await FileSystem.copyAsync({
            from: fileUri,
            to: destUri,
          });
          fileUri = destUri;
          console.log('[FileUploadProgress] Copied content:// URI to cache:', destUri);
        } catch (copyError) {
          console.warn('[FileUploadProgress] Could not copy content:// URI, using original:', copyError);
        }
      }

      // Handle iOS file URIs - copy to cache for reliable upload access
      // iOS ImagePicker URIs from ExponentExperienceData cache need to be copied
      if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
        try {
          const fileName = file.fileName || file.name || `file_${Date.now()}`;
          let extension = fileName.split('.').pop()?.toLowerCase() || getExtensionFromType(file.fileType);
          // Normalize extension for backend compatibility (e.g., .mov -> .mp4)
          const extensionNormMap = { mov: 'mp4', avi: 'mp4', mkv: 'mp4', m4v: 'mp4' };
          extension = extensionNormMap[extension] || extension;
          const destUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;

          // Check if file exists at source
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (fileInfo.exists) {
            await FileSystem.copyAsync({
              from: fileUri,
              to: destUri,
            });
            fileUri = destUri;
            console.log('[FileUploadProgress] iOS: Copied file to cache:', destUri);
          }
        } catch (copyError) {
          console.warn('[FileUploadProgress] iOS: Could not copy file, using original:', copyError);
        }
      }

      // Ensure URI has proper prefix for React Native
      if (Platform.OS === 'ios' && !fileUri.startsWith('file://') && !fileUri.startsWith('http')) {
        fileUri = `file://${fileUri}`;
      }

      // Determine file name and MIME type
      const rawFileName = file.fileName || file.name || generateFileName(file.fileType);
      // Get MIME type and normalize it for backend compatibility
      const rawMimeType = file.mimeType || getMimeType(rawFileName, file.fileType);
      const mimeType = normalizeMimeType(rawMimeType);
      // Normalize filename extension for backend compatibility (e.g., .mov -> .mp4)
      const fileName = normalizeFileName(rawFileName, mimeType);

      console.log('[FileUploadProgress] Preparing upload:', {
        rawFileName,
        fileName,
        rawMimeType,
        mimeType,
        fileType: file.fileType,
        originalUri: file.fileUrl || file.uri,
        processedUri: fileUri,
      });

      // Verify file exists before upload
      const fileCheck = await FileSystem.getInfoAsync(fileUri);
      console.log('[FileUploadProgress] File check before upload:', {
        uri: fileUri,
        exists: fileCheck.exists,
        size: fileCheck.size,
        isDirectory: fileCheck.isDirectory,
      });

      if (!fileCheck.exists) {
        reject(new Error(`File does not exist at path: ${fileUri}`));
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      });
      formData.append('isPerm', 'false');

      console.log('[FileUploadProgress] FormData prepared:', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      });

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Handle abort
      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
      }

      // Progress handler
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      // Load handler (success)
      xhr.onload = () => {
        console.log('[FileUploadProgress] Response received:', {
          status: xhr.status,
          responseText: xhr.responseText?.substring(0, 500),
        });

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const responseData = JSON.parse(xhr.responseText);
            const fileData = responseData.data?.[0] || responseData.data || responseData;
            const uploadedUrl = fileData.url || fileData.fileUrl || fileData.link ||
                                fileData.file?.url || fileData.file?.link;

            if (!uploadedUrl) {
              console.error('[FileUploadProgress] No URL in response:', responseData);
              reject(new Error('Upload succeeded but no URL returned'));
              return;
            }

            resolve({
              success: true,
              url: uploadedUrl,
              fileName: fileData.fileName || fileData.file?.name || fileName,
              fileId: fileData._id || fileData.id || fileData.file?._id,
              mimeType: mimeType,
              ...fileData,
            });
          } catch (parseError) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          console.error('[FileUploadProgress] Upload failed:', {
            status: xhr.status,
            response: xhr.responseText,
          });
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      // Error handler
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      // Abort handler
      xhr.onabort = () => {
        reject(new Error('Upload cancelled'));
      };

      // Timeout handler
      xhr.ontimeout = () => {
        reject(new Error('Upload timed out'));
      };

      // Open and send request
      xhr.open('POST', `${APP_CONFIG.apiUrl}/files`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('settingId', settingId);
      xhr.withCredentials = true;
      xhr.timeout = 300000; // 5 minutes timeout for large files
      xhr.send(formData);

    } catch (error) {
      console.error('[FileUploadProgress] Error:', error);
      reject(error);
    }
  });
};

export default {
  uploadFile,
  uploadFileWithProgress,
  uploadToMediaLibrary,
  validateFileSize,
};
