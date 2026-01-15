import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PabblyIcon from './PabblyIcon';
import { colors } from '../theme/colors';

const AppHeader = ({ showProfile = true, title, subtitle }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.user);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogoPress = () => {
    // Open the drawer navigation
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleProfilePress = () => {
    // Navigate to profile or settings using correct nested navigation path
    navigation.navigate('MainTabs', {
      screen: 'MoreTab',
      params: { screen: 'Settings' },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Left side - Logo (Touchable to open drawer) */}
      <TouchableOpacity
        style={styles.leftSection}
        onPress={handleLogoPress}
        activeOpacity={0.7}
      >
        <PabblyIcon size={36} />
        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
      </TouchableOpacity>

      {/* Right side - Profile */}
      {showProfile && (
        <TouchableOpacity
          onPress={handleProfilePress}
          style={styles.profileButton}
          activeOpacity={0.7}
        >
          <View style={styles.profileContainer}>
            {user?.profilePicture ? (
              <Avatar.Image
                size={40}
                source={{ uri: user.profilePicture }}
              />
            ) : (
              <Avatar.Text
                size={40}
                label={getInitials(user?.name || user?.email)}
                style={styles.avatarText}
                labelStyle={styles.avatarLabel}
              />
            )}
            <View style={styles.onlineIndicator} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[200],
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleContainer: {
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  profileButton: {
    padding: 4,
  },
  profileContainer: {
    position: 'relative',
  },
  avatarText: {
    backgroundColor: colors.primary.main,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success.main,
    borderWidth: 2,
    borderColor: colors.common.white,
  },
});

export default AppHeader;
