-- ==============================================================================
-- PropertyStack Production Database Row Level Security (RLS) Policy Migration
-- ==============================================================================
-- Description:
-- Enforces database-level multi-tenant isolation across all 20 public schema tables.
-- 1. Enables ROW LEVEL SECURITY on every table.
-- 2. Revokes table access from anonymous (anon) Supabase API clients (Default Deny).
-- 3. Grants full bypass/access to service_role (used by backend Fastify API & Prisma).
-- 4. Enforces workspace-level isolation for direct authenticated PostgREST queries.
-- ==============================================================================

-- Helper Function: Check if the authenticated Supabase user is an active member of the workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."WorkspaceMember"
    WHERE "workspaceId" = ws_id
      AND "userId" = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on All Tables
-- ------------------------------------------------------------------------------

ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Lease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."PaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."ErrorLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MaintenanceMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."RentReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."LeaseRenewalOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SecurityAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."UpgradeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."LegalLeaseRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Revoke All Direct Public / Anon Permissions (Zero-Trust Default Deny)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User', 'Workspace', 'WorkspaceMember', 'Property', 'Unit', 'Tenant',
    'Lease', 'Payment', 'PaymentTransaction', 'MaintenanceRequest', 'Notification',
    'ErrorLog', 'MaintenanceMessage', 'RentReminder', 'LeaseRenewalOffer',
    'WebhookEvent', 'SecurityAuditLog', 'UpgradeRequest', 'LegalLeaseRequest', 'AuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon;', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Grant Service Role Full Access (Backend API & Prisma Superuser)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User', 'Workspace', 'WorkspaceMember', 'Property', 'Unit', 'Tenant',
    'Lease', 'Payment', 'PaymentTransaction', 'MaintenanceRequest', 'Notification',
    'ErrorLog', 'MaintenanceMessage', 'RentReminder', 'LeaseRenewalOffer',
    'WebhookEvent', 'SecurityAuditLog', 'UpgradeRequest', 'LegalLeaseRequest', 'AuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Define Scoped Policies for Authenticated Clients
-- ------------------------------------------------------------------------------

-- User Profile Policy: Users can only read & update their own record
DROP POLICY IF EXISTS "Users can view and update own profile" ON public."User";
CREATE POLICY "Users can view and update own profile" ON public."User"
  FOR ALL
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Workspace Membership Policy: Users can view memberships they belong to
DROP POLICY IF EXISTS "Members can view their workspace memberships" ON public."WorkspaceMember";
CREATE POLICY "Members can view their workspace memberships" ON public."WorkspaceMember"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- Workspace Policy: Members can view workspaces they belong to
DROP POLICY IF EXISTS "Members can view their workspaces" ON public."Workspace";
CREATE POLICY "Members can view their workspaces" ON public."Workspace"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(id));

-- Property Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view properties" ON public."Property";
CREATE POLICY "Workspace members can view properties" ON public."Property"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Unit Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view units" ON public."Unit";
CREATE POLICY "Workspace members can view units" ON public."Unit"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Tenant Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view tenants" ON public."Tenant";
CREATE POLICY "Workspace members can view tenants" ON public."Tenant"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Lease Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view leases" ON public."Lease";
CREATE POLICY "Workspace members can view leases" ON public."Lease"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Payment Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view payments" ON public."Payment";
CREATE POLICY "Workspace members can view payments" ON public."Payment"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Maintenance Request Policy: Scoped to workspace membership
DROP POLICY IF EXISTS "Workspace members can view maintenance requests" ON public."MaintenanceRequest";
CREATE POLICY "Workspace members can view maintenance requests" ON public."MaintenanceRequest"
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- Notifications: Users only see their own notifications
DROP POLICY IF EXISTS "Users view own notifications" ON public."Notification";
CREATE POLICY "Users view own notifications" ON public."Notification"
  FOR ALL
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

-- Audit & Security Logs: Only service_role can view and insert
DROP POLICY IF EXISTS "Deny authenticated direct log writes" ON public."SecurityAuditLog";
CREATE POLICY "Deny authenticated direct log writes" ON public."SecurityAuditLog"
  FOR ALL
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Deny authenticated direct error log writes" ON public."ErrorLog";
CREATE POLICY "Deny authenticated direct error log writes" ON public."ErrorLog"
  FOR ALL
  TO authenticated
  USING (false);
