"use client";

import * as React from "react";
import { AlertCircle, Clock, Wallet } from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function OverdueTenantsWidget({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ["overdue-payments", workspaceId],
    queryFn: async () => {
      const [overdue, partial] = await Promise.all([
        apiFetch(
          `${API_BASE_URL}/api/workspaces/${workspaceId}/payments?status=OVERDUE`,
          { credentials: "include" },
        ),
        apiFetch(
          `${API_BASE_URL}/api/workspaces/${workspaceId}/payments?status=PARTIALLY_PAID`,
          { credentials: "include" },
        ),
      ]);
      return [...overdue.payments, ...partial.payments].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
    },
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (socket && workspaceId) {
      const handleUpdate = () =>
        queryClient.invalidateQueries({
          queryKey: ["overdue-payments", workspaceId],
        });
      socket.on("PAYMENT_UPDATED", handleUpdate);
      return () => {
        socket.off("PAYMENT_UPDATED", handleUpdate);
      };
    }
  }, [socket, workspaceId, queryClient]);

  if (loading)
    return (
      <div className="animate-pulse h-64 bg-secondary dark:bg-card rounded-3xl" />
    );
  if (payments.length === 0) return null;

  return (
    <div
      className="rounded-[2.5rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-md p-8 shadow-2xl"
      aria-label="Overdue tenants"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-foreground">
          Attention Needed: Overdue Rent
        </h3>
      </div>

      <div className="space-y-4">
        {payments.map((payment) => {
          const isGraceEnded =
            payment.gracePeriodEnd &&
            new Date(payment.gracePeriodEnd) <= new Date();
          const balance = payment.amount - (payment.amountPaid || 0);

          return (
            <div
              key={payment.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-secondary border border-border dark:border-zinc-700"
            >
              <div>
                <p className="font-bold text-foreground">
                  {payment.lease.tenant.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {payment.lease.property.name}
                </p>
                {payment.status === "PARTIALLY_PAID" && (
                  <p className="text-xs font-semibold text-amber-600 mt-1 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    Partially paid (₦{payment.amountPaid?.toLocaleString()})
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-red-600">
                    ₦{balance.toLocaleString()}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground flex items-center justify-end gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(payment.dueDate))} overdue
                  </p>
                </div>

                {isGraceEnded && (
                  <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                    Grace Ended
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
