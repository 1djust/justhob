"use client";

import * as React from "react";
import {
  CreditCard,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck,
  Eye,
  ThumbsUp,
  Printer,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { ExportButton } from "@/components/shared/ExportButton";
import { Button } from "@/components/shared/Button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Lease, Payment, PaymentTransaction } from "./types";
import { ProofViewerModal } from "./ProofViewerModal";
import { ReviewPaymentModal } from "./ReviewPaymentModal";
import { ReceiptModal } from "./ReceiptModal";
import { PaymentForm } from "./PaymentForm";
import { PartialPaymentModal } from "./PartialPaymentModal";

interface PaymentsListProps {
  workspaceId: string;
  leases: Lease[];
  isPropertyManager?: boolean;
  plan?: string;
}


export function PaymentsList({
  workspaceId,
  leases,
  isPropertyManager = true,
  plan,
}: PaymentsListProps) {
  const queryClient = useQueryClient();
  const { socket, joinWorkspace } = useRealtime();
  const [showForm, setShowForm] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [reviewingPayment, setReviewingPayment] =
    React.useState<Payment | null>(null);
  const [proofViewPayment, setProofViewPayment] =
    React.useState<Payment | null>(null);
  const [receiptViewPayment, setReceiptViewPayment] =
    React.useState<Payment | null>(null);
  const [partialPaymentView, setPartialPaymentView] =
    React.useState<Payment | null>(null);
  const [selectedPayments, setSelectedPayments] = React.useState<Set<string>>(
    new Set(),
  );
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc" | null>(null);

  const { data: paymentsData, isLoading: loading } = useQuery({
    queryKey: ["payments", workspaceId, page, filter],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/payments?page=${page}&limit=15${filter ? `&status=${filter}` : ""}`;
      const data = await apiFetch(url, { credentials: "include" });
      return data;
    },
    enabled: !!workspaceId,
  });

  const payments: Payment[] = React.useMemo(
    () => paymentsData?.payments || [],
    [paymentsData?.payments],
  );
  const totalPages = paymentsData?.pagination?.totalPages || 1;

  React.useEffect(() => {
    if (workspaceId) {
      joinWorkspace(workspaceId);
    }
  }, [workspaceId, joinWorkspace]);

  // Real-time listener
  React.useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ["payments", workspaceId] });
        queryClient.invalidateQueries({
          queryKey: ["overdue-payments", workspaceId],
        });
      };

      socket.on("PAYMENT_UPDATED", handleUpdate);
      socket.on("PAYMENT_SUBMITTED", handleUpdate);

      return () => {
        socket.off("PAYMENT_UPDATED", handleUpdate);
        socket.off("PAYMENT_SUBMITTED", handleUpdate);
      };
    }
  }, [socket, workspaceId, queryClient]);

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${paymentId}/pay`,
        {
          method: "PUT",
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["overdue-payments", workspaceId],
      });
    },
    onError: (e: Error) => {
      alert(e.message || "Failed to mark payment as paid");
    },
  });

  const handleMarkPaid = (paymentId: string) =>
    markPaidMutation.mutate(paymentId);

  const filteredPayments = React.useMemo(() => {
    let result = [...payments];
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.lease?.tenant?.name?.toLowerCase().includes(lower) ||
          p.lease?.property?.name?.toLowerCase().includes(lower),
      );
    }

    if (sortOrder) {
      result.sort((a, b) => {
        const idA = a.id.slice(0, 5).toUpperCase();
        const idB = b.id.slice(0, 5).toUpperCase();
        if (sortOrder === "asc") {
          return idA.localeCompare(idB);
        } else {
          return idB.localeCompare(idA);
        }
      });
    }

    return result;
  }, [payments, searchQuery, sortOrder]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Select all currently visible regular payments
      const regularIds = filteredPayments
        .filter((p) => p.status !== "UNDER_REVIEW")
        .map((p) => p.id);
      setSelectedPayments(new Set(regularIds));
    } else {
      setSelectedPayments(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedPayments);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedPayments(newSelected);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Loading ledger...</p>
      </div>
    );
  }

  const underReviewPayments = filteredPayments.filter(
    (p) => p.status === "UNDER_REVIEW",
  );
  const regularPayments = filteredPayments.filter(
    (p) => p.status !== "UNDER_REVIEW",
  );
  const totalPending = filteredPayments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = filteredPayments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);
  const underReviewCount = underReviewPayments.length;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PAID":
        return {
          className:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
          label: "Paid",
        };
      case "UNDER_REVIEW":
        return {
          className:
            "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
          label: "Under Review",
        };
      case "PARTIALLY_PAID":
        return {
          className:
            "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
          label: "Partially Paid",
        };

      case "OVERDUE":
        return {
          className:
            "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
          label: "Overdue",
        };
      default:
        return {
          className:
            "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
          label: "Pending",
        };
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">
            Payments
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Track rental income and payment history
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-medium appearance-none hover:border-zinc-400 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="PAID">Paid</option>

            <option value="OVERDUE">Overdue</option>
          </select>
          <ExportButton workspaceId={workspaceId} type="payments" plan={plan} />
          {isPropertyManager && (
            <Button onClick={() => setShowForm(true)}>
              <CreditCard className="w-4 h-4" /> Record Offline Payment
            </Button>
          )}
        </div>
      </div>

      {/* Smart Approval Inbox */}
      {underReviewCount > 0 && isPropertyManager && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Pending Verification
            </h4>
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-black px-2 py-0.5 rounded-md ml-2">
              {underReviewCount}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {underReviewPayments.map((p) => {
              const pendingTx = p.transactions?.find(
                (t: PaymentTransaction) => t.status === "PENDING",
              );
              return (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />

                  <div className="flex justify-between items-start mb-4 relative">
                    <div>
                      <h5 className="font-bold text-zinc-900 dark:text-zinc-100">
                        {p.lease?.tenant?.name}
                      </h5>
                      <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3" />{" "}
                        {p.lease?.property?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5 block">
                        Total Invoice
                      </span>
                      <span className="font-black text-blue-700 dark:text-blue-300 block leading-tight">
                        ₦
                        {p.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      {pendingTx ? (
                        <div className="mt-1.5 flex flex-col items-end gap-1">
                          {p.amountPaid && p.amountPaid > 0 ? (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Already Paid: ₦
                              {p.amountPaid.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                            Claiming: ₦
                            {pendingTx.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {p.amountPaid &&
                          p.amountPaid > 0 &&
                          pendingTx.amount + p.amountPaid === p.amount ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                              Completes Balance
                            </span>
                          ) : (
                            p.balancePromise && (
                              <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                                Promise:{" "}
                                {new Date(
                                  p.balancePromise,
                                ).toLocaleDateString()}
                              </span>
                            )
                          )}
                        </div>
                      ) : p.amountPaid &&
                        p.amountPaid > 0 &&
                        p.amountPaid < p.amount ? (
                        <div className="mt-1.5 flex flex-col items-end gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                            Partial Paid: ₦
                            {p.amountPaid.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                            Balance: ₦
                            {(p.amount - p.amountPaid).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {p.balancePromise && (
                            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                              Promise:{" "}
                              {new Date(p.balancePromise).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2 relative mt-4">
                    {p.proofUrl && (
                      <Button
                        onClick={() => setProofViewPayment(p)}
                        className="flex-1 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Proof
                      </Button>
                    )}
                    <Button
                      onClick={() => setReviewingPayment(p)}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Review Pay
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5 font-bold" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
            Receivables
          </p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦
            {totalPending.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600/80 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full w-fit">
            <AlertCircle className="w-3 h-3" /> Unpaid Balance
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 font-bold" />
            </div>
            <ArrowDownRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
            Total Collected
          </p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦{totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full w-fit">
            <CheckCircle2 className="w-3 h-3" /> Settled Payments
          </div>
        </div>
      </div>

      {showForm && isPropertyManager && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <PaymentForm
            workspaceId={workspaceId}
            leases={leases}
            onComplete={() => setShowForm(false)}
          />
        </div>
      )}

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Wallet className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No payment history found. <br />
            {isPropertyManager &&
              "Record an offline payment to update your ledger."}
          </p>
        </div>
      ) : (
        <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden border-separate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          regularPayments.length > 0 &&
                          selectedPayments.size === regularPayments.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
                      />
                      Payment ID
                      <ArrowUpDown
                        onClick={() =>
                          setSortOrder((prev) =>
                            prev === "asc" ? "desc" : "asc",
                          )
                        }
                        className={`w-3 h-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${sortOrder ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}
                      />
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Customer
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Amount
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Payment Method
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Date & Time
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Status
                  </th>
                  <th className="text-right py-4 px-6 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {regularPayments.map((p) => {
                  const statusConfig = getStatusConfig(p.status);
                  const paymentMethod = p.paymentMethod || "Direct Transfer";

                  return (
                    <tr
                      key={p.id}
                      className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedPayments.has(p.id)}
                            onChange={(e) =>
                              handleSelect(p.id, e.target.checked)
                            }
                            className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
                          />
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            INV-{p.id.slice(0, 5).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 overflow-hidden shrink-0">
                            {p.lease?.tenant?.name.charAt(0) || "U"}
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {p.lease?.tenant?.name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-zinc-600 dark:text-zinc-400 tracking-tight whitespace-nowrap">
                          ₦
                          {p.amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(p.dueDate).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          {new Date(p.dueDate).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${statusConfig.className}`}
                          >
                            {statusConfig.label}
                          </span>
                          {(p.status === "PENDING" || p.status === "OVERDUE") &&
                            p.rejectionReason && (
                              <span
                                className="text-[10px] text-rose-500 font-medium leading-tight max-w-[120px] truncate"
                                title={`Rejected: ${p.rejectionReason}`}
                              >
                                Rejected: {p.rejectionReason}
                              </span>
                            )}
                          {p.amountPaid &&
                          p.amountPaid > 0 &&
                          p.amountPaid < p.amount &&
                          p.status === "UNDER_REVIEW" ? (
                            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Partial: ₦
                              {p.amountPaid.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          ) : null}
                          {p.balancePromise && p.status === "UNDER_REVIEW" && (
                            <span className="text-[10px] text-zinc-500 font-medium">
                              Promise:{" "}
                              {new Date(p.balancePromise).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(p.status === "PENDING" ||
                            p.status === "OVERDUE" ||
                            p.status === "PARTIALLY_PAID") &&
                            isPropertyManager && (
                              <>
                                <Button
                                  onClick={() => setPartialPaymentView(p)}
                                  title="Partial Pay"
                                  aria-label="Record partial payment"
                                  className="p-1.5 text-zinc-400 hover:text-amber-600 transition-colors"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleMarkPaid(p.id)}
                                  title="Approve / Mark Settled"
                                  aria-label="Mark payment as paid"
                                  className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}

                          {p.status === "UNDER_REVIEW" && isPropertyManager && (
                            <Button
                              onClick={() => setReviewingPayment(p)}
                              title="Review Offline Payment"
                              aria-label="Review offline payment"
                              className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                            >
                              <FileCheck className="w-4 h-4" />
                            </Button>
                          )}

                          {p.status === "PAID" && (
                            <Button
                              onClick={() => setReceiptViewPayment(p)}
                              title="View Receipt"
                              aria-label="View receipt"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          )}

                          {p.proofUrl && (
                            <Button
                              onClick={() => setProofViewPayment(p)}
                              title="View Proof of Payment"
                              aria-label="View proof of payment"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {(() => {
                  const pages: number[] = [];
                  const maxVisible = 5;
                  let start = Math.max(1, page - Math.floor(maxVisible / 2));
                  const end = Math.min(totalPages, start + maxVisible - 1);
                  start = Math.max(1, end - maxVisible + 1);

                  if (start > 1) {
                    pages.push(1);
                    if (start > 2) pages.push(-1); // ellipsis marker
                  }
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push(-2); // ellipsis marker
                    pages.push(totalPages);
                  }

                  return pages.map((p) =>
                    p < 0 ? (
                      <span key={`ellipsis-${p}`} className="text-zinc-400 mx-1">...</span>
                    ) : (
                      <Button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          page === p
                            ? "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {p}
                      </Button>
                    ),
                  );
                })()}

                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
              <span className="text-sm text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5">
                15 / page
              </span>
            </div>
          )}
        </div>
      )}

      {/* Proof Viewer Modal */}
      {proofViewPayment && (
        <ProofViewerModal
          payment={proofViewPayment}
          onClose={() => setProofViewPayment(null)}
        />
      )}

      {/* Review Modal */}
      {reviewingPayment && (
        <ReviewPaymentModal
          payment={reviewingPayment}
          workspaceId={workspaceId}
          onClose={() => setReviewingPayment(null)}
          onComplete={() => setReviewingPayment(null)}
        />
      )}
      {/* Receipt Modal */}
      {receiptViewPayment && (
        <ReceiptModal
          payment={receiptViewPayment}
          onClose={() => setReceiptViewPayment(null)}
        />
      )}

      {/* Partial Payment Modal */}
      {partialPaymentView && (
        <PartialPaymentModal
          payment={partialPaymentView}
          workspaceId={workspaceId}
          onClose={() => setPartialPaymentView(null)}
          onComplete={() => setPartialPaymentView(null)}
        />
      )}
    </div>
  );
}

