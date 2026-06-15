"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Mail, Phone, User, CheckCircle2, Home } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { LeaseForm } from "./LeaseForm";

interface TenantDrawerFormProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any[];
}

type Step = "form" | "success" | "assigning";

export function TenantDrawerForm({
  workspaceId,
  isOpen,
  onClose,
  properties,
}: TenantDrawerFormProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("form");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    tempPassword: string;
    inviteLink?: string;
  } | null>(null);

  // Reset state when opening/closing
  React.useEffect(() => {
    if (isOpen) {
      setStep("form");
      setFormData({ name: "", email: "", phone: "" });
      setError(null);
      setCredentials(null);
      setCreatedTenantId(null);
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/tenants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
          credentials: "include",
        },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", workspaceId] });
      // The API should return the created tenant's ID inside the response
      // For this implementation, let's assume `data.tenant.id` exists. If not, it just won't render the assign flow.
      setCreatedTenantId(data.tenant?.id || data.id || null);
      
      if (data.credentials) {
        setCredentials(data.credentials);
        setStep("success");
      } else {
        // If no credentials (e.g. no email provided), we could just close or show a simple success message
        onClose();
      }
    },
    onError: (e: Error) => {
      console.error(e);
      setError(e.message || "Failed to create tenant. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const handleCopy = () => {
    if (!credentials) return;
    const text = `Welcome to PropertyStack!\n\nYour tenant account has been created.\n\nEmail: ${credentials.email}\nTemporary Password: ${credentials.tempPassword}\n\nPlease download the PropertyStack app and sign in with these credentials. Change your password after first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loading = createMutation.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white dark:bg-zinc-950 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {step === "form" ? "Add New Tenant" : step === "success" ? "Tenant Created" : "Assign Unit"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    {step === "form" ? "Enter their details below" : step === "success" ? "Share access credentials" : "Setup their lease agreement"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                
                {/* STEP 1: ADD TENANT FORM */}
                {step === "form" && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl border border-red-100 dark:border-red-900/50">
                        {error}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Name Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                          Full Name
                        </label>
                        <div className="relative group">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                          <input
                            required
                            autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400"
                            placeholder="tenant&apos;s active property..."
                          />
                        </div>
                      </div>

                      {/* Email Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                          Email Address
                        </label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400"
                            placeholder="john@example.com"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium ml-1">
                          Required to auto-generate app credentials and invite link.
                        </p>
                      </div>

                      {/* Phone Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                          Phone Number
                        </label>
                        <div className="relative group">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        disabled={loading}
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          "Creating Profile..."
                        ) : (
                          <>
                            Continue to Credentials <CheckCircle2 className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: SUCCESS & CREDENTIALS */}
                {step === "success" && credentials && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {/* Credentials Card */}
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-primary">Login Details Generated</h3>
                      </div>
                      
                      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mb-1">Email</p>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{credentials.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mb-1">Temporary Password</p>
                          <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{credentials.tempPassword}</p>
                        </div>
                        {credentials.inviteLink && (
                          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                             <p className="text-[10px] uppercase font-bold text-primary/80 tracking-widest mb-1">Invite Link</p>
                             <p className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate">{credentials.inviteLink}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleCopy}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          copied 
                            ? "bg-primary text-white" 
                            : "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                      >
                        {copied ? "Copied!" : "Copy for WhatsApp"}
                      </button>
                    </div>

                    {/* Upsell: Assign Unit */}
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                          <Home className="w-6 h-6 text-zinc-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Assign a Unit Now?</h3>
                          <p className="text-sm text-zinc-500">
                            The tenant profile is ready. You can close this window, or immediately assign them to a property.
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-3 pt-2">
                          {createdTenantId ? (
                            <button
                              onClick={() => setStep("assigning")}
                              className="w-full bg-primary text-white hover:bg-primary/90 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all"
                            >
                              Assign Unit
                            </button>
                          ) : (
                            <p className="text-xs text-amber-600">Please refresh to assign unit.</p>
                          )}
                          <button
                            onClick={onClose}
                            className="w-full py-3 font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            I&apos;m done, close this
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: ASSIGN UNIT (Lease Form) */}
                {step === "assigning" && createdTenantId && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                     <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-primary">Creating lease for:</p>
                          <p className="font-bold text-zinc-900 dark:text-white">{formData.name}</p>
                        </div>
                     </div>
                     
                     <LeaseForm 
                        workspaceId={workspaceId} 
                        tenantId={createdTenantId} 
                        properties={properties} 
                        onComplete={onClose} 
                     />
                  </motion.div>
                )}

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
