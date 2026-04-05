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
import { 
  Plus, 
  ShieldCheck, 
  Building 
} from 'lucide-react';

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
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-12 shadow-2xl text-center max-w-md w-full animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-zinc-900 dark:bg-white rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl">
              <Plus className="w-10 h-10 text-white dark:text-zinc-950" />
            </div>
            <h3 className="text-3xl font-bold mb-4 tracking-tighter text-zinc-900 dark:text-white">Get Started</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed font-medium">
              You need to create a Workspace to start managing your properties and tenants.
            </p>
            <button 
              onClick={createInitialWorkspace}
              disabled={creatingWorkspace}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-8 py-4 rounded-2xl text-sm font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl"
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
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="relative mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-[1px] w-8 bg-zinc-400 dark:bg-zinc-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Overview</span>
                </div>
                <h2 className="text-5xl font-bold tracking-tighter sm:text-6xl text-zinc-900 dark:text-white">Dashboard</h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-4 text-lg font-medium max-w-2xl leading-relaxed">
                  Welcome back, <span className="text-zinc-900 dark:text-white font-bold">{user?.name || user?.email?.split('@')[0]}</span>. 
                  Efficiency is the key to property management.
                </p>
              </div>
            </div>

            <DashboardStats workspaceId={selectedWorkspaceId} />

            <div className="relative rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-8 shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Active Workspaces</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage your team and roles</p>
                </div>
              </div>
              
              <div className="relative">
                {user?.workspaces && user.workspaces.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {user.workspaces.map((member) => (
                      <div 
                        key={member.workspace.id} 
                        className={`group relative flex flex-col p-6 rounded-[2rem] border transition-all duration-300 ${
                          selectedWorkspaceId === member.workspace.id 
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl' 
                            : 'bg-white/40 dark:bg-zinc-900/40 border-white/20 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className={`p-3 rounded-2xl ${selectedWorkspaceId === member.workspace.id ? 'bg-white/10' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                            <Building className={`w-5 h-5 ${selectedWorkspaceId === member.workspace.id ? 'text-white' : 'text-zinc-500'}`} />
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            selectedWorkspaceId === member.workspace.id 
                              ? 'bg-white/20 text-white' 
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}>
                            {member.role.replace('_', ' ')}
                          </div>
                        </div>
                        <h4 className="text-xl font-bold tracking-tight mb-2">{member.workspace.name}</h4>
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <span className={`text-[10px] font-medium ${selectedWorkspaceId === member.workspace.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            {member.role === 'PROPERTY_MANAGER' ? 'Full Access' : 'View Only'}
                          </span>
                          {selectedWorkspaceId === member.workspace.id && (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-12 font-medium">You are not a member of any workspaces yet.</p>
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
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
}
