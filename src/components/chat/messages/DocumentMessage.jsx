import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getMediaUrl, getFilename, getMessageCaption, hasFileSizeError, getActualMediaType, getFileSizeLimit } from '../../../utils/messageHelpers';

/**
 * DocumentMessage Component
 * Renders document/file messages with download option
 * Aligned with web app FileMessage component
 */
const DocumentMessage = ({ message, isOutgoing }) => {
  const fileUrl = getMediaUrl(message);
  const fileName = getFilename(message);
  const caption = getMessageCaption(message);
  const hasCaption = Boolean(caption);

  // Check for file size error
  const isFileSizeErr = hasFileSizeError(message);

  // Get file extension and icon
  const getFileExtension = () => {
    if (!fileName) return '';
    const match = fileName.match(/\.([^.]+)$/);
    return match ? match[1].toUpperCase() : '';
  };

  const getFileIcon = () => {
    const ext = getFileExtension().toLowerCase();

    const iconMap = {
      pdf: { name: 'file-pdf-box', color: '#E53935' },
      doc: { name: 'file-word', color: '#1976D2' },
      docx: { name: 'file-word', color: '#1976D2' },
      xls: { name: 'file-excel', color: '#388E3C' },
      xlsx: { name: 'file-excel', color: '#388E3C' },
      ppt: { name: 'file-powerpoint', color: '#D84315' },
      pptx: { name: 'file-powerpoint', color: '#D84315' },
      zip: { name: 'folder-zip', color: '#FFA000' },
      rar: { name: 'folder-zip', color: '#FFA000' },
      txt: { name: 'file-document-outline', color: '#757575' },
      csv: { name: 'file-delimited', color: '#388E3C' },
      json: { name: 'code-json', color: '#FFA000' },
      xml: { name: 'file-code', color: '#1976D2' },
    };

    return iconMap[ext] || { name: 'file-document', color: colors.grey[600] };
  };

  const { name: iconName, color: iconColor } = getFileIcon();
  const fileExt = getFileExtension();

  // Handle document download
  const handleDownload = () => {
    if (fileUrl) {
      Linking.openURL(fileUrl);
    }
  };

  // Render file size error
  if (isFileSizeErr) {
    const actualType = getActualMediaType(message);
    const maxSize = getFileSizeLimit(actualType);

    return (
      <View style={styles.fileSizeErrorContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.warning.main} />
        <View style={styles.fileSizeErrorContent}>
          <Text style={styles.fileSizeErrorTitle}>
            File exceeds size limit
          </Text>
          <Text style={styles.fileSizeErrorSubtitle}>
            Maximum allowed: {maxSize}MB
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.documentContainer, isOutgoing && styles.documentContainerOutgoing]}
        onPress={handleDownload}
        activeOpacity={0.7}
      >
        {/* File icon with extension badge */}
        <View style={[styles.iconContainer, isOutgoing && styles.iconContainerOutgoing]}>
          <Icon name={iconName} size={28} color={iconColor} />
          {fileExt && (
            <View style={[styles.extBadge, { backgroundColor: iconColor }]}>
              <Text style={styles.extText}>{fileExt}</Text>
            </View>
          )}
        </View>

        {/* File info */}
        <View style={styles.fileInfo}>
          <Text
            style={[styles.fileName, isOutgoing && styles.fileNameOutgoing]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {fileName}
          </Text>
          <Text style={[styles.fileMeta, isOutgoing && styles.fileMetaOutgoing]}>
            {fileExt ? `${fileExt} Document` : 'Document'}
          </Text>
        </View>

        {/* Download icon */}
        <Icon
          name="download"
          size={20}
          color={isOutgoing ? 'rgba(255,255,255,0.7)' : colors.grey[500]}
        />
      </TouchableOpacity>

      {hasCaption && (
        <Text style={[styles.caption, isOutgoing && styles.captionOutgoing]}>
          {caption}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 220,
    maxWidth: 280,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.grey[50],
    borderRadius: 8,
  },
  documentContainerOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  iconContainerOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  extBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  fileNameOutgoing: {
    color: colors.common.white,
  },
  fileMeta: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  fileMetaOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  caption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  captionOutgoing: {
    color: colors.common.white,
  },
  fileSizeErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.warning.lighter,
    borderRadius: 8,
    gap: 12,
  },
  fileSizeErrorContent: {
    flex: 1,
  },
  fileSizeErrorTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.warning.dark,
  },
  fileSizeErrorSubtitle: {
    fontSize: 12,
    color: colors.warning.main,
    marginTop: 2,
  },
});

export default memo(DocumentMessage);
