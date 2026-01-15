# Pabbly Chatflow Mobile App - File Structure

## 📁 Complete Project Structure

```
chatflow_mobile_native/
│
├── 📄 App.js                          # Main app entry point with theme and navigation
├── 📄 app.json                        # Expo configuration
├── 📄 index.js                        # App registration
├── 📄 package.json                    # Dependencies and scripts
│
├── 📄 README.md                       # Complete documentation
├── 📄 QUICK_START.md                  # Quick start guide
├── 📄 PROJECT_SUMMARY.md              # Project summary
├── 📄 FILE_STRUCTURE.md               # This file
│
├── 📂 assets/                         # Static assets
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash.png
│
├── 📂 src/                            # Source code
│   │
│   ├── 📂 config/                     # Configuration files
│   │   └── 📄 app.config.js           # App settings, API config, environment
│   │
│   ├── 📂 navigation/                 # Navigation configuration
│   │   └── 📄 AppNavigator.js         # Main navigation setup (tabs + stack)
│   │
│   ├── 📂 screens/                    # All screen components
│   │   │
│   │   ├── 📂 auth/                   # Authentication screens
│   │   │   └── 📄 LoginScreen.js      # Login screen with form
│   │   │
│   │   ├── 📄 HomeScreen.js           # Dashboard with stats and activities
│   │   ├── 📄 ChatsScreen.js          # Chat list with search
│   │   ├── 📄 FlowsScreen.js          # Workflow management
│   │   ├── 📄 ContactsScreen.js       # Contact management
│   │   └── 📄 ProfileScreen.js        # Profile and settings
│   │
│   ├── 📂 services/                   # API and external services
│   │   └── 📄 api.service.js          # Axios setup, interceptors, endpoints
│   │
│   ├── 📂 theme/                      # Theme configuration
│   │   ├── 📄 colors.js               # Color palette (MUI Minimal matching)
│   │   ├── 📄 typography.js           # Typography configuration
│   │   ├── 📄 theme.js                # React Native Paper theme config
│   │   └── 📄 index.js                # Theme exports
│   │
│   ├── 📂 utils/                      # Utility functions
│   │   └── 📄 helpers.js              # Date, string, validation helpers
│   │
│   └── 📂 components/                 # Reusable components (empty, ready to add)
│
└── 📂 node_modules/                   # Dependencies (managed by npm)
```

## 📄 File Descriptions

### Root Files

| File | Purpose |
|------|---------|
| `App.js` | Main entry point, wraps app with providers |
| `app.json` | Expo project configuration |
| `index.js` | Registers the root component |
| `package.json` | Project dependencies and scripts |

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Complete project documentation |
| `QUICK_START.md` | 5-minute quick start guide |
| `PROJECT_SUMMARY.md` | Feature summary and status |
| `FILE_STRUCTURE.md` | This file - structure overview |

### Source Code (`src/`)

#### Configuration (`src/config/`)
```
app.config.js
├── App settings (name, version)
├── API configuration (URL, timeout)
├── Authentication keys
├── Feature flags
└── Environment management
```

#### Navigation (`src/navigation/`)
```
AppNavigator.js
├── Stack Navigator (Auth flow)
├── Bottom Tab Navigator (Main app)
├── Tab icons and styling
└── Screen routing
```

#### Screens (`src/screens/`)
```
auth/
└── LoginScreen.js      # Email/password login form

HomeScreen.js           # Dashboard
├── Stats cards
├── Quick actions
└── Recent activity

ChatsScreen.js          # Chat management
├── Chat list
├── Search bar
├── Unread badges
└── Timestamps

FlowsScreen.js          # Workflow automation
├── Flow cards
├── Status indicators
├── Statistics
└── FAB for new flow

ContactsScreen.js       # Contact management
├── Contact list
├── Search functionality
└── Action buttons

ProfileScreen.js        # User profile
├── Profile header
├── Settings options
├── Account management
└── Logout
```

#### Services (`src/services/`)
```
api.service.js
├── Axios instance
├── Request interceptor (add token)
├── Response interceptor (handle errors)
└── API endpoints
    ├── Auth (login, register, logout)
    ├── User (profile, update)
    ├── Chats (list, send, get)
    ├── Flows (CRUD)
    └── Contacts (CRUD)
```

#### Theme (`src/theme/`)
```
colors.js               # Color palette
├── Primary (#0C68E9)
├── Secondary (#8E33FF)
├── Success (#22C55E)
├── Warning (#FFAB00)
├── Error (#FF5630)
└── Grey shades

typography.js           # Typography
├── Font families
├── Font sizes
├── Font weights
└── Line heights

theme.js               # Theme config
├── Light theme
├── Dark theme
└── React Native Paper integration

index.js               # Exports
```

#### Utils (`src/utils/`)
```
helpers.js
├── dateHelpers (formatting, relative time)
├── stringHelpers (truncate, capitalize, initials)
├── validators (email, phone, password, URL)
├── numberHelpers (format, currency, percentage)
└── colorHelpers (random, contrast)
```

## 📊 Statistics

### Code Files
- **JavaScript Files**: 14 files
- **JSON Files**: 2 files
- **Markdown Files**: 4 files

### Lines of Code (Approximate)
- **Screens**: ~800 lines
- **Theme**: ~200 lines
- **Services**: ~100 lines
- **Utils**: ~200 lines
- **Navigation**: ~100 lines
- **Total**: ~1,400 lines of code

### Dependencies
- **Total Packages**: ~700 packages (including sub-dependencies)
- **Direct Dependencies**: 14 packages
- **Size**: ~350 MB

## 🎯 Key Features by File

### App.js (16 lines)
- ✅ Gesture handler setup
- ✅ Theme provider
- ✅ Navigation integration
- ✅ Status bar configuration

### Navigation (100+ lines)
- ✅ 5 bottom tabs
- ✅ Stack navigation
- ✅ Icons and styling
- ✅ Auth flow

### Theme (200+ lines)
- ✅ Complete color system
- ✅ Typography scale
- ✅ Light/dark themes
- ✅ Material Design 3

### Screens (800+ lines)
- ✅ 6 fully styled screens
- ✅ Material components
- ✅ Responsive layouts
- ✅ Interactive elements

### Services (100+ lines)
- ✅ HTTP client setup
- ✅ Auth token handling
- ✅ Error handling
- ✅ API endpoints

### Utils (200+ lines)
- ✅ 20+ helper functions
- ✅ Validators
- ✅ Formatters
- ✅ Utilities

## 🔍 Finding Files

### To modify colors:
```
src/theme/colors.js
```

### To add a new screen:
```
1. Create: src/screens/NewScreen.js
2. Import in: src/navigation/AppNavigator.js
3. Add to navigator
```

### To change API URL:
```
src/config/app.config.js
Line: apiUrl: 'http://localhost:1337'
```

### To add API endpoint:
```
src/services/api.service.js
Add new method in apiService object
```

### To add utility function:
```
src/utils/helpers.js
Add to appropriate helper category
```

## 📦 Package.json Scripts

```json
{
  "start": "expo start",           // Start dev server
  "android": "expo start --android", // Run on Android
  "ios": "expo start --ios",         // Run on iOS
  "web": "expo start --web"          // Run on web
}
```

## 🔄 File Dependencies

```
App.js
  ├── src/theme/index.js
  │   ├── colors.js
  │   ├── typography.js
  │   └── theme.js
  └── src/navigation/AppNavigator.js
      └── src/screens/
          ├── auth/LoginScreen.js
          ├── HomeScreen.js
          ├── ChatsScreen.js
          ├── FlowsScreen.js
          ├── ContactsScreen.js
          └── ProfileScreen.js
```

## 🎨 Asset Files

```
assets/
├── adaptive-icon.png   # Android adaptive icon
├── favicon.png        # Web favicon
├── icon.png          # App icon
└── splash.png        # Splash screen
```

## 📝 Notes

1. **Empty Folders**: `components/` folder is created but empty, ready for custom components
2. **Modular**: Each file has single responsibility
3. **Scalable**: Easy to add new features
4. **Documented**: All files well-commented
5. **Consistent**: Following React Native best practices

## 🚀 Quick Navigation

| Want to... | Go to... |
|------------|----------|
| Change colors | `src/theme/colors.js` |
| Add screen | `src/screens/` |
| Modify navigation | `src/navigation/AppNavigator.js` |
| Add API call | `src/services/api.service.js` |
| Update config | `src/config/app.config.js` |
| Add helper | `src/utils/helpers.js` |

---

**Last Updated**: January 2026
**Status**: ✅ Complete & Ready
