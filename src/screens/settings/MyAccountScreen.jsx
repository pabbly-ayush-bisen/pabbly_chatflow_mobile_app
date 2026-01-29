import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

export default function MyAccountScreen() {
  const { user, activeWaNumber, teamMemberStatus } = useSelector((state) => state.user);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');

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

  // Get full name from user object
  const getUserFullName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) {
      return user.first_name;
    }
    if (user?.name) {
      return user.name;
    }
    return 'User';
  };

  // Get role display text
  const getRoleDisplay = () => {
    if (user?.role) {
      return user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }
    return 'User';
  };

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleOpenPabblyAccount = () => {
    const url = 'https://accounts.pabbly.com/account';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          showSnackbar('Unable to open link');
        }
      })
      .catch(() => showSnackbar('Failed to open link'));
  };

  const handleOpenSubscription = () => {
    const url = 'https://accounts.pabbly.com/subscription';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          showSnackbar('Unable to open link');
        }
      })
      .catch(() => showSnackbar('Failed to open link'));
  };

  // Account info items with colors
  const accountItems = [
    {
      label: 'Full Name',
      value: getUserFullName(),
      icon: 'account-outline',
      iconColor: '#6366F1',
      iconBg: '#EEF2FF',
    },
    {
      label: 'Email Address',
      value: user?.email || 'Not available',
      icon: 'email-outline',
      iconColor: '#EC4899',
      iconBg: '#FCE7F3',
    },
    {
      label: 'Role',
      value: getRoleDisplay(),
      icon: 'shield-account-outline',
      iconColor: '#F59E0B',
      iconBg: '#FEF3C7',
    },
    {
      label: 'Active WhatsApp',
      value: activeWaNumber || 'Not Found',
      icon: 'whatsapp',
      iconColor: '#22C55E',
      iconBg: '#DCFCE7',
    },
  ];

  // Team member info (if logged in as team member)
  const isTeamMember = teamMemberStatus?.loggedIn;

  // Quick action items
  const quickActions = [
    {
      title: 'Account Settings',
      description: 'Manage your Pabbly account',
      icon: 'account-cog-outline',
      iconColor: '#3B82F6',
      iconBg: '#DBEAFE',
      onPress: handleOpenPabblyAccount,
    },
    {
      title: 'Subscription',
      description: 'View and manage your plan',
      icon: 'crown-outline',
      iconColor: '#F59E0B',
      iconBg: '#FEF3C7',
      onPress: handleOpenSubscription,
    },
    {
      title: 'Billing History',
      description: 'View invoices and payments',
      icon: 'receipt-text-outline',
      iconColor: '#8B5CF6',
      iconBg: '#EDE9FE',
      onPress: handleOpenSubscription,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Gradient Background */}
        <View style={styles.profileHeaderWrapper}>
          <LinearGradient
            colors={[colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            {/* Decorative circles */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            <View style={styles.decorCircle3} />

            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarRing}>
                {user?.profilePicture ? (
                  <View style={styles.avatarImageContainer}>
                    <Image
                      source={{ uri: user.profilePicture }}
                      style={styles.avatarImage}
                    />
                  </View>
                ) : (
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarInitials}>{getInitials()}</Text>
                  </View>
                )}
              </View>
              {/* Online indicator */}
              <View style={styles.onlineBadge}>
                <Icon name="check-decagram" size={22} color="#22C55E" />
              </View>
            </View>

            {/* User Info */}
            <Text style={styles.profileName}>{getUserFullName()}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>

            {/* Role Badge */}
            <View style={styles.roleBadgeContainer}>
              <View style={styles.roleBadge}>
                <Icon name="shield-check" size={14} color={colors.primary.main} />
                <Text style={styles.roleText}>{getRoleDisplay()}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Team Member Status Card */}
        {isTeamMember && (
          <View style={styles.teamMemberCard}>
            <LinearGradient
              colors={['#EEF2FF', '#E0E7FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamMemberGradient}
            >
              <View style={styles.teamMemberIconBox}>
                <Icon name="account-switch-outline" size={24} color="#6366F1" />
              </View>
              <View style={styles.teamMemberInfo}>
                <Text style={styles.teamMemberLabel}>Logged in as Team Member</Text>
                <Text style={styles.teamMemberName}>{teamMemberStatus.name}</Text>
                <Text style={styles.teamMemberEmail}>{teamMemberStatus.email}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#6366F1" />
            </LinearGradient>
          </View>
        )}

        {/* Account Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="account-details-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>Account Details</Text>
          </View>
          <View style={styles.infoCard}>
            {accountItems.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.infoRow,
                  index < accountItems.length - 1 && styles.infoRowBorder,
                ]}
              >
                <View style={[styles.infoIconBox, { backgroundColor: item.iconBg }]}>
                  <Icon name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
                {item.label === 'Active WhatsApp' && activeWaNumber && activeWaNumber !== 'Not Found' && (
                  <View style={styles.connectedBadge}>
                    <Icon name="check-circle" size={14} color="#22C55E" />
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="lightning-bolt-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsCard}>
            {quickActions.map((action, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: action.iconBg }]}>
                    <Icon name={action.icon} size={22} color={action.iconColor} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDesc}>{action.description}</Text>
                  </View>
                  <View style={styles.actionArrowBox}>
                    <Icon name="arrow-right" size={18} color={colors.grey[400]} />
                  </View>
                </TouchableOpacity>
                {index < quickActions.length - 1 && <View style={styles.actionDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoNoteIconBox}>
            <Icon name="information-outline" size={18} color={colors.info.main} />
          </View>
          <View style={styles.infoNoteContent}>
            <Text style={styles.infoNoteTitle}>Need to update your profile?</Text>
            <Text style={styles.infoNoteText}>
              Visit accounts.pabbly.com to manage your account settings, security, and preferences.
            </Text>
          </View>
        </View>

        {/* App Version Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Pabbly Chatflow Mobile</Text>
          <View style={styles.footerDot} />
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    paddingBottom: 80,
  },

  // Profile Header
  profileHeaderWrapper: {
    marginBottom: 20,
  },
  profileGradient: {
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary.main,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.common.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 16,
    textAlign: 'center',
  },
  roleBadgeContainer: {
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Team Member Card
  teamMemberCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  teamMemberGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  teamMemberIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberLabel: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  teamMemberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  teamMemberEmail: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },

  // Section
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  infoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },

  // Actions Card
  actionsCard: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.grey[100],
    marginHorizontal: 16,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  actionArrowBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: colors.info.lighter,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.info.light,
  },
  infoNoteIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoNoteContent: {
    flex: 1,
  },
  infoNoteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info.dark,
    marginBottom: 4,
  },
  infoNoteText: {
    fontSize: 12,
    color: colors.info.main,
    lineHeight: 18,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[300],
  },
  footerVersion: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },

  bottomSpacing: {
    height: 20,
  },

  snackbar: {
    marginBottom: 16,
  },
});
