/**
 * Message Helpers - Utilities for handling WhatsApp message types
 * Aligned with web app implementation (pcf-frontend-app)
 */

// File extension categories
const AUDIO_EXTENSIONS = ['mp3', 'aac', 'wav', 'm4a', 'ogg', 'opus', 'flac'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'avi', 'wmv', 'webm', '3gp', '3g2'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif'];

// WhatsApp file size limits (in MB)
const FILE_SIZE_LIMITS = {
  image: 5,
  video: 16,
  audio: 16,
  document: 100,
};

/**
 * Safely extract text content from a message
 * Handles all possible message structures from WhatsApp API
 */
export const getMessageText = (message) => {
  if (!message) return '';

  // Try all possible text locations (same as web app)
  const candidates = [
    message?.message?.body?.text,
    typeof message?.message?.body === 'string' ? message?.message?.body : null,
    message?.message?.text,
    message?.text,
    message?.body,
    message?.message?.payload?.title,
  ];

  const text = candidates.find((value) => typeof value === 'string' && value.trim());
  return text?.trim() || '';
};

/**
 * Get caption from media messages
 */
export const getMessageCaption = (message) => {
  if (!message) return '';

  const candidates = [
    message?.message?.caption,
    message?.caption,
    message?.waResponse?.video?.caption,
    message?.waResponse?.image?.caption,
    message?.waResponse?.document?.caption,
    message?.waResponse?.audio?.caption,
  ];

  const caption = candidates.find((value) => typeof value === 'string' && value.trim());
  return caption?.trim() || '';
};

/**
 * Get media URL from message
 */
export const getMediaUrl = (message) => {
  if (!message) return null;

  return (
    message?.message?.link ||
    message?.media?.link ||
    message?.image?.link ||
    message?.video?.link ||
    message?.audio?.link ||
    message?.document?.link ||
    message?.sticker?.link ||
    null
  );
};

/**
 * Get filename from document message
 */
export const getFilename = (message) => {
  return (
    message?.message?.filename ||
    message?.filename ||
    message?.waResponse?.document?.filename ||
    'Document'
  );
};

/**
 * Get template data from message
 */
export const getTemplateData = (message) => {
  const templateData = message?.message?.template || message?.message;

  if (typeof templateData === 'object' && templateData !== null) {
    // Get link from multiple possible locations (including optimistic messages)
    const link = message?.message?.link ||
      message?.message?.template?.link ||
      message?.link ||
      null;

    // Get type from message or template
    const type = message?.message?.type ||
      templateData.type ||
      templateData.templateType ||
      'text';

    return {
      templateName: templateData.templateName || templateData.name || 'Template',
      type: type,
      bodyParams: message?.message?.bodyParams || templateData.bodyParams || [],
      headerParams: message?.message?.headerParams || templateData.headerParams || [],
      link: link,
      // Include components for rendering template with variables
      components: templateData.components || message?.message?.template?.components || null,
    };
  }

  return null;
};

/**
 * Get interactive message data
 */
export const getInteractiveData = (message) => {
  if (!message) {
    return {
      type: null,
      body: '',
      buttons: [],
      sections: [],
      header: null,
      footer: '',
    };
  }

  // There are two main shapes:
  // 1) Outgoing interactive messages: message.message.{ type, body, action, header, footer }
  // 2) Incoming interactive replies: message.interactive.{ type, button_reply | list_reply | body, header, footer }
  const msgInteractive = message?.message;
  const waInteractive = message?.interactive;

  // Prefer explicit interactive.type from webhook, then message.message.type
  const interactiveType = msgInteractive?.type || waInteractive?.type || null;

  let body = '';

  // Handle interactive reply messages from WhatsApp (button_reply, list_reply)
  if (waInteractive?.type === 'button_reply') {
    body = waInteractive?.button_reply?.title || '';
  } else if (waInteractive?.type === 'list_reply') {
    // Prefer row title, fall back to id
    body = waInteractive?.list_reply?.title || waInteractive?.list_reply?.id || '';
  } else {
    // Regular interactive message body (outgoing)
    body = msgInteractive?.body?.text || waInteractive?.body?.text || '';
  }

  const buttons =
    msgInteractive?.action?.buttons || waInteractive?.action?.buttons || [];

  const sections =
    msgInteractive?.action?.sections || waInteractive?.action?.sections || [];

  return {
    type: interactiveType,
    body,
    buttons,
    sections,
    header: msgInteractive?.header || waInteractive?.header || null,
    footer: msgInteractive?.footer?.text || waInteractive?.footer?.text || '',
  };
};

/**
 * Get location data from message
 */
export const getLocationData = (message) => {
  return {
    latitude: message?.message?.latitude || message?.location?.latitude,
    longitude: message?.message?.longitude || message?.location?.longitude,
    name: message?.message?.name || message?.location?.name || 'Location',
    address: message?.message?.address || message?.location?.address || '',
  };
};

/**
 * Get contact data from message
 */
export const getContactData = (message) => {
  const contacts = message?.waResponse?.contacts || message?.contacts || [];

  return contacts.map((contact) => ({
    name: contact?.name?.formatted_name ||
      contact?.name?.first_name ||
      contact?.name?.last_name ||
      'Unknown Contact',
    phones: contact?.phones || [],
    wa_id: contact?.wa_id || null,
  }));
};

/**
 * Get order data from message
 */
export const getOrderData = (message) => {
  const orderData = message?.waResponse?.order || message?.order;

  if (!orderData || !orderData.product_items) {
    return null;
  }

  const totalAmount = orderData.product_items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.item_price || 0),
    0
  );

  const totalItems = orderData.product_items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  return {
    productItems: orderData.product_items,
    totalAmount,
    totalItems,
    currency: orderData.product_items[0]?.currency || 'USD',
  };
};

/**
 * Check if message is from WhatsApp Business App
 */
export const isSentFromWhatsAppBusinessApp = (message) => {
  return (
    message?.sentFrom === 'whatsappBusinessApp' ||
    message?.message?.sentFrom === 'whatsappBusinessApp' ||
    message?.metadata?.sentFrom === 'whatsappBusinessApp'
  );
};

/**
 * Check if message has file size error
 */
export const hasFileSizeError = (message) => {
  if (!isSentFromWhatsAppBusinessApp(message)) return false;

  const error = message?.message?.error || '';
  return (
    message?.message?.success === false &&
    error &&
    (error.toLowerCase().includes('file exceeds maximum size limit') ||
      error.toLowerCase().includes('file size') ||
      error.toLowerCase().includes('size limit'))
  );
};

/**
 * Get actual media type from message (handles unsupported type)
 */
export const getActualMediaType = (message) => {
  if (message?.type === 'unsupported' && message?.waResponse?.type) {
    return message.waResponse.type;
  }
  return message?.type || 'text';
};

/**
 * Infer media category from file extension or mime type
 */
export const inferMediaCategory = (fileExtension, mimeType) => {
  const ext = fileExtension?.toLowerCase();
  const mime = mimeType?.toLowerCase();

  if (mime?.startsWith('audio/') || (ext && AUDIO_EXTENSIONS.includes(ext))) {
    return 'audio';
  }
  if (mime?.startsWith('video/') || (ext && VIDEO_EXTENSIONS.includes(ext))) {
    return 'video';
  }
  if (mime?.startsWith('image/') || (ext && IMAGE_EXTENSIONS.includes(ext))) {
    return 'image';
  }
  return 'document';
};

/**
 * Get file metadata from message
 */
export const getFileMeta = (message) => {
  const errorMsg = message?.message?.error || '';
  const fileNameMatch = errorMsg.match(/: ([^:]+)$/);
  const fileName = fileNameMatch ? fileNameMatch[1].trim() : null;

  let mimeType = null;
  if (message?.waResponse) {
    mimeType =
      message.waResponse.video?.mime_type ||
      message.waResponse.image?.mime_type ||
      message.waResponse.audio?.mime_type ||
      message.waResponse.document?.mime_type ||
      message?.message?.mimeType ||
      null;
  }

  let fileExtension = null;
  if (fileName) {
    const extMatch = fileName.match(/\.([^.]+)$/);
    fileExtension = extMatch ? extMatch[1].toUpperCase() : null;
  } else if (mimeType) {
    const mimeExt = mimeType.split('/')[1];
    fileExtension = mimeExt ? mimeExt.toUpperCase() : null;
  }

  return { fileName, mimeType, fileExtension };
};

/**
 * Get WhatsApp file size limit for media type
 */
export const getFileSizeLimit = (mediaType) => {
  return FILE_SIZE_LIMITS[mediaType] || FILE_SIZE_LIMITS.document;
};

/**
 * Get error info for failed messages
 */
export const getErrorInfo = (message) => {
  const customError = message?.customError;
  const metaFailedReason =
    message?.waResponse?.error_data?.details ||
    message?.waResponse?.errors?.[0]?.error_data?.details ||
    message?.waResponse?.errors?.[0]?.title ||
    message?.waResponse?.message;

  return customError || metaFailedReason || null;
};

/**
 * Check if message is outgoing (sent by user)
 */
export const isOutgoingMessage = (message) => {
  return message?.sentBy === 'user' || message?.direction === 'outgoing';
};

/**
 * Get message status
 * Prioritizes status field (like web app), falls back to timestamp-based detection
 */
export const getMessageStatus = (message) => {
  // Use status field directly if available (matches web app behavior)
  if (message?.status && ['failed', 'sent', 'delivered', 'read', 'pending'].includes(message.status)) {
    return message.status;
  }

  // Fallback to timestamp-based detection for backward compatibility
  if (message?.readAt) return 'read';
  if (message?.deliveredAt) return 'delivered';
  if (message?.sentAt) return 'sent';
  if (message?.status === 'failed') return 'failed';
  return 'pending';
};

// List of supported message types
const SUPPORTED_TYPES = [
  'text', 'image', 'video', 'audio', 'document', 'file',
  'sticker', 'location', 'contact', 'contacts', 'template',
  'interactive', 'order', 'reaction', 'system'
];

/**
 * Get message preview for chat list
 * Returns { icon, text } for display
 */
export const getMessagePreview = (message) => {
  if (!message) return { icon: null, text: 'No messages yet' };

  const messageType = message.type || 'text';
  const messageText = getMessageText(message);
  const caption = getMessageCaption(message);

  // Helper for safe text
  const getText = (fallback) => {
    if (messageText) return messageText;
    if (caption) return caption;
    return fallback;
  };

  // Check for unsupported types FIRST (like web app)
  if (
    messageType === 'unsupported' ||
    messageType === 'unknown' ||
    messageType === 'fallback' ||
    !SUPPORTED_TYPES.includes(messageType)
  ) {
    return { icon: 'alert-circle', text: 'Unsupported message' };
  }

  switch (messageType) {
    case 'image':
      return { icon: 'image', text: getText('Photo') };
    case 'video':
      return { icon: 'video', text: getText('Video') };
    case 'audio':
      return { icon: 'microphone', text: 'Voice message' };
    case 'document':
    case 'file':
      return { icon: 'file-document', text: getFilename(message) };
    case 'location':
      return { icon: 'map-marker', text: 'Location' };
    case 'sticker':
      return { icon: 'sticker-emoji', text: 'Sticker' };
    case 'contact':
    case 'contacts': {
      const contacts = getContactData(message);
      const contactName = contacts[0]?.name || 'Contact';
      return { icon: 'account', text: contactName };
    }
    case 'template': {
      const templateData = getTemplateData(message);
      return { icon: 'file-document-outline', text: templateData?.templateName || 'Template message' };
    }
    case 'interactive': {
      const interactiveData = getInteractiveData(message);
      const interactiveText = interactiveData.body || 'Interactive message';
      return { icon: 'gesture-tap-button', text: interactiveText };
    }
    case 'order': {
      const orderData = getOrderData(message);
      const itemCount = orderData?.totalItems || 0;
      return { icon: 'cart', text: `Order (${itemCount} items)` };
    }
    case 'system':
      return { icon: 'information', text: getText('System message') };
    case 'reaction':
      return { icon: 'emoticon', text: 'Reaction' };
    case 'text':
    default:
      return { icon: null, text: getText('Message') };
  }
};

/**
 * Apply WhatsApp text formatting
 * Supports: *bold*, _italic_, ~strikethrough~, `code`
 */
export const applyTextFormatting = (text) => {
  if (!text || typeof text !== 'string') return text || '';

  // For React Native, we return the text as-is
  // Text formatting would need to be handled differently in RN
  // This is a placeholder - full implementation would use react-native's Text with nested styles
  return text;
};

/**
 * Check if text contains only emojis (max 3 emojis like web app)
 */
export const isEmojiOnly = (text) => {
  if (!text || typeof text !== 'string') return false;

  // Remove whitespace and check if remaining chars are emojis
  const stripped = text.replace(/\s/g, '');

  // Don't treat numbers as emoji-only
  if (/^\d+$/.test(stripped)) return false;

  // Match emoji patterns (comprehensive Unicode emoji ranges)
  // eslint-disable-next-line no-misleading-character-class
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1FA00}-\u{1FAFF}\u{2300}-\u{23FF}]/gu;

  const emojiMatches = stripped.match(emojiRegex);
  if (!emojiMatches) return false;

  // Check if string is only emojis (remove all emojis and see if anything remains)
  const withoutEmojis = stripped.replace(emojiRegex, '');
  if (withoutEmojis.length > 0) return false;

  // Max 3 emojis for large display (like web app)
  return emojiMatches.length <= 3;
};

/**
 * Calculate 24-hour messaging window status
 * WhatsApp API allows sending messages only within 24 hours of last customer message
 * Returns { isActive, hoursLeft } - isActive is true if within 24-hour window
 * @param {string|Date} lastActiveTime - Last active/message timestamp
 * @returns {{ isActive: boolean, hoursLeft: number }}
 */
export const MessageStatus = (lastActiveTime) => {
  if (!lastActiveTime) return { isActive: false, hoursLeft: 0 };

  const lastMessageTime = new Date(lastActiveTime);
  const now = new Date();
  const hoursDiff = Math.floor((now - lastMessageTime) / (1000 * 60 * 60));
  const hoursLeft = Math.max(0, 24 - hoursDiff);

  const isActive = hoursDiff < 24;

  return { isActive, hoursLeft };
};

/**
 * Format message with WhatsApp markers for bold, italic, strikethrough
 * WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```code```
 * Markers cannot span newlines, so formatting is applied per line
 * @param {string} text - Message text to format
 * @param {Object} formatting - { isBold, isItalic, isStrikethrough }
 * @returns {string} Formatted message
 */
export const formatWhatsAppMessage = (text, formatting = {}) => {
  if (!text || typeof text !== 'string') return text || '';

  const { isBold, isItalic, isStrikethrough } = formatting;

  // If no formatting applied, return trimmed text
  if (!isBold && !isItalic && !isStrikethrough) {
    return text.trim();
  }

  // Apply formatting per line so WhatsApp parses correctly (markers cannot span newlines)
  return text
    .split('\n')
    .map((line) => {
      // Preserve leading/trailing spaces outside of markers
      const leading = line.match(/^\s*/)?.[0] ?? '';
      const trailing = line.match(/\s*$/)?.[0] ?? '';
      const core = line.slice(leading.length, line.length - trailing.length);

      if (!core) return line; // keep empty or whitespace-only lines as-is

      let t = core;

      // Order matters: italic inside bold inside strikethrough for predictability
      if (isItalic) t = `_${t}_`;
      if (isBold) t = `*${t}*`;
      if (isStrikethrough) t = `~${t}~`;

      return `${leading}${t}${trailing}`;
    })
    .join('\n');
};

/**
 * Get display text for hours left in 24-hour window
 * @param {number} hoursLeft - Hours remaining
 * @returns {string} Formatted display text
 */
export const getTimeLeftDisplay = (hoursLeft) => {
  if (hoursLeft <= 0) return 'Window expired';
  if (hoursLeft === 1) return '1 hour left';
  if (hoursLeft < 24) return `${hoursLeft} hours left`;
  return 'Within 24-hour window';
};

/**
 * Get sender info from message for display in message bubble
 * Returns { type, name, icon } for rendering sender badge
 * Matches web app implementation (chat-message-list.jsx initiatedBy function)
 * @param {Object} message - Message object
 * @param {Object} options - Optional lookup data { assistants: [], flows: [] }
 * @returns {{ type: string, name: string, icon: string } | null}
 */
export const getSenderInfo = (message, options = {}) => {
  if (!message) return null;

  const { assistants = [], flows = [] } = options;
  const fromType = message?.from?.type;
  const fromName = message?.from?.name;
  const fromId = message?.from?.id;

  // Don't show sender info for incoming messages (from contact)
  // Only show for outgoing messages that have from.type
  if (!fromType) return null;

  // System messages don't need sender badge (they're displayed differently)
  if (fromType === 'system') return null;

  switch (fromType) {
    case 'teamMember':
      return {
        type: 'teamMember',
        name: fromName || fromId || 'Team Member',
        icon: 'account-circle-outline',
      };
    case 'aiAssistant': {
      // Look up assistant name from assistants data if available (like web app)
      let assistantName = fromName;
      if (!assistantName && fromId && assistants.length > 0) {
        const matchedAssistant = assistants.find(
          (assistant) => assistant._id === fromId || assistant.id === fromId
        );
        assistantName = matchedAssistant?.name;
      }
      return {
        type: 'aiAssistant',
        name: assistantName || 'AI Assistant',
        icon: 'robot-outline',
      };
    }
    case 'flow': {
      // Look up flow name from flows data if available (like web app)
      let flowName = fromName;
      if (!flowName && fromId && flows.length > 0) {
        const matchedFlow = flows.find(
          (flow) => flow._id === fromId || flow.id === fromId
        );
        flowName = matchedFlow?.name;
      }
      return {
        type: 'flow',
        name: flowName || 'Flow',
        icon: 'source-branch',
      };
    }
    case 'broadcast':
    case 'apiBroadcast':
    case 'testApiBroadcast':
    case 'testBroadcast': {
      // Format broadcast name (remove [resend-X] patterns)
      let broadcastName = fromName || 'Broadcast';
      const resendPattern = /\[resend-\d+\]/gi;
      if (resendPattern.test(broadcastName)) {
        broadcastName = broadcastName.replace(resendPattern, '').trim();
      }
      return {
        type: 'broadcast',
        name: broadcastName,
        icon: 'access-point',
      };
    }
    case 'offHour':
      return {
        type: 'automation',
        name: fromName || 'Off Hour',
        icon: 'clock-outline',
      };
    case 'welcome':
      return {
        type: 'automation',
        name: fromName || 'Welcome Message',
        icon: 'hand-wave-outline',
      };
    case 'optin':
      return {
        type: 'automation',
        name: fromName || 'Opt-in',
        icon: 'check-circle-outline',
      };
    case 'optout':
      return {
        type: 'automation',
        name: fromName || 'Opt-out',
        icon: 'close-circle-outline',
      };
    default:
      // For any other type, show the name or id if available
      if (fromName || fromId) {
        return {
          type: fromType,
          name: fromName || fromId,
          icon: 'account-outline',
        };
      }
      return null;
  }
};

export default {
  getMessageText,
  getMessageCaption,
  getMediaUrl,
  getFilename,
  getTemplateData,
  getInteractiveData,
  getLocationData,
  getContactData,
  getOrderData,
  isSentFromWhatsAppBusinessApp,
  hasFileSizeError,
  getActualMediaType,
  inferMediaCategory,
  getFileMeta,
  getFileSizeLimit,
  getErrorInfo,
  isOutgoingMessage,
  getMessageStatus,
  getMessagePreview,
  applyTextFormatting,
  isEmojiOnly,
  MessageStatus,
  formatWhatsAppMessage,
  getTimeLeftDisplay,
  getSenderInfo,
};
