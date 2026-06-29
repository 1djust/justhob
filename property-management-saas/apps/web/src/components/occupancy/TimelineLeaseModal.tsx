"use client";

import React from "react";
import { X, CalendarDays } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface Lease {
  id: string;
  startDate: string;
  endDate?: string;
  status: string;
  yearlyRent?: number;
  tenant: { name: string };
}

export function TimelineLeaseModal({
  workspaceId,
  lease,
  onClose,
}: {
  workspaceId: string;
  lease: Lease;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    startDate: lease.startDate.split("T")[0],
    endDate: lease.endDate ? lease.endDate.split("T")[0] : "",
    yearlyRent: lease.yearlyRent?.toString() || "",
    status: lease.status,
  });

  const updateLeaseMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/leases/${lease.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: formData.startDate,
            endDate: formData.endDate || null,
            yearlyRent: formData.yearlyRent
              ? parseFloat(formData.yearlyRent)
              : undefined,
            status: formData.status,
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
      alert("Failed to update lease");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeaseMutation.mutate();
  };

  const loading = updateLeaseMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

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
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Edit Lease
            </h3>
            <p className="text-sm text-zinc-500">{lease.tenant.name}</p>
          </div>
        </div>

        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING_RENEWAL">Pending Renewal</option>
                <option value="TERMINATED">Terminated</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
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
            disabled={loading}
            className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
