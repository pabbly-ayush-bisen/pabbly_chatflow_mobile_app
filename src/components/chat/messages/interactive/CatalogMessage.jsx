import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * CatalogMessage Component
 * Renders catalog interactive messages
 * Aligned with web app CatalogPreview component
 */
const CatalogMessage = ({ message, isOutgoing }) => {
  const interactiveData = getInteractiveData(message);
  const { body, footer } = interactiveData;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Get catalog thumbnail if available
  const thumbnailUrl = message?.message?.action?.thumbnail_product_retailer_id || null;

  return (
    <View style={styles.container}>
      {/* Catalog icon/thumbnail */}
      <View style={styles.catalogHeader}>
        <View style={styles.catalogIcon}>
          <Icon name="store" size={32} color={chatColors.primary} />
        </View>
        <View style={styles.catalogInfo}>
          <Text style={[styles.catalogTitle, isOutgoing && styles.catalogTitleOutgoing]}>
            View Catalog
          </Text>
          <Text style={[styles.catalogSubtitle, isOutgoing && styles.catalogSubtitleOutgoing]}>
            Browse our products
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

      {/* View catalog button */}
      <TouchableOpacity style={styles.viewButton} activeOpacity={0.7}>
        <Icon name="store-outline" size={18} color={chatColors.primary} />
        <Text style={styles.viewButtonText}>Open Catalog</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  catalogIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catalogInfo: {
    flex: 1,
  },
  catalogTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  catalogTitleOutgoing: {
    color: colors.text.primary,
  },
  catalogSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  catalogSubtitleOutgoing: {
    color: colors.text.secondary,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    marginTop: 4,
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
    marginTop: 10,
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

export default memo(CatalogMessage);
