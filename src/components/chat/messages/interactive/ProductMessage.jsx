import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * ProductMessage Component
 * Renders single product interactive messages
 * Aligned with web app SingleProductPreview component
 */
const ProductMessage = ({ message, isOutgoing, onImagePress }) => {
  const [imageError, setImageError] = useState(false);

  const interactiveData = getInteractiveData(message);
  const { body, footer } = interactiveData;

  // Get product data from action
  const action = message?.message?.action || {};
  const productRetailerId = action.product_retailer_id;
  const catalogId = action.catalog_id;

  // Get product details if available (from enriched data)
  const productData = message?.message?.productData || message?.productData || {};
  const {
    productName = 'Product',
    productPrice = '',
    productCurrency = '',
    productImageUrl = null,
    productDescription = '',
  } = productData;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Format price
  const formattedPrice = productPrice && productCurrency
    ? `${productCurrency} ${Number(productPrice).toLocaleString()}`
    : productPrice || '';

  return (
    <View style={styles.container}>
      {/* Product image */}
      {productImageUrl && !imageError ? (
        <TouchableOpacity
          onPress={() => onImagePress?.(productImageUrl)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: productImageUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Icon name="shopping" size={40} color={colors.grey[400]} />
        </View>
      )}

      {/* Product info */}
      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, isOutgoing && styles.productNameOutgoing]}
          numberOfLines={2}
        >
          {productName}
        </Text>

        {formattedPrice && (
          <Text style={[styles.productPrice, isOutgoing && styles.productPriceOutgoing]}>
            {formattedPrice}
          </Text>
        )}

        {productDescription && (
          <Text
            style={[styles.productDescription, isOutgoing && styles.productDescriptionOutgoing]}
            numberOfLines={2}
          >
            {productDescription}
          </Text>
        )}
      </View>

      {/* Body text */}
      {bodyText && (
        <Text style={[styles.bodyText, isOutgoing && styles.bodyTextOutgoing]}>
          {bodyText}
        </Text>
      )}

      {/* Footer */}
      {footer && (
        <Text style={[styles.footerText, isOutgoing && styles.footerTextOutgoing]}>
          {footer}
        </Text>
      )}

      {/* View product button */}
      <TouchableOpacity style={styles.viewButton} activeOpacity={0.7}>
        <Icon name="shopping-outline" size={18} color={chatColors.primary} />
        <Text style={styles.viewButtonText}>View Product</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  productImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productInfo: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productNameOutgoing: {
    color: colors.common.white,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.primary,
    marginTop: 4,
  },
  productPriceOutgoing: {
    color: 'rgba(255,255,255,0.9)',
  },
  productDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  productDescriptionOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    marginTop: 4,
  },
  bodyTextOutgoing: {
    color: colors.common.white,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 6,
  },
  footerTextOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  viewButtonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
  },
});

export default memo(ProductMessage);
