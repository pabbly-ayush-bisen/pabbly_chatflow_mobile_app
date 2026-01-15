import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * AddressMessage Component
 * Renders address request interactive messages
 * Aligned with web app AskGenericPreview/AskAddressPreview components
 */
const AddressMessage = ({ message, isOutgoing }) => {
  const interactiveData = getInteractiveData(message);
  const { body, footer } = interactiveData;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || 'Please provide your address';

  return (
    <View style={styles.container}>
      {/* Address icon header */}
      <View style={styles.addressHeader}>
        <View style={styles.addressIcon}>
          <Icon name="map-marker-outline" size={28} color={chatColors.primary} />
        </View>
        <View style={styles.addressInfo}>
          <Text style={[styles.addressTitle, isOutgoing && styles.addressTitleOutgoing]}>
            Address Request
          </Text>
          <Text style={[styles.addressSubtitle, isOutgoing && styles.addressSubtitleOutgoing]}>
            Tap to share your address
          </Text>
        </View>
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

      {/* Share address button */}
      <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
        <Icon name="send" size={18} color={chatColors.primary} />
        <Text style={styles.shareButtonText}>Share Address</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  addressIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  addressTitleOutgoing: {
    color: colors.common.white,
  },
  addressSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  addressSubtitleOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
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
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
  },
});

export default memo(AddressMessage);
