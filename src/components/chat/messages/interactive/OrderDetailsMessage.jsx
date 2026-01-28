import React, { memo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * OrderDetailsMessage Component
 * Renders order details interactive messages
 * Aligned with web app OrderMessageTemplateCard component
 */
const OrderDetailsMessage = ({ message, isOutgoing }) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const interactiveData = getInteractiveData(message);
  const { body, footer } = interactiveData;

  // Get order data from action parameters
  const orderParams = message?.message?.action?.parameters?.order || {};
  const {
    reference_id,
    order_status,
    payment_status,
    items = [],
    subtotal,
    tax,
    shipping,
    discount,
    total,
  } = orderParams;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Calculate totals if not provided
  const calculatedSubtotal = subtotal?.value
    ? Number(subtotal.value) / (subtotal.offset || 100)
    : items.reduce((sum, item) => sum + (item.amount?.value ? Number(item.amount.value) / (item.amount.offset || 100) : 0) * (item.quantity || 1), 0);

  const currency = subtotal?.currency || items[0]?.amount?.currency || 'USD';
  const totalAmount = total?.value
    ? Number(total.value) / (total.offset || 100)
    : calculatedSubtotal;

  // Format currency
  const formatPrice = (value, curr = currency) => {
    return `${curr} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      {/* Order header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderIconContainer}>
          <Icon name="receipt" size={24} color={chatColors.primary} />
        </View>
        <View style={styles.orderHeaderInfo}>
          <Text style={[styles.orderTitle, isOutgoing && styles.orderTitleOutgoing]}>
            Order Details
          </Text>
          {reference_id && (
            <Text style={[styles.orderId, isOutgoing && styles.orderIdOutgoing]}>
              #{reference_id}
            </Text>
          )}
        </View>
        {order_status && (
          <View style={[styles.statusBadge, getStatusStyle(order_status)]}>
            <Text style={styles.statusText}>{order_status}</Text>
          </View>
        )}
      </View>

      {/* Order summary */}
      <View style={styles.orderSummary}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isOutgoing && styles.summaryLabelOutgoing]}>
            Items
          </Text>
          <Text style={[styles.summaryValue, isOutgoing && styles.summaryValueOutgoing]}>
            {items.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isOutgoing && styles.summaryLabelOutgoing]}>
            Total
          </Text>
          <Text style={[styles.totalValue, isOutgoing && styles.totalValueOutgoing]}>
            {formatPrice(totalAmount)}
          </Text>
        </View>
        {payment_status && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, isOutgoing && styles.summaryLabelOutgoing]}>
              Payment
            </Text>
            <Text style={[
              styles.paymentStatus,
              payment_status === 'paid' && styles.paymentPaid,
              payment_status === 'pending' && styles.paymentPending,
            ]}>
              {payment_status}
            </Text>
          </View>
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

      {/* View details button */}
      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => setShowDetailsModal(true)}
        activeOpacity={0.7}
      >
        <Icon name="eye-outline" size={18} color={chatColors.primary} />
        <Text style={styles.viewButtonText}>View Order Details</Text>
      </TouchableOpacity>

      {/* Order Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Order Details</Text>
                {reference_id && (
                  <Text style={styles.modalSubtitle}>#{reference_id}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Divider />

            <ScrollView style={styles.modalBody}>
              {/* Status badges */}
              <View style={styles.statusRow}>
                {order_status && (
                  <View style={[styles.modalStatusBadge, getStatusStyle(order_status)]}>
                    <Text style={styles.statusText}>{order_status}</Text>
                  </View>
                )}
                {payment_status && (
                  <View style={[
                    styles.modalStatusBadge,
                    payment_status === 'paid' && styles.paidBadge,
                    payment_status === 'pending' && styles.pendingBadge,
                  ]}>
                    <Text style={styles.statusText}>{payment_status}</Text>
                  </View>
                )}
              </View>

              {/* Items list */}
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              {items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Icon name="package-variant" size={20} color={colors.grey[400]} />
                    </View>
                  )}
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name || 'Item'}
                    </Text>
                    <Text style={styles.itemQuantity}>
                      Qty: {item.quantity || 1}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatPrice(item.amount?.value ? Number(item.amount.value) / (item.amount.offset || 100) : 0)}
                  </Text>
                </View>
              ))}

              <Divider style={styles.divider} />

              {/* Price breakdown */}
              <View style={styles.priceBreakdown}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Subtotal</Text>
                  <Text style={styles.priceValue}>{formatPrice(calculatedSubtotal)}</Text>
                </View>
                {tax?.value && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Tax</Text>
                    <Text style={styles.priceValue}>
                      {formatPrice(Number(tax.value) / (tax.offset || 100))}
                    </Text>
                  </View>
                )}
                {shipping?.value && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Shipping</Text>
                    <Text style={styles.priceValue}>
                      {formatPrice(Number(shipping.value) / (shipping.offset || 100))}
                    </Text>
                  </View>
                )}
                {discount?.value && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Discount</Text>
                    <Text style={[styles.priceValue, styles.discountValue]}>
                      -{formatPrice(Number(discount.value) / (discount.offset || 100))}
                    </Text>
                  </View>
                )}
                <View style={[styles.priceRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalPrice}>{formatPrice(totalAmount)}</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper to get status badge style
const getStatusStyle = (status) => {
  const statusLower = status?.toLowerCase();
  if (statusLower === 'completed' || statusLower === 'delivered') {
    return { backgroundColor: colors.success.lighter };
  }
  if (statusLower === 'pending' || statusLower === 'processing') {
    return { backgroundColor: colors.warning.lighter };
  }
  if (statusLower === 'cancelled' || statusLower === 'failed') {
    return { backgroundColor: colors.error.lighter };
  }
  return { backgroundColor: colors.grey[200] };
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderHeaderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  orderTitleOutgoing: {
    color: colors.text.primary,
  },
  orderId: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  orderIdOutgoing: {
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.text.primary,
  },
  orderSummary: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  summaryLabelOutgoing: {
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  summaryValueOutgoing: {
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: chatColors.primary,
  },
  totalValueOutgoing: {
    color: chatColors.primary,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  paymentPaid: {
    color: colors.success.main,
  },
  paymentPending: {
    color: colors.warning.main,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bodyTextOutgoing: {
    color: colors.text.primary,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 6,
  },
  footerTextOutgoing: {
    color: colors.text.secondary,
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
    maxHeight: '85%',
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
  modalSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paidBadge: {
    backgroundColor: colors.success.lighter,
  },
  pendingBadge: {
    backgroundColor: colors.warning.lighter,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemQuantity: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    marginVertical: 16,
  },
  priceBreakdown: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  priceValue: {
    fontSize: 14,
    color: colors.text.primary,
  },
  discountValue: {
    color: colors.success.main,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: chatColors.primary,
  },
});

export default memo(OrderDetailsMessage);
