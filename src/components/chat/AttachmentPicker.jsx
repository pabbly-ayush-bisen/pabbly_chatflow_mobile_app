import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, chatColors } from '../../theme/colors';

const AttachmentOption = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <View style={[styles.optionIcon, { backgroundColor: color }]}>
      <Icon name={icon} size={24} color={colors.common.white} />
    </View>
    <Text style={styles.optionLabel}>{label}</Text>
  </TouchableOpacity>
);

const AttachmentPicker = ({ visible, onClose, onSelect }) => {
  const options = [
    {
      icon: 'file-document',
      label: 'Document',
      color: '#5E35B1',
      type: 'document',
    },
    {
      icon: 'camera',
      label: 'Camera',
      color: '#D32F2F',
      type: 'camera',
    },
    {
      icon: 'image',
      label: 'Gallery',
      color: '#8E24AA',
      type: 'gallery',
    },
    {
      icon: 'headphones',
      label: 'Audio',
      color: '#FF6F00',
      type: 'audio',
    },
    {
      icon: 'map-marker',
      label: 'Location',
      color: '#43A047',
      type: 'location',
    },
    {
      icon: 'account',
      label: 'Contact',
      color: '#039BE5',
      type: 'contact',
    },
  ];

  const handleSelect = (type) => {
    onSelect?.(type);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.grid}>
            {options.map((option) => (
              <AttachmentOption
                key={option.type}
                icon={option.icon}
                label={option.label}
                color={option.color}
                onPress={() => handleSelect(option.type)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  option: {
    alignItems: 'center',
    width: '33%',
    marginBottom: 24,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});

export default AttachmentPicker;
