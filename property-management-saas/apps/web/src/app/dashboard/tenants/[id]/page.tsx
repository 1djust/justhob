'use client';

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { apiFetch } from '@/lib/api';

interface Lease {
  id: string;
  status: string;
  startDate: string;
  endDate?: string;
  property?: { name: string; address: string };
}

interface Tenant {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  leases?: Lease[];
}

export default function TenantProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const workspaceId = searchParams.get('workspaceId');

  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({ name: '', email: '', phone: '' });

  React.useEffect(() => {
    if (!workspaceId || !tenantId) return;
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/tenants/${tenantId}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setTenant(data.tenant);
        setFormData({
          name: data.tenant.name || '',
          email: data.tenant.email || '',
          phone: data.tenant.phone || ''
        });
        setLoading(false);
      })
      .catch(() => {
        router.push('/dashboard');
      });
  }, [workspaceId, tenantId, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/tenants/${tenantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      credentials: 'include'
    });
    setTenant({ ...tenant, ...formData });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const copyPortalLink = () => {
    const url = `${window.location.origin}/t/${tenantId}`;
    navigator.clipboard.writeText(url);
    alert('Public Portal Link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white dark:bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-zinc-500 hover:text-foreground transition-colors">
            ← Dashboard
          </button>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <h1 className="text-xl font-bold tracking-tight">Tenant Profile</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8 mt-4">
        {/* Tenant Info Card */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{tenant.name}</h2>
              <p className="text-sm text-zinc-500 mt-1">Added {new Date(tenant.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyPortalLink}
                className="text-sm font-medium px-4 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800"
              >
                Copy Portal Link
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          {editing ? (
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Name</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Phone</label>
                  <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Email</p>
                <p className="font-medium">{tenant.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Phone</p>
                <p className="font-medium">{tenant.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Active Leases</p>
                <p className="font-medium">{tenant.leases?.filter((l) => l.status === 'ACTIVE').length || 0}</p>
              </div>
            </div>
          )}
        </div>

        {/* Lease History */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Lease History</h3>
          </div>
          <div className="p-6">
            {tenant.leases?.length > 0 ? (
              <div className="space-y-3">
                {tenant.leases.map((lease) => (
                  <div key={lease.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-border p-4 rounded-lg">
                    <div>
                      <p className="font-medium">{lease.property?.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{lease.property?.address}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        lease.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        lease.status === 'EXPIRED' ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {lease.status}
                      </span>
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(lease.startDate).toLocaleDateString()} → {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">No leases found for this tenant.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
