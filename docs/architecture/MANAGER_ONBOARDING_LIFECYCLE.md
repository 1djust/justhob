# PropertyStack Manager Access & Onboarding Lifecycle Guide

This document defines the complete end-to-end security, authentication, and onboarding lifecycle for **Property Managers** on the PropertyStack platform (Web, API, and Mobile).

---

## 🏗️ Architecture & Access Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Account Registration                               │
│  • Full Name, Company Email, Password                       │
│  • Accepts Terms of Service & Privacy Policy                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Email / OTP Verification (Security Gatekeeper 1)   │
│  • 6-digit verification code delivered to inbox             │
│  • 🔒 API blocks unconfirmed users (AUTH_EMAIL_NOT_CONFIRMED)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Initial Login & Backend Profile Sync               │
│  • JWT session issued via Supabase Auth                     │
│  • /api/auth/sync provisions Prisma User with role          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Workspace & Payout Setup (Security Gatekeeper 2)   │
│  • Company / Workspace Name                                 │
│  • Phone Number                                             │
│  • Settlement Bank Details (for rent collection & payouts)  │
│  • 🔒 App Router forces /onboarding until completed         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  🎉 Step 5: Full Application Access Granted                 │
│  • Web: /dashboard                                          │
│  • Mobile: /landlord                                        │
│  • Ready to Add Properties, Landlords, Tenants & Leases     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Detailed Step-by-Step Breakdown

### Step 1: Account Registration
- **Locations**:
  - Web: `apps/web/src/app/(auth)/register/page.tsx`
  - Mobile: `propertystack_mobile/lib/features/auth/presentation/register_screen.dart`
- **Required Fields**:
  - Full Name (checked for duplicate/similarity protection)
  - Company Email
  - Password (min 8 characters: 1 uppercase, 1 lowercase, 1 number, 1 special character)
  - Mandatory consent checkbox for Terms of Service and Privacy Policy
- **System Action**: Creates a Supabase Auth user record with metadata `{ role: "PROPERTY_MANAGER" }`.

---

### Step 2: Email / OTP Verification (Gatekeeper 1)
- **Mechanism**: A 6-digit OTP code is dispatched via email from `PropertyStack <propertystackapp@gmail.com>`.
- **Verification**:
  - The manager enters the code on the verification screen or uses the smart email link:
    ```
    https://propertystack.vercel.app/link?action=register&step=otp&email=user@example.com
    ```
- **Security Enforcement**:
  - Unverified accounts cannot make operational API calls.
  - The Fastify backend (`apps/api/src/routes/auth.ts`) returns `AUTH_EMAIL_NOT_CONFIRMED` (HTTP 401) until `email_confirmed_at` is set.
- **Automated Follow-ups**:
  - If unverified after 24 hours: **Stage 1 Reminder Email** is dispatched automatically.
  - If unverified after 72 hours: **Stage 2 (Final) Reminder Email** is dispatched.

---

### Step 3: Initial Sign-In & Profile Sync
- **Locations**:
  - Web: `/login` (`apps/web/src/app/(auth)/login/page.tsx`)
  - Mobile: `/login` (`propertystack_mobile/lib/features/auth/presentation/login_screen.dart`)
- **System Action**:
  - Authenticates against Supabase Auth to retrieve a secure JWT session.
  - Automatically calls `POST /api/auth/sync` to create or update the manager's profile in the PostgreSQL/Prisma database.

---

### Step 4: Workspace & Banking Onboarding (Gatekeeper 2)
- **Locations**:
  - Web: `/dashboard` (Onboarding Setup Modal)
  - Mobile: `/onboarding` (`propertystack_mobile/lib/features/auth/presentation/manager_onboarding_screen.dart`)
- **Required Fields**:
  - **Workspace Name**: The legal company name or brand (e.g., *"Bitachon Real Estate"*).
  - **Phone Number**: Official contact number.
  - **Bank Code, Account Number & Account Name**: Required for automated payment disbursement and rent collection settlement.
- **Enforcement Rules**:
  - In `app_router.dart` (Mobile) and Next.js middleware (Web):
    ```dart
    final isManager = authStateValue.role == 'PROPERTY_MANAGER';
    final isOnboarded = authStateValue.isOnboarded && authStateValue.workspaces.isNotEmpty;

    if (isManager && !isOnboarded) {
      return '/onboarding'; // Forces onboarding
    }
    ```
- **Automated Follow-ups**:
  - Verified managers who have 0 properties in their workspace receive the **Onboarding Setup Guide** email prompting them to add their first building.

---

### Step 5: Full Application Access
Once the manager completes Onboarding:
- **Web App**: Unlocks the full navigation menu (`/dashboard`, `/properties`, `/tenants`, `/payments`, `/maintenance`, `/owners`, `/reports`).
- **Mobile App**: Unlocks the Landlord/Manager screen (`/landlord`) with full property and tenant administration capabilities.

---

## 🛠️ Automated Reminder & Follow-Up System

PropertyStack includes an automated cron pipeline for onboarding recovery:

| Trigger Condition | Notification Sent | Smart Deep Link Destination |
| :--- | :--- | :--- |
| **Unconfirmed Email ($\ge$ 24h)** | Stage 1: Complete Registration | `/link?action=register&step=otp` (Resumes at OTP input) |
| **Unconfirmed Email ($\ge$ 72h)** | Stage 2: Final Reminder | `/link?action=register&step=otp` (Resumes at OTP input) |
| **0 Properties in Workspace** | Onboarding Setup Guide | `/link?action=dashboard` (Opens Add Property wizard) |

---

## 🔍 Verification & Audit Commands

To inspect the status of any manager or check incomplete onboarding accounts:

```bash
# Full audit of unconfirmed users and empty workspaces
cd property-management-saas/apps/api
npx tsx src/scripts/audit-incomplete-users.ts

# Inspect a specific user account by email
npx tsx src/scripts/inspect-user.ts

# Dispatch onboarding reminders to pending managers
npx tsx src/scripts/dispatch-onboarding-reminders.ts
```
