/**
 * Shared utility functions and constants for message/template previews.
 * Used across InboxSettings, OptInManagement, TemplatesScreen, and QuickRepliesScreen.
 */

// Message type configuration for badges
export const MESSAGE_TYPE_CONFIG = {
  text: { label: 'Text', icon: 'format-text', color: '#64748B' },
  image: { label: 'Image', icon: 'image', color: '#0EA5E9' },
  video: { label: 'Video', icon: 'video', color: '#F97316' },
  audio: { label: 'Audio', icon: 'microphone', color: '#8B5CF6' },
  file: { label: 'Document', icon: 'file-document', color: '#DC2626' },
  template: { label: 'Template', icon: 'file-document-outline', color: '#0C68E9' },
};

// Button type configurations for template buttons
export const BUTTON_CONFIG = {
  URL: { icon: 'open-in-new', label: 'URL' },
  PHONE_NUMBER: { icon: 'phone', label: 'Call' },
  QUICK_REPLY: { icon: 'reply', label: 'Quick Reply' },
  COPY_CODE: { icon: 'content-copy', label: 'Copy Code' },
  FLOW: { icon: 'sitemap', label: 'Flow' },
  CATALOG: { icon: 'shopping', label: 'Catalog' },
  MPM: { icon: 'package-variant', label: 'Multi-Product' },
  SPM: { icon: 'package', label: 'Single Product' },
  VOICE_CALL: { icon: 'phone-outgoing', label: 'Voice Call' },
  OTP: { icon: 'shield-key', label: 'OTP' },
};

/**
 * Get the effective message type for badge display
 */
export const getEffectiveMessageType = (msgType, regularMsgType) => {
  if (msgType === 'template') return 'template';
  return regularMsgType || 'text';
};

/**
 * Substitute body parameters into template text
 * @param {string} bodyText - Template body text with {{n}} placeholders
 * @param {Object} bodyParams - Parameter values keyed by index (0-based)
 * @param {Array} examples - Example values from template definition
 * @returns {string} Text with substituted values
 */
export const substituteBodyParams = (bodyText, bodyParams, examples) => {
  if (!bodyText) return '';
  let text = bodyText;

  if (bodyParams && Object.keys(bodyParams).length > 0) {
    Object.keys(bodyParams).forEach((key) => {
      const index = parseInt(key, 10);
      if (!isNaN(index)) {
        text = text.replace(`{{${index + 1}}}`, bodyParams[key]);
      }
    });
  }

  if (examples && examples.length > 0) {
    examples.forEach((example, index) => {
      text = text.replace(`{{${index + 1}}}`, example);
    });
  }

  return text;
};

/**
 * Substitute header parameters into template header text
 * @param {string} headerText - Template header text with {{n}} placeholders
 * @param {Object} headerParams - Parameter values keyed by index (0-based)
 * @returns {string} Text with substituted values
 */
export const substituteHeaderParams = (headerText, headerParams) => {
  if (!headerText) return '';
  let text = headerText;

  if (headerParams && Object.keys(headerParams).length > 0) {
    Object.keys(headerParams).forEach((key) => {
      const index = parseInt(key, 10);
      if (!isNaN(index)) {
        text = text.replace(`{{${index + 1}}}`, headerParams[key]);
      }
    });
  }

  return text;
};

/**
 * Get a specific component from template components array
 */
export const getTemplateComponent = (template, type) => {
  if (!template?.components) return null;
  return template.components.find(
    (c) => c.type === type || c.type === type.toLowerCase()
  );
};

/**
 * Get template header component
 */
export const getTemplateHeader = (template) => {
  return getTemplateComponent(template, 'HEADER');
};

/**
 * Get template body text
 */
export const getTemplateBody = (template) => {
  const bodyComponent = getTemplateComponent(template, 'BODY');
  return bodyComponent?.text || '';
};

/**
 * Get template footer text
 */
export const getTemplateFooter = (template) => {
  const footerComponent = getTemplateComponent(template, 'FOOTER');
  return footerComponent?.text || '';
};

/**
 * Get template buttons array
 */
export const getTemplateButtons = (template) => {
  const buttonsComponent = getTemplateComponent(template, 'BUTTONS');
  return buttonsComponent?.buttons || [];
};

/**
 * Get carousel cards for carousel templates
 */
export const getCarouselCards = (template) => {
  const carouselComponent = getTemplateComponent(template, 'CAROUSEL');
  return carouselComponent?.cards || [];
};

/**
 * Get limited time offer component
 */
export const getLimitedTimeOffer = (template) => {
  return getTemplateComponent(template, 'LIMITED_TIME_OFFER');
};
