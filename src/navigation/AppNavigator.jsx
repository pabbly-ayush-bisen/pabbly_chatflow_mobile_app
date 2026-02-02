import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { getLastNotificationResponse } from '../services/notificationService';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { Text, Divider } from 'react-native-paper';
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
import InboxSettingsScreen from '../screens/settings/InboxSettingsScreen';
import ContactCustomFieldScreen from '../screens/settings/ContactCustomFieldScreen';
import TagsScreen from '../screens/settings/TagsScreen';
import QuickRepliesScreen from '../screens/settings/QuickRepliesScreen';
import ChatRulesScreen from '../screens/settings/ChatRulesScreen';
import ConfigureSLAScreen from '../screens/settings/ConfigureSLAScreen';
import TimeZoneScreen from '../screens/settings/TimeZoneScreen';
import MyAccountScreen from '../screens/settings/MyAccountScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import InitialLoadingScreen from '../screens/InitialLoadingScreen';

// Components
import AppHeader from '../components/AppHeader';
import ChatflowLogo from '../components/ChatflowLogo';
import LogoutOverlay from '../components/LogoutOverlay';
import { NetworkAwareWrapper } from '../components/NetworkAwareWrapper';

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
  const { navigation } = props;
  const [showWebFeatures, setShowWebFeatures] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);
  const [logoutStep, setLogoutStep] = useState(0);
  const { teamMemberStatus } = useSelector((state) => state.user);
  const isTeamMemberLoggedIn = !!teamMemberStatus?.loggedIn;

  // Web-only features with correct sequence
  // Some features are hidden for team members
  // Each feature has a URL that opens chatflow.pabbly.com
  const webOnlyFeatures = [
    { title: 'Team Queue', description: 'Manage team chat queues', icon: 'account-multiple-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Explore Template', description: 'Browse template gallery', icon: 'file-search-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Broadcast', description: 'Send bulk messages to contacts', icon: 'bullhorn-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Flow', description: 'Create automated workflows', icon: 'sitemap-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Catalog', description: 'Manage product catalogs', icon: 'shopping-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Activity Log', description: 'View system activity', icon: 'history', showForTeamMember: false, url: 'https://chatflow.pabbly.com' },
    { title: 'WhatsApp Payments', description: 'Payment integration settings', icon: 'credit-card-outline', showForTeamMember: true, url: 'https://chatflow.pabbly.com' },
    { title: 'Webhook and API', description: 'Configure webhooks', icon: 'webhook', showForTeamMember: false, url: 'https://chatflow.pabbly.com' },
  ].filter(feature => isTeamMemberLoggedIn ? feature.showForTeamMember : true);

  const handleLogout = async () => {
    // Show logout overlay immediately
    setShowLogoutOverlay(true);
    setLogoutStep(0);
    navigation.closeDrawer();

    try {
      // Step 1: Saving data
      await new Promise(resolve => setTimeout(resolve, 800));
      setLogoutStep(1);

      // Step 2: Clearing session
      await new Promise(resolve => setTimeout(resolve, 600));
      setLogoutStep(2);

      // Step 3: Actually perform logout
      await dispatch(logout()).unwrap();

      // Small delay to show completing step
      await new Promise(resolve => setTimeout(resolve, 400));
    } catch (error) {
      // Error during logout - still hide overlay
    } finally {
      setShowLogoutOverlay(false);
      setLogoutStep(0);
    }
  };

  const menuItems = [
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
    <SafeAreaView style={styles.drawerContainer} edges={['top']}>
      {/* Fixed Header - Logo Only */}
      <View style={styles.drawerFixedHeader}>
        {/* Logo Section */}
        <View style={styles.drawerLogoContainer}>
          <ChatflowLogo width={130} showText={true} showIcon={true} />
        </View>
        <Divider style={styles.drawerDivider} />
      </View>

      {/* Scrollable Content - Menu Items & Available on Web */}
      <ScrollView
        style={styles.drawerScrollView}
        contentContainerStyle={styles.drawerScrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Available on Web Section - No Card, Aligned with menu items */}
        <View style={styles.drawerMenuContainer}>
          <TouchableOpacity
            style={styles.drawerMenuItem}
            onPress={() => setShowWebFeatures(!showWebFeatures)}
            activeOpacity={0.7}
          >
            <View style={[styles.drawerMenuIconBox, { backgroundColor: colors.info.main + '15' }]}>
              <Icon name="monitor" size={22} color={colors.info.main} />
            </View>
            <View style={styles.drawerMenuTextContainer}>
              <Text style={styles.drawerMenuTitle}>Available on Web</Text>
              <Text style={styles.drawerMenuDescription}>Features only on web dashboard</Text>
            </View>
            <Icon
              name={showWebFeatures ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.grey[400]}
            />
          </TouchableOpacity>

          {showWebFeatures && (
            <View style={styles.webFeaturesExpanded}>
              {webOnlyFeatures.map((feature, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.webFeatureRow}
                  onPress={() => Linking.openURL(feature.url)}
                  activeOpacity={0.7}
                >
                  <View style={styles.webFeatureIconSmall}>
                    <Icon name={feature.icon} size={18} color={colors.grey[400]} />
                  </View>
                  <View style={styles.webFeatureContent}>
                    <Text style={styles.webFeatureName}>{feature.title}</Text>
                    <Text style={styles.webFeatureDesc}>{feature.description}</Text>
                  </View>
                  <View style={styles.webBadge}>
                    <Text style={styles.webBadgeText}>Web</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.webNoteInline}
                onPress={() => Linking.openURL('https://chatflow.pabbly.com')}
                activeOpacity={0.7}
              >
                <Icon name="information-outline" size={14} color={colors.info.main} />
                <Text style={styles.webNoteText}>Visit chatflow.pabbly.com for full access</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Footer - Logout */}
      <SafeAreaView edges={['bottom']} style={styles.drawerFixedFooter}>
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
      </SafeAreaView>

      {/* Logout Overlay */}
      <LogoutOverlay visible={showLogoutOverlay} currentStep={logoutStep} />
    </SafeAreaView>
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

// Modern Colorful Tab Bar Component
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  // Get unread count from inbox chats
  const chats = useSelector((state) => state.inbox?.chats || []);
  const totalUnreadCount = chats.reduce((count, chat) => {
    return count + (chat.unreadCount || 0);
  }, 0);

  // Tab configuration with colorful icons
  const tabConfig = {
    DashboardTab: {
      icon: 'home',
      iconOutline: 'home-outline',
      label: 'Home',
      color: '#6366F1', // Indigo
      bgColor: '#EEF2FF',
    },
    InboxTab: {
      icon: 'chat',
      iconOutline: 'chat-outline',
      label: 'Inbox',
      color: '#10B981', // Emerald
      bgColor: '#ECFDF5',
    },
    ContactsTab: {
      icon: 'account-group',
      iconOutline: 'account-group-outline',
      label: 'Contacts',
      color: '#F59E0B', // Amber
      bgColor: '#FEF3C7',
    },
    TemplatesTab: {
      icon: 'file-document',
      iconOutline: 'file-document-outline',
      label: 'Templates',
      color: '#8B5CF6', // Violet
      bgColor: '#F3E8FF',
    },
    MoreTab: {
      icon: 'dots-horizontal-circle',
      iconOutline: 'dots-horizontal-circle-outline',
      label: 'More',
      color: '#64748B', // Slate
      bgColor: '#F1F5F9',
    },
  };

  return (
    <View style={[
      styles.tabBarWrapper,
      { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8 }
    ]}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const config = tabConfig[route.name] || {};
          const label = config.label || options.tabBarLabel || route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconWrapper}>
                {isFocused && (
                  <View style={[styles.tabIconBackground, { backgroundColor: config.bgColor }]} />
                )}
                <Icon
                  name={isFocused ? config.icon : config.iconOutline}
                  size={26}
                  color={isFocused ? config.color : '#9CA3AF'}
                />
                {/* Unread count badge for Inbox tab */}
                {route.name === 'InboxTab' && totalUnreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.tabLabel,
                isFocused && { color: config.color, fontWeight: '600' }
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
        name="InboxSettings"
        component={InboxSettingsScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Inbox Settings')}
      />
      <MoreStack.Screen
        name="ContactCustomField"
        component={ContactCustomFieldScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Contact Custom Field')}
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
        name="ChatRules"
        component={ChatRulesScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Chat Rules')}
      />
      <MoreStack.Screen
        name="ConfigureSLA"
        component={ConfigureSLAScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Configure SLA')}
      />
      <MoreStack.Screen
        name="TimeZone"
        component={TimeZoneScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'Time Zone')}
      />
      <MoreStack.Screen
        name="MyAccount"
        component={MyAccountScreen}
        options={({ navigation }) => getChildScreenOptions(navigation, 'My Account')}
      />
    </MoreStack.Navigator>
  );
}

// Bottom Tab Navigator for main app - modern floating tab bar
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
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
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Reset the MoreTab stack to its initial screen when tab is pressed
            navigation.navigate('MoreTab', { screen: 'MoreMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

// Drawer Navigator wrapping the tabs - simplified since screens are now in tab stacks
function DrawerNavigator() {
  return (
    <NetworkAwareWrapper>
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
    </NetworkAwareWrapper>
  );
}

// Import navigation utilities from separate file to avoid circular dependencies
import { navigationRef, navigate } from './navigationUtils';

// Re-export for backward compatibility
export { navigationRef, navigate };

// Minimum time to show loading screen after login (in milliseconds)
const MINIMUM_LOADING_TIME = 3000;

// Main App Navigator - ChatDetailsScreen is at root level to hide tabs
export default function AppNavigator() {
  // Use 'authenticated' instead of 'isAuthenticated' to match web app
  const authenticated = useSelector((state) => state?.user?.authenticated ?? false);
  const checkSessionStatus = useSelector((state) => state?.user?.checkSessionStatus ?? 'idle');
  const settingId = useSelector((state) => state?.user?.settingId);

  // Track if we should show loading screen after login
  const [showLoadingScreen, setShowLoadingScreen] = React.useState(false);
  // Track if session check failed (meaning user needs to login manually)
  const [sessionCheckFailed, setSessionCheckFailed] = React.useState(false);

  // Track when session check fails - this means user will see login screen
  React.useEffect(() => {
    if (checkSessionStatus === 'failed') {
      setSessionCheckFailed(true);
    }
  }, [checkSessionStatus]);

  // Detect fresh login: when user becomes authenticated AFTER session check failed
  // This means user was on login screen and just logged in (not session restore)
  React.useEffect(() => {
    if (sessionCheckFailed && authenticated) {
      // User was on login screen and now authenticated = fresh login
      // Log:('[AppNavigator] Fresh login detected - showing loading screen for 3 seconds');
      setShowLoadingScreen(true);
      setSessionCheckFailed(false); // Reset so it doesn't trigger again

      // Hide loading screen after 3 seconds
      const timer = setTimeout(() => {
        // Log:('[AppNavigator] 3 seconds elapsed - hiding loading screen');
        setShowLoadingScreen(false);
      }, MINIMUM_LOADING_TIME);

      return () => clearTimeout(timer);
    }
  }, [authenticated, sessionCheckFailed]);

  // Reset on logout
  React.useEffect(() => {
    if (!authenticated) {
      setShowLoadingScreen(false);
      setSessionCheckFailed(false);
    }
  }, [authenticated]);

  // Determine if we should show the loading screen
  const isInitialLoading = authenticated && showLoadingScreen;

  // Check if app was opened from a notification
  useEffect(() => {
    const checkInitialNotification = async () => {
      if (!authenticated) return;

      try {
        const response = await getLastNotificationResponse();
        if (response?.notification?.request?.content?.data?.chatId) {
          const chatId = response.notification.request.content.data.chatId;
          // Log:('[AppNavigator] App opened from notification, navigating to chat:', chatId);

          // Small delay to ensure navigation is ready
          setTimeout(() => {
            navigate('ChatDetails', { chatId });
          }, 500);
        }
      } catch (error) {
        // Log:('[AppNavigator] Error checking initial notification:', error);
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
        ) : isInitialLoading ? (
          <Stack.Screen name="InitialLoading" component={InitialLoadingScreen} />
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
  // Modern Colorful Tab Bar
  tabBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 0 : -30,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
        borderTopWidth: 0.5,
        borderTopColor: '#D1D5DB',
      },
    }),
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingTop: Platform.OS === 'android' ? 6 : 8,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'android' ? 6 : 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
  },
  tabIconWrapper: {
    width: Platform.OS === 'android' ? 52 : 56,
    height: Platform.OS === 'android' ? 32 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  tabIconBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: Platform.OS === 'android' ? 11 : 10,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  // Back Button Style
  backButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
  },
  // Drawer Styles
  drawerContainer: {
    flex: 1,
    backgroundColor: colors.common.white,
  },
  drawerFixedHeader: {
    backgroundColor: colors.common.white,
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingBottom: 10,
  },
  drawerFixedFooter: {
    backgroundColor: colors.common.white,
  },
  drawerLogoContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  drawerDivider: {
    backgroundColor: colors.grey[200],
    marginHorizontal: 16,
  },
  drawerMenuContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  // Web Features Expanded (minimal indentation)
  webFeaturesExpanded: {
    marginLeft: 20,
    paddingRight: 4,
    paddingTop: 4,
  },
  webFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  webFeatureIconSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.grey[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFeatureContent: {
    flex: 1,
  },
  webFeatureName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  webFeatureDesc: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  webBadge: {
    backgroundColor: colors.grey[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  webBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  webNoteInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 4,
    gap: 6,
  },
  webNoteText: {
    fontSize: 11,
    color: colors.info.main,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error.main,
  },
});
