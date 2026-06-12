"use client";

import React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface Unit {
  id: string;
  unitNumber: string;
  type: string;
  status: string;
}

interface Property {
  id: string;
  name: string;
  units?: Unit[];
}

export function LeaseForm({
  workspaceId,
  tenantId,
  properties,
  onComplete,
}: {
  workspaceId: string;
  tenantId: string;
  properties: Property[];
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    propertyId: "",
    unitId: "",
    startDate: "",
    endDate: "",
    yearlyRent: "",
  });

  const selectedProperty = properties.find((p) => p.id === formData.propertyId);
  const availableUnits =
    selectedProperty?.units?.filter((u) => u.status === "VACANT") || [];

  const createLeaseMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}/leases`,
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
    onError: (e) => {
      console.error(e);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLeaseMutation.mutate();
  };
  const loading = createLeaseMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] bg-zinc-50 dark:bg-zinc-900/30 space-y-6 relative overflow-hidden shadow-inner"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-zinc-900 dark:bg-white rounded-lg">
          <Plus className="w-3 h-3 text-white dark:text-zinc-950" />
        </div>
        <p className="text-sm font-bold">Assign to New Unit</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Building
          </label>
          <select
            required
            value={formData.propertyId}
            onChange={(e) =>
              setFormData({
                ...formData,
                propertyId: e.target.value,
                unitId: "",
              })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 appearance-none"
          >
            <option value="">Select building...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Unit #
          </label>
          <select
            required
            disabled={!formData.propertyId}
            value={formData.unitId}
            onChange={(e) =>
              setFormData({ ...formData, unitId: e.target.value })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 appearance-none"
          >
            <option value="">
              {formData.propertyId ? "Select unit..." : "Select building first"}
            </option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber} ({u.type.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Yearly Rent (₦)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.yearlyRent}
            onChange={(e) =>
              setFormData({ ...formData, yearlyRent: e.target.value })
            }
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10"
            placeholder="0.00"
          />
        </div>
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
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10"
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
          {loading ? "Creating Lease..." : "Initialize Lease"}
        </button>
      </div>
    </form>
  );
}
