import React, { memo, useMemo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { colors, chatColors } from '../../../theme/colors';
import { getMessageText, isEmojiOnly } from '../../../utils/messageHelpers';

/**
 * TextMessage Component
 * Renders text messages with WhatsApp-style formatting support
 * Aligned with web app implementation
 *
 * Supports:
 * - *bold* text
 * - _italic_ text
 * - ~strikethrough~ text
 * - `inline code` text
 * - ```code block``` text
 * - Emoji-only messages (large display)
 */
const TextMessage = ({ message, isOutgoing }) => {
  const text = getMessageText(message);
  const isEmoji = isEmojiOnly(text);

  // Memoize formatted text to avoid re-parsing
  const formattedContent = useMemo(() => {
    if (!text) return null;
    if (isEmoji) return null; // Emoji handled separately
    return parseWhatsAppFormatting(text, isOutgoing);
  }, [text, isOutgoing, isEmoji]);

  if (!text) {
    return null;
  }

  // Emoji-only message (large emoji display like web app)
  if (isEmoji) {
    return (
      <View style={[styles.emojiContainer, isOutgoing ? styles.emojiContainerOutgoing : styles.emojiContainerIncoming]}>
        <RNText style={[styles.emojiText, isOutgoing ? styles.emojiTextOutgoing : styles.emojiTextIncoming]}>{text}</RNText>
      </View>
    );
  }

  // Regular text message with formatting support
  return (
    <View style={styles.container}>
      <RNText
        style={[
          styles.messageText,
          isOutgoing ? styles.messageTextOutgoing : styles.messageTextIncoming,
          isOutgoing && styles.outgoingText,
        ]}
      >
        {formattedContent}
      </RNText>
    </View>
  );
};

/**
 * Parse WhatsApp-style formatting and return React Native Text elements
 * Supports nested formatting (e.g., *_bold italic_*)
 */
const parseWhatsAppFormatting = (text, isOutgoing) => {
  if (!text || typeof text !== 'string') return text;

  // Formatting markers and their styles
  const formatters = [
    { marker: '```', style: 'codeBlock' },    // Code block (must be checked first)
    { marker: '`', style: 'inlineCode' },      // Inline code
    { marker: '*', style: 'bold' },            // Bold
    { marker: '_', style: 'italic' },          // Italic
    { marker: '~', style: 'strikethrough' },   // Strikethrough
  ];

  const elements = [];
  let key = 0;

  const parseSegment = (segment, parentStyles = []) => {
    if (!segment) return null;

    // Check for each formatter
    for (const { marker, style } of formatters) {
      // Find opening marker
      const openIndex = segment.indexOf(marker);
      if (openIndex === -1) continue;

      // Find closing marker (skip the opening marker)
      const searchStart = openIndex + marker.length;
      const closeIndex = segment.indexOf(marker, searchStart);
      if (closeIndex === -1) continue;

      // Extract parts
      const before = segment.slice(0, openIndex);
      const content = segment.slice(searchStart, closeIndex);
      const after = segment.slice(closeIndex + marker.length);

      const result = [];

      // Add text before the formatted section
      if (before) {
        result.push(
          <RNText key={`before-${key++}`} style={getTextStyles(parentStyles, isOutgoing)}>
            {before}
          </RNText>
        );
      }

      // Add formatted content (recursively parse for nested formatting)
      const newStyles = [...parentStyles, style];
      if (style === 'codeBlock' || style === 'inlineCode') {
        // Don't parse nested formatting in code
        result.push(
          <RNText key={`formatted-${key++}`} style={getTextStyles(newStyles, isOutgoing)}>
            {content}
          </RNText>
        );
      } else {
        // Recursively parse for nested formatting
        const parsedContent = parseSegment(content, newStyles);
        result.push(
          <RNText key={`formatted-${key++}`} style={getTextStyles(newStyles, isOutgoing)}>
            {parsedContent}
          </RNText>
        );
      }

      // Add text after the formatted section (recursively parse)
      if (after) {
        const parsedAfter = parseSegment(after, parentStyles);
        result.push(parsedAfter);
      }

      return result;
    }

    // No formatting found, return plain text
    return segment;
  };

  return parseSegment(text, []);
};

/**
 * Get combined text styles based on active formatting
 */
const getTextStyles = (activeStyles, isOutgoing) => {
  const baseStyle = [
    styles.messageTextInner,
    isOutgoing && styles.outgoingTextInner,
  ];

  activeStyles.forEach((style) => {
    switch (style) {
      case 'bold':
        baseStyle.push(styles.boldText);
        break;
      case 'italic':
        baseStyle.push(styles.italicText);
        break;
      case 'strikethrough':
        baseStyle.push(styles.strikethroughText);
        break;
      case 'inlineCode':
        baseStyle.push(styles.inlineCodeText);
        baseStyle.push(isOutgoing ? styles.inlineCodeOutgoing : styles.inlineCodeIncoming);
        break;
      case 'codeBlock':
        baseStyle.push(styles.codeBlockText);
        baseStyle.push(isOutgoing ? styles.codeBlockOutgoing : styles.codeBlockIncoming);
        break;
    }
  });

  return baseStyle;
};

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.primary,
  },
  messageTextOutgoing: {
    textAlign: 'left',
  },
  messageTextIncoming: {
    textAlign: 'left',
  },
  messageTextInner: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.primary,
  },
  outgoingText: {
    color: colors.common.white,
  },
  outgoingTextInner: {
    color: colors.common.white,
  },
  emojiContainer: {
    justifyContent: 'center',
    paddingVertical: 4,
  },
  emojiContainerOutgoing: {
    alignItems: 'flex-start',
  },
  emojiContainerIncoming: {
    alignItems: 'flex-start',
  },
  emojiText: {
    fontSize: 48,
    lineHeight: 56,
  },
  emojiTextOutgoing: {
    textAlign: 'left',
  },
  emojiTextIncoming: {
    textAlign: 'left',
  },
  boldText: {
    fontWeight: 'bold',
  },
  italicText: {
    fontStyle: 'italic',
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
  },
  inlineCodeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inlineCodeIncoming: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    color: colors.text.primary,
  },
  inlineCodeOutgoing: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: colors.common.white,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  codeBlockIncoming: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    color: colors.text.primary,
  },
  codeBlockOutgoing: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: colors.common.white,
  },
});

export default memo(TextMessage);
