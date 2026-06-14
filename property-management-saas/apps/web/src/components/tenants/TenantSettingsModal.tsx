import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "../shared/Button";

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  allowPartialPayments?: boolean | null;
}

export function TenantSettingsModal({
  workspaceId,
  tenant,
  onClose,
}: {
  workspaceId: string;
  tenant: Tenant;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [allowPartialPayments, setAllowPartialPayments] = React.useState<boolean>(
    tenant.allowPartialPayments ?? true
  );

  React.useEffect(() => {
    apiFetch("/api/workspaces", { credentials: "include" }).then(
      (data) => {
        const wsMember = data.workspaces?.find(
          (w: { workspace?: { id: string; allowPartialPayments?: boolean } }) => w.workspace?.id === workspaceId
        );
        const ws = wsMember?.workspace;
        if (
          ws &&
          (tenant.allowPartialPayments === null ||
            tenant.allowPartialPayments === undefined)
        ) {
          setAllowPartialPayments(ws.allowPartialPayments ?? true);
        }
      }
    );
  }, [workspaceId, tenant.allowPartialPayments]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `/api/workspaces/${workspaceId}/tenants/${tenant.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            allowPartialPayments,
          }),
          credentials: "include",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      onClose();
    },
    onError: (e: Error) => {
      console.error(e);
      alert(e.message || "Failed to update tenant settings");
    },
  });

  const loading = updateMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Payment Settings
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {tenant.name}
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="secondary"
              size="icon"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="block text-sm font-bold text-zinc-900 dark:text-white">
                      Allow Partial Payments
                    </span>
                    <span className="block text-xs text-zinc-500 mt-1">
                      Override workspace settings and allow this tenant to pay invoices in installments.
                    </span>
                  </div>
                  <div className="relative inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      checked={allowPartialPayments}
                      onChange={(e) => setAllowPartialPayments(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={loading}
            isLoading={loading}
            variant="accent"
            className="w-full"
          >
            <Save className="w-4 h-4" /> Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
