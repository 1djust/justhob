# Security Incident Response & Log Management Runbook

This runbook defines operational procedures for Super Administrators managing platform security, responding to network threats, and conducting audit investigations on PropertyStack.

---

## 1. System Logging Architecture

PropertyStack operates three distinct real-time telemetry streams:

1. **System Error & Performance Feed (`Errors` Tab)**
   - **Captured Data**: Unhandled API crashes, server stack traces, and slow database queries (>3000ms).
   - **Automated Privacy Redaction**: All sensitive parameters (passwords, JWT tokens, API keys, database connection strings) are recursively sanitized to `[REDACTED]` prior to storage and presentation.
   - **Super Admin Workflow**: When errors occur, click **Show Details** $\rightarrow$ **Copy Log**, and transmit the sanitized payload to your software engineering team for resolution.

2. **Security Telemetry Feed (`Security & MFA` Tab)**
   - **Captured Data**: Unauthorized endpoint probing (`UNAUTHORIZED_API_ACCESS`), failed authentication attempts (`FAILED_LOGIN`), and rate limit violations (`RATE_LIMIT_EXCEEDED`).
   - **Automated Threshold Alerting**: The system continuously monitors event density per IP address. If an IP triggers 10 security violations within 5 minutes, an emergency alert email is automatically dispatched to the platform administrator.

3. **Manager Operational Audit Trail (`Manager Audit Trail` Tab)**
   - **Captured Data**: Full traceability of all property manager operations across 15+ backend routes (including property creations, unit listings, tenant lease approvals, rent payment reviews, and landlord payout bank detail updates).
   - **Dispute Resolution Workflow**: Use the real-time search bar to filter actions by manager name, email, or target landlord/tenant to establish legal accountability and proof.

---

## 2. Threat Mitigation Procedures

### Action Plan A: Blocking Malicious IP Addresses

#### 1. Cloudflare / Edge Hosting Firewall (Production Recommended)
- Copy the offending IP address from the Security Telemetry Feed.
- Access your Cloudflare or hosting WAF control panel.
- Navigate to **Security** $\rightarrow$ **WAF** $\rightarrow$ **IP Access Rules**.
- Add a new rule for the target IP address and set the action to **Block**.

#### 2. Linux VPS Host Firewall
- Execute the following command on your primary Linux server:
  ```bash
  sudo ufw deny from <MALICIOUS_IP> to any
  ```

---

### Action Plan B: Securing Compromised Accounts

If unauthorized activity targets a specific property manager account:
1. Open **Users Management** on the Super Admin sidebar.
2. Search for the manager's email address.
3. Verify their Multi-Factor Authentication (2FA) status.
4. Temporarily set their status to **Deactivated** or trigger a mandatory password reset.
5. Notify the user via verified communication channels before restoring privileges.
