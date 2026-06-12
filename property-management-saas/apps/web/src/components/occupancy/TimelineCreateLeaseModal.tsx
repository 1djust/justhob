"use client";

import React from "react";
import { X, CalendarPlus } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface TimelineCreateLeaseModalProps {
  workspaceId: string;
  prefillUnitId?: string;
  prefillPropertyId?: string;
  prefillStartDate?: string;
  onClose: () => void;
}

interface Tenant {
  id: string;
  name: string;
}

export function TimelineCreateLeaseModal({
  workspaceId,
  prefillUnitId,
  prefillPropertyId,
  prefillStartDate,
  onClose,
}: TimelineCreateLeaseModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    tenantId: "",
    propertyId: prefillPropertyId || "",
    unitId: prefillUnitId || "",
    startDate: prefillStartDate || "",
    endDate: "",
    yearlyRent: "",
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["tenants", workspaceId],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tenants`, { credentials: "include" })
  });

  const tenants: Tenant[] = tenantsData?.tenants || [];

  const createLeaseMutation = useMutation({
    mutationFn: async () => {
      if (!formData.tenantId) throw new Error("Tenant is required");
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${formData.tenantId}/leases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: formData.propertyId,
            unitId: formData.unitId,
            startDate: formData.startDate,
            endDate: formData.endDate || null,
            yearlyRent: formData.yearlyRent ? parseFloat(formData.yearlyRent) : 0,
          }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", workspaceId] });
      onClose();
    },
    onError: (e) => {
      console.error(e);
      alert("Failed to create lease");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLeaseMutation.mutate();
  };
  
  const loading = createLeaseMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose} />
      
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              New Lease
            </h3>
            <p className="text-sm text-zinc-500">Create from timeline</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Select Tenant
            </label>
            <select
              required
              value={formData.tenantId}
              onChange={(e) =>
                setFormData({ ...formData, tenantId: e.target.value })
              }
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              <option value="">Choose a tenant...</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Yearly Rent
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.yearlyRent}
              onChange={(e) =>
                setFormData({ ...formData, yearlyRent: e.target.value })
              }
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.tenantId}
            className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Creating..." : "Create Lease"}
          </button>
        </div>
      </form>
    </div>
  );
}
