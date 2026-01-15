import React, { memo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getOrderData } from '../../../utils/messageHelpers';

/**
 * OrderMessage Component
 * Renders order messages (cart sent by customer)
 * Aligned with web app CartDetailsModal and order message rendering
 */
const OrderMessage = ({ message, isOutgoing }) => {
  const [showCartModal, setShowCartModal] = useState(false);

  const orderData = getOrderData(message);

  // Render error state
  if (!orderData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="cart-off" size={24} color={colors.grey[400]} />
        <Text style={styles.errorText}>Order data not available</Text>
      </View>
    );
  }

  const { productItems, totalAmount, totalItems, currency } = orderData;

  // Get first product image for preview
  const firstProductImage = message?.message?.product_items?.[0]?.productImageUrl;

  // Format price
  const formatPrice = (value) => {
    return `${currency} ${Number(value).toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      {/* Order header with product image preview */}
      <View style={styles.orderHeader}>
        {firstProductImage ? (
          <Image
            source={{ uri: firstProductImage }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Icon name="cart" size={24} color={colors.grey[400]} />
          </View>
        )}
        <View style={styles.orderInfo}>
          <Text style={[styles.orderTitle, isOutgoing && styles.orderTitleOutgoing]}>
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </Text>
          <Text style={[styles.orderTotal, isOutgoing && styles.orderTotalOutgoing]}>
            {formatPrice(totalAmount)} (estimated)
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* View cart button */}
      <TouchableOpacity
        style={[
          styles.viewButton,
          !firstProductImage && styles.viewButtonDisabled,
        ]}
        onPress={() => firstProductImage && setShowCartModal(true)}
        activeOpacity={firstProductImage ? 0.7 : 1}
      >
        <Icon
          name="cart-outline"
          size={18}
          color={firstProductImage ? chatColors.primary : colors.grey[400]}
        />
        <Text
          style={[
            styles.viewButtonText,
            !firstProductImage && styles.viewButtonTextDisabled,
          ]}
        >
          View sent cart
        </Text>
      </TouchableOpacity>

      {/* Cart Details Modal */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your cart</Text>
              <TouchableOpacity
                onPress={() => setShowCartModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Item count */}
            <View style={styles.itemCountContainer}>
              <Text style={styles.itemCount}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </Text>
            </View>

            {/* Product list */}
            <ScrollView style={styles.productList}>
              {productItems.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.productItem,
                    index < productItems.length - 1 && styles.productItemBorder,
                  ]}
                >
                  {item.productImageUrl ? (
                    <Image
                      source={{ uri: item.productImageUrl }}
                      style={styles.productItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.productItemImagePlaceholder}>
                      <Icon name="package-variant" size={24} color={colors.grey[400]} />
                    </View>
                  )}
                  <View style={styles.productItemInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.productName || item.product_retailer_id || 'Product'}
                    </Text>
                    <Text style={styles.productQuantity}>
                      Quantity: {item.quantity || 1}
                    </Text>
                    <Text style={styles.productPrice}>
                      {item.currency} {Number(item.item_price || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Divider />

            {/* Total */}
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Estimated total</Text>
              <Text style={styles.totalAmount}>{formatPrice(totalAmount)}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  orderTitleOutgoing: {
    color: colors.common.white,
  },
  orderTotal: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  orderTotalOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 10,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  viewButtonDisabled: {
    opacity: 0.5,
  },
  viewButtonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
  },
  viewButtonTextDisabled: {
    color: colors.grey[400],
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemCountContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  itemCount: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  productList: {
    paddingHorizontal: 20,
  },
  productItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  productItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  productItemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  productItemImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productItemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  productQuantity: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  productPrice: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
});

export default memo(OrderMessage);
