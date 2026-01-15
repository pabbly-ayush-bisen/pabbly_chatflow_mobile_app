# Launch on Physical Android Device - Quick Guide

## 📱 Step-by-Step Instructions

### Step 1: Install Expo Go App

1. Open **Google Play Store** on your Android phone
2. Search for **"Expo Go"**
3. Install the app (it's free)
4. Open Expo Go app

### Step 2: Connect to Same WiFi

**IMPORTANT:** Make sure your phone and computer are on the **SAME WiFi network**

### Step 3: Start the Dev Server

In your terminal, run:
```bash
cd chatflow_mobile_native
npm start
```

### Step 4: Connect Your Phone

Once the dev server starts, you'll see a **QR code** in your terminal.

**Method A: Scan QR Code (Easiest)**
1. Open **Expo Go** app on your phone
2. Tap **"Scan QR code"**
3. Point camera at the QR code in your terminal
4. App will automatically load!

**Method B: Enter URL Manually**
1. Open **Expo Go** app
2. Tap **"Enter URL manually"**
3. Look in your terminal for the URL like: `exp://192.168.x.x:8081`
4. Type that URL into Expo Go
5. Tap "Connect"

### Step 5: Wait for App to Load

- First time will take 1-2 minutes to bundle
- You'll see a loading screen
- Then the Pabbly Chatflow login screen appears!

---

## 🔍 Finding Your Computer's IP Address

If you need to enter URL manually:

**On Windows:**
```bash
ipconfig
```
Look for **"IPv4 Address"** under your active WiFi adapter (usually starts with 192.168.x.x)

---

## ⚙️ Update API URL for Physical Device

Since you're using a physical device, you need to update the API URL to use your computer's actual IP address instead of `10.0.2.2` (which is for emulator only).

**Edit this file:** `src/config/app.config.jsx`

Change this line:
```javascript
apiUrl: __DEV__ ? 'http://10.0.2.2:1337' : 'https://api.pabbly.com',
```

To:
```javascript
apiUrl: __DEV__ ? 'http://YOUR_COMPUTER_IP:1337' : 'https://api.pabbly.com',
```

Replace `YOUR_COMPUTER_IP` with your actual IP (e.g., `192.168.1.100`)

**Example:**
```javascript
apiUrl: __DEV__ ? 'http://192.168.1.100:1337' : 'https://api.pabbly.com',
```

---

## 🐛 Troubleshooting

### Can't Scan QR Code?
- Make sure Expo Go has camera permissions
- Try entering URL manually instead
- Make sure QR code is fully visible on screen

### "Unable to Connect"?
**Check these:**
1. ✅ Phone and computer on SAME WiFi
2. ✅ Dev server is running (`npm start`)
3. ✅ Firewall isn't blocking port 8081
4. ✅ Try using tunnel mode: `npm start -- --tunnel`

### App Won't Load?
- Check terminal for errors
- Try restarting dev server
- Clear cache: `npm start -- --clear`

### "Network Request Failed" After Login?
- Update API URL in config file (see above)
- Make sure backend server is running
- Check your computer's IP hasn't changed

---

## 🎯 What Happens Next

1. **App loads** - Shows Pabbly Chatflow logo
2. **Login screen** appears
3. **Enter credentials**
4. **Redirects to Dashboard** with bottom tabs:
   - Dashboard
   - Inbox
   - Contacts
   - More

---

## 💡 Pro Tips

1. **Shake Phone** to open developer menu
2. **Enable Fast Refresh** - Changes auto-reload
3. **Keep Dev Server Running** - Don't close terminal
4. **Watch Terminal** - Shows logs and errors
5. **Reload App** - If stuck, press `r` in terminal

---

## 🔄 Development Workflow

1. Make code changes in your editor
2. Save file
3. App auto-reloads on phone (usually)
4. If not, press `r` in terminal or shake phone and select "Reload"

---

## 📊 Expected Timeline

- **First Launch:** 2-3 minutes (bundling all code)
- **After Changes:** 5-10 seconds (fast refresh)
- **Full Reload:** 30-60 seconds

---

## ✅ Success Checklist

- [ ] Expo Go installed on phone
- [ ] Phone and computer on same WiFi
- [ ] Dev server running (`npm start`)
- [ ] QR code scanned or URL entered
- [ ] App loading screen visible
- [ ] Login screen appears

---

## 🎉 You're Ready!

Once you see the login screen, your app is successfully running on your physical Android device!

**Next:** Test all features and enjoy your mobile app! 📱
