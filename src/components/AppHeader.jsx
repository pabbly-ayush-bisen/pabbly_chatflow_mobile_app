import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PabblyIcon from './PabblyIcon';
import { colors } from '../theme/colors';

// Storage key for notification preferences
const NOTIFICATION_PREFS_KEY = '@pabbly_notification_prefs';

const AppHeader = ({ showProfile = true, title, subtitle }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.user);

  // Notification preferences state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  // Load notification preferences on mount
  useEffect(() => {
    loadNotificationPrefs();
  }, []);

  const loadNotificationPrefs = async () => {
    try {
      const prefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (prefs) {
        const parsed = JSON.parse(prefs);
        setNotificationsEnabled(parsed.enabled ?? true);
        setSoundEnabled(parsed.sound ?? true);
        setVibrationEnabled(parsed.vibration ?? true);
      }
    } catch (error) {
      // Log:('Error loading notification prefs:', error);
    }
  };

  const saveNotificationPrefs = async (prefs) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Log:('Error saving notification prefs:', error);
    }
  };

  const handleToggleNotifications = (value) => {
    setNotificationsEnabled(value);
    const prefs = { enabled: value, sound: soundEnabled, vibration: vibrationEnabled };
    saveNotificationPrefs(prefs);
  };

  const handleToggleSound = (value) => {
    setSoundEnabled(value);
    const prefs = { enabled: notificationsEnabled, sound: value, vibration: vibrationEnabled };
    saveNotificationPrefs(prefs);
  };

  const handleToggleVibration = (value) => {
    setVibrationEnabled(value);
    const prefs = { enabled: notificationsEnabled, sound: soundEnabled, vibration: value };
    saveNotificationPrefs(prefs);
  };

  // Get initials from first and last name
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return (user.first_name[0] + user.last_name[0]).toUpperCase();
    }
    if (user?.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleMenuPress = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleProfilePress = () => {
    navigation.navigate('MainTabs', {
      screen: 'MoreTab',
      params: { screen: 'MyAccount' },
    });
  };

  const handleNotificationPress = () => {
    setShowPrefsModal(true);
  };

  // Notification Preferences Modal
  const renderNotificationPrefsModal = () => (
    <Modal
      visible={showPrefsModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPrefsModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowPrefsModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.prefsModalContainer}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <View style={styles.prefsModalHeader}>
            <View style={styles.prefsModalIconBox}>
              <Icon
                name={notificationsEnabled ? 'bell' : 'bell-off'}
                size={24}
                color={notificationsEnabled ? colors.primary.main : colors.text.tertiary}
              />
            </View>
            <Text style={styles.prefsModalTitle}>Notification Preferences</Text>
            <TouchableOpacity
              style={styles.prefsModalCloseBtn}
              onPress={() => setShowPrefsModal(false)}
            >
              <Icon name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Preferences List */}
          <View style={styles.prefsModalContent}>
            {/* Master Toggle */}
            <View style={styles.prefItem}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconBox, { backgroundColor: notificationsEnabled ? '#DCFCE7' : '#F1F5F9' }]}>
                  <Icon
                    name={notificationsEnabled ? 'bell-ring-outline' : 'bell-off-outline'}
                    size={20}
                    color={notificationsEnabled ? '#16A34A' : '#64748B'}
                  />
                </View>
                <View style={styles.prefTextContainer}>
                  <Text style={styles.prefTitle}>Enable Notifications</Text>
                  <Text style={styles.prefDescription}>
                    {notificationsEnabled ? 'Notifications are on' : 'Notifications are off'}
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#E2E8F0', true: colors.primary.main + '60' }}
                thumbColor={notificationsEnabled ? colors.primary.main : '#94A3B8'}
              />
            </View>

            {/* Sound Toggle */}
            <View style={[styles.prefItem, !notificationsEnabled && styles.prefItemDisabled]}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconBox, { backgroundColor: soundEnabled && notificationsEnabled ? '#DBEAFE' : '#F1F5F9' }]}>
                  <Icon
                    name={soundEnabled ? 'volume-high' : 'volume-off'}
                    size={20}
                    color={soundEnabled && notificationsEnabled ? '#2563EB' : '#64748B'}
                  />
                </View>
                <View style={styles.prefTextContainer}>
                  <Text style={[styles.prefTitle, !notificationsEnabled && styles.prefTitleDisabled]}>
                    Sound
                  </Text>
                  <Text style={styles.prefDescription}>Play sound for new messages</Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleToggleSound}
                disabled={!notificationsEnabled}
                trackColor={{ false: '#E2E8F0', true: colors.primary.main + '60' }}
                thumbColor={soundEnabled && notificationsEnabled ? colors.primary.main : '#94A3B8'}
              />
            </View>

            {/* Vibration Toggle */}
            <View style={[styles.prefItem, !notificationsEnabled && styles.prefItemDisabled]}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconBox, { backgroundColor: vibrationEnabled && notificationsEnabled ? '#F3E8FF' : '#F1F5F9' }]}>
                  <Icon
                    name="vibrate"
                    size={20}
                    color={vibrationEnabled && notificationsEnabled ? '#9333EA' : '#64748B'}
                  />
                </View>
                <View style={styles.prefTextContainer}>
                  <Text style={[styles.prefTitle, !notificationsEnabled && styles.prefTitleDisabled]}>
                    Vibration
                  </Text>
                  <Text style={styles.prefDescription}>Vibrate for new messages</Text>
                </View>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={handleToggleVibration}
                disabled={!notificationsEnabled}
                trackColor={{ false: '#E2E8F0', true: colors.primary.main + '60' }}
                thumbColor={vibrationEnabled && notificationsEnabled ? colors.primary.main : '#94A3B8'}
              />
            </View>
          </View>

          {/* Status Indicator */}
          <View style={[
            styles.prefsStatusBanner,
            { backgroundColor: notificationsEnabled ? '#DCFCE7' : '#FEF2F2' }
          ]}>
            <Icon
              name={notificationsEnabled ? 'check-circle' : 'alert-circle'}
              size={16}
              color={notificationsEnabled ? '#16A34A' : '#DC2626'}
            />
            <Text style={[
              styles.prefsStatusText,
              { color: notificationsEnabled ? '#16A34A' : '#DC2626' }
            ]}>
              {notificationsEnabled
                ? 'You will receive message notifications'
                : 'You will not receive any notifications'}
            </Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Decorative background elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      {/* Left side - Menu + Logo */}
      <View style={styles.leftSection}>
        {/* Menu Button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleMenuPress}
          activeOpacity={0.7}
        >
          <Icon name="menu" size={22} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Logo and Title */}
        <View style={styles.brandContainer}>
          {/* Pabbly Icon - No background glow */}
          <PabblyIcon size={34} />

          {title ? (
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
          ) : (
            <View style={styles.brandContent}>
              {/* Visual accent line */}
              <View style={styles.accentLine} />
              <View style={styles.brandTextWrapper}>
                <Text style={styles.welcomeText}>Welcome back</Text>
                <Text style={styles.userGreeting} numberOfLines={1}>
                  {user?.first_name || 'User'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Right side - Notification + Profile */}
      {showProfile && (
        <View style={styles.rightSection}>
          {/* Notification Bell - Icon changes based on state */}
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.notificationIconContainer,
              !notificationsEnabled && styles.notificationIconContainerOff
            ]}>
              <Icon
                name={notificationsEnabled ? 'bell-outline' : 'bell-off-outline'}
                size={20}
                color={notificationsEnabled ? colors.text.secondary : '#94A3B8'}
              />
            </View>
            {/* Notification status indicator */}
            <View style={[
              styles.notificationIndicator,
              { backgroundColor: notificationsEnabled ? '#22C55E' : '#EF4444' }
            ]} />
          </TouchableOpacity>

          {/* Profile Avatar */}
          <TouchableOpacity
            onPress={handleProfilePress}
            style={styles.profileButton}
            activeOpacity={0.7}
          >
            <View style={styles.profileContainer}>
              <View style={styles.avatarRing}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                </View>
              </View>
              <View style={styles.onlineIndicator} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Notification Preferences Modal */}
      {renderNotificationPrefsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  // Decorative elements
  decorCircle1: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary.main + '08',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -40,
    left: 60,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F59E0B08',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accentLine: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: colors.primary.main,
  },
  brandTextWrapper: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  userGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notificationIconContainerOff: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notificationIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.common.white,
  },
  profileButton: {
    padding: 2,
  },
  profileContainer: {
    position: 'relative',
  },
  avatarRing: {
    padding: 2,
    borderRadius: 16,
    backgroundColor: colors.primary.main + '20',
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: colors.common.white,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  prefsModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  prefsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  prefsModalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefsModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  prefsModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefsModalContent: {
    padding: 16,
    gap: 12,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
  },
  prefItemDisabled: {
    opacity: 0.5,
  },
  prefItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  prefIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefTextContainer: {
    flex: 1,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  prefTitleDisabled: {
    color: colors.text.tertiary,
  },
  prefDescription: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  prefsStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    gap: 8,
  },
  prefsStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AppHeader;
