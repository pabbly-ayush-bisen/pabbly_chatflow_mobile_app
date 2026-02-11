import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const AttachmentOption = ({ icon, label, color, bgColor, onPress, animDelay }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      delay: animDelay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.optionWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.option}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.optionIconOuter, { backgroundColor: bgColor }]}>
          <View style={[styles.optionIconInner, { backgroundColor: color }]}>
            <Icon name={icon} size={22} color={colors.common.white} />
          </View>
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const AttachmentPicker = ({ visible, onClose, onSelect }) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(300);
      backdropAnim.setValue(0);
    }
  }, [visible]);

  const handleSelect = (type) => {
    onSelect?.(type);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            { opacity: backdropAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.handleBar}>
              <View style={styles.handle} />
            </View>

            <Text style={styles.title}>Share</Text>

            {/* Row 1: Document, Camera, Gallery */}
            <View style={styles.row}>
              <AttachmentOption
                icon="file-document-outline"
                label="Document"
                color="#5C6BC0"
                bgColor="#E8EAF6"
                onPress={() => handleSelect('document')}
                animDelay={0}
              />
              <AttachmentOption
                icon="camera-outline"
                label="Camera"
                color="#E53935"
                bgColor="#FFEBEE"
                onPress={() => handleSelect('camera')}
                animDelay={50}
              />
              <AttachmentOption
                icon="image-outline"
                label="Gallery"
                color="#43A047"
                bgColor="#E8F5E9"
                onPress={() => handleSelect('gallery')}
                animDelay={100}
              />
            </View>

            {/* Row 2: Video, Audio (left-aligned under Document, Camera) */}
            <View style={styles.row}>
              <AttachmentOption
                icon="video-outline"
                label="Video"
                color="#FB8C00"
                bgColor="#FFF3E0"
                onPress={() => handleSelect('video')}
                animDelay={150}
              />
              <AttachmentOption
                icon="headphones"
                label="Audio"
                color="#8E24AA"
                bgColor="#F3E5F5"
                onPress={() => handleSelect('audio')}
                animDelay={200}
              />
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  optionWrapper: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  option: {
    alignItems: 'center',
  },
  optionIconOuter: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionIconInner: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
});

export default AttachmentPicker;
