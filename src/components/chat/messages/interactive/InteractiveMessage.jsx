import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';
import ButtonMessage from './ButtonMessage';
import ListMessage from './ListMessage';
import ProductMessage from './ProductMessage';
import MultiProductMessage from './MultiProductMessage';
import CatalogMessage from './CatalogMessage';
import AddressMessage from './AddressMessage';
import OrderDetailsMessage from './OrderDetailsMessage';

/**
 * InteractiveMessage Component
 * Main router for all interactive message types
 * Aligned with web app interactive message handling
 *
 * Supported types:
 * - button / cta_url: Button messages
 * - list: List selection messages
 * - product: Single product messages
 * - product_list: Multi-product messages
 * - catalog_message: Catalog messages
 * - address_message: Address request messages
 * - order_details: Order details messages
 */
const InteractiveMessage = ({ message, isOutgoing, onImagePress }) => {
  const interactiveData = getInteractiveData(message);
  const { type, header, body, footer } = interactiveData;

  // Check for media header type (outgoing interactive with media)
  const headerType = message?.message?.header?.type;
  const hasMediaHeader = ['image', 'video', 'audio', 'document'].includes(headerType);

  // Render error state
  if (!type) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Interactive message type unknown</Text>
      </View>
    );
  }

  // Route to appropriate component based on type
  const renderInteractiveContent = () => {
    // Incoming interactive replies (from end user)
    if (type === 'button_reply' || type === 'list_reply') {
      return (
        <View style={styles.replyContainer}>
          <Icon
            name="gesture-tap-button"
            size={16}
            color={colors.grey[600]}
          />
          <Text
            style={[
              styles.replyText,
              isOutgoing && styles.replyTextOutgoing,
            ]}
            numberOfLines={2}
          >
            {body || 'Interactive reply'}
          </Text>
        </View>
      );
    }

    // Media button messages (image/video/audio/document header with buttons)
    if (hasMediaHeader) {
      return (
        <ButtonMessage
          message={message}
          isOutgoing={isOutgoing}
          onImagePress={onImagePress}
          hasMediaHeader
          mediaType={headerType}
        />
      );
    }

    switch (type) {
      case 'button':
      case 'cta_url':
        return (
          <ButtonMessage
            message={message}
            isOutgoing={isOutgoing}
          />
        );

      case 'list':
        return (
          <ListMessage
            message={message}
            isOutgoing={isOutgoing}
          />
        );

      case 'product':
        return (
          <ProductMessage
            message={message}
            isOutgoing={isOutgoing}
            onImagePress={onImagePress}
          />
        );

      case 'product_list':
        return (
          <MultiProductMessage
            message={message}
            isOutgoing={isOutgoing}
            onImagePress={onImagePress}
          />
        );

      case 'catalog_message':
        return (
          <CatalogMessage
            message={message}
            isOutgoing={isOutgoing}
          />
        );

      case 'address_message':
        return (
          <AddressMessage
            message={message}
            isOutgoing={isOutgoing}
          />
        );

      case 'order_details':
        return (
          <OrderDetailsMessage
            message={message}
            isOutgoing={isOutgoing}
          />
        );

      default:
        // Fallback: show body text with type indicator
        return (
          <View style={styles.fallbackContainer}>
            <Icon
              name="gesture-tap-button"
              size={16}
              color={colors.grey[500]}
            />
            <Text style={[styles.fallbackText, isOutgoing && styles.fallbackTextOutgoing]}>
              {typeof body === 'string' ? body : 'Interactive message'}
            </Text>
            {footer && (
              <Text style={[styles.fallbackFooter, isOutgoing && styles.fallbackFooterOutgoing]}>
                {footer}
              </Text>
            )}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderInteractiveContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 200,
    maxWidth: 280,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  replyTextOutgoing: {
    color: colors.text.primary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  fallbackContainer: {
    padding: 4,
  },
  fallbackText: {
    fontSize: 14,
    color: colors.text.primary,
    marginTop: 4,
  },
  fallbackTextOutgoing: {
    color: colors.text.primary,
  },
  fallbackFooter: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  fallbackFooterOutgoing: {
    color: colors.text.secondary,
  },
});

export default memo(InteractiveMessage);
