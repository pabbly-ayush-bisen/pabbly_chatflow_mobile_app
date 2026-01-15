# Android Launch Guide - Pabbly Chatflow Mobile App

## ✅ Current Status

Your Expo development server is **RUNNING** at `http://localhost:8081`

The Metro bundler is starting up and the app is ready to launch on Android.

---

## 🚀 Option 1: Launch on Android Emulator (Recommended)

### Prerequisites:
1. **Android Studio** installed
2. **Android Emulator** set up
3. **Android SDK** configured

### Steps:

#### 1. Open Android Studio
- Launch Android Studio
- Go to **Tools > Device Manager** (or AVD Manager)

#### 2. Start an Emulator
- Click the **▶ Play** button next to your virtual device
- Wait for the emulator to fully boot up

#### 3. In Your Current Terminal
The Expo dev server is already running. Now press:
```
Press 'a' to open Android emulator
```

Or in a **NEW terminal window**, run:
```bash
cd chatflow_mobile_native
npm run android
```

---

## 📱 Option 2: Launch on Physical Android Device (Easiest)

### Prerequisites:
1. Android phone
2. **Expo Go** app installed from Play Store
3. Phone and computer on **same WiFi network**

### Steps:

#### 1. Install Expo Go
- Open Google Play Store
- Search for "Expo Go"
- Install the app

#### 2. Connect to Your App
The Expo dev server should show a QR code in your terminal.

**Method A: Scan QR Code**
- Open Expo Go app
- Tap "Scan QR Code"
- Scan the QR code from terminal

**Method B: Enter URL Manually**
- Open Expo Go app
- Tap "Enter URL manually"
- Enter: `exp://YOUR_COMPUTER_IP:8081`

To find your computer's IP:
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

---

## 🔧 Option 3: Using ADB (Android Debug Bridge)

If you have ADB installed and a device connected:

```bash
# Check connected devices
adb devices

# If device is connected, run:
cd chatflow_mobile_native
npm run android
```

---

## ⚠️ Current Package Version Warnings

The dev server shows some package version mismatches:
```
@react-native-picker/picker@2.11.4 - expected version: 2.11.1
react-native-gesture-handler@2.30.0 - expected version: ~2.28.0
react-native-screens@4.19.0 - expected version: ~4.16.0
```

**These warnings are usually safe to ignore**, but if you encounter issues, you can fix them:

```bash
# Stop the dev server (Ctrl+C)
cd chatflow_mobile_native

# Install expected versions
npm install @react-native-picker/picker@2.11.1
npm install react-native-gesture-handler@~2.28.0
npm install react-native-screens@~4.16.0

# Restart
npm start
```

---

## 🐛 Troubleshooting

### Issue: "Metro Bundler Failed to Start"
**Solution:**
```bash
# Kill the process on port 8081
npx kill-port 8081

# Clear cache and restart
npm start -- --clear
```

### Issue: "Can't Connect to App"
**Solutions:**
1. Ensure phone and computer are on same WiFi
2. Check firewall isn't blocking port 8081
3. Try using tunnel mode:
   ```bash
   npm start -- --tunnel
   ```

### Issue: "App Won't Load on Emulator"
**Solutions:**
1. Make sure emulator is fully booted
2. Try restarting the emulator
3. Run: `adb reverse tcp:8081 tcp:8081`

### Issue: "Build Failed"
**Solutions:**
1. Clear cache: `npm start -- --clear`
2. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   npm install
   ```

---

## 📱 What to Expect

Once the app launches, you'll see:

1. **Login Screen** (since you're not authenticated yet)
   - Email and password fields
   - Sign in button

2. After login, you'll see:
   - **Bottom Navigation** with 4 tabs:
     - Dashboard
     - Inbox
     - Contacts
     - More

3. All features are functional and connected to Redux

---

## 🎯 Quick Commands Reference

```bash
# Start dev server
npm start

# Start and clear cache
npm start -- --clear

# Run on Android
npm run android

# Run on Android with specific device
npm run android -- --device

# Stop dev server
Ctrl + C

# View logs
# They appear in the same terminal window
```

---

## 🔍 Monitoring the App

### View Logs:
Logs appear in the terminal where you ran `npm start`

### React Native Debugger:
1. Open app on device/emulator
2. Shake device or press `Ctrl+M` (emulator)
3. Select "Debug" from menu

### Redux DevTools:
Since this is a mobile app, Redux state can be monitored using:
1. Reactotron (if configured)
2. Console logs in the dev server terminal
3. React Native Debugger

---

## 📊 Expected Terminal Output

You should see something like:
```
Starting project at C:\Users\bisen\chatflow_mobile_app\chatflow_mobile_native
Starting Metro Bundler
Waiting on http://localhost:8081

› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

---

## 🎨 Testing the App

Once launched, test these features:

1. **Login**
   - Use your credentials
   - Should redirect to Dashboard

2. **Dashboard**
   - View stats
   - See WhatsApp numbers
   - Check folders

3. **Inbox**
   - View chat list
   - Open a chat
   - Send messages

4. **Contacts**
   - View contact lists
   - Add a new contact

5. **More Menu**
   - Access Templates
   - Access Broadcast
   - Access Settings

---

## 💡 Tips

1. **Shake to Open Menu**: Shake your device to open the dev menu
2. **Fast Refresh**: Changes auto-reload (most of the time)
3. **Reload Manually**: If changes don't appear, press `r` in terminal
4. **Check Logs**: Watch terminal for errors/warnings
5. **Network Requests**: All API calls go to configured backend

---

## 📞 Need Help?

### Common Questions:

**Q: App shows white screen**
A: Check terminal for errors, try reloading with `r`

**Q: Can't see QR code**
A: Terminal might be too small, maximize it or use URL method

**Q: "Network request failed"**
A: Check API URL in `src/config/app.config.jsx`

**Q: App crashes on launch**
A: Check terminal logs, clear cache and restart

---

## ✅ Next Steps After Launch

1. **Test Login**: Use your credentials
2. **Test API Connection**: Check if data loads
3. **Test Navigation**: Navigate between screens
4. **Test Features**: Try all CRUD operations
5. **Report Issues**: Note any bugs or errors

---

## 🎉 You're All Set!

The dev server is running and ready for Android connection.

Choose one of the methods above to launch the app on your Android device or emulator.

**Happy Testing! 🚀**
