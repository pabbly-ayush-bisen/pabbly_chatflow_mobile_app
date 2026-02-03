# Pabbly Chatflow Mobile App - Architecture Documentation

**Simple aur Easy-to-Understand Format**

---

# PART 1: APP KA OVERVIEW

## Ye App Kya Hai?

Pabbly Chatflow Mobile App ek **React Native** application hai jo WhatsApp Business messaging ko manage karne ke liye banayi gayi hai. Isse aap:

- WhatsApp conversations dekh sakte ho
- Messages send/receive kar sakte ho
- Contacts manage kar sakte ho
- Templates use kar sakte ho
- Team members ke saath collaborate kar sakte ho

## Technologies Used

| Technology | Kaam Kya Karta Hai |
|------------|-------------------|
| React Native | Mobile app banane ke liye |
| Expo | Build aur development tools |
| Redux | App ka data manage karne ke liye |
| SQLite | Phone mein data store karne ke liye (offline support) |
| Socket.IO | Real-time messages ke liye |
| Axios | Server se data lene ke liye (API calls) |

---

# PART 2: FOLDER STRUCTURE

## Main Folders Kya Hain?

```
src/
├── components/     → UI ke chhote-chhote parts (buttons, cards, etc.)
├── screens/        → Poore pages (Login, Inbox, Chat, etc.)
├── services/       → Server se baat karne ka code
├── redux/          → App ka data store
├── contexts/       → Shared data (Socket, Cache, Network)
├── database/       → SQLite database code
├── hooks/          → Reusable logic
├── navigation/     → Screen navigation
├── theme/          → Colors, fonts
└── utils/          → Helper functions
```

## Important Files

| File | Kya Karta Hai |
|------|---------------|
| `App.js` | App start hota hai yahaan se |
| `SessionManager.js` | Login session manage karta hai |
| `socketService.js` | Real-time connection handle karta hai |
| `axios.jsx` | API calls karta hai |
| `userSlice.jsx` | User login data store karta hai |
| `inboxSlice.jsx` | Chat data store karta hai |

---

# PART 3: APP KAISE START HOTA HAI

## Step-by-Step Flow

```
Step 1: App Open Hota Hai
         ↓
Step 2: Check - Kya user pehle se logged in hai?
         ↓
    ┌────┴────┐
    ↓         ↓
   YES        NO
    ↓         ↓
Step 3a:   Step 3b:
Home       Login
Screen     Screen
dikhao     dikhao
```

## Detailed Steps:

**1. App Launch**
- `index.js` se app start hota hai
- `App.js` mein saare providers wrap hote hain

**2. Session Check**
- `SessionManager.initialize()` call hota hai
- Phone mein stored token check hota hai

**3. Decision**
- Agar token hai → Seedha home screen
- Agar token nahi → Login screen

**4. After Login**
- Socket connect hota hai (real-time ke liye)
- Cache initialize hota hai (offline support ke liye)
- Push notifications register hote hain

---

# PART 4: LOGIN SYSTEM

## 2 Tarike Se Login Ho Sakta Hai

### Method 1: Email + Password

```
User                    App                     Server
  │                      │                        │
  │─── Email/Password ──→│                        │
  │                      │─── Credentials ───────→│
  │                      │                        │
  │                      │←── Token + User Data ──│
  │                      │                        │
  │←── Home Screen ──────│                        │
```

**Simple Explanation:**
1. User email aur password dalta hai
2. App hidden WebView mein Pabbly Accounts ko bhejta hai
3. Server token return karta hai
4. Token phone mein store hota hai
5. User home screen pe pahunch jata hai

### Method 2: Google Login

```
User                    App                     Google
  │                      │                        │
  │─── Google Button ───→│                        │
  │                      │─── Google OAuth ──────→│
  │                      │                        │
  │                      │←── Token ──────────────│
  │                      │                        │
  │←── Home Screen ──────│                        │
```

**Simple Explanation:**
1. User "Continue with Google" tap karta hai
2. Google login page open hota hai
3. Google token deta hai
4. Woh token Pabbly ko jaata hai
5. User login ho jaata hai

## Token Storage

| Kya Store Hota Hai | Key Name | Purpose |
|-------------------|----------|---------|
| Login Token | `@pabbly_chatflow_token` | API calls ke liye |
| User Data | `@pabbly_chatflow_user` | User info |
| Business Account | `settingId` | Konsa account active hai |

---

# PART 5: DATA MANAGEMENT (Redux)

## Redux Kya Hai?

Redux ek **central store** hai jahaan app ka saara data rehta hai. Jaise ek warehouse mein saaman organized rehta hai, waise hi Redux mein data organized rehta hai.

## 8 Data Slices

| Slice | Kya Data Rehta Hai |
|-------|-------------------|
| `userSlice` | Login info, user profile, token |
| `inboxSlice` | Saari chats, messages, unread count |
| `contactSlice` | Contacts list |
| `templateSlice` | WhatsApp message templates |
| `broadcastSlice` | Bulk messages |
| `assistantSlice` | AI assistant data |
| `settingsSlice` | App settings, quick replies |
| `dashboardSlice` | Dashboard stats |

## Data Flow

```
User Action (Button Click)
         ↓
    dispatch(action)
         ↓
    Redux Store Update
         ↓
    UI Automatically Update
```

**Example:**
1. User chat open karta hai
2. `dispatch(fetchChatDetails(chatId))` call hota hai
3. Server se data aata hai
4. Redux store update hota hai
5. Screen pe chat dikh jaati hai

---

# PART 6: REAL-TIME MESSAGING (Socket)

## Socket Kya Hai?

Socket ek **live connection** hai server ke saath. Jaise phone call mein dono sides connected rehti hain, waise hi socket se app aur server connected rehte hain.

## Socket Kab Use Hota Hai?

| Event | Kab Hota Hai |
|-------|-------------|
| New Message | Jab koi naya message aata hai |
| Message Status | Jab message sent/delivered/read hota hai |
| Contact Created | Jab naya contact banta hai |
| Team Logout | Jab admin team member ko logout karta hai |

## Message Receive Flow

```
WhatsApp User Message Bhejta Hai
              ↓
      Pabbly Server Receive Karta Hai
              ↓
      Socket Event Emit Hota Hai ('newMessage')
              ↓
      App Receive Karta Hai
              ↓
      ┌───────┴───────┐
      ↓               ↓
  App Open Hai    App Background Mein
      ↓               ↓
  Chat List      Push Notification
  Update         Show Hoti Hai
```

## Message Send Flow

```
User Message Type Karta Hai
         ↓
    Send Button Tap
         ↓
    Message Turant Screen Pe Dikhta Hai (Pending Status)
         ↓
    Socket Se Server Ko Bheja Jaata Hai
         ↓
    Server WhatsApp Ko Forward Karta Hai
         ↓
    Status Update Aata Hai (Sent → Delivered → Read)
         ↓
    Checkmarks Update Hote Hain
```

---

# PART 7: API CALLS

## API Kya Hai?

API (Application Programming Interface) ka matlab hai server se data lena ya bhejana. Jaise aap restaurant mein waiter se order dete ho, waise hi app API se server ko request bhejta hai.

## Important APIs

### Authentication APIs

| API | Method | Kaam |
|-----|--------|------|
| `/auth/signin` | POST | Login karna |
| `/auth/logout` | GET | Logout karna |
| `/auth/verify-session` | GET | Session valid hai ya nahi check karna |

### Chat APIs

| API | Method | Kaam |
|-----|--------|------|
| `/chats` | GET | Saari chats lena |
| `/chats/fetchConversation` | GET | Ek chat ke messages lena |
| `/chats/send-message` | POST | Message bhejana |

### Contact APIs

| API | Method | Kaam |
|-----|--------|------|
| `/contacts` | GET | Saare contacts lena |
| `/contacts` | POST | Naya contact banana |
| `/contacts/:id` | PUT | Contact update karna |

## API Call Flow

```
Component mein Button Click
         ↓
    dispatch(fetchChats())  ← Redux Action
         ↓
    Axios API Call          ← HTTP Request
         ↓
    Server Response         ← Data Aata Hai
         ↓
    Redux Store Update      ← Data Save Hota Hai
         ↓
    UI Update               ← Screen Refresh
```

---

# PART 8: OFFLINE SUPPORT (Caching)

## Caching Kya Hai?

Caching ka matlab hai data phone mein save karna taaki internet na hone par bhi kuch data dikh sake.

## 3 Levels of Cache

```
Level 1: Redux (Memory)
    ↓   - Sabse Fast
    ↓   - App band hone pe delete ho jaata hai

Level 2: SQLite (Database)
    ↓   - Phone mein permanently store
    ↓   - App restart ke baad bhi rehta hai

Level 3: Server
        - Source of truth
        - Internet chahiye
```

## Kya Cache Hota Hai?

| Data | Kahaan Store Hota Hai |
|------|----------------------|
| Chats List | SQLite + Redux |
| Messages | SQLite + Redux |
| Contacts | SQLite + Redux |
| User Session | AsyncStorage |
| Preferences | AsyncStorage |

## Cache Flow (Jab App Open Hota Hai)

```
Step 1: Pehle SQLite se cached data load karo
         ↓
Step 2: User ko turant dikhao (fast experience)
         ↓
Step 3: Background mein server se fresh data lao
         ↓
Step 4: Naya data aane pe UI update karo
```

---

# PART 9: PUSH NOTIFICATIONS

## Push Notification Kya Hai?

Push notification woh message hai jo app band hone par bhi phone pe dikhaata hai.

## Flow

```
WhatsApp Message Aata Hai
         ↓
    Server Receive Karta Hai
         ↓
    Expo Push Service Ko Bhejta Hai
         ↓
    Phone Pe Notification Dikhti Hai
         ↓
    User Tap Karta Hai
         ↓
    App Open Hota Hai → Specific Chat
```

## Notification Kab Dikhti Hai?

| Situation | Notification? |
|-----------|---------------|
| App background mein hai | YES |
| App open hai, different chat | YES |
| App open hai, same chat | NO |
| User ne notifications off kiye | NO |
| Message user ne khud bheja | NO |

## Message Type Icons

| Type | Notification Mein Dikhta Hai |
|------|------------------------------|
| Text | Actual message text |
| Image | "📷 Photo" |
| Video | "🎥 Video" |
| Audio | "🎵 Voice message" |
| Document | "📄 Document" |
| Location | "📍 Location" |

---

# PART 10: NAVIGATION (Screens)

## App Mein Kitne Screens Hain?

```
┌─────────────────────────────────────────┐
│            MAIN SCREENS                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  Not Logged In             │
│  │ LOGIN   │  ─────────────             │
│  │ SCREEN  │  Email/Password ya Google  │
│  └─────────┘                            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        TAB BAR (5 Tabs)         │    │
│  ├─────────────────────────────────┤    │
│  │                                 │    │
│  │  📊 Dashboard                   │    │
│  │     → Stats, WhatsApp numbers   │    │
│  │                                 │    │
│  │  💬 Inbox                       │    │
│  │     → Chat list, filters        │    │
│  │     → Chat Details (messages)   │    │
│  │                                 │    │
│  │  👥 Contacts                    │    │
│  │     → Contact list              │    │
│  │     → Add/Edit contact          │    │
│  │                                 │    │
│  │  📝 Templates                   │    │
│  │     → WhatsApp templates        │    │
│  │                                 │    │
│  │  ⚙️ More                        │    │
│  │     → Settings                  │    │
│  │     → Quick Replies             │    │
│  │     → Team Members              │    │
│  │     → Tags                      │    │
│  │     → Logout                    │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

# PART 11: 100+ TEAM MEMBERS - SERVER LOAD

## Scenario

Agar ek business account mein **100 team members** hain aur har member ke paas **2 devices** hain (phone + tablet), toh total **200 connections** honge.

## Jab Ek Message Aata Hai, Kya Hota Hai?

```
WhatsApp se Message Aaya
         ↓
    Server Receive Karta Hai
         ↓
    200 Devices Ko Bhejta Hai (Socket Broadcast)
         ↓
    200 Push Notifications Bhejta Hai
         ↓
    Database Mein Save Karta Hai
```

## Server Resource Usage (Per Message)

| Resource | Usage |
|----------|-------|
| Socket Broadcasts | 200 emissions |
| Bandwidth | ~600 KB (2KB × 200 devices + push) |
| Database | 1 write + 1 read |
| CPU Time | ~62ms |
| Memory Spike | ~300KB |

## Daily Usage (1000 messages/day)

| Metric | Value |
|--------|-------|
| Total Bandwidth | ~600 MB/day |
| Database Operations | 2000 operations |
| Socket Events | 200,000 events |

## Client-Side Filtering

Har device pe ye check hota hai:

```
Message Aaya
    ↓
Check: Kya ye message mere account ka hai?
    ↓
┌───┴───┐
│       │
YES     NO
│       │
Process  Ignore
```

Ye `settingId` check karta hai - agar match nahi karta toh message ignore ho jaata hai.

---

# PART 12: DATA FLOW DIAGRAMS

## Level 0: Simple Overview

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│ WhatsApp │ ──────→ │   PABBLY     │ ──────→ │  Mobile  │
│   User   │ ←────── │   SERVER     │ ←────── │   App    │
└──────────┘         └──────────────┘         └──────────┘
```

## Level 1: Main Processes

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE APP                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │ 1. LOGIN    │    │ 2. CHATS    │    │ 3. CONTACTS│  │
│   │    SYSTEM   │    │   SYSTEM    │    │    SYSTEM │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │ 4. TEMPLATE │    │ 5. BROADCAST│    │ 6. REALTIME│  │
│   │    SYSTEM   │    │    SYSTEM   │    │    SYNC   │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
              ┌────────────────────────┐
              │      DATA STORES       │
              │                        │
              │  Redux    SQLite    AsyncStorage │
              │ (Memory) (Database) (Key-Value) │
              └────────────────────────┘
```

## Level 2: Login Process

```
User
  │
  │ Email + Password
  ↓
┌─────────────────┐
│ VALIDATE INPUT  │ ← Check: Empty? Invalid format?
└────────┬────────┘
         │ Valid
         ↓
┌─────────────────┐     ┌──────────────────┐
│ AUTHENTICATE    │ ←──→│ Pabbly Accounts  │
│ WITH PABBLY     │     │ Server           │
└────────┬────────┘     └──────────────────┘
         │ Token received
         ↓
┌─────────────────┐     ┌──────────────────┐
│ VERIFY TOKEN    │ ←──→│ ChatFlow Server  │
│ WITH CHATFLOW   │     │                  │
└────────┬────────┘     └──────────────────┘
         │ User data received
         ↓
┌─────────────────┐
│ SAVE SESSION    │ → AsyncStorage (token, user, settingId)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ GO TO HOME      │
│ SCREEN          │
└─────────────────┘
```

## Level 2: Chat Message Flow

```
User Types Message
         │
         ↓
┌─────────────────────────────────────────┐
│ OPTIMISTIC UPDATE                        │
│ Message turant screen pe dikhao         │
│ Status: "Pending" (grey clock)          │
└────────────────────┬────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────┐
│ SEND VIA SOCKET                          │
│ Socket.emit('sendMessage', data)        │
└────────────────────┬────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────┐
│ SERVER PROCESSING                        │
│ 1. Validate message                     │
│ 2. Forward to WhatsApp                  │
│ 3. Save to database                     │
│ 4. Send status update                   │
└────────────────────┬────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────┐
│ STATUS UPDATES                           │
│ Pending → Sent (✓) → Delivered (✓✓)    │
│        → Read (✓✓ blue)                 │
└─────────────────────────────────────────┘
```

## Level 2: Real-Time Sync

```
WhatsApp User Message Bhejta Hai
              │
              ↓
┌─────────────────────────────────────────┐
│ CHATFLOW SERVER                          │
│ Message receive karta hai               │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ↓                       ↓
┌─────────────────┐    ┌─────────────────┐
│ SOCKET EMIT     │    │ PUSH NOTIFY     │
│ 'newMessage'    │    │ via Expo        │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ↓                      ↓
┌─────────────────────────────────────────┐
│ MOBILE APP                               │
├─────────────────────────────────────────┤
│                                         │
│  1. Check settingId match               │
│     (Mera account ka message hai?)      │
│                                         │
│  2. Agar YES:                           │
│     → Redux update                      │
│     → Chat list update                  │
│     → Notification (if background)      │
│                                         │
│  3. Agar NO:                            │
│     → Ignore                            │
│                                         │
└─────────────────────────────────────────┘
```

---

# PART 13: COMPLETE SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         EXTERNAL SYSTEMS                                 │
│                                                                          │
│    ┌──────────┐      ┌──────────────┐      ┌─────────────────┐          │
│    │ WhatsApp │      │   Pabbly     │      │     Google      │          │
│    │ Business │      │   Accounts   │      │     OAuth       │          │
│    │   API    │      │   (Login)    │      │                 │          │
│    └────┬─────┘      └──────┬───────┘      └────────┬────────┘          │
│         │                   │                       │                    │
└─────────┼───────────────────┼───────────────────────┼────────────────────┘
          │                   │                       │
          ↓                   ↓                       ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                      PABBLY CHATFLOW SERVER                              │
│                                                                          │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│    │  REST API  │  │  Socket.IO │  │   Auth     │  │   Push     │       │
│    │  Handler   │  │   Server   │  │  Service   │  │  Service   │       │
│    └────────────┘  └────────────┘  └────────────┘  └────────────┘       │
│                                                                          │
│    ┌────────────────────────────────────────────────────────────┐       │
│    │                    MONGODB DATABASE                         │       │
│    │   chats │ messages │ contacts │ templates │ users          │       │
│    └────────────────────────────────────────────────────────────┘       │
│                                                                          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                    HTTP / WebSocket / Push Notifications
                                    │
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         MOBILE APPLICATION                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    UI LAYER (Screens)                           │     │
│  │  Login │ Dashboard │ Inbox │ Chat │ Contacts │ Settings        │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    STATE LAYER                                  │     │
│  │  Redux Store │ SocketContext │ CacheContext │ NetworkContext   │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    SERVICE LAYER                                │     │
│  │  Axios (API) │ Socket.IO │ SessionManager │ FileUpload         │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    DATA LAYER                                   │     │
│  │  AsyncStorage (Session) │ SQLite (Cache) │ Redux (Memory)      │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# PART 14: SECURITY

## Kaise Secure Hai?

| Security Feature | Kaise Kaam Karta Hai |
|------------------|---------------------|
| HTTPS | Saari API calls encrypted hoti hain |
| JWT Token | Har request mein token jaata hai |
| Session Expiry | Token expire ho jaata hai (re-login needed) |
| Logout | Saara data phone se delete ho jaata hai |

## Token Flow

```
Login Success
     ↓
Token Milta Hai
     ↓
AsyncStorage Mein Save
     ↓
Har API Call Mein Token Header Mein Jaata Hai
     ↓
Server Verify Karta Hai
     ↓
Valid → Request Process
Invalid → 401 Error → Logout
```

---

# PART 15: BUILD & DEPLOYMENT

## Build Commands

| Command | Kya Karta Hai |
|---------|---------------|
| `npm start` | Development server start |
| `npm run android` | Android app run |
| `npm run ios` | iOS app run |
| `npm run build:preview` | Test build banao |
| `npm run build:production` | Production build banao |

## App Identifiers

| Platform | Package Name |
|----------|-------------|
| Android | `com.pabbly.chatflow` |
| iOS | `com.pabbly.chatflow` |

---

# PART 16: SUMMARY

## Key Points

1. **Login**: Email/Password ya Google se ho sakta hai

2. **Real-time**: Socket.IO se instant messages aate hain

3. **Offline Support**: SQLite mein data cache hota hai

4. **State Management**: Redux mein saara data organized hai

5. **Push Notifications**: Background mein bhi messages dikhte hain

6. **Multi-Device**: Ek account multiple devices pe chal sakta hai

7. **Team Support**: 100+ team members support hai

## File Locations (Quick Reference)

| Feature | File Location |
|---------|---------------|
| Login Logic | `src/redux/slices/userSlice.jsx` |
| Chat Logic | `src/redux/slices/inboxSlice.jsx` |
| Socket Connection | `src/services/socketService.js` |
| API Calls | `src/utils/axios.jsx` |
| Session Management | `src/services/SessionManager.js` |
| Navigation | `src/navigation/AppNavigator.jsx` |
| Push Notifications | `src/services/notificationService.js` |

---

**Document Version:** 1.0.0
**Last Updated:** February 2026
