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
  Plus,
  RefreshCw
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { ExportButton } from '@/components/shared/ExportButton';
import { LeaseRenewalManager } from '@/components/tenants/LeaseRenewalManager';
import { useRealtime } from '@/components/providers/RealtimeProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  plan?: string;
}

export function TenantsList({ workspaceId, properties, onLeasesLoaded, plan }: TenantProps) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useRealtime();
  const [showForm, setShowForm] = React.useState(false);
  const [assigningTenantId, setAssigningTenantId] = React.useState<string | null>(null);
  const [renewalLeaseId, setRenewalLeaseId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'all' | 'renewals'>('all');
  const [page, setPage] = React.useState(1);

  const { data: tenantsData, isLoading: loading } = useQuery({
    queryKey: ['tenants', workspaceId, page],
    queryFn: async () => {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants?page=${page}&limit=20`, {
        credentials: 'include'
      });
      return data;
    },
    enabled: !!workspaceId
  });

  const tenants: Tenant[] = tenantsData?.tenants || [];
  const totalPages = tenantsData?.pagination?.totalPages || 1;

  React.useEffect(() => {
    if (tenants.length > 0 && onLeasesLoaded) {
      const allLeases = tenants.flatMap((t: Tenant) => t.leases || []);
      onLeasesLoaded(allLeases);
    }
  }, [tenants, onLeasesLoaded]);

  // Real-time updates
  React.useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUpdate = () => {
      console.log('[TenantsList] Real-time update received, refreshing...');
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
    };

    socket.on('LEASE_UPDATED', handleUpdate);
    socket.on('LEASE_RENEWED', handleUpdate);
    socket.on('LEASE_RENEWAL_REJECTED', handleUpdate);

    return () => {
      socket.off('LEASE_UPDATED', handleUpdate);
      socket.off('LEASE_RENEWED', handleUpdate);
      socket.off('LEASE_RENEWAL_REJECTED', handleUpdate);
    };
  }, [socket, isConnected, workspaceId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
    }
  });

  const endTenancyMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}/end-tenancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.toUpperCase(), note: 'Ended from dashboard' }),
        credentials: 'include'
      });
    },
    onSuccess: () => {
      alert('Tenancy ended successfully');
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
    },
    onError: (e: any) => {
      alert(e.message || 'Failed to end tenancy');
    }
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this tenant? This will effectively archive their profile.')) return;
    deleteMutation.mutate(id);
  };

  const handleEndTenancy = async (id: string) => {
    const reason = prompt("Enter reason for ending tenancy (VOLUNTARY, EVICTION, LEASE_EXPIRED, OTHER):", "VOLUNTARY");
    if (!reason) return;
    endTenancyMutation.mutate({ id, reason });
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
        <div className="flex items-center gap-3">
          <ExportButton workspaceId={workspaceId} type="tenants" plan={plan} />
          <button
            onClick={() => setShowForm(!showForm)}
            className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
          >
            {showForm ? 'Cancel' : <><UserPlus className="w-4 h-4" /> Add Tenant</>}
          </button>
        </div>
      </div>

      <div className="flex space-x-2 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          All Tenants
        </button>
        <button
          onClick={() => setActiveTab('renewals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'renewals'
              ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          Lease Renewals
        </button>
      </div>

      {activeTab === 'renewals' && (
        <LeaseRenewalManager workspaceId={workspaceId} />
      )}

      {activeTab === 'all' && (
        <>
          {showForm && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <TenantForm workspaceId={workspaceId} onComplete={() => setShowForm(false)} />
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
                  {!t.leases?.some(l => l.status === 'ACTIVE') && (
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
                  )}
                  {t.leases?.some(l => l.status === 'ACTIVE') && (
                    <button
                      onClick={() => handleEndTenancy(t.id)}
                      className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 dark:hover:bg-rose-900/40 transition-all"
                    >
                      End Tenancy
                    </button>
                  )}
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
                    onComplete={() => setAssigningTenantId(null)}
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
                      <React.Fragment key={l.id}>
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 pl-3 pr-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 group/lease hover:border-zinc-400 transition-colors">
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-950 flex items-center justify-center text-[11px] font-bold border border-zinc-100 dark:border-zinc-800 shadow-sm shrink-0">
                            {l.unit?.unitNumber || 'U'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 line-clamp-1">{l.property?.name}</span>
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
                        </div>

                        {l.yearlyRent != null && (
                          <div className="pl-4 border-l border-zinc-200 dark:border-zinc-700 flex flex-col justify-center">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mb-0.5">Rent</div>
                            <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                              {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(l.yearlyRent))}
                              <span className="text-zinc-400 font-normal">/yr</span>
                            </div>
                          </div>
                        )}

                        {(l.startDate || l.endDate) && (
                          <div className="pl-4 border-l border-zinc-200 dark:border-zinc-700 flex flex-col justify-center hidden sm:flex">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mb-0.5">Lease Period</div>
                            <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                              {l.startDate ? new Date(l.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'} - {l.endDate ? new Date(l.endDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                          </div>
                        )}

                        <div className="ml-auto pl-2 flex items-center gap-1">
                          {l.status === 'ACTIVE' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenewalLeaseId(renewalLeaseId === l.id ? null : l.id); }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/40 transition-all"
                              title="Send renewal offer"
                            >
                              <RefreshCw className="w-3 h-3" /> Renew
                            </button>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover/lease:translate-x-1 group-hover/lease:text-zinc-500 transition-all" />
                        </div>
                      </div>
                      {renewalLeaseId === l.id && (
                        <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                          <RenewalOfferForm
                            workspaceId={workspaceId}
                            leaseId={l.id}
                            currentRent={l.yearlyRent || 0}
                            onComplete={() => setRenewalLeaseId(null)}
                            onCancel={() => setRenewalLeaseId(null)}
                          />
                        </div>
                      )}
                      </React.Fragment>
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
      
      {/* Pagination Controls */}
      {activeTab === 'all' && totalPages > 1 && tenants.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 mt-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 rounded-2xl">
          <p className="text-xs text-zinc-500 font-medium">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-xs font-bold rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-xs font-bold rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function TenantForm({ workspaceId, onComplete }: { workspaceId: string; onComplete: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({ name: '', email: '', phone: '' });
  const [credentials, setCredentials] = React.useState<{ email: string; tempPassword: string; inviteLink?: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
      if (data.credentials) {
        setCredentials(data.credentials);
      } else {
        onComplete();
      }
    },
    onError: (e: any) => {
      console.error(e);
      setError(e.message || 'Failed to create tenant. Please try again.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };
  const loading = createMutation.isPending;

  const handleCopy = () => {
    if (!credentials) return;
    const text = `Welcome to PropertyStack!\n\nYour tenant account has been created.\n\nEmail: ${credentials.email}\nTemporary Password: ${credentials.tempPassword}\n\nPlease download the PropertyStack app and sign in with these credentials. Change your password after first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show credentials modal after successful creation
  if (credentials) {
    return (
      <div className="mb-12 p-8 border-2 border-emerald-200 dark:border-emerald-800 rounded-[2rem] bg-emerald-50/50 dark:bg-emerald-950/20 space-y-6 animate-in zoom-in-95 fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">Tenant Created Successfully!</h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Share the login details below with the tenant</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-zinc-400" />
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Email</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 select-all">{credentials.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Temporary Password</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono select-all">{credentials.tempPassword}</p>
            </div>
          </div>
          {credentials.inviteLink && (
            <div className="flex items-start gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <svg className="w-4 h-4 text-emerald-500 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-widest">Secure Invite Link (Recommended)</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded w-full truncate border border-zinc-100 dark:border-zinc-800">{credentials.inviteLink}</code>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(credentials.inviteLink!); alert('Invite Link Copied!'); }}
                    className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-wider font-bold rounded hover:bg-emerald-200 transition-colors whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 ${
              copied 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 hover:scale-105'
            }`}
          >
            {copied ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copied to Clipboard</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy Credentials for WhatsApp</>
            )}
          </button>
          <button
            onClick={() => { setCredentials(null); onComplete(); }}
            className="px-6 py-2.5 rounded-full text-sm font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
          >
            Done
          </button>
        </div>
        <p className="text-xs text-zinc-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          The tenant can use these credentials to sign in on the PropertyStack mobile app.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50/50 dark:bg-zinc-900/30 space-y-6">
      <div>
        <h4 className="text-xl font-bold mb-1">New Tenant Profile</h4>
        <p className="text-sm text-zinc-500">Basic contact information for the resident</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl text-sm text-rose-700 dark:text-rose-300 animate-in fade-in duration-200">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span className="font-medium">{error}</span>
        </div>
      )}
      
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
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({ propertyId: '', unitId: '', startDate: '', endDate: '', yearlyRent: '' });

  const selectedProperty = properties.find(p => p.id === formData.propertyId);
  const availableUnits = selectedProperty?.units?.filter((u) => u.status === 'VACANT') || [];

  const createLeaseMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}/leases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
      onComplete();
    },
    onError: (e) => {
      console.error(e);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLeaseMutation.mutate();
  };
  const loading = createLeaseMutation.isPending;

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

function RenewalOfferForm({ workspaceId, leaseId, currentRent, onComplete, onCancel }: {
  workspaceId: string;
  leaseId: string;
  currentRent: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    newRent: String(currentRent),
    newStartDate: '',
    newEndDate: '',
    terms: ''
  });
  const [error, setError] = React.useState<string | null>(null);

  const renewalMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/leases/${leaseId}/renewal-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
      onComplete();
    },
    onError: (e: any) => {
      setError(e.message || 'Failed to send renewal offer');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    renewalMutation.mutate();
  };
  const loading = renewalMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="p-5 border border-amber-200 dark:border-amber-800 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-amber-600 rounded-lg">
          <RefreshCw className="w-3 h-3 text-white" />
        </div>
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Send Lease Renewal Offer</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">New Yearly Rent (₦)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.newRent}
            onChange={e => setFormData({ ...formData, newRent: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">New Start Date</label>
          <input
            type="date"
            required
            value={formData.newStartDate}
            onChange={e => setFormData({ ...formData, newStartDate: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">New End Date</label>
          <input
            type="date"
            required
            value={formData.newEndDate}
            onChange={e => setFormData({ ...formData, newEndDate: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Terms (Optional)</label>
          <input
            type="text"
            value={formData.terms}
            onChange={e => setFormData({ ...formData, terms: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            placeholder="e.g. Standard terms apply"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-full text-xs font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
        >
          Cancel
        </button>
        <button
          disabled={loading}
          type="submit"
          className="bg-amber-600 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Sending...' : 'Send Renewal Offer'}
        </button>
      </div>
    </form>
  );
}
