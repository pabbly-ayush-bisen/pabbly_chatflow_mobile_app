# Pabbly Chatflow Mobile App - Organization Account Requirements

## Executive Summary

The Pabbly Chatflow mobile application currently uses personal developer accounts for critical infrastructure services. For production deployment, security, and team collaboration, these need to be transitioned to organization-level accounts.

---

## Services Overview

| Service | Current Status | Purpose | Action Required |
|---------|---------------|---------|-----------------|
| Expo (EAS) | Personal Account | App builds, OTA updates | Create Organization Account |
| Firebase (FCM) | Personal Project | Push notification delivery | Transfer to Organization |
| OneSignal | Personal Account | Push notification management | Create Organization Account |
| Google Play Console | - | Android app distribution | Organization Account |
| Apple Developer | - | iOS app distribution | Organization Account |

---

## 1. Expo / EAS (Expo Application Services)

### What is it?
Expo is the development framework used to build the React Native mobile app. EAS (Expo Application Services) provides:
- **EAS Build**: Cloud-based Android/iOS builds
- **EAS Update**: Over-the-air (OTA) updates without app store submissions
- **EAS Submit**: Automated app store submissions

### Why is it needed?
- Builds Android APK/AAB and iOS IPA files
- Enables instant bug fixes via OTA updates
- Manages app signing credentials securely
- Provides build logs and crash reports

### Current Configuration
```
Account: aakash-bhelkar-pabbly
Project: chatflow_mobile_native
Build Profiles: development, preview, production
```

### Organization Requirements
1. Create Expo organization account
2. Transfer project ownership
3. Add team members with appropriate roles
4. Configure billing

### Pricing (as of 2024)

| Plan | Price | Builds/Month | OTA Updates | Team Members |
|------|-------|--------------|-------------|--------------|
| **Free** | $0 | 30 | 1,000 | 1 |
| **Production** | $99/month | Unlimited | 50,000 | Unlimited |
| **Enterprise** | Custom | Unlimited | Custom | Unlimited |

**Recommendation**: Start with **Free tier** for initial deployment, upgrade to **Production ($99/month)** when:
- Build queue times become a bottleneck
- OTA updates exceed 1,000/month
- Team needs multiple developer access

---

## 2. Firebase Cloud Messaging (FCM)

### What is it?
Firebase Cloud Messaging is Google's service for sending push notifications to Android and iOS devices.

### Why is it needed?
- Required by OneSignal for Android push notification delivery
- Provides device registration tokens
- Handles notification delivery to Android devices
- Required for Google Play Store compliance

### Current Configuration
```
Project: Configured via google-services.json
Package: com.pabbly.chatflow
Services: Cloud Messaging enabled
```

### Organization Requirements
1. Create Firebase project under organization Google Cloud account
2. Generate new `google-services.json` for Android
3. Generate new `GoogleService-Info.plist` for iOS
4. Update app configuration with new credentials
5. Add team members to Firebase project

### Pricing

| Tier | Price | Messages |
|------|-------|----------|
| **Free (Spark)** | $0 | Unlimited push notifications |
| **Blaze (Pay-as-you-go)** | $0 base | Unlimited + additional Firebase services |

**Note**: FCM itself is **FREE** with unlimited messages. However, if using other Firebase services (Analytics, Crashlytics), the Blaze plan may be needed.

**Recommendation**: **Free tier is sufficient** for push notifications only.

---

## 3. OneSignal

### What is it?
OneSignal is a push notification service that provides:
- Cross-platform notification delivery (Android/iOS)
- User segmentation and targeting
- Notification analytics
- In-app messaging

### Why is it needed?
- Manages push notification subscriptions (player IDs)
- Provides notification templates and scheduling
- Offers delivery analytics and open rates
- Simplifies targeting specific users or segments
- Handles notification delivery optimization

### Current Configuration
```
App ID: f078c1e9-fe64-4ef6-ae44-4546b082f14e
Platform: Android + iOS
Integration: react-native-onesignal SDK v5.3.0
Features Used:
  - Push notifications
  - User external ID mapping
  - Foreground notification handling
  - Notification click handling
```

### Organization Requirements
1. Create OneSignal organization account
2. Create new app under organization
3. Configure FCM credentials (from organization Firebase)
4. Configure APNs credentials (from organization Apple Developer)
5. Update app with new OneSignal App ID
6. Add team members

### Pricing

| Plan | Price | Mobile Push Subscribers | Features |
|------|-------|------------------------|----------|
| **Free** | $0 | Unlimited | Basic push, segments |
| **Growth** | $9/month | Unlimited | + Analytics, A/B testing |
| **Professional** | $99/month | Unlimited | + Advanced targeting, API access |
| **Enterprise** | Custom | Unlimited | + SLA, dedicated support |

**Current App Usage**:
- Basic push notifications
- User external ID mapping
- Foreground/background handling

**Recommendation**: **Free tier is sufficient** for current features. Upgrade to Growth ($9/month) if:
- Advanced analytics needed
- A/B testing for notifications
- Automated messaging campaigns

---

## 4. Google Play Console (Android Distribution)

### What is it?
Google Play Console is the platform for publishing and managing Android apps on the Google Play Store.

### Why is it needed?
- Required to publish Android app on Play Store
- Manages app updates and releases
- Provides download statistics and crash reports
- Handles in-app purchases (if needed)
- Manages app signing keys

### Organization Requirements
1. Create Google Play Developer organization account
2. Pay one-time registration fee
3. Complete organization verification
4. Configure app signing
5. Add team members with roles

### Pricing

| Item | Cost | Frequency |
|------|------|-----------|
| **Registration Fee** | $25 | One-time |
| **Service Fee** | 15-30% | Per transaction (for paid apps/IAP) |

**Note**: For free apps with no in-app purchases, only the $25 one-time fee applies.

**Recommendation**: **$25 one-time fee** - Essential for Play Store distribution.

---

## 5. Apple Developer Program (iOS Distribution)

### What is it?
Apple Developer Program membership required to publish iOS apps on the App Store.

### Why is it needed?
- Required to publish iOS app on App Store
- Provides APNs certificates for push notifications
- Access to TestFlight for beta testing
- Code signing certificates

### Organization Requirements
1. Enroll in Apple Developer Program as Organization
2. Requires D-U-N-S Number for organization
3. Complete organization verification
4. Configure certificates and provisioning profiles
5. Add team members with roles

### Pricing

| Program | Cost | Frequency |
|---------|------|-----------|
| **Apple Developer Program** | $99 | Annual |
| **Apple Developer Enterprise Program** | $299 | Annual (for internal apps only) |

**Recommendation**: **$99/year** - Required for App Store distribution.

---

## Migration Checklist

### Phase 1: Account Setup
- [ ] Create Expo organization account
- [ ] Create Firebase project under organization
- [ ] Create OneSignal organization account
- [ ] Register Google Play Developer account
- [ ] Enroll in Apple Developer Program

### Phase 2: Configuration
- [ ] Transfer Expo project to organization
- [ ] Generate new `google-services.json`
- [ ] Generate new `GoogleService-Info.plist`
- [ ] Create new OneSignal app with organization credentials
- [ ] Update app configuration files

### Phase 3: Credentials Update
- [ ] Update `google-services.json` in app
- [ ] Update OneSignal App ID in `app.config.jsx`
- [ ] Configure EAS credentials for production signing
- [ ] Generate new APK signing keystore (or transfer existing)

### Phase 4: Testing
- [ ] Build preview APK with new credentials
- [ ] Test push notifications end-to-end
- [ ] Verify OneSignal player ID registration
- [ ] Test OTA updates

### Phase 5: Production Deployment
- [ ] Build production release
- [ ] Submit to Google Play Store
- [ ] Submit to Apple App Store

---

## Cost Summary

### One-Time Costs
| Item | Cost |
|------|------|
| Google Play Developer Registration | $25 |
| **Total One-Time** | **$25** |

### Annual Costs
| Item | Cost |
|------|------|
| Apple Developer Program | $99/year |
| **Total Annual** | **$99/year** |

### Monthly Costs (Current Requirements)
| Service | Plan | Cost |
|---------|------|------|
| Expo/EAS | Free | $0 |
| Firebase (FCM) | Free | $0 |
| OneSignal | Free | $0 |
| **Total Monthly** | | **$0** |

### Optional Monthly Costs (If Scaling)
| Service | Plan | Cost | When Needed |
|---------|------|------|-------------|
| Expo/EAS | Production | $99/month | >30 builds/month or >1000 OTA updates |
| OneSignal | Growth | $9/month | Advanced analytics, A/B testing |

---

## Credentials Required from Organization

To complete the migration, the following credentials/access will be needed:

### From Google/Firebase
1. Organization Google account with billing enabled
2. Access to create Firebase projects

### From Apple
1. Organization Apple ID
2. D-U-N-S Number (for organization enrollment)
3. Legal entity information

### From OneSignal
1. Organization email for account creation
2. Firebase FCM credentials (after Firebase setup)
3. Apple APNs credentials (after Apple Developer setup)

### From Expo
1. Organization email for account creation
2. Billing information (for future paid plans)

---

## Security Considerations

### Why Organization Accounts Matter
1. **Access Control**: Remove access when team members leave
2. **Audit Trail**: Track who made changes
3. **Credential Security**: Centralized credential management
4. **Business Continuity**: App ownership doesn't depend on individual accounts
5. **Compliance**: Enterprise security requirements

### Current Risk with Personal Accounts
- App ownership tied to personal account
- Credentials stored in personal accounts
- No team access management
- Potential data privacy concerns

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Account Setup | 1-2 weeks (Apple verification can take time) |
| Configuration | 1-2 days |
| Credential Update | 1 day |
| Testing | 2-3 days |
| Production Deployment | 1-2 days |
| **Total** | **2-3 weeks** |

---

## Contact Information

For questions about this migration:
- Technical Implementation: [Development Team]
- Account/Billing: [IT/Finance Team]
- App Store Management: [Product Team]

---

*Document Version: 1.0*
*Last Updated: February 2024*
*Prepared for: Pabbly Chatflow Mobile App Stakeholders*
