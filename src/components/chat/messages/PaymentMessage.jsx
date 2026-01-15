import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';

/**
 * PaymentMessage Component
 *
 * READ-ONLY display of WhatsApp payment messages.
 * No create/edit functionality - only for viewing payment information.
 */
const PaymentMessage = ({ payment, isOutgoing }) => {
  // Extract payment data from various possible structures
  const amount = payment?.amount || payment?.total_amount?.value || 0;
  const currency = payment?.currency || payment?.total_amount?.offset
    ? 'INR' : (payment?.total_amount?.currency || 'INR');
  const status = payment?.status || payment?.payment_status || 'unknown';
  const transactionId = payment?.transaction_id || payment?.reference_id || payment?.id || '';
  const transactionType = payment?.transaction_type || payment?.type || 'payment';
  const timestamp = payment?.timestamp || payment?.created_at;
  const note = payment?.note || payment?.description || '';

  // Format amount with currency
  const formatAmount = (value, curr) => {
    // Handle WhatsApp offset format (amount in smallest unit, e.g., paise)
    const actualAmount = payment?.total_amount?.offset
      ? value / Math.pow(10, payment.total_amount.offset)
      : value;

    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
    });

    return formatter.format(actualAmount);
  };

  // Get status configuration
  const getStatusConfig = (paymentStatus) => {
    switch (paymentStatus?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'captured':
        return {
          icon: 'check-circle',
          color: colors.success.main,
          label: 'Successful',
          bgColor: colors.success.lighter,
        };
      case 'pending':
      case 'processing':
        return {
          icon: 'clock-outline',
          color: colors.warning.main,
          label: 'Pending',
          bgColor: colors.warning.lighter,
        };
      case 'failed':
      case 'rejected':
      case 'cancelled':
        return {
          icon: 'close-circle',
          color: colors.error.main,
          label: 'Failed',
          bgColor: colors.error.lighter,
        };
      case 'refunded':
        return {
          icon: 'undo',
          color: colors.info.main,
          label: 'Refunded',
          bgColor: colors.info.lighter,
        };
      default:
        return {
          icon: 'help-circle-outline',
          color: colors.grey[500],
          label: 'Unknown',
          bgColor: colors.grey[100],
        };
    }
  };

  // Get transaction type icon
  const getTransactionTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'payment':
      case 'pay':
        return 'cash';
      case 'request':
      case 'request_money':
        return 'cash-plus';
      case 'refund':
        return 'cash-refund';
      default:
        return 'cash';
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <View style={styles.container}>
      {/* Payment Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: chatColors.primary + '20' }]}>
          <Icon
            name={getTransactionTypeIcon(transactionType)}
            size={24}
            color={chatColors.primary}
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.typeLabel, isOutgoing && styles.textOutgoing]}>
            WhatsApp Payment
          </Text>
          <Text style={[styles.subLabel, isOutgoing && styles.textOutgoingSecondary]}>
            {transactionType === 'request' ? 'Payment Request' : 'Payment'}
          </Text>
        </View>
      </View>

      {/* Amount Display */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, isOutgoing && styles.textOutgoing]}>
          {formatAmount(amount, currency)}
        </Text>
      </View>

      {/* Note if present */}
      {note ? (
        <Text style={[styles.note, isOutgoing && styles.textOutgoingSecondary]}>
          "{note}"
        </Text>
      ) : null}

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
        <Icon name={statusConfig.icon} size={16} color={statusConfig.color} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* Transaction Details */}
      {transactionId ? (
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isOutgoing && styles.textOutgoingSecondary]}>
              Transaction ID
            </Text>
            <Text
              style={[styles.detailValue, isOutgoing && styles.textOutgoing]}
              numberOfLines={1}
            >
              {transactionId}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Read-only indicator */}
      <View style={styles.readOnlyBadge}>
        <Icon name="eye" size={12} color={colors.grey[500]} />
        <Text style={styles.readOnlyText}>View only</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 240,
    maxWidth: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 12,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.primary,
    maxWidth: '60%',
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 4,
  },
  readOnlyText: {
    fontSize: 10,
    color: colors.grey[500],
  },
  textOutgoing: {
    color: colors.common.white,
  },
  textOutgoingSecondary: {
    color: 'rgba(255,255,255,0.7)',
  },
});

export default memo(PaymentMessage);
