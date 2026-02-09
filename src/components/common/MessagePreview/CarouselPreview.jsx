/**
 * CarouselPreview - Renders carousel template cards in a horizontal ScrollView.
 *
 * Always uses clean icon + label placeholders for card headers.
 * The header_handle URLs in carousel cards are Meta's example/sample images
 * (used for template approval), not actual production media.
 */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { chatColors } from '../../../theme/colors';
import styles from './messagePreviewStyles';
import { BUTTON_CONFIG } from './messagePreviewUtils';

const CarouselPreview = ({ cards = [] }) => {
  if (cards.length === 0) return null;

  return (
    <View style={styles.carouselPreviewSection}>
      <Text style={styles.carouselLabel}>
        CAROUSEL CARDS ({cards.length})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carouselScroll}
      >
        {cards.map((card, cardIdx) => {
          const cardHeader = card.components?.find(
            (c) => c.type === 'HEADER' || c.type === 'header'
          );
          const cardBody = card.components?.find(
            (c) => c.type === 'BODY' || c.type === 'body'
          );
          const cardButtons =
            card.components?.find(
              (c) => c.type === 'BUTTONS' || c.type === 'buttons'
            )?.buttons || [];

          const format = cardHeader?.format?.toUpperCase();

          return (
            <View key={cardIdx} style={styles.carouselCard}>
              {/* Card Header/Media — always placeholder */}
              {cardHeader && (
                <View style={styles.carouselCardMedia}>
                  <View style={styles.carouselCardMediaIconCircle}>
                    <Icon
                      name={
                        format === 'IMAGE'
                          ? 'image'
                          : format === 'VIDEO'
                          ? 'video'
                          : 'file-document'
                      }
                      size={22}
                      color="#0EA5E9"
                    />
                  </View>
                  <Text style={styles.carouselCardMediaLabel}>
                    {format === 'IMAGE'
                      ? 'Image'
                      : format === 'VIDEO'
                      ? 'Video'
                      : 'Document'}
                  </Text>
                </View>
              )}
              {/* Card Body */}
              {cardBody?.text && (
                <Text style={styles.carouselCardBody} numberOfLines={3}>
                  {cardBody.text}
                </Text>
              )}
              {/* Card Buttons */}
              {cardButtons.length > 0 && (
                <View style={styles.carouselCardButtons}>
                  {cardButtons.map((btn, btnIdx) => {
                    const btnConfig =
                      BUTTON_CONFIG[btn.type] || BUTTON_CONFIG.QUICK_REPLY;
                    return (
                      <View key={btnIdx} style={styles.carouselCardButton}>
                        <Icon
                          name={btnConfig.icon}
                          size={12}
                          color={chatColors.linkColor}
                        />
                        <Text
                          style={styles.carouselCardButtonText}
                          numberOfLines={1}
                        >
                          {btn.text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default CarouselPreview;
