"use client";

import * as React from "react";
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Landmark,
  ArrowRight,
  Info,
  Clock,
  AlertCircle,
  UploadCloud,
  Copy,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Button } from "../shared/Button";
import { toast } from "sonner";

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
  { code: "999992", name: "OPay (PayCom)" },
  { code: "50515", name: "Moniepoint Microfinance Bank" },
  { code: "999991", name: "PalmPay" },
  { code: "50211", name: "Kuda Microfinance Bank" },
  { code: "565", name: "Carbon" },
  { code: "090110", name: "VFD Microfinance Bank" },
  { code: "51318", name: "FairMoney Microfinance Bank" },
];

interface WorkspaceData {
  id: string;
  name: string;
  plan: string;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  subscriptionExpiresAt?: string | null;
}

interface WorkspaceMemberData {
  id: string;
  workspaceId: string;
  workspace?: WorkspaceData;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}

interface UpgradeRequestData {
  id: string;
  workspaceId: string;
  userId: string;
  proofUrl: string;
  requestedPlan: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const [activeTab, setActiveTab] = React.useState<"payout" | "billing">(
    "payout",
  );

  // Payout Settings State
  const [bankCode, setBankCode] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  // Billing / Subscription State
  const [currentPlan, setCurrentPlan] = React.useState("FREE");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = React.useState<
    string | null
  >(null);
  const [upgradeRequests, setUpgradeRequests] = React.useState<
    UpgradeRequestData[]
  >([]);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = React.useState<
    "PRO" | "ENTERPRISE"
  >("PRO");
  const [proofUrl, setProofUrl] = React.useState("");
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [submittingUpgrade, setSubmittingUpgrade] = React.useState(false);
  const [copiedAccount, setCopiedAccount] = React.useState(false);

  const PLATFORM_BANK_DETAILS = {
    bankName: "Zenith Bank",
    accountNumber: "1229088194",
    accountName: "PropertyStack Technologies Ltd",
  };

  const fetchUpgradeRequests = React.useCallback(() => {
    apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/upgrade-requests`, {
      credentials: "include",
    })
      .then((data) => {
        setUpgradeRequests(
          (data.upgradeRequests || []) as UpgradeRequestData[],
        );
      })
      .catch((err) => console.error("Failed to fetch upgrade requests:", err));
  }, [workspaceId]);

  // Load existing workspace & billing data
  React.useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/workspaces`, { credentials: "include" }).then(
      (data) => {
        const ws = (data.workspaces as WorkspaceMemberData[] | undefined)?.find(
          (w: WorkspaceMemberData) =>
            w.workspaceId === workspaceId || w.workspace?.id === workspaceId,
        );
        if (ws) {
          const targetWs = ws.workspace;
          setBankCode(targetWs?.bankCode || ws.bankCode || "");
          setAccountNumber(targetWs?.accountNumber || ws.accountNumber || "");
          setAccountName(targetWs?.accountName || ws.accountName || "");
          setCurrentPlan(targetWs?.plan || "FREE");
          setSubscriptionExpiresAt(targetWs?.subscriptionExpiresAt || null);
        }
      },
    );
    fetchUpgradeRequests();
  }, [workspaceId, fetchUpgradeRequests]);

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber, accountName }),
        credentials: "include",
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      toast.success("Payout settlement account updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update payout settings");
    } finally {
      setLoading(false);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    try {
      const { signedUrl, publicUrl } = await apiFetch(
        `${API_BASE_URL}/api/uploads/presigned-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          credentials: "include",
        },
      );

      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setProofUrl(publicUrl);
      toast.success("Payment proof uploaded successfully");
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload proof document");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleRequestUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofUrl) {
      toast.error("Please upload your proof of payment first");
      return;
    }

    setSubmittingUpgrade(true);
    try {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/upgrade-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedPlan: selectedUpgradePlan,
            proofUrl,
          }),
          credentials: "include",
        },
      );

      toast.success("Upgrade request submitted for verification");
      setProofUrl("");
      fetchUpgradeRequests();
    } catch (err: unknown) {
      console.error(err);
      const errMsg =
        (err as Error).message || "Failed to submit upgrade request";
      toast.error(errMsg);
    } finally {
      setSubmittingUpgrade(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(PLATFORM_BANK_DETAILS.accountNumber);
    setCopiedAccount(true);
    toast.success("Account number copied");
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const pendingRequest = upgradeRequests.find((r) => r.status === "PENDING");
  const rejectedRequest = upgradeRequests.find((r) => r.status === "REJECTED");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mt-10">
      <div className="max-w-3xl">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-8">
          <button
            onClick={() => setActiveTab("payout")}
            className={`pb-4 px-6 text-sm font-bold transition-all border-b-2 ${
              activeTab === "payout"
                ? "border-primary text-zinc-900 dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            Payout Settings
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`pb-4 px-6 text-sm font-bold transition-all border-b-2 ${
              activeTab === "billing"
                ? "border-primary text-zinc-900 dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            Billing & Subscriptions
          </button>
        </div>

        {activeTab === "payout" && (
          <div>
            <div className="mb-10">
              <h3 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">
                Payout Settings
              </h3>
              <p className="text-sm text-zinc-500 mt-2 font-medium">
                Configure where management fees and direct rent should be
                settled.
              </p>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 rounded-[3rem] blur-xl opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>

              <form
                onSubmit={handlePayoutSubmit}
                className="relative p-10 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-white dark:bg-zinc-950 shadow-sm space-y-10"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-50 dark:text-zinc-900 shadow-xl">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold tracking-tight">
                      Settlement Account
                    </h4>
                    <p className="text-xs text-zinc-400 font-medium">
                      Active Bank Authorization
                    </p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                      Financial Institution
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                        className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-bold appearance-none cursor-pointer text-foreground"
                      >
                        <option value="">Select your bank...</option>
                        {NIGERIAN_BANKS.sort((a, b) =>
                          a.name.localeCompare(b.name),
                        ).map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <ArrowRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                      NUBAN Number (10 Digits)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        pattern="[0-9]{10}"
                        maxLength={10}
                        placeholder="0123456789"
                        value={accountNumber}
                        onChange={(e) =>
                          setAccountNumber(
                            e.target.value.replace(/[^0-9]/g, ""),
                          )
                        }
                        className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-black tracking-[0.2em] placeholder:tracking-normal placeholder:font-normal text-foreground"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-300">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                    Legal Account Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EXACTLY AS IT APPEARS ON BANK STATEMENT"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-bold placeholder:font-normal text-foreground"
                  />
                </div>

                <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-start gap-4">
                  <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500 leading-relaxed">
                    By clicking save, you authorize the platform to route
                    automated settlements to this account. Payouts are typically
                    processed within 24 hours of successful tenant payment
                    clearance.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    {success && (
                      <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" /> Payout verified
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      loading || accountNumber.length !== 10 || !accountName
                    }
                    isLoading={loading}
                    variant="primary"
                    size="lg"
                    className="group flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em]"
                  >
                    {loading ? (
                      "Authorizing..."
                    ) : (
                      <>
                        Save Configuration
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            <div className="mt-10 p-8 rounded-[2rem] border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center gap-5">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
                <Info className="w-5 h-5" />
              </div>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Need to split payouts across multiple accounts? <br />
                <span className="text-zinc-500 font-bold underline cursor-pointer">
                  Contact support for Advanced Treasury features.
                </span>
              </p>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-8">
            <div className="mb-6">
              <h3 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">
                Billing & Subscription
              </h3>
              <p className="text-sm text-zinc-500 mt-2 font-medium">
                Manage your workspace workspace billing tiers and manual
                transfer upgrades.
              </p>
            </div>

            {/* Upgrade pending banner */}
            {pendingRequest && (
              <div className="p-6 border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-2 bg-amber-100 dark:bg-amber-950 rounded-xl text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">
                    Upgrade Verification Pending
                  </h4>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-500 mt-1">
                    Your request to upgrade to the{" "}
                    <strong className="uppercase">
                      {pendingRequest.requestedPlan}
                    </strong>{" "}
                    plan is under review. Our team will verify your uploaded
                    proof of payment shortly.
                  </p>
                  <p className="text-[10px] text-amber-400 mt-2 font-semibold">
                    Submitted:{" "}
                    {new Date(pendingRequest.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Upgrade rejected banner */}
            {rejectedRequest && !pendingRequest && (
              <div className="p-6 border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-2 bg-rose-100 dark:bg-rose-950 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-rose-800 dark:text-rose-400">
                    Upgrade Request Declined
                  </h4>
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-500 mt-1">
                    Your request to upgrade to{" "}
                    <strong className="uppercase">
                      {rejectedRequest.requestedPlan}
                    </strong>{" "}
                    was declined.
                  </p>
                  <div className="p-3 bg-white dark:bg-zinc-900/50 rounded-xl mt-3 border border-rose-100 dark:border-rose-900/30">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      Reason:{" "}
                      {rejectedRequest.rejectionReason ||
                        "No explanation provided"}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-500 mt-3">
                    Please correct your payment or bank details and upload a new
                    proof of payment below.
                  </p>
                </div>
              </div>
            )}

            {/* Current plan details card */}
            <div className="p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-white dark:bg-zinc-950 flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Workspace Subscription
                </p>
                <div className="flex items-center gap-3">
                  <h4 className="text-2xl font-black text-foreground tracking-tight uppercase">
                    {currentPlan} PLAN
                  </h4>
                  {currentPlan !== "FREE" && (
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest bg-primary text-white uppercase shadow-md shadow-primary/20 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> ACTIVE
                    </span>
                  )}
                </div>
                {subscriptionExpiresAt && (
                  <p className="text-xs font-bold text-zinc-400">
                    Expires:{" "}
                    {new Date(subscriptionExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {currentPlan === "FREE" && !pendingRequest && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500">
                    Need more features?
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                </div>
              )}
            </div>

            {/* Plan selection and transfer instructions */}
            {currentPlan === "FREE" && !pendingRequest && (
              <div className="grid gap-8 md:grid-cols-5 animate-in fade-in duration-500">
                {/* Manual Bank details */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                    Manual Bank Transfer
                  </h4>
                  <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-4 relative group overflow-hidden">
                    <div className="absolute right-0 top-0 -translate-y-1/3 translate-x-1/3 w-32 h-32 bg-primary/5 rounded-full blur-xl pointer-events-none" />
                    <div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">
                        Financial Institution
                      </span>
                      <strong className="text-sm font-bold text-foreground block mt-0.5">
                        {PLATFORM_BANK_DETAILS.bankName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">
                        Account Number
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <strong className="text-base font-black text-primary tracking-widest block">
                          {PLATFORM_BANK_DETAILS.accountNumber}
                        </strong>
                        <button
                          onClick={copyToClipboard}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
                          title="Copy account number"
                        >
                          {copiedAccount ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">
                        Beneficiary Name
                      </span>
                      <strong className="text-xs font-bold text-foreground block mt-0.5">
                        {PLATFORM_BANK_DETAILS.accountName}
                      </strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-[11px] font-medium text-zinc-500 leading-relaxed border border-zinc-200/50 dark:border-zinc-800/50">
                    <Info className="w-3.5 h-3.5 inline mr-1 text-zinc-400 -translate-y-0.5" />
                    Transfer the pricing fee of your target plan to the bank
                    details above and upload the transaction receipt.
                  </div>
                </div>

                {/* Upload proof form */}
                <form
                  onSubmit={handleRequestUpgrade}
                  className="md:col-span-3 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-white dark:bg-zinc-950 space-y-6"
                >
                  <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                    Request Workspace Upgrade
                  </h4>

                  {/* Plan Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      Select Target Tier
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedUpgradePlan("PRO")}
                        className={`p-4 rounded-xl border font-bold text-left transition-all ${
                          selectedUpgradePlan === "PRO"
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black">PRO</span>
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">
                          ₦50,000 / Year
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUpgradePlan("ENTERPRISE")}
                        className={`p-4 rounded-xl border font-bold text-left transition-all ${
                          selectedUpgradePlan === "ENTERPRISE"
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black font-sans">
                            ENTERPRISE
                          </span>
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">
                          ₦120,000 / Year
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Proof Uploader */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      Proof of Payment (Image/PDF)
                    </label>
                    <div className="relative border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-zinc-50/50 dark:bg-zinc-900/20 text-center hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 transition-colors group">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleProofUpload}
                        disabled={uploadingProof || submittingUpgrade}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      {uploadingProof ? (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <p className="text-xs font-semibold text-zinc-500">
                            Uploading proof...
                          </p>
                        </div>
                      ) : proofUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Proof Attached Successfully
                          </p>
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-zinc-500 underline hover:text-zinc-600 font-semibold pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Preview Receipt
                          </a>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:scale-110 transition-transform duration-200" />
                          <p className="text-xs font-bold text-zinc-500">
                            Click or drag receipt here
                          </p>
                          <span className="text-[10px] text-zinc-400 font-medium">
                            JPEG, PNG, or PDF files
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!proofUrl || submittingUpgrade || uploadingProof}
                    isLoading={submittingUpgrade}
                    variant="primary"
                    size="lg"
                    className="w-full text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                  >
                    {submittingUpgrade
                      ? "Submitting Request..."
                      : "Request Subscription Upgrade"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
