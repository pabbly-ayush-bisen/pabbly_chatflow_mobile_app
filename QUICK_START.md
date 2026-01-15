# Quick Start Guide - Pabbly Chatflow Mobile App

## 🚀 Getting Started (5 minutes)

### Step 1: Navigate to Project
```bash
cd chatflow_mobile_native
```

### Step 2: Start Development Server
```bash
npm start
```

This will:
- Start Metro bundler
- Show QR code in terminal
- Open Expo DevTools in browser

### Step 3: Run on Your Device

#### Option A: Using Expo Go App (Easiest)
1. Download **Expo Go** from:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Scan the QR code:
   - **iOS**: Use Camera app
   - **Android**: Use Expo Go app

#### Option B: Using Emulator/Simulator

**For Android:**
```bash
npm run android
```

**For iOS (macOS only):**
```bash
npm run ios
```

**For Web:**
```bash
npm run web
```

## 📱 Testing the App

Once the app loads, you'll see:

1. **Login Screen** (default)
   - Email and password fields
   - Remember me checkbox
   - Forgot password link

2. **Main App** (after login - currently bypassed for testing)
   - **Home Tab**: Dashboard with stats and quick actions
   - **Chats Tab**: List of conversations
   - **Flows Tab**: Automated workflows
   - **Contacts Tab**: Contact management
   - **Profile Tab**: User settings and preferences

## 🎨 What's Included

### Theme
- ✅ Colors matching MUI Minimal theme
- ✅ Typography configuration
- ✅ Light theme (dark theme ready)

### Screens
- ✅ Login/Authentication
- ✅ Home/Dashboard
- ✅ Chats with search
- ✅ Flows with status
- ✅ Contacts with actions
- ✅ Profile with settings

### Navigation
- ✅ Bottom tabs (5 screens)
- ✅ Stack navigation
- ✅ Icons and labels

### Utilities
- ✅ API service with interceptors
- ✅ Helper functions
- ✅ Configuration management

## 🛠️ Common Commands

```bash
# Start development server
npm start

# Clear cache and start
npm start -- --clear

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web

# Install new package
npm install package-name
```

## 📝 Making Changes

### 1. Edit Screens
Navigate to `src/screens/` and edit any screen file:
- `HomeScreen.js`
- `ChatsScreen.js`
- `FlowsScreen.js`
- `ContactsScreen.js`
- `ProfileScreen.js`

### 2. Update Theme Colors
Edit `src/theme/colors.js` to change color scheme.

### 3. Add New Screens
1. Create new screen in `src/screens/`
2. Add to navigation in `src/navigation/AppNavigator.js`

### 4. API Integration
Update `src/services/api.service.js` with your endpoints.

## 🔧 Configuration

### Backend API URL
Edit `src/config/app.config.js`:
```javascript
apiUrl: 'http://localhost:1337' // Change to your API URL
```

### App Name & Version
Edit `app.json`:
```json
{
  "name": "Pabbly Chatflow",
  "version": "1.0.0"
}
```

## 📂 Project Structure

```
chatflow_mobile_native/
├── src/
│   ├── config/            # App configuration
│   ├── navigation/        # Navigation setup
│   ├── screens/          # All screen components
│   │   ├── auth/         # Auth screens
│   │   └── ...           # Main screens
│   ├── services/         # API services
│   ├── theme/            # Theme configuration
│   └── utils/            # Helper functions
├── App.js                # Main entry point
├── package.json
└── README.md
```

## 🎯 Next Steps

1. **Enable Authentication**
   - In `src/navigation/AppNavigator.js`, change:
   ```javascript
   const isAuthenticated = false; // Change to true or connect to auth state
   ```

2. **Connect to API**
   - Update API URL in config
   - Implement actual API calls
   - Handle responses and errors

3. **Add Real Data**
   - Replace dummy data with API calls
   - Implement loading states
   - Add error handling

4. **Customize UI**
   - Match exact design from AiSensy
   - Add custom components
   - Fine-tune styling

5. **Add Features**
   - Push notifications
   - Real-time messaging
   - File uploads
   - Offline support

## 🐛 Troubleshooting

### Metro bundler not starting
```bash
npm start -- --clear
```

### Port already in use
```bash
# Kill process on port 8081
npx kill-port 8081
npm start
```

### Dependency issues
```bash
rm -rf node_modules package-lock.json
npm install
```

### Expo Go connection issues
- Ensure phone and computer are on same WiFi
- Try scanning QR code again
- Use tunnel connection: `npm start -- --tunnel`

## 📚 Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [React Navigation](https://reactnavigation.org/)

## 💡 Tips

1. **Hot Reload**: Changes auto-reload in app
2. **Shake Device**: Opens developer menu
3. **Console Logs**: View in terminal where `npm start` is running
4. **Inspect Element**: Use React Native Debugger

## 🎉 You're Ready!

The app is now running with:
- ✅ Material Design UI
- ✅ 5 main screens
- ✅ Navigation setup
- ✅ Theme matching web app
- ✅ Ready for API integration

Start building amazing features! 🚀
