"use client";

import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { Lease } from "./types";

interface PaymentFormProps {
  workspaceId: string;
  leases: Lease[];
  onComplete: () => void;
}

export function PaymentForm({
  workspaceId,
  leases,
  onComplete,
}: PaymentFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    leaseId: "",
    amount: "",
    dueDate: "",
    status: "PENDING",
    note: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onComplete]);

  const handleLeaseChange = (leaseId: string) => {
    const lease = leases.find((l) => l.id === leaseId);
    setFormData((prev) => ({
      ...prev,
      leaseId,
      amount: lease?.yearlyRent ? String(lease.yearlyRent) : prev.amount,
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["overdue-payments", workspaceId],
      });
      onComplete();
    },
    onError: (e: Error) => {
      if (e.message && e.message.includes("Free plan limit reached")) {
        setError(e.message);
      } else {
        setError("Failed to record payment. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };
  const loading = createMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => onComplete()}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-8 pb-0">
          <div>
            <h4 className="text-xl font-bold mb-1">Record Offline Payment</h4>
            <p className="text-sm text-zinc-500">
              Capture a manual rent payment or cash deposit.{" "}
              <br className="hidden md:block" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Digital payments submitted by tenants will automatically appear
                in your Pending Verification inbox.
              </span>
            </p>
          </div>
          <Button
            type="button"
            onClick={() => onComplete()}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0 self-start"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    Action Blocked
                  </h5>
                  <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                    {error}
                  </p>
                </div>
              </div>
              {error.includes("limit reached") && (
                <Link
                  href="/#pricing"
                  className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-center"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 relative">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Occupancy / Lease Agreement
              </label>
              <select
                required
                value={formData.leaseId}
                onChange={(e) => handleLeaseChange(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium appearance-none"
              >
                <option value="">
                  {leases.length === 0
                    ? "Loading leases..."
                    : "Select active tenant lease..."}
                </option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tenant?.name} — {l.property?.name}{" "}
                    {l.unit?.unitNumber ? `(Unit ${l.unit.unitNumber})` : ""} —
                    ₦{l.yearlyRent?.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Payment Amount (₦)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                readOnly
                value={formData.amount}
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:outline-none cursor-not-allowed font-bold tracking-tight text-zinc-500"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium"
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
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-bold appearance-none"
              >
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Reference / Note
              </label>
              <input
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium"
                placeholder="e.g. Annual Rent Payment 2024"
              />
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              onClick={() => onComplete()}
              type="button"
              className="px-6 py-3 mr-4 rounded-full font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </Button>
            <Button disabled={loading} type="submit" variant="primary">
              {loading ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
