import React, { memo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../../theme/colors';
import { getInteractiveData } from '../../../../utils/messageHelpers';

/**
 * ListMessage Component
 * Renders interactive list messages with expandable sections
 * Aligned with web app ListPreview component
 */
const ListMessage = ({ message, isOutgoing }) => {
  const [showListModal, setShowListModal] = useState(false);

  const interactiveData = getInteractiveData(message);
  const { body, sections, header, footer } = interactiveData;

  // Get button title from action
  const buttonTitle = message?.message?.action?.button || 'View Options';

  // Get body text
  const bodyText = typeof body === 'string' ? body : body?.text || '';

  // Calculate total items
  const totalItems = sections.reduce((acc, section) => acc + (section.rows?.length || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header text */}
      {header?.text && (
        <Text style={[styles.headerText, isOutgoing && styles.headerTextOutgoing]}>
          {header.text}
        </Text>
      )}

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

      {/* List button */}
      <TouchableOpacity
        style={styles.listButton}
        onPress={() => setShowListModal(true)}
        activeOpacity={0.7}
      >
        <Icon name="menu" size={18} color={chatColors.primary} />
        <Text style={styles.listButtonText}>{buttonTitle}</Text>
        <Text style={styles.itemCount}>({totalItems} options)</Text>
      </TouchableOpacity>

      {/* List Modal */}
      <Modal
        visible={showListModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{buttonTitle}</Text>
              <TouchableOpacity
                onPress={() => setShowListModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Sections */}
            <ScrollView style={styles.sectionsContainer}>
              {sections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                  {/* Section title */}
                  {section.title && (
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  )}

                  {/* Section rows */}
                  {section.rows?.map((row, rowIndex) => (
                    <TouchableOpacity
                      key={rowIndex}
                      style={styles.listItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        // Handle row selection
                        setShowListModal(false);
                      }}
                    >
                      <View style={styles.listItemContent}>
                        <Text style={styles.listItemTitle}>{row.title || row.id}</Text>
                        {row.description && (
                          <Text style={styles.listItemDescription} numberOfLines={2}>
                            {row.description}
                          </Text>
                        )}
                      </View>
                      <Icon name="chevron-right" size={20} color={colors.grey[400]} />
                    </TouchableOpacity>
                  ))}

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
    marginBottom: 6,
  },
  headerTextOutgoing: {
    color: colors.text.primary,
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
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  listButtonText: {
    fontSize: 14,
    color: chatColors.primary,
    fontWeight: '500',
  },
  itemCount: {
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
    paddingHorizontal: 20,
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
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  listItemDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sectionDivider: {
    marginTop: 16,
  },
});

export default memo(ListMessage);
