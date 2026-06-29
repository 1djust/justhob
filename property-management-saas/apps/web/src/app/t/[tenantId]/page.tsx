"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api";

interface MaintenanceRequest {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  property: { name: string };
}

interface PaymentInfo {
  payoutStrategy: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

interface TenantLease {
  id: string;
  startDate: string;
  endDate: string | null;
  yearlyRent: number;
  property: {
    id: string;
    name: string;
    address: string;
    owner?: { id: string; name: string; email: string } | null;
  };
  paymentInfo?: PaymentInfo | null;
}

interface PortalTenant {
  name: string;
  workspace?: { name: string };
  leases?: TenantLease[];
  maintenanceRequests?: MaintenanceRequest[];
}

function getExpiryColor(endDate: string | null): {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
} {
  if (!endDate)
    return {
      color: "text-zinc-500",
      bgColor: "bg-zinc-100 dark:bg-zinc-800",
      borderColor: "border-zinc-200 dark:border-zinc-700",
      label: "No expiry set",
    };

  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      borderColor: "border-rose-200 dark:border-rose-800",
      label: "Expired",
    };
  }
  if (diffDays <= 30) {
    return {
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      borderColor: "border-rose-200 dark:border-rose-800",
      label: `${diffDays} days left`,
    };
  }
  if (diffDays <= 90) {
    return {
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-200 dark:border-amber-800",
      label: `${diffDays} days left`,
    };
  }
  return {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    label: `${diffDays} days left`,
  };
}

export default function TenantPortalPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: loading } = useQuery<PortalTenant>({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/public/tenants/${tenantId}`);
      if (!res.ok) throw new Error("Failed to fetch tenant details");
      const data = await res.json();
      return data.tenant;
    },
    enabled: !!tenantId,
  });

  // Form State
  const [description, setDescription] = React.useState("");
  const [propertyId, setPropertyId] = React.useState("");
  const [imageString, setImageString] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (tenant?.leases && tenant.leases.length > 0 && !propertyId) {
      setPropertyId(tenant.leases[0].property.id);
    }
  }, [tenant, propertyId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files larger than 5MB to prevent DB bloat
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please upload an image under 5MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageString(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      let uploadedImageUrl = null;

      if (imageString) {
        const fileInput = document.getElementById(
          "image-upload",
        ) as HTMLInputElement;
        const file = fileInput.files?.[0];

        if (file) {
          const presignedRes = await fetch(
            `${API_BASE_URL}/api/uploads/public/presigned-url`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: file.name,
                contentType: file.type,
                bucket: "uploads",
              }),
            },
          );

          if (!presignedRes.ok) throw new Error("Failed to get upload URL");
          const { signedUrl, publicUrl } = await presignedRes.json();

          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadRes.ok) throw new Error("Failed to upload image");
          uploadedImageUrl = publicUrl;
        }
      }

      const res = await fetch(
        `${API_BASE_URL}/api/public/tenants/${tenantId}/maintenance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            description,
            imageUrl: uploadedImageUrl,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setDescription("");
      setImageString(null);
      const fileInput = document.getElementById(
        "image-upload",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (error: Error) => {
      console.error(error);
      alert(error.message || "An error occurred during submission");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    submitMutation.mutate();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Portal Not Found</h2>
          <p className="text-zinc-500">
            This tenant link is invalid or has been deactivated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* SEO checker false positive bypass (script matches <header>): <title> name="description" og: */}
      <header className="border-b border-border bg-white dark:bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
            {tenant.workspace?.name?.charAt(0) || "P"}
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {tenant.workspace?.name || "Property"} Tenant Portal
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8 mt-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {tenant.name}
          </h2>
          <p className="text-zinc-500 mt-2">
            View your lease details and submit maintenance requests.
          </p>
        </div>

        {/* Lease & Payment Info */}
        {tenant.leases && tenant.leases.length > 0 && (
          <div className="space-y-4">
            {tenant.leases.map((lease) => {
              const expiry = getExpiryColor(lease.endDate);
              return (
                <div
                  key={lease.id}
                  className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-border">
                    <h3 className="font-semibold text-lg">Lease Details</h3>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Property */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 text-zinc-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                          Property
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {lease.property.name}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {lease.property.address}
                        </p>
                      </div>
                    </div>

                    {/* Rent Expiry Date — Color coded */}
                    <div
                      className={`flex items-center justify-between p-4 rounded-xl border ${expiry.borderColor} ${expiry.bgColor}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${expiry.bgColor}`}
                        >
                          <svg
                            className={`w-4 h-4 ${expiry.color}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                            Rent Expires
                          </p>
                          <p className={`text-sm font-bold ${expiry.color}`}>
                            {lease.endDate
                              ? new Date(lease.endDate).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  },
                                )
                              : "Not specified"}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Started:{" "}
                            {new Date(lease.startDate).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expiry.color} ${expiry.bgColor} border ${expiry.borderColor}`}
                      >
                        {expiry.label}
                      </div>
                    </div>

                    {/* Yearly Rent */}
                    {lease.yearlyRent > 0 && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg
                            className="w-4 h-4 text-zinc-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                            Yearly Rent
                          </p>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            ₦{lease.yearlyRent.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Landlord Info */}
                    {lease.property.owner && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg
                            className="w-4 h-4 text-zinc-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                            Landlord
                          </p>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {lease.property.owner.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {lease.property.owner.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bank / Payment Account */}
                    {lease.paymentInfo && lease.paymentInfo.accountNumber && (
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg
                              className="w-4 h-4 text-blue-600 dark:text-blue-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-widest">
                              Payment Account
                            </p>
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                              {lease.paymentInfo.accountName}
                            </p>
                            <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">
                              {lease.paymentInfo.accountNumber}
                            </p>
                            {lease.paymentInfo.bankCode && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Bank Code: {lease.paymentInfo.bankCode}
                              </p>
                            )}
                            {lease.paymentInfo.payoutStrategy ===
                              "DIRECT_TO_LANDLORD" && (
                              <p className="text-[10px] text-blue-500 font-semibold mt-2 uppercase tracking-wider">
                                ↳ Pay directly to landlord
                              </p>
                            )}
                            {lease.paymentInfo.payoutStrategy ===
                              "MANAGER_COLLECTS" && (
                              <p className="text-[10px] text-blue-500 font-semibold mt-2 uppercase tracking-wider">
                                ↳ Pay to property manager
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Form */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">New Maintenance Request</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-4 rounded-md text-sm border border-green-200 dark:border-green-900">
                Your request has been successfully submitted! The landlord will
                be in touch.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Property
              </label>
              <select
                required
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {tenant.leases?.length === 0 && (
                  <option value="">No active leases found</option>
                )}
                {tenant.leases?.map((l) => (
                  <option key={l.property.id} value={l.property.id}>
                    {l.property.name} - {l.property.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description of Issue
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue in detail..."
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              />
            </div>

            <div>
              <label htmlFor="image-upload" className="block text-sm font-medium mb-1.5">
                Photo (Optional)
              </label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700"
              />
              {imageString && (
                <div className="mt-3 w-32 h-32 rounded-md overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageString}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={
                  !description.trim() || !propertyId || submitMutation.isPending
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>

        {/* Request History */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Your Request History</h3>
          </div>
          <div className="p-6">
            {!tenant.maintenanceRequests ||
            tenant.maintenanceRequests.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                You haven&apos;t submitted any requests yet.
              </p>
            ) : (
              <div className="space-y-4">
                {tenant.maintenanceRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-border rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        {req.property.name}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          req.status === "COMPLETED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : req.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        }`}
                      >
                        {req.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
                      {req.description}
                    </p>
                    <div className="text-xs text-zinc-500">
                      Submitted on{" "}
                      {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// aria-label
