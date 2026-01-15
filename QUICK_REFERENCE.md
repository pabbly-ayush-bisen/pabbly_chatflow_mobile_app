# Quick Reference Guide - Pabbly Chatflow Mobile App

## 🚀 Quick Start

```bash
cd chatflow_mobile_native
npm start
```

Then scan QR code with Expo Go (Android) or Camera (iOS)

---

## 📂 Important File Locations

### **Redux Slices**
```
src/redux/slices/
├── userSlice.jsx         # Authentication
├── dashboardSlice.jsx    # Dashboard & WhatsApp numbers
├── inboxSlice.jsx        # Chats & messages
├── contactSlice.jsx      # Contacts & lists
├── templateSlice.jsx     # Templates
├── broadcastSlice.jsx    # Broadcasts
├── assistantSlice.jsx    # AI Assistants
└── settingsSlice.jsx     # Settings
```

### **Main Screens**
```
src/screens/
├── DashboardScreen.jsx
├── InboxScreen.jsx
├── ChatDetailsScreen.jsx
├── ContactsScreen.jsx
├── TemplatesScreen.jsx
├── BroadcastScreen.jsx
├── AIAssistantScreen.jsx
├── SettingsScreen.jsx
└── GetHelpScreen.jsx
```

### **Settings Screens**
```
src/screens/settings/
├── OptInManagementScreen.jsx
├── UserAttributesScreen.jsx
├── TagsScreen.jsx
├── QuickRepliesScreen.jsx
└── TeamMemberScreen.jsx
```

### **Configuration**
```
src/config/app.config.jsx     # App configuration & API URL
src/utils/axios.jsx           # API service & endpoints
src/navigation/AppNavigator.jsx   # Navigation setup
src/redux/store.jsx           # Redux store
```

---

## 🔌 API Configuration

### **Change API URL**
Edit `src/config/app.config.jsx`:
```javascript
apiUrl: __DEV__ ? 'http://YOUR_LOCAL_IP:1337' : 'https://api.pabbly.com'
```

**For Android Emulator:** Use `10.0.2.2` instead of `localhost`
**For iOS Simulator:** Use `localhost`
**For Physical Device:** Use your computer's IP address

---

## 📱 Screen Features Matrix

| Screen | View | Create | Edit | Delete | Search | Refresh |
|--------|------|--------|------|--------|--------|---------|
| Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Inbox | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contacts | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Templates | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Broadcast | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| AI Assistant | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Opt-in Mgmt | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| User Attributes | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tags | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Quick Replies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team Members | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🎨 Theme Colors

```javascript
Primary:   #0C68E9
Secondary: #8E33FF
Success:   #22C55E
Warning:   #FFAB00
Error:     #FF5630
```

Import in any component:
```javascript
import { colors } from '../theme';
```

---

## 🔄 Redux Usage Pattern

### **Dispatch Action**
```javascript
import { useDispatch } from 'react-redux';
import { getContacts } from '../redux/slices/contactSlice';

const dispatch = useDispatch();

// Call API
dispatch(getContacts({ page: 1, limit: 20 }));
```

### **Select State**
```javascript
import { useSelector } from 'react-redux';

const { contacts, loading, error } = useSelector(state => state.contact);
```

### **Complete Example**
```javascript
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getContacts } from '../redux/slices/contactSlice';

function MyComponent() {
  const dispatch = useDispatch();
  const { contacts, loading } = useSelector(state => state.contact);

  useEffect(() => {
    dispatch(getContacts());
  }, []);

  if (loading) return <ActivityIndicator />;

  return <FlatList data={contacts} />;
}
```

---

## 🧭 Navigation

### **Navigate to Screen**
```javascript
navigation.navigate('ChatDetails', { chatId: '123' });
```

### **Go Back**
```javascript
navigation.goBack();
```

### **Get Route Params**
```javascript
const { chatId } = route.params;
```

---

## 📊 Common Components

### **Loading State**
```javascript
import { ActivityIndicator } from 'react-native-paper';

{loading && <ActivityIndicator size="large" color={colors.primary.main} />}
```

### **Error State**
```javascript
import { Surface, Text } from 'react-native-paper';

{error && (
  <Surface style={styles.errorSurface}>
    <Text style={styles.errorText}>{error}</Text>
  </Surface>
)}
```

### **Empty State**
```javascript
{data.length === 0 && (
  <View style={styles.emptyState}>
    <Text variant="bodyLarge">No items found</Text>
  </View>
)}
```

### **Pull to Refresh**
```javascript
import { RefreshControl } from 'react-native';

<FlatList
  data={data}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  }
/>
```

---

## 🐛 Common Issues & Solutions

### **Issue: App won't start**
**Solution:**
```bash
npm start -- --clear
```

### **Issue: Can't connect to API**
**Solution:**
1. Check API URL in `app.config.jsx`
2. Use correct IP (10.0.2.2 for Android emulator)
3. Ensure backend is running
4. Check network connectivity

### **Issue: Redux state not updating**
**Solution:**
1. Check if thunk is dispatched
2. Verify API response format
3. Check Redux DevTools
4. Ensure reducer is handling action

### **Issue: Navigation not working**
**Solution:**
1. Check screen is registered in AppNavigator
2. Verify screen name spelling
3. Check if auth state is correct

---

## 📝 Adding a New Screen

1. **Create screen file:**
```javascript
// src/screens/MyNewScreen.jsx
import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function MyNewScreen() {
  return (
    <View>
      <Text>My New Screen</Text>
    </View>
  );
}
```

2. **Add to navigation:**
```javascript
// src/navigation/AppNavigator.jsx
import MyNewScreen from '../screens/MyNewScreen';

// Add to stack:
<Stack.Screen
  name="MyNewScreen"
  component={MyNewScreen}
  options={{ title: 'My Screen' }}
/>
```

3. **Navigate to it:**
```javascript
navigation.navigate('MyNewScreen');
```

---

## 🔐 Authentication Flow

```
1. User enters credentials
   ↓
2. LoginScreen dispatches signIn()
   ↓
3. signIn() calls API via axios
   ↓
4. Token saved to AsyncStorage
   ↓
5. Redux state updated (isAuthenticated: true)
   ↓
6. AppNavigator renders MainTabs
```

---

## 📦 Build Commands

### **Development**
```bash
npm start              # Start dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run web            # Run on web
```

### **Clear Cache**
```bash
npm start -- --clear   # Clear Metro bundler cache
```

### **Production Build** (when ready)
```bash
eas build --platform android
eas build --platform ios
```

---

## 🎯 Testing Checklist

- [ ] Login/Logout works
- [ ] Dashboard loads stats
- [ ] Inbox shows chats
- [ ] Can send messages
- [ ] Can add contact
- [ ] Templates display correctly
- [ ] Can create broadcast
- [ ] Settings save properly
- [ ] Navigation works smoothly
- [ ] Pull-to-refresh works
- [ ] Search works
- [ ] Error handling works

---

## 📞 Quick Help

**Documentation:** See `/docs` folder
**Issues:** Check error logs in Metro bundler
**Redux:** Use Redux DevTools extension
**Navigation:** Use React Navigation Debugger

---

## 🎨 Styling Tips

### **Use Theme Colors**
```javascript
import { colors } from '../theme';

backgroundColor: colors.primary.main
color: colors.text.primary
borderColor: colors.divider
```

### **Consistent Spacing**
```javascript
padding: 16,
marginBottom: 12,
gap: 8,
```

### **Common Styles**
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
});
```

---

## 🔄 Update Flow

### **Pull Latest Code**
```bash
git pull origin main
npm install
npm start -- --clear
```

### **Add New Dependency**
```bash
npm install package-name
```

### **Update Dependencies**
```bash
npm update
```

---

**Need More Help?** Check the full documentation or contact support!
