# Pabbly Chatflow Mobile App

A cross-platform mobile application for Pabbly Chatflow built with React Native and Expo.

## Features

- **Cross-Platform**: Works on both iOS and Android
- **Material Design**: UI built with React Native Paper
- **Theme**: Matches the MUI Minimal theme from the web app
- **Navigation**: Tab-based navigation similar to AiSensy app
- **Screens**:
  - Home/Dashboard
  - Chats
  - Flows (Automated workflows)
  - Contacts
  - Profile & Settings
  - Login/Authentication

## Tech Stack

- **React Native** with Expo
- **React Native Paper** - Material Design components
- **React Navigation** - Navigation library
- **Axios** - HTTP client
- **AsyncStorage** - Local storage
- **date-fns** - Date utilities

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo Go app on your mobile device (for testing)
- For iOS development: macOS with Xcode
- For Android development: Android Studio

## Installation

1. Navigate to the project directory:
```bash
cd chatflow_mobile_native
```

2. Install dependencies (if not already installed):
```bash
npm install
```

## Running the App

### Start the development server:
```bash
npm start
```

This will start the Expo development server and show a QR code.

### Run on Android:
```bash
npm run android
```

Or scan the QR code with the Expo Go app on your Android device.

### Run on iOS:
```bash
npm run ios
```

Or scan the QR code with the Camera app on your iOS device.

### Run on Web:
```bash
npm run web
```

## Project Structure

```
chatflow_mobile_native/
├── src/
│   ├── components/         # Reusable components
│   ├── config/            # App configuration
│   ├── navigation/        # Navigation setup
│   │   └── AppNavigator.js
│   ├── screens/           # Screen components
│   │   ├── auth/
│   │   │   └── LoginScreen.js
│   │   ├── ChatsScreen.js
│   │   ├── ContactsScreen.js
│   │   ├── FlowsScreen.js
│   │   ├── HomeScreen.js
│   │   └── ProfileScreen.js
│   ├── services/          # API services
│   ├── theme/             # Theme configuration
│   │   ├── colors.js
│   │   ├── typography.js
│   │   ├── theme.js
│   │   └── index.js
│   └── utils/             # Utility functions
├── App.js                 # Main app entry point
└── package.json
```

## Theme Configuration

The theme matches the MUI Minimal theme from the web app:

- **Primary Color**: #0C68E9 (Blue)
- **Secondary Color**: #8E33FF (Purple)
- **Success Color**: #22C55E (Green)
- **Warning Color**: #FFAB00 (Orange)
- **Error Color**: #FF5630 (Red)

## Next Steps

1. **API Integration**: Connect to backend APIs
2. **Authentication**: Implement JWT/OAuth authentication
3. **State Management**: Add Redux or Context API
4. **Real-time Features**: Implement Socket.io for live chat
5. **Push Notifications**: Add Firebase Cloud Messaging
6. **Offline Support**: Implement offline data sync
7. **Testing**: Add unit and integration tests
8. **Performance**: Optimize images and lazy loading

## Development Guidelines

1. Follow the existing code structure
2. Use React Native Paper components for consistency
3. Maintain the theme colors and typography
4. Test on both iOS and Android devices
5. Keep the UI similar to AiSensy mobile app

## Troubleshooting

### Metro bundler issues:
```bash
npm start -- --clear
```

### Dependency issues:
```bash
rm -rf node_modules package-lock.json
npm install
```

### iOS specific:
```bash
cd ios && pod install && cd ..
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test on both platforms
4. Submit a pull request

## License

Proprietary - Pabbly

## Support

For support, email support@pabbly.com or visit [https://www.pabbly.com](https://www.pabbly.com)
