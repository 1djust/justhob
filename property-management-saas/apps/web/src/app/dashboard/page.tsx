'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { PropertiesList } from '@/components/properties/PropertiesList';
import { TenantsList } from '@/components/tenants/TenantsList';
import { PaymentsList } from '@/components/payments/PaymentsList';
import { MaintenanceList } from '@/components/maintenance/MaintenanceList';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { WorkspaceSettings } from '@/components/settings/WorkspaceSettings';
import { OwnerManagement } from '@/components/owners/OwnerManagement';
import { Sidebar } from '@/components/dashboard/Sidebar';

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceMember {
  workspace: Workspace;
  role: string;
}

interface User {
  email: string;
  name?: string;
  workspaces?: WorkspaceMember[];
}

type DashboardView = 'dashboard' | 'properties' | 'tenants' | 'owners' | 'payments' | 'maintenance' | 'settings';

export default function DashboardPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const [activeView, setActiveView] = React.useState<DashboardView>('dashboard');
  const router = useRouter();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<{ id: string; name: string }[]>([]);
  const [leases, setLeases] = React.useState<{ id: string }[]>([]);

  const activeRole = user?.workspaces?.find((w) => w.workspace.id === selectedWorkspaceId)?.role;
  const isPropertyManager = activeRole === 'PROPERTY_MANAGER';

  React.useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/auth/me`)
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
    await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    router.push('/login');
  };

  const createInitialWorkspace = async () => {
    setCreatingWorkspace(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/workspaces`, {
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

  const renderActiveView = () => {
    if (!selectedWorkspaceId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-12 shadow-xl text-center max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4 tracking-tight">Get Started</h3>
            <p className="text-zinc-500 mb-8 leading-relaxed">
              You need to create a Workspace to start adding properties and tenants.
            </p>
            <button 
              onClick={createInitialWorkspace}
              disabled={creatingWorkspace}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-6 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {creatingWorkspace ? 'Creating...' : 'Create "My Properties" Workspace'}
            </button>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
              <p className="text-zinc-500 mt-2">Welcome back, {user?.name || user?.email?.split('@')[0]}. Here is your property overview.</p>
            </div>
            <DashboardStats workspaceId={selectedWorkspaceId} />
            <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="font-semibold text-lg">Your Workspaces</h3>
              </div>
              <div className="p-6">
                {user?.workspaces && user.workspaces.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.workspaces.map((member) => (
                      <li key={member.workspace.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 border border-border p-4 rounded-xl group transition-all hover:border-zinc-400 dark:hover:border-zinc-600">
                        <span className="font-medium">{member.workspace.name}</span>
                        <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {member.role.replace('_', ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-500 text-center py-8">You are not a member of any workspaces yet.</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'properties':
        return <PropertiesList workspaceId={selectedWorkspaceId} onPropertiesLoaded={setProperties} isPropertyManager={isPropertyManager} />;
      case 'tenants':
        return isPropertyManager ? <TenantsList workspaceId={selectedWorkspaceId} properties={properties} onLeasesLoaded={setLeases} /> : null;
      case 'owners':
        return isPropertyManager ? <OwnerManagement workspaceId={selectedWorkspaceId} /> : null;
      case 'payments':
        return <PaymentsList workspaceId={selectedWorkspaceId} leases={leases} isPropertyManager={isPropertyManager} />;
      case 'maintenance':
        return <MaintenanceList workspaceId={selectedWorkspaceId} isPropertyManager={isPropertyManager} />;
      case 'settings':
        return isPropertyManager ? <WorkspaceSettings workspaceId={selectedWorkspaceId} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
        isPropertyManager={isPropertyManager}
        userEmail={user?.email}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 lg:ml-64 transition-all duration-300 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 pb-24">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
}
