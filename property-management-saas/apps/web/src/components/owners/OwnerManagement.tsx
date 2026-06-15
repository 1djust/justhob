"use client";

import * as React from "react";
import {
  UserPlus,
  Trash2,
  Building2,
  Mail,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Search,
  MoreVertical,
  Banknote,
  Landmark,
  X,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../shared/Button";

const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "Guaranty Trust Bank (GTB)" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "032", name: "Union Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "214", name: "First City Monument Bank (FCMB)" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "215", name: "Unity Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "030", name: "Heritage Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "212", name: "Wema Bank" },
  { code: "035", name: "ALAT by WEMA" },
  { code: "068", name: "Standard Chartered Bank" },
];

interface OwnerManagementProps {
  workspaceId: string;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  payoutStrategy: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
}

export function OwnerManagement({ workspaceId }: OwnerManagementProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [ownerToDelete, setOwnerToDelete] = React.useState<Owner | null>(null);
  const payoutStrategyLabels: Record<string, string> = {
    DIRECT_TO_LANDLORD: "Landlord Receives Directly",
    MANAGER_COLLECTS: "Manager Collects First",
  };

  const { data: owners = [], isLoading: loading } = useQuery<Owner[]>({
    queryKey: ["owners", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/owners`,
        {
          credentials: "include",
        },
      );
      return data.owners || [];
    },
    enabled: !!workspaceId,
  });

  const removeOwnerMutation = useMutation({
    mutationFn: async (ownerId: string) => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/owners/${ownerId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners", workspaceId] });
      setOwnerToDelete(null);
    },
    onError: (e: Error) => {
      console.error(e);
      alert("Failed to remove owner.");
      setOwnerToDelete(null);
    },
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">
          Retrieving owners...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">
            Landlords
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Manage property owners and payout configurations
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <UserPlus className="w-4 h-4" /> Add Owner
        </Button>
      </div>

      {showForm && (
        <AddOwnerForm
          workspaceId={workspaceId}
          onComplete={() => setShowForm(false)}
        />
      )}

      {ownerToDelete && (
        <ConfirmDeleteModal
          ownerName={ownerToDelete.name}
          onConfirm={() => {
            removeOwnerMutation.mutate(ownerToDelete.id);
          }}
          onCancel={() => setOwnerToDelete(null)}
          isPending={removeOwnerMutation.isPending}
        />
      )}

      {owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-900/30">
          <Landmark className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-bold text-center px-4 tracking-tight">
            No owners registered yet. <br />
            <span className="text-xs font-medium opacity-60 italic whitespace-nowrap">
              Invite landlords to begin managing their properties.
            </span>
          </p>
        </div>
      ) : (
        <div className="rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden border-separate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">
                    Owner Identity
                  </th>
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">
                    Payout Strategy
                  </th>
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">
                    Bank Settlement
                  </th>
                  <th className="text-right py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {owners.map((o) => (
                  <tr
                    key={o.id}
                    className="group hover:bg-zinc-50/30 dark:hover:bg-zinc-900/20 transition-colors"
                  >
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-800">
                          {o.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {o.name}
                          </span>
                          <span className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3" /> {o.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-8">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          o.payoutStrategy === "DIRECT_TO_LANDLORD"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                            : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                        }`}
                      >
                        {o.payoutStrategy === "DIRECT_TO_LANDLORD" ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <Wallet className="w-3 h-3" />
                        )}
                        {payoutStrategyLabels[o.payoutStrategy] || "NOT SET"}
                      </span>
                    </td>
                    <td className="py-6 px-8">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                          {o.accountName || "—"}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-500 tracking-wider">
                          {o.accountNumber
                            ? `NUBAN: ${o.accountNumber}`
                            : "Account Pending"}
                        </span>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setOwnerToDelete(o)}
                          className="hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400"
                          title="Remove Owner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-zinc-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AddOwnerForm({
  workspaceId,
  onComplete,
}: {
  workspaceId: string;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    payoutStrategy: "DIRECT_TO_LANDLORD",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });
  const [error, setError] = React.useState("");
  const [successLink, setSuccessLink] = React.useState("");

  const addOwnerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/owners`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
          credentials: "include",
        },
      );
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["owners", workspaceId] });
      if (res.inviteLink) {
        setSuccessLink(res.inviteLink);
      } else {
        onComplete();
      }
    },
    onError: (e: Error) => {
      setError(e.message || "Failed to add owner");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    addOwnerMutation.mutate();
  };
  const loading = addOwnerMutation.isPending;

  if (successLink) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onComplete()}
      >
        <div 
          className="relative max-w-lg w-full p-8 border border-emerald-200 dark:border-emerald-900/50 rounded-[2.5rem] bg-emerald-50 dark:bg-emerald-950 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <div>
          <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
            Landlord Added Successfully!
          </h4>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
            Please copy the secure invite link below and send it to them
            directly.
          </p>
        </div>
        <div className="bg-white dark:bg-black p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 break-all flex items-center justify-between gap-4">
          <code className="text-xs text-emerald-800 dark:text-emerald-200 font-medium text-left">
            {successLink}
          </code>
          <Button
            type="button"
            variant={copied ? "success" : "accent"}
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(successLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="transition-all duration-300 gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              "Copy Link"
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="success"
          onClick={() => onComplete()}
        >
          Done
        </Button>
        </div>
      </div>
    );
  }

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
            <h4 className="text-xl font-bold mb-1">Onboard New Landlord</h4>
            <p className="text-sm text-zinc-500">
              Configure owner details and payment agreements
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="self-start"
            onClick={() => onComplete()}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 dark:bg-zinc-900/50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none"></div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-100 dark:border-rose-900/50 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2 relative">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
            Full Identity
          </label>
          <input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal"
            placeholder="e.g. Johnathan Doe"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
            Communication Email
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal"
            placeholder="landlord@example.com"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
            Access Authentication (Temporary Password)
          </label>
          <input
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal"
            placeholder="Defaults to: TempPass123!"
          />
        </div>

        <div className="md:col-span-2 space-y-8 pt-6">
          <div className="flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-zinc-100 dark:border-zinc-800" />
            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">
              Settlement Configuration
            </span>
            <div className="h-[1px] flex-1 bg-zinc-100 dark:border-zinc-800" />
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                Payout Protocol
              </label>
              <select
                value={formData.payoutStrategy}
                onChange={(e) =>
                  setFormData({ ...formData, payoutStrategy: e.target.value })
                }
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="DIRECT_TO_LANDLORD">
                  LANDLORD RECEIVES DIRECTLY (Tenant transfers to Landlord)
                </option>
                <option value="MANAGER_COLLECTS">
                  MANAGER COLLECTS FIRST (Tenant transfers to Manager)
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                Receiving Financial Institution
              </label>
              <select
                required
                value={formData.bankCode}
                onChange={(e) =>
                  setFormData({ ...formData, bankCode: e.target.value })
                }
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="">Select bank...</option>
                {NIGERIAN_BANKS.sort((a, b) =>
                  a.name.localeCompare(b.name),
                ).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                NUBAN Account Number
              </label>
              <input
                required
                maxLength={10}
                value={formData.accountNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountNumber: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 font-black tracking-[0.2em]"
                placeholder="0000000000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                Account Holder Name (Legal)
              </label>
              <input
                required
                value={formData.accountName}
                onChange={(e) =>
                  setFormData({ ...formData, accountName: e.target.value })
                }
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 font-bold placeholder:font-normal"
                placeholder="AS SEEN ON BANK RECORDS"
              />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
            <Banknote className="w-4 h-4 text-zinc-400 mt-0.5" />
            <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">
              {formData.payoutStrategy === "DIRECT_TO_LANDLORD"
                ? "FUNDS PROTOCOL: Tenant pays to Landlord's account, sends proof to you, and you verify receipt in the system."
                : "FUNDS PROTOCOL: Tenant pays to your account, sends proof, and you manually disburse to the Landlord later."}
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4 gap-4">
        <Button
          onClick={() => onComplete()}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          disabled={
            loading ||
            !formData.name ||
            !formData.email ||
            !formData.bankCode ||
            formData.accountNumber.length !== 10 ||
            !formData.accountName
          }
          type="submit"
          isLoading={loading}
          size="lg"
          className="uppercase tracking-widest font-black"
        >
          {loading ? "Processing..." : "Authorize Add"}
        </Button>
      </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmDeleteModalProps {
  ownerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function ConfirmDeleteModal({
  ownerName,
  onConfirm,
  onCancel,
  isPending,
}: ConfirmDeleteModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl max-w-md w-full p-8 space-y-6 text-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center mx-auto animate-bounce duration-1000">
          <Trash2 className="w-8 h-8 text-rose-600 dark:text-rose-400" />
        </div>

        <div className="space-y-2">
          <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            Remove Landlord
          </h4>
          <p className="text-sm text-zinc-500 leading-relaxed font-medium">
            Are you sure you want to remove <span className="font-bold text-zinc-900 dark:text-zinc-100">{ownerName}</span>?
          </p>
          <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold text-left flex items-start gap-2.5 mt-2">
            <AlertCircle className="w-4.5 h-4.5 mt-0.5 shrink-0" />
            <span>This action is permanent. All associated properties will become unassigned.</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            onClick={onCancel}
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            type="button"
            variant="danger"
            className="w-full font-black uppercase tracking-wider"
            isLoading={isPending}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
