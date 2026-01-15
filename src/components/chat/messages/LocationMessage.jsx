import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../../theme/colors';
import { getLocationData } from '../../../utils/messageHelpers';

/**
 * LocationMessage Component
 * Renders location messages with map preview and coordinates
 * Aligned with web app LocationCard component
 */
const LocationMessage = ({ message, isOutgoing }) => {
  const locationData = getLocationData(message);
  const { latitude, longitude, name, address } = locationData;

  // Validate coordinates
  const hasValidCoordinates =
    latitude &&
    longitude &&
    !Number.isNaN(Number(latitude)) &&
    !Number.isNaN(Number(longitude));

  // Generate static map URL (using OpenStreetMap tiles via StaticMapMaker or similar)
  // For production, consider using a proper map tiles service
  const getMapImageUrl = () => {
    if (!hasValidCoordinates) return null;
    // Using a placeholder approach - in production, use Google Static Maps API or similar
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=300x150&maptype=mapnik&markers=${latitude},${longitude},red-pushpin`;
  };

  // Handle open in maps
  const handleOpenMaps = () => {
    if (hasValidCoordinates) {
      const url = `https://maps.google.com/?q=${latitude},${longitude}`;
      Linking.openURL(url);
    }
  };

  // Render error state
  if (!hasValidCoordinates) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="map-marker-off" size={32} color={colors.grey[400]} />
        <Text style={styles.errorText}>Invalid location coordinates</Text>
      </View>
    );
  }

  const mapImageUrl = getMapImageUrl();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleOpenMaps}
      activeOpacity={0.8}
    >
      {/* Map preview */}
      <View style={styles.mapContainer}>
        {mapImageUrl ? (
          <Image
            source={{ uri: mapImageUrl }}
            style={styles.mapImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Icon name="map-marker" size={48} color={colors.error.main} />
          </View>
        )}

        {/* Map overlay with pin icon */}
        <View style={styles.markerOverlay}>
          <Icon name="map-marker" size={32} color={colors.error.main} />
        </View>
      </View>

      {/* Location info */}
      <View style={[styles.infoContainer, isOutgoing && styles.infoContainerOutgoing]}>
        <View style={styles.infoHeader}>
          <Icon
            name="map-marker"
            size={16}
            color={isOutgoing ? 'rgba(255,255,255,0.7)' : chatColors.primary}
          />
          <Text
            style={[styles.locationName, isOutgoing && styles.locationNameOutgoing]}
            numberOfLines={1}
          >
            {name || 'Location'}
          </Text>
        </View>

        {address ? (
          <Text
            style={[styles.locationAddress, isOutgoing && styles.locationAddressOutgoing]}
            numberOfLines={2}
          >
            {address}
          </Text>
        ) : (
          <Text style={[styles.coordinates, isOutgoing && styles.coordinatesOutgoing]}>
            {`${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`}
          </Text>
        )}

        <View style={styles.actionContainer}>
          <Icon
            name="open-in-new"
            size={14}
            color={chatColors.primary}
          />
          <Text style={styles.actionText}>Open in Maps</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.grey[100],
  },
  mapContainer: {
    height: 120,
    backgroundColor: colors.grey[200],
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
  },
  markerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -32 }],
  },
  infoContainer: {
    padding: 12,
    backgroundColor: colors.common.white,
  },
  infoContainerOutgoing: {
    backgroundColor: 'transparent',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  locationNameOutgoing: {
    color: colors.common.white,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  locationAddressOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  coordinates: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  coordinatesOutgoing: {
    color: 'rgba(255,255,255,0.6)',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionText: {
    fontSize: 13,
    color: chatColors.primary,
    fontWeight: '500',
  },
  errorContainer: {
    width: 200,
    padding: 20,
    backgroundColor: colors.grey[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default memo(LocationMessage);
