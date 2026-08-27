"use client";

import * as React from "react";
import { X } from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Payment } from "./types";

interface PartialPaymentModalProps {
  payment: Payment;
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function PartialPaymentModal({
  payment,
  workspaceId,
  onClose,
  onComplete,
}: PartialPaymentModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const partialMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${payment.id}/partial-pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(amount),
            balancePromiseDate: date || undefined,
            balancePromiseNote: note || undefined,
          }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["overdue-payments", workspaceId],
      });
      onComplete();
    },
    onError: (err: Error) => {
      alert(err.message || "Failed to record partial payment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    partialMutation.mutate();
  };
  const loading = partialMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Record Partial Payment
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Total due: ₦
              {payment.amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {payment.transactions && payment.transactions.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest mb-3">
                Payment History
              </h4>
              <div className="space-y-3">
                {payment.transactions.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        ₦{t.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(t.paidDate).toLocaleDateString()}
                      </p>
                    </div>
                    {t.status === "COMPLETED" ? (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md uppercase">
                        Paid
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md uppercase">
                        {t.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Amount Paid Now (₦)
            </label>
            <input
              type="number"
              step="0.01"
              required
              max={payment.amount - (payment.amountPaid || 0)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Promise Date for Balance
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Note / Agreement
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full mt-1.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium resize-none"
              placeholder="e.g. Tenant promised to pay the rest next week."
            />
          </div>
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Saving..." : "Record Partial Payment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
