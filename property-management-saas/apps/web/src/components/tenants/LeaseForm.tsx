"use client";

import React from "react";
import { Plus, Copy, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

interface Unit {
  id: string;
  unitNumber: string;
  type: string;
  status: string;
}

interface Property {
  id: string;
  name: string;
  address?: string;
  units?: Unit[];
}

export function LeaseForm({
  workspaceId,
  tenantId,
  tenantName,
  managerName,
  properties,
  onComplete,
  initialData,
}: {
  workspaceId: string;
  tenantId: string;
  tenantName?: string;
  managerName?: string;
  properties: Property[];
  onComplete: () => void;
  initialData?: {
    propertyId: string;
    unitId: string;
    startDate: string;
    endDate?: string;
    yearlyRent: number;
    agreementText?: string;
    managerSignature?: string;
    legalDocUrl?: string;
  };
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    propertyId: initialData?.propertyId || "",
    unitId: initialData?.unitId || "",
    startDate: initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : "",
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : "",
    yearlyRent: initialData?.yearlyRent ? String(initialData.yearlyRent) : "",
    agreementText: initialData?.agreementText || "",
    managerSignature: initialData?.managerSignature || managerName || "",
  });
  const [customLeaseDocUrl, setCustomLeaseDocUrl] = React.useState(initialData?.legalDocUrl || "");
  const [uploadingCustomLease, setUploadingCustomLease] = React.useState(false);
  const [leaseOption, setLeaseOption] = React.useState<"free" | "paid">("free");
  const [legalDetails, setLegalDetails] = React.useState({
    tenantName: tenantName || "",
    tenantAddress: "",
    landlordName: managerName || "",
    landlordAddress: "",
  });
  const [proofUrl, setProofUrl] = React.useState("");
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const selectedProperty = properties.find((p) => p.id === formData.propertyId);

  // For editing previous lease, we allow the current unitId to be shown even if its status is OCCUPIED
  const availableUnits =
    selectedProperty?.units?.filter(
      (u) => u.status === "VACANT" || u.id === initialData?.unitId,
    ) || [];

  const createLeaseMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}/leases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            agreementText: "Uploaded lease agreement terms document.",
            legalDocUrl: customLeaseDocUrl,
          }),
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

  const requestLegalLeaseMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants/${tenantId}/legal-lease-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: formData.propertyId,
            unitId: formData.unitId || undefined,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
            yearlyRent: formData.yearlyRent,
            managerSignature: formData.managerSignature,
            tenantName: legalDetails.tenantName,
            tenantAddress: legalDetails.tenantAddress,
            landlordName: legalDetails.landlordName,
            landlordAddress: legalDetails.landlordAddress,
            proofUrl,
          }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      setSuccessMessage(
        "Proof of payment submitted! Your legal lease agreement document will be drafted and sent to your email within 48 hours.",
      );
    },
    onError: (e: unknown) => {
      console.error(e);
      toast.error((e as Error).message || "Failed to submit request");
    },
  });

  React.useEffect(() => {
    if (selectedProperty) {
      setLegalDetails((prev) => ({
        ...prev,
        landlordAddress: selectedProperty.address || "",
      }));
    }
  }, [formData.propertyId, selectedProperty]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofUrl(reader.result as string);
      setUploadingProof(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setUploadingProof(false);
    };
    reader.readAsDataURL(file);
  };

  // Templates removed in favor of direct PDF/JPG lease document upload

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (leaseOption === "paid") {
      if (!proofUrl) {
        toast.error("Please upload proof of payment screenshot");
        return;
      }
      requestLegalLeaseMutation.mutate();
    } else {
      if (!customLeaseDocUrl) {
        toast.error("Please upload the lease agreement terms document");
        return;
      }
      createLeaseMutation.mutate();
    }
  };
  const loading =
    createLeaseMutation.isPending || requestLegalLeaseMutation.isPending;

  if (successMessage) {
    return (
      <div className="p-8 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] bg-zinc-50 dark:bg-zinc-900/30 text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          Submission Successful
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
          {successMessage}
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-850 px-6 py-2 rounded-full text-xs font-bold transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 border border-zinc-250 dark:border-zinc-800/80 rounded-[1.5rem] bg-zinc-50/50 dark:bg-zinc-900/10 space-y-6 relative overflow-hidden shadow-xs backdrop-blur-xs"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-zinc-900 dark:bg-white rounded-xl shadow-xs">
            <Plus className="w-3.5 h-3.5 text-white dark:text-zinc-950" />
          </div>
          <p className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
            {initialData ? "Edit & Resubmit Lease" : "Assign to New Unit"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/60 rounded-2xl">
        <button
          type="button"
          onClick={() => setLeaseOption("free")}
          className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            leaseOption === "free"
              ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/40 dark:border-zinc-800/40"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Option 1: Draft My Own Terms (Free)
        </button>
        <button
          type="button"
          onClick={() => setLeaseOption("paid")}
          className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            leaseOption === "paid"
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Option 2: Paid Legal Lease (10% Fee)
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Building
          </label>
          <div className="relative">
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
              className="w-full pl-3.5 pr-10 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5 appearance-none cursor-pointer"
            >
              <option value="">Select building...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Unit #
          </label>
          <div className="relative">
            <select
              required
              disabled={!formData.propertyId}
              value={formData.unitId}
              onChange={(e) =>
                setFormData({ ...formData, unitId: e.target.value })
              }
              className="w-full pl-3.5 pr-10 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5 disabled:opacity-50 appearance-none cursor-pointer"
            >
              <option value="">
                {formData.propertyId
                  ? "Select unit..."
                  : "Select building first"}
              </option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber} ({u.type.replace(/_/g, " ")})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
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
            className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
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
            className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5 cursor-pointer"
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
            className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5 cursor-pointer"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Landlord Signature (Type name to sign)
          </label>
          <input
            type="text"
            required
            value={formData.managerSignature}
            onChange={(e) =>
              setFormData({ ...formData, managerSignature: e.target.value })
            }
            className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
            placeholder="Type name to sign..."
          />
          {formData.managerSignature && (
            <div className="mt-2 px-4 py-3 bg-blue-50/20 dark:bg-blue-950/10 rounded-xl border border-blue-100/50 dark:border-blue-900/20 text-center relative overflow-hidden backdrop-blur-xs">
              <span className="font-serif italic text-lg tracking-wide text-blue-600 dark:text-blue-400 block select-none">
                {formData.managerSignature}
              </span>
              <span className="absolute right-2.5 bottom-1 text-[8px] font-bold text-blue-500/60 dark:text-blue-400/40 uppercase tracking-widest select-none">
                Digital Ink
              </span>
            </div>
          )}
        </div>
      </div>

      {leaseOption === "paid" ? (
        <div className="space-y-6">
          <div className="border-t border-zinc-200/50 dark:border-zinc-850/50 pt-5">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 ml-1">
              Legal Draft Details
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Landlord Full Name
                </label>
                <input
                  type="text"
                  required
                  value={legalDetails.landlordName}
                  onChange={(e) =>
                    setLegalDetails({
                      ...legalDetails,
                      landlordName: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
                  placeholder="Landlord Name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Landlord Address
                </label>
                <input
                  type="text"
                  required
                  value={legalDetails.landlordAddress}
                  onChange={(e) =>
                    setLegalDetails({
                      ...legalDetails,
                      landlordAddress: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
                  placeholder="Landlord Address"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Tenant Full Name
                </label>
                <input
                  type="text"
                  required
                  value={legalDetails.tenantName}
                  onChange={(e) =>
                    setLegalDetails({
                      ...legalDetails,
                      tenantName: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
                  placeholder="Tenant Name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Tenant Current Address
                </label>
                <input
                  type="text"
                  required
                  value={legalDetails.tenantAddress}
                  onChange={(e) =>
                    setLegalDetails({
                      ...legalDetails,
                      tenantAddress: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/5"
                  placeholder="Tenant Current Address"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-950/20 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-5 space-y-5 shadow-xs">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Payment Instructions (Legal Drafting Fee)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="space-y-1 p-3 bg-white/50 dark:bg-zinc-950/15 border border-zinc-200/50 dark:border-zinc-850/40 rounded-xl">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Drafting Fee (10% of Rent)
                </span>
                <span className="text-base font-black text-zinc-900 dark:text-white">
                  {formData.yearlyRent
                    ? `₦${(Number(formData.yearlyRent) * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "₦0.00"}
                </span>
              </div>
              <div className="space-y-1 p-3 bg-white/50 dark:bg-zinc-950/15 border border-zinc-200/50 dark:border-zinc-850/40 rounded-xl">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Account Number
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900 dark:text-white font-mono text-sm">
                    0123456789
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("0123456789");
                      toast.success("Account number copied!");
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                    title="Copy Account Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 p-3 bg-white/50 dark:bg-zinc-950/15 border border-zinc-200/50 dark:border-zinc-850/40 rounded-xl">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Bank Name
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  Access Bank
                </span>
              </div>
              <div className="space-y-1 p-3 bg-white/50 dark:bg-zinc-950/15 border border-zinc-200/50 dark:border-zinc-850/40 rounded-xl">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Account Name
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  JustHub Legal Services
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-4 space-y-2.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                Proof of Payment (Screenshot/Receipt)
              </label>

              <div className="relative">
                <input
                  id="proof-upload"
                  type="file"
                  accept="image/*"
                  required={!proofUrl}
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {!proofUrl ? (
                  <label
                    htmlFor="proof-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-2xl p-6 bg-white/50 dark:bg-zinc-950/20 cursor-pointer transition-all hover:bg-white dark:hover:bg-zinc-950/40 group text-center"
                  >
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors mb-3">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-zinc-755 dark:text-zinc-300">
                      Upload Payment Proof
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                      Click or drag receipt photo to this area
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-4 bg-white/80 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-2xl">
                    <div className="relative w-16 h-16 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white shrink-0">
                      <img
                        src={proofUrl}
                        alt="Proof upload preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">
                        Payment Receipt
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Upload complete
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofUrl("")}
                      className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 hover:text-rose-700 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Remove receipt"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                {uploadingProof && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                      <svg
                        className="animate-spin h-4 w-4 text-zinc-900 dark:text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Reading receipt image...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              disabled={
                requestLegalLeaseMutation.isPending ||
                uploadingProof ||
                !proofUrl ||
                !formData.propertyId ||
                !formData.yearlyRent
              }
              type="submit"
              className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-98 disabled:opacity-50 shadow-md shadow-zinc-900/10 cursor-pointer"
            >
              {requestLegalLeaseMutation.isPending
                ? "Submitting Request..."
                : "Submit Legal Request"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block ml-1">
              Upload Lease Agreement Terms (PDF or JPG/PNG)
            </label>

            <div className="relative">
              <input
                id="custom-lease-upload"
                type="file"
                accept=".pdf,image/*"
                required={!customLeaseDocUrl}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setUploadingCustomLease(true);
                  try {
                    const res = await apiFetch(
                      `${API_BASE_URL}/api/uploads/presigned-url`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fileName: file.name,
                          contentType: file.type,
                          bucket: "uploads",
                        }),
                      }
                    ) as { signedUrl: string; publicUrl: string };

                    const uploadRes = await fetch(res.signedUrl, {
                      method: "PUT",
                      headers: { "Content-Type": file.type },
                      body: file,
                    });

                    if (!uploadRes.ok) {
                      throw new Error("Failed to upload file to storage server");
                    }

                    setCustomLeaseDocUrl(res.publicUrl);
                    toast.success("Lease agreement document uploaded successfully!");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to upload file");
                  } finally {
                    setUploadingCustomLease(false);
                  }
                }}
                className="sr-only"
              />

              {!customLeaseDocUrl ? (
                <label
                  htmlFor="custom-lease-upload"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-2xl p-8 bg-white/50 dark:bg-zinc-950/20 cursor-pointer transition-all hover:bg-white dark:hover:bg-zinc-950/40 group text-center"
                >
                  <div className="p-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors mb-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-zinc-755 dark:text-zinc-300">
                    Upload Lease Agreement Terms
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                    Accepts PDF or JPG/PNG format (Max 10MB)
                  </span>
                </label>
              ) : (
                <div className="flex items-center justify-between bg-white/80 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-zinc-500 shrink-0">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-850 dark:text-zinc-100 truncate">
                        Lease Document
                      </p>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold tracking-tight mt-0.5 uppercase">
                        Successfully Uploaded
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomLeaseDocUrl("")}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 hover:text-rose-700 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Remove document"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {uploadingCustomLease && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <svg
                      className="animate-spin h-4 w-4 text-zinc-900 dark:text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Uploading Lease Terms...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              disabled={loading || uploadingCustomLease}
              type="submit"
              className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-98 disabled:opacity-50 shadow-md shadow-zinc-900/10 cursor-pointer"
            >
              {loading
                ? initialData
                  ? "Resubmitting..."
                  : "Creating Lease..."
                : initialData
                  ? "Resubmit Lease"
                  : "Initialize Lease"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
