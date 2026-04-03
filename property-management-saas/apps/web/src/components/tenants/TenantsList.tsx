'use client';

import * as React from 'react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface Lease {
  id: string;
  status: string;
  unit?: { unitNumber: string };
  property?: { name: string };
}

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  leases: Lease[];
}

interface Property {
  id: string;
  name: string;
  units?: { id: string; status: string; unitNumber: string; type: string }[];
}

interface TenantProps {
  workspaceId: string;
  properties: Property[];
  onLeasesLoaded?: (leases: Lease[]) => void;
}

export function TenantsList({ workspaceId, properties, onLeasesLoaded }: TenantProps) {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [assigningTenantId, setAssigningTenantId] = React.useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
        const allLeases = (data.tenants || []).flatMap((t: Tenant) => t.leases || []);
        onLeasesLoaded?.(allLeases);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (workspaceId) fetchTenants();
  }, [workspaceId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this tenant?')) return;
    await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    fetchTenants();
  };

  if (loading) return <div className="mt-8">Loading tenants...</div>;

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <h3 className="text-xl font-bold tracking-tight">Tenants</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : 'Add Tenant'}
        </button>
      </div>

      {showForm && (
        <TenantForm workspaceId={workspaceId} onComplete={() => { setShowForm(false); fetchTenants(); }} />
      )}

      {tenants.length === 0 ? (
        <div className="text-zinc-500 py-8 text-center border border-dashed border-border rounded-xl">
          No tenants found. Click &quot;Add Tenant&quot; to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map(t => (
            <div key={t.id} className="border border-border p-5 rounded-xl bg-white dark:bg-zinc-950 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <a href={`/dashboard/tenants/${t.id}?workspaceId=${workspaceId}`} className="font-semibold text-lg hover:underline">{t.name}</a>
                  <div className="flex gap-4 mt-1 text-sm text-zinc-500">
                    {t.email && <span>{t.email}</span>}
                    {t.phone && <span>{t.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssigningTenantId(assigningTenantId === t.id ? null : t.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {assigningTenantId === t.id ? 'Cancel' : 'Assign to Property'}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md text-red-500 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {assigningTenantId === t.id && (
                <LeaseForm
                  workspaceId={workspaceId}
                  tenantId={t.id}
                  properties={properties}
                  onComplete={() => { setAssigningTenantId(null); fetchTenants(); }}
                />
              )}

                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Active Leases</p>
                  <div className="flex flex-wrap gap-2">
                    {t.leases.map((l) => (
                      <span key={l.id} className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-md border border-border">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{l.unit?.unitNumber || 'Unit'}</span>
                        <span className="text-zinc-400">•</span>
                        <span>{l.property?.name}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-400'}`} />
                      </span>
                    ))}
                  </div>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantForm({ workspaceId, onComplete }: { workspaceId: string; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-6 border border-border rounded-xl bg-zinc-50 dark:bg-zinc-900/50 space-y-4">
      <h4 className="font-semibold text-lg mb-2">Add New Tenant</h4>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Full Name</label>
          <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Email</label>
          <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="john@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Phone</label>
          <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="+1 234 567 890" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button disabled={loading} type="submit" className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Tenant'}
        </button>
      </div>
    </form>
  );
}

function LeaseForm({ workspaceId, tenantId, properties, onComplete }: { workspaceId: string; tenantId: string; properties: Property[]; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ propertyId: '', unitId: '', startDate: '', endDate: '', yearlyRent: '' });
  const [loading, setLoading] = React.useState(false);

  // Derive available units from the selected property
  const selectedProperty = properties.find(p => p.id === formData.propertyId);
  const availableUnits = selectedProperty?.units?.filter((u) => u.status === 'VACANT') || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}/leases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border border-dashed border-border rounded-lg bg-zinc-50 dark:bg-zinc-900/30 space-y-3">
      <p className="text-sm font-medium">Assign to Property</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-500">Property</label>
          <select 
            required 
            value={formData.propertyId} 
            onChange={e => setFormData({ ...formData, propertyId: e.target.value, unitId: '' })} 
            className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="">Select property...</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-500">Unit / Flat Number</label>
          <select 
            required 
            disabled={!formData.propertyId}
            value={formData.unitId} 
            onChange={e => setFormData({ ...formData, unitId: e.target.value })} 
            className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            <option value="">{formData.propertyId ? 'Select unit...' : 'First select a property'}</option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.unitNumber} ({u.type.replace(/_/g, ' ')})</option>
            ))}
          </select>
          {formData.propertyId && availableUnits.length === 0 && (
            <p className="text-[10px] text-red-500 mt-1 font-bold">No vacant units available.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-500">Lease Start</label>
          <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-500">Lease End (optional)</label>
          <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-500">Yearly Rent (₦)</label>
          <input type="number" step="0.01" min="0" value={formData.yearlyRent} onChange={e => setFormData({ ...formData, yearlyRent: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="0.00" />
        </div>
      </div>
      <div className="flex justify-end">
        <button disabled={loading} type="submit" className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-1.5 rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </form>
  );
}
