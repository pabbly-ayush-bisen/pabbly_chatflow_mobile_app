/**
 * Toast Configuration Component
 * Custom toast styles for the application
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme';

// Custom toast component
const ToastBase = ({ text1, text2, type, style }) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: { backgroundColor: colors.common.white, borderLeftColor: colors.success.main },
          icon: '✓',
          iconBg: colors.success.light + '20',
          iconColor: colors.success.main,
        };
      case 'error':
        return {
          container: { backgroundColor: colors.common.white, borderLeftColor: colors.error.main },
          icon: '!',
          iconBg: colors.error.light + '20',
          iconColor: colors.error.main,
        };
      case 'warning':
        return {
          container: { backgroundColor: colors.common.white, borderLeftColor: colors.warning.main },
          icon: '!',
          iconBg: colors.warning.light + '20',
          iconColor: colors.warning.main,
        };
      case 'info':
      default:
        return {
          container: { backgroundColor: colors.common.white, borderLeftColor: colors.info.main },
          icon: 'i',
          iconBg: colors.info.light + '20',
          iconColor: colors.info.main,
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <View style={[styles.container, typeStyles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: typeStyles.iconBg }]}>
        <Text style={[styles.icon, { color: typeStyles.iconColor }]}>{typeStyles.icon}</Text>
      </View>
      <View style={styles.textContainer}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message} numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
};

// Toast configuration object
export const toastConfig = {
  success: (props) => <ToastBase {...props} type="success" />,
  error: (props) => <ToastBase {...props} type="error" />,
  info: (props) => <ToastBase {...props} type="info" />,
  warning: (props) => <ToastBase {...props} type="warning" />,
};

const styles = StyleSheet.create({
  container: {
    width: '92%',
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

export default toastConfig;
