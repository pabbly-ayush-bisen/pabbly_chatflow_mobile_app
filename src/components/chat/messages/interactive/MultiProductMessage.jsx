import React, { memo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Modal, ScrollView, FlatList } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * MultiProductMessage Component
 * Renders multi-product list interactive messages
 * Aligned with web app MultiproductPreview component
 */
const MultiProductMessage = ({ message, isOutgoing, onImagePress }) => {
  const [showProductsModal, setShowProductsModal] = useState(false);

  const interactiveData = getInteractiveData(message);
  const { body, sections, header, footer } = interactiveData;

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Calculate total products
  const totalProducts = sections.reduce((acc, section) => acc + (section.product_items?.length || 0), 0);

  // Get all products flattened
  const allProducts = sections.flatMap(section =>
    (section.product_items || []).map(product => ({
      ...product,
      sectionTitle: section.title,
    }))
  );

  // Get first few products for preview
  const previewProducts = allProducts.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header text */}
      {header?.text && (
        <Text style={[styles.headerText, isOutgoing && styles.headerTextOutgoing]}>
          {header.text}
        </Text>
      )}

      {/* Product preview grid */}
      <View style={styles.previewGrid}>
        {previewProducts.map((product, index) => (
          <View key={index} style={styles.previewItem}>
            {product.productImageUrl ? (
              <Image
                source={{ uri: product.productImageUrl }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Icon name="shopping" size={20} color={colors.grey[400]} />
              </View>
            )}
          </View>
        ))}
        {totalProducts > 3 && (
          <View style={styles.moreIndicator}>
            <Text style={styles.moreText}>+{totalProducts - 3}</Text>
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

      {/* View products button */}
      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => setShowProductsModal(true)}
        activeOpacity={0.7}
      >
        <Icon name="shopping-outline" size={18} color={chatColors.primary} />
        <Text style={styles.viewButtonText}>View All Products</Text>
        <Text style={styles.productCount}>({totalProducts})</Text>
      </TouchableOpacity>

      {/* Products Modal */}
      <Modal
        visible={showProductsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProductsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Products ({totalProducts})</Text>
              <TouchableOpacity
                onPress={() => setShowProductsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Sections with products */}
            <ScrollView style={styles.sectionsContainer}>
              {sections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                  {/* Section title */}
                  {section.title && (
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  )}

                  {/* Products grid */}
                  <View style={styles.productsGrid}>
                    {(section.product_items || []).map((product, productIndex) => (
                      <TouchableOpacity
                        key={productIndex}
                        style={styles.productCard}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (product.productImageUrl) {
                            onImagePress?.(product.productImageUrl);
                          }
                        }}
                      >
                        {product.productImageUrl ? (
                          <Image
                            source={{ uri: product.productImageUrl }}
                            style={styles.productImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.productPlaceholder}>
                            <Icon name="shopping" size={24} color={colors.grey[400]} />
                          </View>
                        )}
                        <View style={styles.productDetails}>
                          <Text style={styles.productName} numberOfLines={2}>
                            {product.productName || product.product_retailer_id || 'Product'}
                          </Text>
                          {product.productPrice && (
                            <Text style={styles.productPrice}>
                              {product.productCurrency || ''} {Number(product.productPrice).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Section divider */}
                  {sectionIndex < sections.length - 1 && (
                    <Divider style={styles.sectionDivider} />
                  )}
                </View>
              ))}
            </ScrollView>
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
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  headerTextOutgoing: {
    color: colors.text.primary,
  },
  previewGrid: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 4,
  },
  previewItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreIndicator: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
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
  productCount: {
    fontSize: 12,
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
  sectionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '47%',
    backgroundColor: colors.grey[50],
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 100,
  },
  productPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    padding: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: chatColors.primary,
    marginTop: 4,
  },
  sectionDivider: {
    marginTop: 16,
  },
});

export default memo(MultiProductMessage);
