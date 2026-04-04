'use client';

import * as React from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Building, 
  Calendar, 
  Clock, 
  Phone, 
  Mail, 
  ChevronRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface Lease {
  id: string;
  status: string;
  unit?: { unitNumber: string };
  property?: { name: string };
  startDate?: string;
  endDate?: string;
  yearlyRent?: number;
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
    if (!confirm('Are you sure you want to remove this tenant? This will effectively archive their profile.')) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchTenants();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Loading residents...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Tenants</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage your residents and lease agreements</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
        >
          {showForm ? 'Cancel' : <><UserPlus className="w-4 h-4" /> Add Tenant</>}
        </button>
      </div>

      {showForm && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <TenantForm workspaceId={workspaceId} onComplete={() => { setShowForm(false); fetchTenants(); }} />
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Users className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No tenants found in this workspace. <br />
            Get started by adding your first resident.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {tenants.map((t, idx) => (
            <div 
              key={t.id} 
              className="group border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-all duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-border/50">
                    <span className="font-bold text-lg">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg leading-tight flex items-center gap-2 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                      {t.name}
                      <a href={`/dashboard/tenants/${t.id}?workspaceId=${workspaceId}`} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-zinc-500 font-medium">
                      {t.email && (
                        <span className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                          <Mail className="w-3 h-3" /> {t.email}
                        </span>
                      )}
                      {t.phone && (
                        <span className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                          <Phone className="w-3 h-3" /> {t.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAssigningTenantId(assigningTenantId === t.id ? null : t.id)}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border transition-all ${
                      assigningTenantId === t.id 
                        ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700' 
                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    {assigningTenantId === t.id ? 'Cancel' : 'Assign Unit'}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                    title="Remove tenant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {assigningTenantId === t.id && (
                <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                  <LeaseForm
                    workspaceId={workspaceId}
                    tenantId={t.id}
                    properties={properties}
                    onComplete={() => { setAssigningTenantId(null); fetchTenants(); }}
                  />
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Lease Agreements</p>
                </div>
                
                {t.leases.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {t.leases.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 pr-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 group/lease hover:border-zinc-400 transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-950 flex items-center justify-center text-[11px] font-bold border border-zinc-100 dark:border-zinc-800 shadow-sm">
                          {l.unit?.unitNumber || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{l.property?.name}</span>
                          <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                            {l.status === 'ACTIVE' ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {l.status}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-zinc-300 ml-1 group-hover/lease:translate-x-1 transition-transform" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No active leases for this tenant.</p>
                )}
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
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50/50 dark:bg-zinc-900/30 space-y-6">
      <div>
        <h4 className="text-xl font-bold mb-1">New Tenant Profile</h4>
        <p className="text-sm text-zinc-500">Basic contact information for the resident</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
          <input 
            required 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium text-sm" 
            placeholder="John Doe" 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
          <input 
            type="email" 
            value={formData.email} 
            onChange={e => setFormData({ ...formData, email: e.target.value })} 
            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium text-sm" 
            placeholder="john@example.com" 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Phone Number</label>
          <input 
            value={formData.phone} 
            onChange={e => setFormData({ ...formData, phone: e.target.value })} 
            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium text-sm" 
            placeholder="+1 (234) 567 890" 
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <button 
          disabled={loading} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-8 py-2.5 rounded-full text-sm font-bold shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Tenant'}
        </button>
      </div>
    </form>
  );
}

function LeaseForm({ workspaceId, tenantId, properties, onComplete }: { workspaceId: string; tenantId: string; properties: Property[]; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ propertyId: '', unitId: '', startDate: '', endDate: '', yearlyRent: '' });
  const [loading, setLoading] = React.useState(false);

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
    <form onSubmit={handleSubmit} className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] bg-zinc-50 dark:bg-zinc-900/30 space-y-6 relative overflow-hidden shadow-inner">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-zinc-900 dark:bg-white rounded-lg">
          <Plus className="w-3 h-3 text-white dark:text-zinc-950" />
        </div>
        <p className="text-sm font-bold">Assign to New Unit</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Building</label>
          <select 
            required 
            value={formData.propertyId} 
            onChange={e => setFormData({ ...formData, propertyId: e.target.value, unitId: '' })} 
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 appearance-none"
          >
            <option value="">Select building...</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Unit #</label>
          <select 
            required 
            disabled={!formData.propertyId}
            value={formData.unitId} 
            onChange={e => setFormData({ ...formData, unitId: e.target.value })} 
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 appearance-none"
          >
            <option value="">{formData.propertyId ? 'Select unit...' : 'Select building first'}</option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.unitNumber} ({u.type.replace(/_/g, ' ')})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Yearly Rent (₦)</label>
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            value={formData.yearlyRent} 
            onChange={e => setFormData({ ...formData, yearlyRent: e.target.value })} 
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10" 
            placeholder="0.00" 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Start Date</label>
          <input 
            type="date" 
            required 
            value={formData.startDate} 
            onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10" 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">End Date</label>
          <input 
            type="date" 
            value={formData.endDate} 
            onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10" 
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-2">
        <button 
          disabled={loading} 
          type="submit" 
          className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-6 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Creating Lease...' : 'Initialize Lease'}
        </button>
      </div>
    </form>
  );
}
