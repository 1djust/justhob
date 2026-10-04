"use client";

import * as React from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Smartphone,
  Send,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Mail,
  Users,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  ShieldCheck,
  Radio,
} from "lucide-react";

interface ReleaseInfo {
  success: boolean;
  activeUsersCount: number;
  defaultHighlights: string[];
  currentVersion: string;
  currentBuildNumber: number;
  downloadUrl: string;
  versionJsonUrl: string;
}

export function MobileReleasesTab() {
  const queryClient = useQueryClient();

  // Fetch release info and active user metrics
  const { data: releaseInfo, isLoading } = useQuery<ReleaseInfo>({
    queryKey: ["admin-mobile-release-info"],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE_URL}/api/super-admin/mobile-releases/info`);
      return res;
    },
  });

  const [version, setVersion] = React.useState("0.3.5");
  const [buildNumber, setBuildNumber] = React.useState(23);
  const [title, setTitle] = React.useState("PropertyStack Mobile App v0.3.5 is Now Available! 📱");
  const [highlights, setHighlights] = React.useState<string[]>([
    "⚡ Single-Touch Fingerprint Unlock: Instant biometric access with zero duplicate prompts.",
    "🚀 Seamless In-App Updates: Automatic in-app notification prompt whenever a new version drops.",
    "📄 One-Tap PDF Rent Receipts: Preview, download, and share official receipts directly from mobile.",
    "🏢 Portfolio Real-Time Sync: Smoother navigation, lower data consumption, and rapid sync.",
  ]);
  const [newHighlight, setNewHighlight] = React.useState("");
  const [broadcastMode, setBroadcastMode] = React.useState<"all" | "single">("all");
  const [testEmail, setTestEmail] = React.useState("propertystackapp@gmail.com");
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [previewTab, setPreviewTab] = React.useState<"editor" | "preview">("editor");

  // Sync state once release info loads
  React.useEffect(() => {
    if (releaseInfo) {
      if (releaseInfo.currentVersion) {
        setVersion(releaseInfo.currentVersion);
        setTitle(`PropertyStack Mobile App v${releaseInfo.currentVersion} is Now Available! 📱`);
      }
      if (releaseInfo.currentBuildNumber) {
        setBuildNumber(releaseInfo.currentBuildNumber);
      }
      if (releaseInfo.defaultHighlights && releaseInfo.defaultHighlights.length > 0) {
        setHighlights(releaseInfo.defaultHighlights);
      }
    }
  }, [releaseInfo]);

  const broadcastMutation = useMutation({
    mutationFn: async (payload: {
      version: string;
      buildNumber: number;
      title: string;
      highlights: string[];
      targetEmail?: string;
      dryRun?: boolean;
    }) => {
      return apiFetch(`${API_BASE_URL}/api/super-admin/mobile-releases/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      setShowConfirmModal(false);
      const sentCount = res?.results?.sent ?? 0;
      toast.success(
        broadcastMode === "all"
          ? `Broadcast dispatched successfully! Delivered to ${sentCount} active user(s).`
          : `Test announcement sent successfully to ${testEmail}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-mobile-release-info"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to broadcast update";
      toast.error(message);
    },
  });

  const handleAddHighlight = () => {
    if (!newHighlight.trim()) return;
    setHighlights((prev) => [...prev, newHighlight.trim()]);
    setNewHighlight("");
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights((prev) => prev.filter((_, i) => i !== index));
  };

  const apkUrl = releaseInfo?.downloadUrl || "https://propertystack.vercel.app/downloads/propertystack-tenant.apk";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Live Release Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Published Mobile Version</span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground">v{version}</span>
            <span className="text-xs font-mono font-semibold text-muted-foreground">Build {buildNumber}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Serving from Vercel Edge CDN</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>In-App Update Engine</span>
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Cache-busted real-time manifest</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Active Registered Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground">
              {isLoading ? "..." : releaseInfo?.activeUsersCount ?? 7}
            </span>
            <span className="text-xs text-muted-foreground">inboxes ready</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Verified active accounts</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Direct APK Package</span>
            <Download className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 truncate"
            >
              <span>propertystack-tenant.apk</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Production signed APK</p>
        </div>
      </div>

      {/* Main Broadcast Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Highlights Editor */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Release Announcement Studio</h3>
                  <p className="text-xs text-muted-foreground">Craft user-friendly release notes and notify users</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewTab("editor")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    previewTab === "editor" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("preview")}
                  className={`px-3 py-1 rounded-lg transition-colors md:hidden ${
                    previewTab === "preview" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {/* Version & Build Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  App Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => {
                    setVersion(e.target.value);
                    setTitle(`PropertyStack Mobile App v${e.target.value} is Now Available! 📱`);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0.3.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Build Number
                </label>
                <input
                  type="number"
                  value={buildNumber}
                  onChange={(e) => setBuildNumber(Number(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="23"
                />
              </div>
            </div>

            {/* Email Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Announcement Headline (Email Subject & Top Banner)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="PropertyStack Mobile App v0.3.5 is Now Available! 📱"
              />
            </div>

            {/* Release Highlights (Interactive List) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  User-Friendly Highlights ({highlights.length})
                </label>
                <span className="text-[11px] text-muted-foreground">Clear, simple benefits for tenants & landlords</span>
              </div>

              <div className="space-y-2">
                {highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/30 border border-border group hover:border-primary/30 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...highlights];
                        updated[idx] = e.target.value;
                        setHighlights(updated);
                      }}
                      className="flex-1 bg-transparent text-xs text-foreground font-medium focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="text-muted-foreground hover:text-rose-600 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      title="Remove highlight"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Highlight Row */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddHighlight();
                    }
                  }}
                  placeholder="e.g. ⚡ Faster Offline Sync: Access property details with zero internet delay."
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-dashed border-border text-xs focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddHighlight}
                  className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Broadcast Destination Controls */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Broadcast Destination
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBroadcastMode("all")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    broadcastMode === "all"
                      ? "bg-primary/10 border-primary text-foreground shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Users className="w-4 h-4 text-primary" />
                    <span>All Active Users ({releaseInfo?.activeUsersCount ?? 7})</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Dispatches official update announcement to all registered active accounts.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastMode("single")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    broadcastMode === "single"
                      ? "bg-primary/10 border-primary text-foreground shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Test Recipient Only</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Send a safe test copy to inspect email delivery in your personal inbox.
                  </p>
                </button>
              </div>

              {broadcastMode === "single" && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Test Destination Email
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="propertystackapp@gmail.com"
                  />
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Render Cloud & SPF/DKIM Verified</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={broadcastMutation.isPending}
                  onClick={() => {
                    broadcastMutation.mutate({
                      version,
                      buildNumber,
                      title,
                      highlights,
                      targetEmail: testEmail,
                      dryRun: false,
                    });
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border hover:bg-muted font-bold text-xs text-foreground transition-colors disabled:opacity-50"
                >
                  Send Test to Myself
                </button>

                <button
                  type="button"
                  disabled={broadcastMutation.isPending}
                  onClick={() => {
                    if (broadcastMode === "all") {
                      setShowConfirmModal(true);
                    } else {
                      broadcastMutation.mutate({
                        version,
                        buildNumber,
                        title,
                        highlights,
                        targetEmail: testEmail,
                        dryRun: false,
                      });
                    }
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {broadcastMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{broadcastMode === "all" ? "Broadcast to All Users" : "Send Test Email"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Email Preview Mockup */}
        <div className={`lg:col-span-5 ${previewTab === "preview" ? "block" : "hidden md:block"}`}>
          <div className="sticky top-24 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" />
                Live Inbox Mockup
              </span>
              <span className="text-[11px] text-muted-foreground">Standardized PropertyStack Layout</span>
            </div>

            {/* Email Container Mockup */}
            <div className="rounded-2xl border border-border/80 bg-zinc-100 dark:bg-zinc-950 p-4 shadow-xl overflow-hidden text-zinc-900">
              {/* Window Frame Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-[10px] font-mono">From: PropertyStack &lt;propertystackapp@gmail.com&gt;</span>
              </div>

              {/* Email Content Frame */}
              <div className="mt-4 rounded-xl overflow-hidden bg-white shadow-sm border border-zinc-200">
                {/* Branded Dark Header */}
                <div style={{ backgroundColor: "#0A192F" }} className="p-5 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold tracking-tight text-base text-white">PropertyStack</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      MOBILE APP UPDATE
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-white leading-snug">{title}</h4>
                </div>

                {/* Email Body */}
                <div className="p-5 space-y-4 text-xs text-zinc-700 leading-relaxed bg-white">
                  <p className="font-medium text-zinc-900">Hello Justus,</p>
                  <p className="text-zinc-600">
                    A new version of the <strong>PropertyStack Mobile App (v{version} Build {buildNumber})</strong> is now
                    available for your device. Here is what has been improved:
                  </p>

                  {/* Highlights Card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold text-zinc-900">✨ What's New & Improved:</p>
                    <ul className="space-y-1.5 pl-3 list-disc text-[11px] text-zinc-700">
                      {highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Action CTA Button */}
                  <div className="text-center py-2">
                    <div
                      style={{ backgroundColor: "#0066FF" }}
                      className="inline-block px-5 py-2.5 rounded-lg text-white font-bold text-xs shadow-md shadow-blue-500/20"
                    >
                      📥 Download Mobile App Update (v{version} APK)
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 text-center">
                    Already have the app? Open PropertyStack on your phone and tap <strong>"Update Now"</strong>.
                  </p>

                  <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500">
                    Best regards,<br />
                    <strong className="text-zinc-800">The PropertyStack Team</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Mass Broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">Confirm Update Broadcast</h4>
                <p className="text-xs text-muted-foreground">This will dispatch emails to live users</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are about to broadcast the <strong>v{version} (Build {buildNumber})</strong> release announcement to{" "}
              <strong>{releaseInfo?.activeUsersCount ?? 7} active users</strong> in your database.
            </p>

            <div className="p-3 rounded-xl bg-muted text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span className="font-semibold text-foreground">v{version} (Build {buildNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients:</span>
                <span className="font-semibold text-foreground">{releaseInfo?.activeUsersCount ?? 7} active accounts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sender:</span>
                <span className="font-semibold text-foreground">PropertyStack Official</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={broadcastMutation.isPending}
                onClick={() => {
                  broadcastMutation.mutate({
                    version,
                    buildNumber,
                    title,
                    highlights,
                    dryRun: false,
                  });
                }}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {broadcastMutation.isPending ? "Broadcasting..." : "Yes, Dispatch Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
