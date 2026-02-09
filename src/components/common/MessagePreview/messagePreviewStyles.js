/**
 * Shared styles for MessagePreviewBubble and its sub-components.
 * Extracted from InboxSettingsScreen as the reference design.
 */
import { StyleSheet } from 'react-native';
import { colors, chatColors } from '../../../theme/colors';

export default StyleSheet.create({
  // Type Badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Preview Container
  previewContainer: {
    gap: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Disabled State
  previewDisabled: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    gap: 8,
  },
  previewDisabledIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDisabledTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewDisabledHint: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Empty State
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.grey[200],
    borderStyle: 'dashed',
    gap: 8,
  },
  previewEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  previewEmptyHint: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Chat Area
  chatArea: {
    backgroundColor: chatColors.chatBg,
    borderRadius: 12,
    padding: 14,
  },
  chatBubble: {
    backgroundColor: chatColors.outgoing,
    borderRadius: 12,
    borderTopRightRadius: 4,
    padding: 0,
    alignSelf: 'flex-end',
    maxWidth: 230,
    minWidth: 230,
    overflow: 'hidden',
  },

  // Media Wrapper
  mediaWrapper: {
    position: 'relative',
  },

  // Image Preview
  imagePreview: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grey[200],
  },

  // Video Preview (static placeholder)
  videoPreview: {
    width: '100%',
    height: 140,
    backgroundColor: '#1a1a2e',
  },
  videoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },

  // Native Video (expo-av)
  nativeVideoContainer: {
    width: '100%',
    height: 150,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
  },

  // Audio Preview (static waveform)
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioContent: {
    flex: 1,
    gap: 4,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 2,
  },
  audioBar: {
    width: 3,
    backgroundColor: chatColors.primary,
    borderRadius: 2,
    opacity: 0.6,
  },
  audioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audioDuration: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Native Audio (expo-av) container
  nativeAudioContainer: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  // File Preview
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  fileTypeText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Message Text
  messageText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    padding: 10,
  },
  messageCaption: {
    paddingTop: 8,
  },
  noTextMessage: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    padding: 10,
  },

  // Empty State for media without URL
  bubbleEmptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  bubbleEmptyText: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 8,
  },

  // Message Footer (timestamp + ticks)
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: colors.text.secondary,
  },

  // Template Badge in Bubble
  templateBadgeInBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  templateBadgeText: {
    fontSize: 11,
    color: colors.grey[500],
    fontStyle: 'italic',
  },

  // Template Header - Image
  templateHeaderImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grey[200],
  },

  // Template Header - Video
  templateHeaderVideo: {
    alignSelf: 'stretch',
    height: 140,
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  templateVideoThumbnail: {
    width: '100%',
    height: '100%',
  },
  templatePlayButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  templatePlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },

  // Template Header - Document
  templateHeaderDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  templateDocIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateDocInfo: {
    flex: 1,
  },
  templateDocName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  templateDocType: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Template Header - Text
  templateHeaderTextContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  templateHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // ── Media Placeholder (matching inbox TemplateMessage style) ──
  templateMediaPlaceholder: {
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    height: 140,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Video Placeholder (matching inbox video style with play overlay) ──
  templateVideoPlaceholderContainer: {
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  templateVideoPlaceholderBg: {
    flex: 1,
    backgroundColor: colors.grey[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateVideoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateVideoPlayBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },

  // ── Document Placeholder (matching inbox document row style) ──
  templateDocPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  templateDocPlaceholderText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
  },

  // ── Location Placeholder (matching inbox location style) ──
  templateLocationPlaceholder: {
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    height: 80,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Template Body/Footer
  templateBodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  templateFooterText: {
    fontSize: 12,
    color: colors.text.secondary,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },

  // Template Buttons - Inside Bubble (matching inbox TemplateMessage style)
  templateButtonsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 4,
    gap: 6,
  },
  templateButtonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center',
  },

  // Template Buttons - Outside Bubble (TemplatesScreen style)
  buttonsBox: {
    marginTop: 8,
    alignSelf: 'flex-end',
    maxWidth: '88%',
    gap: 4,
  },
  buttonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.grey[200],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.linkColor,
  },

  // Template Not Found Hint
  templateNotFoundHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  templateNotFoundText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Carousel Preview
  carouselPreviewSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
  },
  carouselLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  carouselScroll: {
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  carouselCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.grey[200],
    overflow: 'hidden',
  },
  carouselCardMedia: {
    backgroundColor: '#E8F4FD',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselCardMediaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D0ECFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  carouselCardMediaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5E9',
    letterSpacing: 0.5,
  },
  carouselCardBody: {
    fontSize: 13,
    color: colors.text.primary,
    padding: 12,
    lineHeight: 18,
  },
  carouselCardButtons: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  carouselCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey[50],
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  carouselCardButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: chatColors.linkColor,
  },

  // Limited Time Offer
  limitedOfferBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  limitedOfferText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
  },

  // Audio Player (native expo-av)
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: chatColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioProgressContainer: {
    flex: 1,
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: chatColors.primary,
    borderRadius: 2,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  audioTimeText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
});
