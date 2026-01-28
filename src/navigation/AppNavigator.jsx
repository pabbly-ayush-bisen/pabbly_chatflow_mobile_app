import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { getLastNotificationResponse } from '../services/notificationService';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { Text, Divider, Avatar } from 'react-native-paper';
import { colors } from '../theme';
import { logout } from '../redux/slices/userSlice';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import InboxScreen from '../screens/InboxScreen';
import ChatDetailsScreen from '../screens/ChatDetailsScreen';
import ContactInfoScreen from '../screens/ContactInfoScreen';
import ContactsScreen from '../screens/ContactsScreen';
import AddContactScreen from '../screens/AddContactScreen';
import TemplatesScreen from '../screens/TemplatesScreen';
import BroadcastScreen from '../screens/BroadcastScreen';
import CreateBroadcastScreen from '../screens/CreateBroadcastScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GetHelpScreen from '../screens/GetHelpScreen';

// Settings screens
import OptInManagementScreen from '../screens/settings/OptInManagementScreen';
import UserAttributesScreen from '../screens/settings/UserAttributesScreen';
import TagsScreen from '../screens/settings/TagsScreen';
import QuickRepliesScreen from '../screens/settings/QuickRepliesScreen';
import TeamMemberScreen from '../screens/settings/TeamMemberScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';

// Components
import AppHeader from '../components/AppHeader';
import ChatflowLogo from '../components/ChatflowLogo';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Stack navigators for each tab to allow sub-screens while keeping tabs visible
const DashboardStack = createStackNavigator();
const InboxStack = createStackNavigator();
const ContactsStack = createStackNavigator();
const TemplatesStack = createStackNavigator();
const MoreStack = createStackNavigator();

// Custom Drawer Content
function CustomDrawerContent(props) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.user);
  const { navigation } = props;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      title: 'Broadcast',
      description: 'Send messages to multiple contacts',
      icon: 'bullhorn-outline',
      onPress: () => {
        navigation.closeDrawer();
        navigation.navigate('MainTabs', {
          screen: 'MoreTab',
          params: { screen: 'Broadcast' },
        });
      },
      color: colors.warning.main,
    },
    {
      title: 'AI Assistant',
      description: 'Manage AI assistants',
      icon: 'robot-outline',
      onPress: () => {
        navigation.closeDrawer();
        navigation.navigate('MainTabs', {
          screen: 'MoreTab',
          params: { screen: 'AIAssistant' },
        });
      },
      color: colors.secondary.main,
    },
    {
      title: 'Settings',
      description: 'App settings and preferences',
      icon: 'cog-outline',
      onPress: () => {
        navigation.closeDrawer();
        navigation.navigate('MainTabs', {
          screen: 'MoreTab',
          params: { screen: 'Settings' },
        });
      },
      color: colors.grey[600],
    },
    {
      title: 'Get Help',
      description: 'Help & support',
      icon: 'help-circle-outline',
      onPress: () => {
        navigation.closeDrawer();
        navigation.navigate('MainTabs', {
          screen: 'MoreTab',
          params: { screen: 'GetHelp' },
        });
      },
      color: colors.success.main,
    },
  ];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      {/* User Profile Section */}
      <View style={styles.drawerHeader}>
        <View style={styles.drawerLogoRow}>
          <ChatflowLogo width={140} showText={true} showIcon={true} />
        </View>
        <View style={styles.drawerUserSection}>
          {user?.profilePicture ? (
            <Avatar.Image size={56} source={{ uri: user.profilePicture }} />
          ) : (
            <Avatar.Text
              size={56}
              label={getInitials(user?.name || user?.email)}
              style={styles.drawerAvatar}
              labelStyle={styles.drawerAvatarLabel}
            />
          )}
          <View style={styles.drawerUserInfo}>
            <Text style={styles.drawerUserName} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <Text style={styles.drawerUserEmail} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
        </View>
      </View>

      <Divider style={styles.drawerDivider} />

      {/* Menu Items */}
      <View style={styles.drawerMenuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.drawerMenuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.drawerMenuIconBox, { backgroundColor: item.color + '15' }]}>
              <Icon name={item.icon} size={22} color={item.color} />
            </View>
            <View style={styles.drawerMenuTextContainer}>
              <Text style={styles.drawerMenuTitle}>{item.title}</Text>
              <Text style={styles.drawerMenuDescription}>{item.description}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.grey[400]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Spacer */}
      <View style={styles.drawerSpacer} />

      {/* Logout Button */}
      <View style={styles.drawerFooter}>
        <Divider style={styles.drawerDivider} />
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.drawerMenuIconBox, { backgroundColor: colors.error.main + '15' }]}>
            <Icon name="logout" size={22} color={colors.error.main} />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

// Templates with Header wrapper
function TemplatesWithHeader() {
  return (
    <View style={styles.screenContainer}>
      <AppHeader title="Templates" subtitle="WhatsApp templates" />
      <TemplatesScreen />
    </View>
  );
}

// Dashboard with Header wrapper
function DashboardWithHeader() {
  return (
    <View style={styles.screenContainer}>
      <AppHeader />
      <DashboardScreen />
    </View>
  );
}

// Contacts with Header wrapper
function ContactsWithHeader() {
  return (
    <View style={styles.screenContainer}>
      <AppHeader title="Contacts" subtitle="Manage your contacts" />
      <ContactsScreen />
    </View>
  );
}

// Custom Tab Bar Icon component
const TabIcon = ({ name, focused, color }) => {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconContainerActive]}>
      <Icon name={name} size={24} color={color} />
    </View>
  );
};

// Custom Back Button component for better UX
const BackButton = ({ onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.backButton}
    activeOpacity={0.7}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Icon name="arrow-left" size={24} color={colors.text.primary} />
  </TouchableOpacity>
);

// Common header style options for stack screens with back button
const commonHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.common.white,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[200],
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: { fontWeight: '700', fontSize: 18 },
  headerBackTitleVisible: false,
  headerLeftContainerStyle: { paddingLeft: 8 },
};

// Header options with custom back button for child screens
const getChildScreenOptions = (navigation, title) => ({
  headerShown: true,
  ...commonHeaderOptions,
  title,
  headerLeft: () => (
    <BackButton onPress={() => navigation.goBack()} />
  ),
});

// Dashboard Tab Stack - includes dashboard and related screens
function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="DashboardMain" component={DashboardWithHeader} />
    </DashboardStack.Navigator>
  );
}

// Inbox Tab Stack - only includes inbox list (chat details moved to root stack)
function InboxStackNavigator() {
  return (
    <InboxStack.Navigator screenOptions={{ headerShown: false }}>
      <InboxStack.Screen name="InboxMain" component={InboxScreen} />
    </InboxStack.Navigator>
  );
}

// Contacts Tab Stack - includes contacts and add contact
function ContactsStackNavigator() {
  return (
    <ContactsStack.Navigator screenOptions={{ headerShown: false }}>
      <ContactsStack.Screen name="ContactsMain" component={ContactsWithHeader} />
      <ContactsStack.Screen
        name="AddContact"
        component={AddContactScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Add Contact')}
      />
    </ContactsStack.Navigator>
  );
}

// Templates Tab Stack
function TemplatesStackNavigator() {
  return (
    <TemplatesStack.Navigator screenOptions={{ headerShown: false }}>
      <TemplatesStack.Screen name="TemplatesMain" component={TemplatesWithHeader} />
    </TemplatesStack.Navigator>
  );
}

// More Tab Stack - includes settings, broadcast, AI assistant, etc.
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: true, ...commonHeaderOptions }}>
      <MoreStack.Screen
        name="MoreMain"
        component={SettingsScreen}
        options={{ title: 'More' }}
      />
      <MoreStack.Screen
        name="Broadcast"
        component={BroadcastScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Broadcast')}
      />
      <MoreStack.Screen
        name="CreateBroadcast"
        component={CreateBroadcastScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Create Broadcast')}
      />
      <MoreStack.Screen
        name="AIAssistant"
        component={AIAssistantScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'AI Assistant')}
      />
      <MoreStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Settings')}
      />
      <MoreStack.Screen
        name="GetHelp"
        component={GetHelpScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Get Help')}
      />
      <MoreStack.Screen
        name="OptInManagement"
        component={OptInManagementScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Opt-in Management')}
      />
      <MoreStack.Screen
        name="UserAttributes"
        component={UserAttributesScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'User Attributes')}
      />
      <MoreStack.Screen
        name="Tags"
        component={TagsScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Tags')}
      />
      <MoreStack.Screen
        name="QuickReplies"
        component={QuickRepliesScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Quick Replies')}
      />
      <MoreStack.Screen
        name="TeamMember"
        component={TeamMemberScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Team Members')}
      />
    </MoreStack.Navigator>
  );
}

// Bottom Tab Navigator for main app - tabs visible on all screens
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'DashboardTab') {
            iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          } else if (route.name === 'InboxTab') {
            iconName = focused ? 'message' : 'message-outline';
          } else if (route.name === 'ContactsTab') {
            iconName = focused ? 'account-group' : 'account-group-outline';
          } else if (route.name === 'TemplatesTab') {
            iconName = focused ? 'file-document' : 'file-document-outline';
          } else if (route.name === 'MoreTab') {
            iconName = focused ? 'dots-horizontal-circle' : 'dots-horizontal-circle-outline';
          }

          return <TabIcon name={iconName} focused={focused} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.grey[500],
        tabBarStyle: {
          backgroundColor: colors.common.white,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          shadowColor: colors.common.black,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="InboxTab"
        component={InboxStackNavigator}
        options={{
          tabBarLabel: 'Inbox',
          tabBarBadge: undefined,
        }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsStackNavigator}
        options={{
          tabBarLabel: 'Contacts',
        }}
      />
      <Tab.Screen
        name="TemplatesTab"
        component={TemplatesStackNavigator}
        options={{
          tabBarLabel: 'Templates',
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
}

// Drawer Navigator wrapping the tabs - simplified since screens are now in tab stacks
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.common.white,
          width: 300,
        },
        drawerType: 'front',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabs} />
    </Drawer.Navigator>
  );
}

// Navigation reference for use outside components
export const navigationRef = React.createRef();

// Navigate to a screen from outside a component
export const navigate = (name, params) => {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
};

// Main App Navigator - ChatDetailsScreen is at root level to hide tabs
export default function AppNavigator() {
  // Use 'authenticated' instead of 'isAuthenticated' to match web app
  const authenticated = useSelector((state) => state?.user?.authenticated ?? false);

  React.useEffect(() => {
    console.log('AppNavigator - authenticated:', authenticated);
  }, [authenticated]);

  // Check if app was opened from a notification
  useEffect(() => {
    const checkInitialNotification = async () => {
      if (!authenticated) return;

      try {
        const response = await getLastNotificationResponse();
        if (response?.notification?.request?.content?.data?.chatId) {
          const chatId = response.notification.request.content.data.chatId;
          console.log('[AppNavigator] App opened from notification, navigating to chat:', chatId);

          // Small delay to ensure navigation is ready
          setTimeout(() => {
            navigate('ChatDetails', { chatId });
          }, 500);
        }
      } catch (error) {
        console.log('[AppNavigator] Error checking initial notification:', error);
      }
    };

    checkInitialNotification();
  }, [authenticated]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current, layouts }) => ({
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          }),
        }}
      >
        {!authenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="DrawerNav" component={DrawerNavigator} />
            <Stack.Screen
              name="ChatDetails"
              component={ChatDetailsScreen}
              options={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            />
            <Stack.Screen
              name="ContactInfo"
              component={ContactInfoScreen}
              options={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabIconContainer: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconContainerActive: {
    backgroundColor: colors.primary.lighter,
  },
  // Back Button Style
  backButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
  },
  // Drawer Styles
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    padding: 20,
    paddingTop: 16,
  },
  drawerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerAvatar: {
    backgroundColor: colors.primary.main,
  },
  drawerAvatarLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  drawerUserInfo: {
    flex: 1,
  },
  drawerUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  drawerUserEmail: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  drawerDivider: {
    backgroundColor: colors.grey[200],
    marginHorizontal: 16,
  },
  drawerMenuContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  drawerMenuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerMenuTextContainer: {
    flex: 1,
  },
  drawerMenuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  drawerMenuDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  drawerSpacer: {
    flex: 1,
  },
  drawerFooter: {
    paddingBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 12,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error.main,
  },
});
