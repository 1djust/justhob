# PropertyStack Test Accounts

All test accounts have been synchronized with the following password for ease of use.

**Global Password:** `Test1234!`

## 🔑 Account Directory

| Role | Email | Purpose |
| :--- | :--- | :--- |
| **Super Admin** | `admin@justhob.com` | Access Admin Dashboard, trigger System Jobs (Crons), and manage global settings. |
| **Property Manager** | `manager@justhob.com` | Manage properties, approve payments, and send lease renewal offers. |
| **Tenant** | `tenant@justhob.com` | Used for testing all lease expiry and payment overdue notifications based on the scenario script. |

---

## 🚀 Testing Workflow

1. **Setup Data**: Run the script with the desired scenario parameter in the `property-management-saas` directory:
   - `npx tsx setup-mega-test.ts 90` (90-day lease expiry)
   - `npx tsx setup-mega-test.ts 60` (60-day lease expiry)
   - `npx tsx setup-mega-test.ts 30` (30-day lease expiry)
   - `npx tsx setup-mega-test.ts 7` (7-day pre-due payment alert)
   - `npx tsx setup-mega-test.ts 1` (1-day overdue payment alert)
   - `npx tsx setup-mega-test.ts 14` (14-day overdue feature restriction)
   - `npx tsx setup-mega-test.ts 21` (21-day overdue final warning)
   - `npx tsx setup-mega-test.ts 31` (30+ day overdue complete lockout & eviction notice)
2. **Trigger Jobs**: Log in as **Admin** on the web dashboard and click **"Run System Jobs Now"**.
3. **Verify App**: Log in as the **Tenant** on the mobile app to see the real-time banners and notifications.
