'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { apiFetch } from '@/lib/api';
import { PropertiesList } from '@/components/properties/PropertiesList';
import { TenantsList } from '@/components/tenants/TenantsList';
import { PaymentsList } from '@/components/payments/PaymentsList';
import { MaintenanceList } from '@/components/maintenance/MaintenanceList';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { WorkspaceSettings } from '@/components/settings/WorkspaceSettings';
import { OwnerManagement } from '@/components/owners/OwnerManagement';

export default function DashboardPage() {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const router = useRouter();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<any[]>([]);
  const [leases, setLeases] = React.useState<any[]>([]);

  const activeRole = user?.workspaces?.find((w: any) => w.workspace.id === selectedWorkspaceId)?.role;
  const isPropertyManager = activeRole === 'PROPERTY_MANAGER';

  React.useEffect(() => {
    apiFetch('http://localhost:3001/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        setUser(data.user);
        if (data.user?.workspaces?.length > 0) {
          setSelectedWorkspaceId(data.user.workspaces[0].workspace.id);
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const handleLogout = async () => {
    await apiFetch('http://localhost:3001/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const createInitialWorkspace = async () => {
    setCreatingWorkspace(true);
    try {
      const res = await apiFetch('http://localhost:3001/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Properties' })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white dark:bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Property Management</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 whitespace-nowrap">Logged in as <strong className="text-foreground">{user?.email}</strong></span>
          <ThemeToggle />
          <button 
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6 space-y-8 mt-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-zinc-500 mt-2">Welcome back, {user?.name || user?.email?.split('@')[0]}. Here is an overview of your properties.</p>
        </div>

        {selectedWorkspaceId ? (
          <DashboardStats workspaceId={selectedWorkspaceId} />
        ) : (
          <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-8 shadow-sm text-center">
            <h3 className="text-lg font-bold mb-2">Get Started</h3>
            <p className="text-zinc-500 mb-6">You need to create a Workspace to start adding properties and tenants.</p>
            <button 
              onClick={createInitialWorkspace}
              disabled={creatingWorkspace}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {creatingWorkspace ? 'Creating...' : 'Create "My Properties" Workspace'}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden mt-8">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Your Workspaces</h3>
          </div>
          <div className="p-6">
            {user?.workspaces?.length > 0 ? (
              <ul className="space-y-4">
                {user.workspaces.map((member: any) => (
                  <li key={member.workspace.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 border border-border p-4 rounded-lg">
                    <span className="font-medium">{member.workspace.name}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-center py-8">You are not a member of any workspaces yet.</p>
            )}
          </div>
        </div>
        {selectedWorkspaceId && (
          <PropertiesList workspaceId={selectedWorkspaceId} onPropertiesLoaded={setProperties} isPropertyManager={isPropertyManager} />
        )}
        {selectedWorkspaceId && isPropertyManager && (
          <OwnerManagement workspaceId={selectedWorkspaceId} />
        )}
        {selectedWorkspaceId && isPropertyManager && (
          <TenantsList workspaceId={selectedWorkspaceId} properties={properties} onLeasesLoaded={setLeases} />
        )}
        {selectedWorkspaceId && (
          <PaymentsList workspaceId={selectedWorkspaceId} leases={leases} isPropertyManager={isPropertyManager} />
        )}
        {selectedWorkspaceId && (
          <MaintenanceList workspaceId={selectedWorkspaceId} isPropertyManager={isPropertyManager} />
        )}
        {selectedWorkspaceId && isPropertyManager && (
          <WorkspaceSettings workspaceId={selectedWorkspaceId} />
        )}
      </main>
    </div>
  );
}
