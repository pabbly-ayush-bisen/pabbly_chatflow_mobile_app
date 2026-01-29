import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * CustomDialog - iOS-style dialog that works consistently on both platforms
 * Replaces ugly Android native dialogs with a beautiful custom design
 */
const CustomDialog = ({
  visible,
  onDismiss,
  title,
  message,
  icon,
  iconColor = colors.primary.main,
  iconBackgroundColor,
  children,
  actions = [],
  showCloseButton = false,
  loading = false,
  dismissable = true,
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(0.9));
  const [opacityAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleBackdropPress = () => {
    if (dismissable && onDismiss) {
      onDismiss();
    }
  };

  const defaultIconBg = iconBackgroundColor || `${iconColor}15`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissable ? onDismiss : undefined}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.dialog,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Close button */}
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onDismiss}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={22} color={colors.grey[500]} />
                </TouchableOpacity>
              )}

              {/* Icon */}
              {icon && (
                <View style={[styles.iconContainer, { backgroundColor: defaultIconBg }]}>
                  <Icon name={icon} size={32} color={iconColor} />
                </View>
              )}

              {/* Title */}
              {title && <Text style={styles.title}>{title}</Text>}

              {/* Message */}
              {message && <Text style={styles.message}>{message}</Text>}

              {/* Custom content */}
              {children}

              {/* Loading indicator */}
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary.main} />
                </View>
              )}

              {/* Actions */}
              {actions.length > 0 && !loading && (
                <View style={[styles.actionsContainer, actions.length === 1 && styles.singleAction]}>
                  {actions.map((action, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.actionButton,
                        action.primary && styles.primaryButton,
                        action.destructive && styles.destructiveButton,
                        actions.length === 2 && styles.halfButton,
                        action.disabled && styles.disabledButton,
                      ]}
                      onPress={action.onPress}
                      disabled={action.disabled}
                      activeOpacity={0.7}
                    >
                      {action.loading ? (
                        <ActivityIndicator
                          size="small"
                          color={action.primary || action.destructive ? '#FFFFFF' : colors.primary.main}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.actionText,
                            action.primary && styles.primaryText,
                            action.destructive && styles.destructiveText,
                            action.disabled && styles.disabledText,
                          ]}
                        >
                          {action.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  singleAction: {
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  halfButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
  },
  destructiveButton: {
    backgroundColor: colors.error.main,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: colors.grey[500],
  },
});

export default CustomDialog;
