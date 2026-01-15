import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { colors, chatColors, getAvatarColor } from '../theme/colors';
import { logout } from '../redux/slices/userSlice';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.user);

  const userName = user?.name || 'User';
  const userEmail = user?.email || 'user@example.com';
  const userPhone = user?.phone || '+1 234 567 8900';
  const userAbout = 'Hey there! I am using ChatFlow';

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const MenuItem = ({ icon, title, subtitle, onPress, showDivider = true, danger = false }) => (
    <>
      <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.menuIconContainer, danger && styles.menuIconDanger]}>
          <Icon name={icon} size={24} color={danger ? colors.error.main : chatColors.primary} />
        </View>
        <View style={styles.menuContent}>
          <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
        {!danger && <Icon name="chevron-right" size={24} color={colors.grey[400]} />}
      </TouchableOpacity>
      {showDivider && <Divider style={styles.menuDivider} />}
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.common.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(userName) }]}>
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            </View>
            <View style={styles.cameraButton}>
              <Icon name="camera" size={20} color={colors.common.white} />
            </View>
          </TouchableOpacity>

          {/* Name */}
          <TouchableOpacity style={styles.profileInfo} activeOpacity={0.7}>
            <View style={styles.profileInfoIcon}>
              <Icon name="account" size={24} color={colors.grey[500]} />
            </View>
            <View style={styles.profileInfoContent}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{userName}</Text>
            </View>
            <Icon name="pencil" size={20} color={chatColors.primary} />
          </TouchableOpacity>

          <Divider style={styles.profileDivider} />

          {/* About */}
          <TouchableOpacity style={styles.profileInfo} activeOpacity={0.7}>
            <View style={styles.profileInfoIcon}>
              <Icon name="information-outline" size={24} color={colors.grey[500]} />
            </View>
            <View style={styles.profileInfoContent}>
              <Text style={styles.profileLabel}>About</Text>
              <Text style={styles.profileValue}>{userAbout}</Text>
            </View>
            <Icon name="pencil" size={20} color={chatColors.primary} />
          </TouchableOpacity>

          <Divider style={styles.profileDivider} />

          {/* Phone */}
          <View style={styles.profileInfo}>
            <View style={styles.profileInfoIcon}>
              <Icon name="phone" size={24} color={colors.grey[500]} />
            </View>
            <View style={styles.profileInfoContent}>
              <Text style={styles.profileLabel}>Phone</Text>
              <Text style={styles.profileValue}>{userPhone}</Text>
            </View>
          </View>

          <Divider style={styles.profileDivider} />

          {/* Email */}
          <View style={styles.profileInfo}>
            <View style={styles.profileInfoIcon}>
              <Icon name="email-outline" size={24} color={colors.grey[500]} />
            </View>
            <View style={styles.profileInfoContent}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{userEmail}</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <MenuItem
            icon="bell-outline"
            title="Notifications"
            subtitle="Message, group & call tones"
            onPress={() => {}}
          />
          <MenuItem
            icon="lock-outline"
            title="Privacy"
            subtitle="Block contacts, disappearing messages"
            onPress={() => {}}
          />
          <MenuItem
            icon="database"
            title="Storage and data"
            subtitle="Network usage, auto-download"
            onPress={() => {}}
          />
          <MenuItem
            icon="translate"
            title="App language"
            subtitle="English"
            onPress={() => {}}
            showDivider={false}
          />
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <MenuItem
            icon="help-circle-outline"
            title="Help"
            subtitle="Help center, contact us, privacy policy"
            onPress={() => {}}
          />
          <MenuItem
            icon="account-multiple-plus-outline"
            title="Invite a friend"
            onPress={() => {}}
            showDivider={false}
          />
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <MenuItem
            icon="logout"
            title="Logout"
            onPress={handleLogout}
            showDivider={false}
            danger
          />
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>ChatFlow v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatColors.headerBg,
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.common.white,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },

  // Profile Section
  profileSection: {
    backgroundColor: colors.common.white,
    paddingVertical: 24,
    marginBottom: 12,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.common.white,
    fontSize: 48,
    fontWeight: '600',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: chatColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.common.white,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileInfoIcon: {
    width: 40,
    marginRight: 16,
  },
  profileInfoContent: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 13,
    color: colors.grey[500],
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 16,
    color: colors.text.primary,
  },
  profileDivider: {
    marginLeft: 76,
    backgroundColor: colors.grey[200],
  },

  // Section
  section: {
    backgroundColor: colors.common.white,
    marginBottom: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: chatColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuIconContainer: {
    width: 40,
    marginRight: 16,
  },
  menuIconDanger: {
    // No extra styling needed, color is handled inline
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    color: colors.text.primary,
  },
  menuTitleDanger: {
    color: colors.error.main,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.grey[500],
    marginTop: 2,
  },
  menuDivider: {
    marginLeft: 76,
    backgroundColor: colors.grey[200],
  },

  // Version
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 13,
    color: colors.grey[400],
  },
});
