# PropertyStack Feature & Enhancement Backlog

This file tracks planned features, technical debt, and future infrastructure enhancements.

---

## 📌 Native Push Notifications (FCM & APNs)

**Category**: Mobile Infrastructure & Real-Time Messaging  
**Priority**: Backlog (Deferred)  
**Target Platform**: `propertystack_mobile` (Flutter iOS & Android) & `apps/api` (Fastify Node.js Backend)

### Current State
PropertyStack has full **In-App Notification support**:
- ✅ Database `Notification` table with REST API (`GET /notifications`, `PATCH /read-all`, `PATCH /:id/read`)
- ✅ Real-time Socket.IO events (`NOTIFICATION_CREATED`) for live in-app updates
- ✅ 15-second polling fallback in `notifications_notifier.dart`
- ✅ Notification Settings UI with toggle switches (UI-only, not persisted to API)

### What's Missing (Native Push)
Users receive **no OS-level tray alerts** when the app is backgrounded or closed.

---

### Implementation Breakdown

#### 1. Firebase Project Setup
- Create Firebase project in Firebase Console
- Download `google-services.json` → `android/app/`
- Download `GoogleService-Info.plist` → iOS Xcode runner
- Configure APNs Auth Key (`.p8`) for iOS push delivery

#### 2. Mobile Client (`propertystack_mobile`)
- **Dependencies**: Add `firebase_core`, `firebase_messaging`, `flutter_local_notifications`
- **FCM Token Handler**:
  - Request notification permissions on launch
  - Obtain FCM device registration token
  - Post token to API on login & token refresh (`POST /users/me/device-tokens`)
- **Background Listener**:
  - Implement top-level `@pragma('vm:entry-point')` background message handler

#### 3. Backend API (`apps/api`)
- **Database Schema**: Add `DeviceToken` model (`userId`, `token`, `platform`, `updatedAt`)
- **Firebase Admin SDK**: Initialize `firebase-admin` with service account credentials
- **Notification Dispatcher**: Extend `prisma.notification.create` calls to enqueue FCM push to all active `DeviceToken` entries for the recipient

#### 4. User Preference Persistence
- Update `notification_settings_screen.dart` to save toggle preferences (`pushEnabled`, `emailEnabled`, event-specific) to user profile on the API

### Open Questions (To Resolve Before Implementation)
1. Should push notifications work for both tenants and managers, or managers only initially?
2. Which events should trigger a push? (payment received, maintenance logged, lease expiring, overdue rent, or all?)
3. Firebase project — new or existing?
