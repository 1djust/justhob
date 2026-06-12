"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  Search,
  Paperclip,
  MoreVertical,
  MessageSquare,
  MoreHorizontal,
  Shield
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaseForm } from "./LeaseForm";
import { TenantDrawerForm } from "./TenantDrawerForm";
import { TenantSettingsModal } from "./TenantSettingsModal";

interface Lease {
  id: string;
  status: string;
  unit?: { unitNumber: string };
  property?: { name: string };
  startDate?: string;
  endDate?: string;
  yearlyRent?: number;
  payments?: { id: string; status: string; dueDate: string }[];
}

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  allowPartialPayments?: boolean | null;
  leases: Lease[];
}

interface Property {
  id: string;
  name: string;
  units?: { id: string; status: string; unitNumber: string; type: string }[];
}

interface WorkspacesData {
  workspaces: { workspace?: { id: string; allowPartialPayments?: boolean } }[];
}

interface TenantsData {
  tenants: Tenant[];
  pagination?: { totalPages: number };
}

interface TenantProps {
  workspaceId: string;
  properties: Property[];
  onLeasesLoaded?: (leases: Lease[]) => void;
}

export function TenantsList({
  workspaceId,
  properties,
  onLeasesLoaded,
}: TenantProps) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useRealtime();
  const [showForm, setShowForm] = React.useState(false);
  const [assigningTenantId, setAssigningTenantId] = React.useState<string | null>(null);
  const [renewalLeaseId, setRenewalLeaseId] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(1);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [locationFilter, setLocationFilter] = React.useState("all");
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [editingTenantSettings, setEditingTenantSettings] = React.useState<Tenant | null>(null);

  const { data: tenantsData, isLoading: loading } = useQuery({
    queryKey: ["tenants", workspaceId, page],
    queryFn: async () => {
      const data = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants?page=${page}&limit=20`,
        { credentials: "include" },
      );
      return data;
    },
    enabled: !!workspaceId,
  });

  const tenants: Tenant[] = tenantsData?.tenants || [];
  const totalPages = tenantsData?.pagination?.totalPages || 1;

  React.useEffect(() => {
    if (tenants.length > 0 && onLeasesLoaded) {
      const allLeases = tenants.flatMap((t: Tenant) => t.leases || []);
      onLeasesLoaded(allLeases);
    }
  }, [tenants, onLeasesLoaded]);

  React.useEffect(() => {
    if (!socket || !isConnected) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
    socket.on("LEASE_UPDATED", handleUpdate);
    socket.on("LEASE_RENEWED", handleUpdate);
    socket.on("LEASE_RENEWAL_REJECTED", handleUpdate);
    return () => {
      socket.off("LEASE_UPDATED", handleUpdate);
      socket.off("LEASE_RENEWED", handleUpdate);
      socket.off("LEASE_RENEWAL_REJECTED", handleUpdate);
    };
  }, [socket, isConnected, workspaceId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] }),
  });

  const endTenancyMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${id}/end-tenancy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.toUpperCase(), note: "Ended from dashboard" }),
        credentials: "include",
      });
    },
    onSuccess: () => {
      alert("Tenancy ended successfully");
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
    },
    onError: (e: Error) => alert(e.message || "Failed to end tenancy"),
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this tenant? This will effectively archive their profile.")) return;
    deleteMutation.mutate(id);
    setOpenMenuId(null);
  };

  const handleEndTenancy = async (id: string) => {
    const reason = prompt("Enter reason for ending tenancy (VOLUNTARY, EVICTION, LEASE_EXPIRED, OTHER):", "VOLUNTARY");
    if (!reason) return;
    endTenancyMutation.mutate({ id, reason });
    setOpenMenuId(null);
  };

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces`, { credentials: "include" });
      return data;
    },
    enabled: !!workspaceId,
  });

  const workspaceMember = workspacesData?.workspaces?.find((w: WorkspacesData["workspaces"][number]) => w.workspace?.id === workspaceId);
  const globalAllowPartialPayments = workspaceMember?.workspace?.allowPartialPayments ?? true;

  const updateWorkspaceMutation = useMutation({
    mutationFn: async (allowPartialPayments: boolean) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowPartialPayments }),
        credentials: "include",
      });
    },
    onMutate: async (newVal) => {
      await queryClient.cancelQueries({ queryKey: ["workspaces"] });
      await queryClient.cancelQueries({ queryKey: ["tenants", workspaceId] });

      const previous = queryClient.getQueryData(["workspaces"]);
      
      // Optimistically update workspace
      queryClient.setQueryData(["workspaces"], (old: WorkspacesData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          workspaces: old.workspaces.map((w: WorkspacesData["workspaces"][number]) => 
            w.workspace?.id === workspaceId 
              ? { ...w, workspace: { ...w.workspace, allowPartialPayments: newVal } }
              : w
          )
        };
      });

      // Optimistically update all tenants to null so they inherit the new global rule instantly
      queryClient.setQueryData(["tenants", workspaceId, String(page)], (old: TenantsData | undefined) => {
        if (!old || !old.tenants) return old;
        return {
          ...old,
          tenants: old.tenants.map((t: Tenant) => ({ ...t, allowPartialPayments: null }))
        };
      });

      return { previous };
    },
    onError: (err, newVal, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["workspaces"], context.previous);
        // We'll let a full re-fetch correct the tenants state if an error occurs
        queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      }
      toast.error("Failed to update workspace: " + err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      toast.success("Global partial payment setting updated");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ tenantId, allowPartialPayments }: { tenantId: string; allowPartialPayments: boolean | null }) => {
      const t = tenants.find(x => x.id === tenantId);
      if (!t) return;
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t.name, email: t.email, phone: t.phone, allowPartialPayments }),
        credentials: "include",
      });
    },
    onMutate: async (newVariables) => {
      await queryClient.cancelQueries({ queryKey: ["tenants", workspaceId, page] });
      const previous = queryClient.getQueryData(["tenants", workspaceId, page]);
      queryClient.setQueryData(["tenants", workspaceId, page], (old: TenantsData | undefined) => {
        if (!old || !old.tenants) return old;
        return {
          ...old,
          tenants: old.tenants.map((t: Tenant) => 
            t.id === newVariables.tenantId
              ? { ...t, allowPartialPayments: newVariables.allowPartialPayments }
              : t
          )
        };
      });
      return { previous };
    },
    onError: (err, newVariables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tenants", workspaceId, page], context.previous);
      }
      alert("Failed to update tenant: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId, page] });
    },
  });

  const getPrimaryLease = (tenant: Tenant) => {
    const activeLease = tenant.leases?.find(l => l.status === "ACTIVE");
    return activeLease || tenant.leases?.[0] || null;
  };

  const getTenantStatus = (lease: Lease | null) => {
    if (!lease) return { label: "No Lease", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
    if (lease.status !== "ACTIVE") return { label: lease.status, color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
    
    const latestPayment = lease.payments?.[0];
    if (!latestPayment) return { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" };
    
    if (latestPayment.status === "OVERDUE" || (new Date(latestPayment.dueDate) < new Date() && latestPayment.status !== "PAID")) {
      return { label: "Due", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" };
    }
    return { label: "Paid", color: "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary/80" };
  };

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filteredTenants = tenants.filter(t => {
    const primary = getPrimaryLease(t);
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (primary?.property?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === "all" || primary?.property?.name === locationFilter;
    return matchesSearch && matchesLocation;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Loading residents...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Tenants</h3>
          <p className="text-sm text-zinc-500 mt-1">All Tenants</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm transition-all w-full md:w-auto"
          >
            {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Tenant</>}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="animate-in zoom-in-95 fade-in duration-300 mb-8">
          <TenantDrawerForm workspaceId={workspaceId} isOpen={showForm} onClose={() => setShowForm(false)} properties={properties} />
          {editingTenantSettings && (
            <TenantSettingsModal workspaceId={workspaceId} tenant={editingTenantSettings} onClose={() => setEditingTenantSettings(null)} />
          )}
        </div>
      )}

      {/* Global Payment Settings */}
      <div className="mb-6 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between shadow-sm">
        <div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" /> Global Partial Payments
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">Enable or disable partial payments for all tenants by default.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={globalAllowPartialPayments}
            disabled={updateWorkspaceMutation.isPending}
            onChange={(e) => updateWorkspaceMutation.mutate(e.target.checked)}
            className="sr-only peer" 
          />
          <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-white shadow-inner"></div>
        </label>
      </div>

      {/* Filters and View Toggles */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-6 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Type:</span>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-zinc-900 dark:text-white border-none focus:ring-0 cursor-pointer p-0 font-medium"
            >
              <option value="all">All Types</option>
              <option>New Tenants</option>
              <option>Renewals</option>
              <option>Past Tenants</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Location:</span>
            <select 
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-transparent text-zinc-900 dark:text-white border-none focus:ring-0 cursor-pointer p-0 font-medium"
            >
              <option value="all">All</option>
              {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredTenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Users className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No tenants found in this workspace. <br />
            Get started by adding your first resident.
          </p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              {filteredTenants.map((t) => {
                const primary = getPrimaryLease(t);
                const status = getTenantStatus(primary);
                const shortId = t.id.split('-')[0].toUpperCase();
                const attachmentName = t.name.split(' ')[0].substring(0, 4) + '_' + shortId.substring(0,4) + '.pdf';

                return (
                  <div key={t.id} className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80 flex items-center justify-center font-bold">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{t.name}</h4>
                          <p className="text-xs text-zinc-500">{t.phone || "No phone"}</p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id); }}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === t.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 py-1 text-zinc-700 dark:text-zinc-300">
                            {!primary && (
                              <button onClick={() => { setAssigningTenantId(t.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Assign Unit</button>
                            )}
                            <button onClick={() => { setEditingTenantSettings(t); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Payment Settings</button>
                            {primary?.status === "ACTIVE" && (
                              <>
                                <button onClick={() => { setRenewalLeaseId(primary.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Renew Lease</button>
                                <button onClick={() => handleEndTenancy(t.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">End Tenancy</button>
                              </>
                            )}
                            <button onClick={() => handleDelete(t.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {assigningTenantId === t.id && (
                      <div className="mb-4 animate-in slide-in-from-top-2">
                        <LeaseForm workspaceId={workspaceId} tenantId={t.id} properties={properties} onComplete={() => setAssigningTenantId(null)} />
                      </div>
                    )}
                    {renewalLeaseId && primary?.id === renewalLeaseId && (
                       <div className="mb-4 animate-in slide-in-from-top-2">
                         <RenewalOfferForm workspaceId={workspaceId} leaseId={primary.id} currentRent={primary.yearlyRent || 0} onComplete={() => setRenewalLeaseId(null)} onCancel={() => setRenewalLeaseId(null)} />
                       </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-5 gap-x-2 mb-6">
                      <div>
                        <p className="text-[11px] text-zinc-500 font-medium mb-1">Location</p>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 line-clamp-1">{primary?.property?.name || "Unassigned"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-500 font-medium mb-1">Tenant ID</p>
                        <p className="text-xs font-semibold text-zinc-500">{shortId}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-500 font-medium mb-1">Attachment</p>
                        <p className="text-xs font-semibold text-zinc-500 flex items-center gap-1"><Paperclip className="w-3 h-3 text-zinc-400" /> {primary ? attachmentName : "None"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-500 font-medium mb-1">Status</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="col-span-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Allow Partial Payment:</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            disabled={globalAllowPartialPayments}
                            checked={globalAllowPartialPayments || t.allowPartialPayments === true}
                            onChange={(e) => updateTenantMutation.mutate({ tenantId: t.id, allowPartialPayments: e.target.checked })}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-white shadow-inner peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                      <a href={`/dashboard/tenants/${t.id}?workspaceId=${workspaceId}`} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary/80 transition-colors">
                        <Users className="w-3.5 h-3.5" /> View Profile
                      </a>
                      <button onClick={() => alert("Messaging feature coming soon!")} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary/80 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" /> Message
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-visible shadow-sm pb-4">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-6 py-5 font-semibold">Tenant Name</th>
                    <th className="px-6 py-5 font-semibold">Location</th>
                    <th className="px-6 py-5 font-semibold">Attachment</th>
                    <th className="px-6 py-5 font-semibold">Status</th>
                    <th className="px-6 py-5 font-semibold text-center">Partial Pmt</th>
                    <th className="px-6 py-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredTenants.map(t => {
                    const primary = getPrimaryLease(t);
                    const status = getTenantStatus(primary);
                    const shortId = t.id.split('-')[0].toUpperCase();
                    const attachmentName = t.name.split(' ')[0].substring(0, 4) + '_' + shortId.substring(0,4) + '.pdf';

                    return (
                      <React.Fragment key={t.id}>
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80 flex items-center justify-center font-bold text-xs">
                                {t.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-white">{t.name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">{shortId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300 font-medium">{primary?.property?.name || "Unassigned"}</td>
                          <td className="px-6 py-4 text-primary dark:text-primary/80 font-medium">
                            {primary ? <span className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> {attachmentName}</span> : <span className="text-zinc-400">None</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                disabled={globalAllowPartialPayments}
                                checked={globalAllowPartialPayments || t.allowPartialPayments === true}
                                onChange={(e) => updateTenantMutation.mutate({ tenantId: t.id, allowPartialPayments: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-white shadow-inner peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                            </label>
                          </td>
                          <td className="px-6 py-4 text-right relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id); }}
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            {openMenuId === t.id && (
                              <div className="absolute right-6 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 py-1 text-left text-zinc-700 dark:text-zinc-300">
                                <a href={`/dashboard/tenants/${t.id}?workspaceId=${workspaceId}`} className="block w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">View Profile</a>
                                <button onClick={() => alert("Messaging feature coming soon!")} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Message</button>
                                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                                <button onClick={() => { setEditingTenantSettings(t); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Payment Settings</button>
                                {!primary && (
                                  <button onClick={() => { setAssigningTenantId(t.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Assign Unit</button>
                                )}
                                {primary?.status === "ACTIVE" && (
                                  <>
                                    <button onClick={() => { setRenewalLeaseId(primary.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Renew Lease</button>
                                    <button onClick={() => handleEndTenancy(t.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">End Tenancy</button>
                                  </>
                                )}
                                <button onClick={() => handleDelete(t.id)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {(assigningTenantId === t.id || (renewalLeaseId && primary?.id === renewalLeaseId)) && (
                          <tr>
                            <td colSpan={6} className="p-4 bg-zinc-50/50 dark:bg-zinc-900/20">
                              {assigningTenantId === t.id && (
                                <LeaseForm workspaceId={workspaceId} tenantId={t.id} properties={properties} onComplete={() => setAssigningTenantId(null)} />
                              )}
                              {renewalLeaseId && primary?.id === renewalLeaseId && (
                                <RenewalOfferForm workspaceId={workspaceId} leaseId={primary.id} currentRent={primary.yearlyRent || 0} onComplete={() => setRenewalLeaseId(null)} onCancel={() => setRenewalLeaseId(null)} />
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && tenants.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 mt-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 rounded-2xl">
              <p className="text-xs text-zinc-500 font-medium">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-xs font-bold rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 text-xs font-bold rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}





function RenewalOfferForm({
  workspaceId,
  leaseId,
  currentRent,
  onComplete,
  onCancel,
}: {
  workspaceId: string;
  leaseId: string;
  currentRent: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    newRent: String(currentRent),
    newStartDate: "",
    newEndDate: "",
    terms: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  const renewalMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/leases/${leaseId}/renewal-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      onComplete();
    },
    onError: (e: Error) => {
      setError(e.message || "Failed to send renewal offer");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    renewalMutation.mutate();
  };
  const loading = renewalMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 border border-amber-200 dark:border-amber-800 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-amber-600 rounded-lg">
          <RefreshCw className="w-3 h-3 text-white" />
        </div>
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Send Lease Renewal Offer
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            New Yearly Rent (₦)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.newRent}
            onChange={(e) =>
              setFormData({ ...formData, newRent: e.target.value })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            New Start Date
          </label>
          <input
            type="date"
            required
            value={formData.newStartDate}
            onChange={(e) =>
              setFormData({ ...formData, newStartDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            New End Date
          </label>
          <input
            type="date"
            required
            value={formData.newEndDate}
            onChange={(e) =>
              setFormData({ ...formData, newEndDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Terms (Optional)
          </label>
          <input
            type="text"
            value={formData.terms}
            onChange={(e) =>
              setFormData({ ...formData, terms: e.target.value })
            }
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
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Sending..." : "Send Renewal Offer"}
        </button>
      </div>
    </form>
  );
}
