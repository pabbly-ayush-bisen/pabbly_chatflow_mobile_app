import React, { memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { colors, chatColors } from '../../../theme/colors';

/**
 * UploadingMediaMessage Component
 * WhatsApp-style upload progress UI for media messages
 * Shows circular progress indicator, cancel/retry buttons
 * Supports: image, video, audio, document
 */
const UploadingMediaMessage = ({
  upload,
  onCancel,
  onRetry,
  isOutgoing = true,
}) => {
  const {
    localUri,
    fileType,
    fileName,
    fileSize,
    caption,
    progress = 0,
    status = 'uploading', // 'uploading' | 'failed' | 'completed'
    error,
  } = upload;

  const isUploading = status === 'uploading';
  const isFailed = status === 'failed';

  // Animation for pulsing effect when uploading
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isUploading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isUploading, pulseAnim]);

  // Circular progress dimensions
  const size = 56;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress / 100) * circumference;

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get icon and color for document type
  const getDocumentInfo = () => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    const iconMap = {
      pdf: { icon: 'file-pdf-box', color: '#E53935' },
      doc: { icon: 'file-word', color: '#1976D2' },
      docx: { icon: 'file-word', color: '#1976D2' },
      xls: { icon: 'file-excel', color: '#388E3C' },
      xlsx: { icon: 'file-excel', color: '#388E3C' },
      ppt: { icon: 'file-powerpoint', color: '#D84315' },
      pptx: { icon: 'file-powerpoint', color: '#D84315' },
      zip: { icon: 'folder-zip', color: '#FFA000' },
      rar: { icon: 'folder-zip', color: '#FFA000' },
      txt: { icon: 'file-document-outline', color: '#757575' },
      csv: { icon: 'file-delimited', color: '#388E3C' },
    };
    return iconMap[ext] || { icon: 'file-document', color: '#5E35B1' };
  };

  // Render image upload preview
  const renderImagePreview = () => (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri: localUri }}
        style={styles.imagePreview}
        resizeMode="cover"
      />
      {renderUploadOverlay()}
    </View>
  );

  // Render video upload preview
  const renderVideoPreview = () => (
    <View style={styles.videoContainer}>
      {localUri ? (
        <Image
          source={{ uri: localUri }}
          style={styles.videoPreview}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Icon name="video" size={48} color={colors.grey[400]} />
        </View>
      )}
      {/* Video icon badge */}
      <View style={styles.videoBadge}>
        <Icon name="video" size={14} color={colors.common.white} />
      </View>
      {renderUploadOverlay()}
    </View>
  );

  // Render audio upload preview
  const renderAudioPreview = () => (
    <View style={styles.audioContainer}>
      <View style={styles.audioContent}>
        {/* Waveform placeholder */}
        <View style={styles.waveformContainer}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                { height: 8 + Math.random() * 16, opacity: 0.4 + (progress / 100) * 0.6 },
              ]}
            />
          ))}
        </View>

        {/* Progress info */}
        <View style={styles.audioInfo}>
          <Text style={styles.audioFileName} numberOfLines={1}>
            {fileName || 'Audio'}
          </Text>
          {fileSize && (
            <Text style={styles.audioFileSize}>
              {formatFileSize(fileSize)}
            </Text>
          )}
        </View>
      </View>

      {/* Upload progress circle */}
      <View style={styles.audioProgressContainer}>
        {renderProgressCircle(44)}
      </View>
    </View>
  );

  // Render document upload preview
  const renderDocumentPreview = () => {
    const { icon, color } = getDocumentInfo();
    const ext = fileName?.split('.').pop()?.toUpperCase() || 'FILE';

    return (
      <View style={styles.documentContainer}>
        {/* Document icon */}
        <View style={[styles.documentIconContainer, { backgroundColor: `${color}20` }]}>
          <Icon name={icon} size={28} color={color} />
          <View style={[styles.documentExtBadge, { backgroundColor: color }]}>
            <Text style={styles.documentExtText}>{ext}</Text>
          </View>
        </View>

        {/* Document info */}
        <View style={styles.documentInfo}>
          <Text style={styles.documentFileName} numberOfLines={1}>
            {fileName || 'Document'}
          </Text>
          <View style={styles.documentMeta}>
            {fileSize && (
              <Text style={styles.documentFileSize}>
                {formatFileSize(fileSize)}
              </Text>
            )}
            {isUploading && (
              <Text style={styles.documentProgress}>
                {Math.round(progress)}%
              </Text>
            )}
            {isFailed && (
              <Text style={styles.documentFailed}>Failed</Text>
            )}
          </View>
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={styles.documentActionButton}
          onPress={handleActionPress}
          activeOpacity={0.7}
        >
          {isUploading ? (
            <View style={styles.documentProgressRing}>
              <Svg width={36} height={36}>
                <Circle
                  cx={18}
                  cy={18}
                  r={15}
                  stroke={colors.grey[300]}
                  strokeWidth={2}
                  fill="transparent"
                />
                <Circle
                  cx={18}
                  cy={18}
                  r={15}
                  stroke={chatColors.primary}
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={(2 * Math.PI * 15) * (1 - progress / 100)}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="18, 18"
                />
              </Svg>
              <Icon name="close" size={16} color={colors.grey[600]} style={styles.documentActionIcon} />
            </View>
          ) : isFailed ? (
            <View style={[styles.documentRetryButton, { backgroundColor: colors.error.lighter }]}>
              <Icon name="refresh" size={20} color={colors.error.main} />
            </View>
          ) : (
            <Icon name="check-circle" size={24} color={chatColors.accent} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Render circular progress indicator
  const renderProgressCircle = (circleSize = size) => {
    const r = (circleSize - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (progress / 100) * c;

    return (
      <Animated.View style={[styles.progressContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Svg width={circleSize} height={circleSize} style={styles.progressSvg}>
          {/* Background Circle */}
          <Circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={r}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          {isUploading && (
            <Circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={r}
              stroke={colors.common.white}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${circleSize / 2}, ${circleSize / 2}`}
            />
          )}
        </Svg>

        {/* Center Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, { width: circleSize - 16, height: circleSize - 16, borderRadius: (circleSize - 16) / 2 }]}
          onPress={handleActionPress}
          activeOpacity={0.7}
        >
          <Icon
            name={isFailed ? 'refresh' : 'close'}
            size={circleSize > 50 ? 22 : 18}
            color={isFailed ? colors.warning.main : colors.common.white}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render upload overlay for image/video
  const renderUploadOverlay = () => (
    <View style={styles.uploadOverlay}>
      {renderProgressCircle()}

      {/* Status info */}
      <View style={styles.statusContainer}>
        {isUploading && (
          <>
            <Text style={styles.statusText}>{Math.round(progress)}%</Text>
            {fileSize && (
              <Text style={styles.statusSubtext}>
                {formatFileSize((fileSize * progress) / 100)} / {formatFileSize(fileSize)}
              </Text>
            )}
          </>
        )}
        {isFailed && (
          <>
            <Text style={[styles.statusText, styles.failedText]}>Upload Failed</Text>
            <Text style={styles.statusSubtext}>Tap to retry</Text>
          </>
        )}
      </View>
    </View>
  );

  // Handle action button press
  const handleActionPress = () => {
    if (isUploading) {
      onCancel?.();
    } else if (isFailed) {
      onRetry?.();
    }
  };

  // Render based on file type
  const renderContent = () => {
    switch (fileType) {
      case 'image':
        return renderImagePreview();
      case 'video':
        return renderVideoPreview();
      case 'audio':
        return renderAudioPreview();
      case 'document':
      default:
        return renderDocumentPreview();
    }
  };

  return (
    <View style={styles.container}>
      {renderContent()}

      {/* Caption (for image/video only) */}
      {caption && (fileType === 'image' || fileType === 'video') && (
        <Text style={[styles.caption, isOutgoing && styles.outgoingCaption]}>
          {caption}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 260,
  },

  // Image styles
  imageContainer: {
    width: 240,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.grey[200],
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },

  // Video styles
  videoContainer: {
    width: 240,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.grey[800],
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.grey[300],
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Audio styles
  audioContainer: {
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  audioContent: {
    flex: 1,
    marginRight: 12,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.common.white,
    borderRadius: 2,
  },
  audioInfo: {
    marginTop: 6,
  },
  audioFileName: {
    fontSize: 13,
    color: colors.common.white,
    fontWeight: '500',
  },
  audioFileSize: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  audioProgressContainer: {
    width: 44,
    height: 44,
  },

  // Document styles
  documentContainer: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  documentExtBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  documentExtText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  documentInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  documentFileName: {
    fontSize: 13,
    color: colors.common.white,
    fontWeight: '500',
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  documentFileSize: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  documentProgress: {
    fontSize: 11,
    color: chatColors.accent,
    fontWeight: '600',
  },
  documentFailed: {
    fontSize: 11,
    color: colors.error.light,
    fontWeight: '500',
  },
  documentActionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentProgressRing: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentActionIcon: {
    position: 'absolute',
  },
  documentRetryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Upload overlay (for image/video)
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress circle
  progressContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSvg: {
    position: 'absolute',
  },
  actionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Status text
  statusContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: colors.common.white,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  failedText: {
    color: colors.error.light,
  },

  // Caption
  caption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  outgoingCaption: {
    color: colors.common.white,
  },
});

export default memo(UploadingMediaMessage);
