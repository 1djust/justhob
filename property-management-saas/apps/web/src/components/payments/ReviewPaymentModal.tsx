"use client";

import * as React from "react";
import {
  CreditCard,
  CheckCircle2,
  Building,
  ThumbsDown,
  X,
  ThumbsUp,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Payment, PaymentTransaction } from "./types";

interface ReviewPaymentModalProps {
  payment: Payment;
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function ReviewPaymentModal({
  payment,
  workspaceId,
  onClose,
  onComplete,
}: ReviewPaymentModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const pendingTx = payment.transactions?.find(
    (t: PaymentTransaction) => t.status === "PENDING",
  );
  const defaultAmount = pendingTx
    ? pendingTx.amount
    : payment.amount - (payment.amountPaid || 0);

  const [approvedAmountPaid] = React.useState<string>(
    String(defaultAmount),
  );

  const reviewMutation = useMutation({
    mutationFn: async (status: "PAID" | "REJECTED") => {
      if (status === "REJECTED" && !rejectionReason.trim())
        throw new Error("Rejection reason required");

      const numAmount = Number(approvedAmountPaid);
      if (status === "PAID" && (isNaN(numAmount) || numAmount <= 0)) {
        throw new Error("Please enter a valid amount received.");
      }

      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${payment.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "PAID" ? { approvedAmountPaid: numAmount } : {}),
            ...(status === "REJECTED"
              ? { rejectionReason: rejectionReason.trim() }
              : {}),
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
    onError: (e: Error) => {
      alert(e.message || "Failed to review payment");
    },
  });

  const handleReview = (status: "PAID" | "REJECTED") => {
    reviewMutation.mutate(status);
  };
  const loading = reviewMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Review Payment
            </h3>
            <Button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Payment Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-zinc-900 dark:text-white">
                {payment.lease?.tenant?.name}
              </p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Building className="w-3 h-3" /> {payment.lease?.property?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                ₦
                {payment.amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              {pendingTx && (
                <div className="mt-1 flex flex-col items-end gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                    Claimed: ₦
                    {pendingTx.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                    Balance Due: ₦
                    {(
                      payment.amount - (payment.amountPaid || 0)
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  {payment.balancePromise && (
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                      Promise:{" "}
                      {new Date(payment.balancePromise).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              {!pendingTx &&
                payment.amountPaid &&
                payment.amountPaid > 0 &&
                payment.amountPaid < payment.amount && (
                  <div className="mt-1 flex flex-col items-end gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                      Partial Paid: ₦
                      {payment.amountPaid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                      Balance Due: ₦
                      {(payment.amount - payment.amountPaid).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                    {payment.balancePromise && (
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                        Promise:{" "}
                        {new Date(payment.balancePromise).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Proof preview */}
          {payment.proofUrl && (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <img
                src={payment.proofUrl}
                alt="Proof"
                className="w-full max-h-[200px] object-contain bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          )}

          {payment.note && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Note
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {payment.note}
              </p>
            </div>
          )}

          {/* Action selection */}
          {action === null && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setAction("approve")}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold border-2 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-all active:scale-[0.98]"
              >
                <ThumbsUp className="w-5 h-5" />
                Approve
              </Button>
              <Button
                onClick={() => setAction("reject")}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-bold border-2 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-all active:scale-[0.98]"
              >
                <ThumbsDown className="w-5 h-5" />
                Reject
              </Button>
            </div>
          )}

          {/* Approve confirmation */}
          {action === "approve" && (
            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Confirm Amount Received
                </p>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/60 uppercase tracking-widest mb-1 block">
                    Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={approvedAmountPaid}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-zinc-900/50 text-sm font-bold text-emerald-900 dark:text-emerald-100 focus:outline-none cursor-not-allowed opacity-80"
                  />
                </div>
                {(payment.amountPaid || 0) + Number(approvedAmountPaid) <
                  payment.amount && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                    This will be approved as a PARTIAL PAYMENT. The remaining
                    balance of ₦
                    {(
                      payment.amount -
                      ((payment.amountPaid || 0) + Number(approvedAmountPaid))
                    ).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    will remain due.
                  </p>
                )}
                {(payment.amountPaid || 0) + Number(approvedAmountPaid) >=
                  payment.amount && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                    This will clear the remaining balance. The invoice will be
                    marked as fully paid.
                  </p>
                )}
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-1">
                  The tenant will be notified and a receipt will be generated.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAction(null)}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                >
                  Back
                </Button>
                <Button
                  onClick={() => handleReview("PAID")}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm Approval
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Reject with reason */}
          {action === "reject" && (
            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Amount does not match, receipt is unclear..."
                  className="w-full mt-1.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 font-medium text-sm resize-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setAction(null);
                    setRejectionReason("");
                  }}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                >
                  Back
                </Button>
                <Button
                  onClick={() => handleReview("REJECTED")}
                  disabled={loading || !rejectionReason.trim()}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4" /> Reject Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
