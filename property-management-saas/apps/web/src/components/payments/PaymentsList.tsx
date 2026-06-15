"use client";

import * as React from "react";
import {
  CreditCard,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wallet,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  ThumbsDown,
  X,
  FileCheck,
  FileText,
  Image as ImageIcon,
  QrCode,
  Eye,
  ThumbsUp,
  MoreVertical,
  Edit3,
  Printer,
  ArrowUpDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { ExportButton } from "@/components/shared/ExportButton";
import { Button } from "@/components/shared/Button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

interface Lease {
  id: string;
  tenant?: { name: string };
  property?: { name: string };
  unit?: { unitNumber: string };
  yearlyRent?: number;
}

interface PaymentTransaction {
  id: string;
  amount: number;
  status: string;
  note?: string;
  paidDate: string;
  receiptId?: string;
}

interface Payment {
  id: string;
  amount: number;
  amountPaid?: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  proofUrl?: string;
  rejectionReason?: string;
  balancePromise?: string;
  receiptId?: string;
  note?: string;
  lease?: {
    tenant?: { id: string; name: string };
    property?: { id: string; name: string };
  };
  transactions?: PaymentTransaction[];
}

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
  const [selectedPayments, setSelectedPayments] = React.useState<Set<string>>(new Set());
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

  const payments: Payment[] = paymentsData?.payments || [];
  const totalPages = paymentsData?.pagination?.totalPages || 1;

  React.useEffect(() => {
    if (workspaceId) {
      joinWorkspace(workspaceId);
    }
  }, [workspaceId, joinWorkspace]);

  // Real-time listener
  React.useEffect(() => {
    if (socket) {
      const handleUpdate = (data: unknown) => {
        console.log("[Realtime] Payment event received:", data);
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
  });

  const handleMarkPaid = (paymentId: string) =>
    markPaidMutation.mutate(paymentId);

  const filteredPayments = React.useMemo(() => {
    let result = [...payments];
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.lease?.tenant?.name.toLowerCase().includes(lower) ||
        p.lease?.property?.name.toLowerCase().includes(lower)
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
      const regularIds = filteredPayments.filter(p => p.status !== "UNDER_REVIEW").map(p => p.id);
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
  const regularPayments = filteredPayments.filter((p) => p.status !== "UNDER_REVIEW");
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
          className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
          label: "Paid",
        };
      case "UNDER_REVIEW":
        return {
          className: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
          label: "Under Review",
        };
      case "PARTIALLY_PAID":
        return {
          className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
          label: "Partially Paid",
        };

      case "OVERDUE":
        return {
          className: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
          label: "Overdue",
        };
      default:
        return {
          className: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
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
            <Button
              onClick={() => setShowForm(true)}
            >
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
              const pendingTx = p.transactions?.find((t: PaymentTransaction) => t.status === "PENDING");
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
                      <Building className="w-3 h-3" /> {p.lease?.property?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5 block">
                      Total Invoice
                    </span>
                    <span className="font-black text-blue-700 dark:text-blue-300 block leading-tight">
                      ₦{p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    {pendingTx ? (
                      <div className="mt-1.5 flex flex-col items-end gap-1">
                        {p.amountPaid && p.amountPaid > 0 ? (
                           <span className="text-[10px] text-emerald-600 font-bold">
                             Already Paid: ₦{p.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                           </span>
                        ) : null}
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                          Claiming: ₦{pendingTx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        {p.amountPaid && p.amountPaid > 0 && pendingTx.amount + p.amountPaid === p.amount ? (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                             Completes Balance
                           </span>
                        ) : p.balancePromise && (
                          <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                            Promise: {new Date(p.balancePromise).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : p.amountPaid && p.amountPaid > 0 && p.amountPaid < p.amount ? (
                      <div className="mt-1.5 flex flex-col items-end gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                          Partial Paid: ₦{p.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                          Balance: ₦{(p.amount - p.amountPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        {p.balancePromise && (
                          <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                            Promise: {new Date(p.balancePromise).toLocaleDateString()}
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
                        checked={regularPayments.length > 0 && selectedPayments.size === regularPayments.length}
                        onChange={handleSelectAll}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer" 
                      />
                      Payment ID 
                      <ArrowUpDown 
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
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
                  // Mock a payment method based on ID for visual parity
                  const mockMethods = ["Virtual Card", "Bank Transfer", "NadaPay Wallet"];
                  const mockMethod = mockMethods[p.id.charCodeAt(0) % 3];

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
                            onChange={(e) => handleSelect(p.id, e.target.checked)}
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
                          ₦{p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {mockMethod}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(p.dueDate).toLocaleDateString(undefined, {
                            day: "numeric", month: "short", year: "numeric"
                          })} {new Date(p.dueDate).toLocaleTimeString(undefined, {
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${statusConfig.className}`}>
                            {statusConfig.label}
                          </span>
                          {(p.status === "PENDING" || p.status === "OVERDUE") && p.rejectionReason && (
                            <span className="text-[10px] text-rose-500 font-medium leading-tight max-w-[120px] truncate" title={`Rejected: ${p.rejectionReason}`}>
                              Rejected: {p.rejectionReason}
                            </span>
                          )}
                          {p.amountPaid && p.amountPaid > 0 && p.amountPaid < p.amount && p.status === "UNDER_REVIEW" ? (
                            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Partial: ₦{p.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          ) : null}
                          {p.balancePromise && p.status === "UNDER_REVIEW" && (
                            <span className="text-[10px] text-zinc-500 font-medium">
                              Promise: {new Date(p.balancePromise).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIALLY_PAID") && isPropertyManager && (
                            <>
                              <Button
                                onClick={() => setPartialPaymentView(p)}
                                title="Partial Pay"
                                className="p-1.5 text-zinc-400 hover:text-amber-600 transition-colors"
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleMarkPaid(p.id)}
                                title="Approve / Mark Settled"
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
                              className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                            >
                              <FileCheck className="w-4 h-4" />
                            </Button>
                          )}

                          {p.status === "PAID" && (
                            <Button
                              onClick={() => setReceiptViewPayment(p)}
                              title="View Receipt"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {p.proofUrl && (
                            <Button
                              onClick={() => setProofViewPayment(p)}
                              title="View Proof of Payment"
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  // Simplified pagination display for 1-5
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="text-zinc-400 mx-1">...</span>
                    <Button
                      onClick={() => setPage(totalPages)}
                      className="w-8 h-8 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}

                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5">
                <span>15 / page</span>
                <ChevronDown className="w-4 h-4" />
              </div>
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

/* ─── Proof Viewer Modal ─── */
function ProofViewerModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Proof of Payment
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">
                Submitted by {payment.lease?.tenant?.name} • ₦
                {payment.amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              {payment.amountPaid && payment.amountPaid > 0 && payment.amountPaid < payment.amount && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                  Partial Paid: ₦{payment.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Proof Image */}
        <div className="p-6 flex items-center justify-center overflow-auto max-h-[60vh]">
          {payment.proofUrl ? (
            <img
              src={payment.proofUrl}
              alt="Proof of payment"
              className="max-w-full max-h-full rounded-xl object-contain border border-zinc-200 dark:border-zinc-800"
            />
          ) : (
            <div className="flex flex-col items-center text-zinc-400 py-12">
              <ImageIcon className="w-16 h-16 mb-4" />
              <p className="font-medium">No proof image available</p>
            </div>
          )}
        </div>

        {/* Note if present */}
        {payment.note && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Tenant Note
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {payment.note}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewPaymentModal({
  payment,
  workspaceId,
  onClose,
  onComplete,
}: {
  payment: Payment;
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const pendingTx = payment.transactions?.find((t: PaymentTransaction) => t.status === "PENDING");
  const defaultAmount = pendingTx ? pendingTx.amount : (payment.amount - (payment.amountPaid || 0));

  const [approvedAmountPaid, setApprovedAmountPaid] = React.useState<string>(
    String(defaultAmount)
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
      console.error(e);
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
                    Claimed: ₦{pendingTx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                    Balance Due: ₦{(payment.amount - (payment.amountPaid || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  {payment.balancePromise && (
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                      Promise: {new Date(payment.balancePromise).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              {!pendingTx && payment.amountPaid && payment.amountPaid > 0 && payment.amountPaid < payment.amount && (
                <div className="mt-1 flex flex-col items-end gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                    Partial Paid: ₦{payment.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                    Balance Due: ₦{(payment.amount - payment.amountPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  {payment.balancePromise && (
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                      Promise: {new Date(payment.balancePromise).toLocaleDateString()}
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
                {((payment.amountPaid || 0) + Number(approvedAmountPaid)) < payment.amount && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                    This will be approved as a PARTIAL PAYMENT. The remaining balance of ₦{(payment.amount - ((payment.amountPaid || 0) + Number(approvedAmountPaid))).toLocaleString("en-US", { minimumFractionDigits: 2 })} will remain due.
                  </p>
                )}
                {((payment.amountPaid || 0) + Number(approvedAmountPaid)) >= payment.amount && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                    This will clear the remaining balance. The invoice will be marked as fully paid.
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

/* ─── Receipt Modal ─── */
function ReceiptModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const printReceipt = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-zinc-900 to-emerald-400 dark:from-emerald-500 dark:via-zinc-100 dark:to-emerald-500" />

        <div className="p-10 pt-8">
          {/* Close Button (Hidden on Print) */}
          <Button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-zinc-400 hover:text-emerald-600 transition-all print:hidden"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Receipt Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-xl">
              <Building className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
              PropertyStack Settlement
            </h3>
            <p className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase mt-1">
              Certified Digital Receipt
            </p>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Total Amount Paid
            </p>
            <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              ₦
              {payment.amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 uppercase">
              <CheckCircle2 className="w-3 h-3" /> Transaction Success
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-5 mb-10">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Tenant
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.tenant?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Property
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.property?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Payment Date
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.paidDate
                  ? new Date(payment.paidDate).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Method
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                Manual Verification
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full flex items-center justify-center gap-4 mb-4">
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
              <QrCode className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Receipt Number
            </p>
            <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tracking-wider">
              {payment.receiptId ||
                `RCPT-${payment.id.split("-")[0].toUpperCase()}`}
            </p>
          </div>

          {payment.transactions && payment.transactions.length > 0 && (
            <div className="mt-8 border-t-2 border-dashed border-zinc-100 dark:border-zinc-800 pt-8">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">
                Transaction History
              </p>
              <div className="space-y-3">
                {payment.transactions.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="font-bold text-zinc-900 dark:text-white">
                      ₦{t.amount.toLocaleString()}
                    </span>
                    <span className="text-zinc-500">
                      {new Date(t.paidDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="flex gap-4 p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
          <Button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Close
          </Button>
          <Button
            onClick={printReceipt}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white hover:bg-primary/90 text-sm font-black hover:scale-[1.02] transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> Print PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Invoice Modal ─── */
function InvoiceModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const printInvoice = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400 dark:from-amber-600 dark:via-amber-400 dark:to-amber-600" />

        <div className="p-10 pt-8">
          {/* Close Button (Hidden on Print) */}
          <Button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-900/30 text-zinc-400 hover:text-amber-600 transition-all print:hidden"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Invoice Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-xl">
              <Building className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
              PropertyStack Invoice
            </h3>
            <p className="text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase mt-1">
              Payment Request
            </p>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Amount Due
            </p>
            <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              ₦
              {payment.amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/50 uppercase">
              <Clock className="w-3 h-3" /> Due:{" "}
              {new Date(payment.dueDate).toLocaleDateString()}
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-5 mb-10">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Billed To
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.tenant?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Property
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.property?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Status
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.status.replace("_", " ")}
              </span>
            </div>
            {payment.note && (
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Note
                </span>
                <span
                  className="text-sm font-black text-zinc-900 dark:text-white max-w-[60%] text-right truncate"
                  title={payment.note}
                >
                  {payment.note}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full flex items-center justify-center gap-4 mb-4">
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
              <FileText className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Invoice ID
            </p>
            <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tracking-wider">
              INV-{payment.id.split("-")[0].toUpperCase()}
            </p>
          </div>
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="flex gap-4 p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
          <Button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Close
          </Button>
          <Button
            onClick={printInvoice}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white hover:bg-primary/90 text-sm font-black hover:scale-[1.02] transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> Print PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  workspaceId,
  leases,
  onComplete,
}: {
  workspaceId: string;
  leases: Lease[];
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    leaseId: "",
    amount: "",
    dueDate: "",
    status: "PENDING",
    note: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  const handleLeaseChange = (leaseId: string) => {
    const lease = leases.find((l) => l.id === leaseId);
    setFormData({
      ...formData,
      leaseId,
      amount: lease?.yearlyRent ? String(lease.yearlyRent) : formData.amount,
    });
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
      console.error(e);
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
                Digital payments submitted by tenants will automatically appear in
                your Pending Verification inbox.
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
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-8"
        >

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
                {l.unit?.unitNumber ? `(Unit ${l.unit.unitNumber})` : ""} — ₦
                {l.yearlyRent?.toLocaleString()}
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
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
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
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
        <Button
          disabled={loading}
          type="submit" variant="primary"
        >
          {loading ? "Recording..." : "Record Payment"}
        </Button>
      </div>
        </form>
      </div>
    </div>
  );
}

function PartialPaymentModal({
  payment,
  workspaceId,
  onClose,
  onComplete,
}: {
  payment: Payment;
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");

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
      console.error(err);
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
              Total due: ₦{payment.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
