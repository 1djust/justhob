"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { AdminDashboard, type AdminTab } from "@/components/admin/AdminDashboard";
import {
  ShieldCheck,
  Activity,
  Users,
  Building2,
  TrendingUp,
  AlertOctagon,
  DollarSign,
  FileCheck,
  History,
  LogOut,
  ExternalLink,
  Lock,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  globalRole?: string;
}

const TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "workspaces", label: "Workspaces", icon: Building2 },
  { id: "users", label: "Users Management", icon: Users },
  { id: "upgrades", label: "Upgrade Requests", icon: TrendingUp },
  { id: "errors", label: "System Logs", icon: AlertOctagon },
  { id: "payments", label: "Payments", icon: DollarSign },
  { id: "security", label: "Security & MFA", icon: Lock },
  { id: "legal-leases", label: "Legal Leases", icon: FileCheck },
  { id: "audit-trail", label: "Manager Audit Trail", icon: History },
];

export default function SuperAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("overview");
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    apiFetch(`${API_BASE_URL}/api/auth/me`)
      .then((data) => {
        if (!isMounted) return;
        if (!data?.user) {
          router.push("/admin/login");
          return;
        }

        if (data.user.globalRole !== "SUPER_ADMIN" && data.user.role !== "SUPER_ADMIN") {
          toast.error("Access denied. Super Admin privileges required.");
          router.push("/dashboard");
          return;
        }

        setUser(data.user);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Super Admin auth check failed:", err);
        router.push("/admin/login");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" });
      const { supabase } = await import("@/lib/supabase");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.push("/admin/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wider uppercase">Authenticating Super Admin Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top God-Mode Command Bar */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">PropertyStack</span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-red-500/10 text-red-400 border border-red-500/30">
                GOD MODE
              </span>
            </div>
            <p className="text-xs text-zinc-400">Super Administrator Control Center</p>
          </div>
        </div>

        {/* Global telemetry & Admin Profile */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-400 font-mono">System: Operational</span>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-white">{user?.name || "Super Admin"}</div>
            <div className="text-[11px] text-zinc-500 font-mono">{user?.email}</div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"
            title="Return to Property Management Application"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />
            <span>Exit to App</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-zinc-800/80 bg-zinc-900/50 p-4 flex flex-col justify-between shrink-0 hidden md:flex">
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
              Platform Governance
            </div>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>Security Level:</span>
              <span className="text-emerald-400 font-mono font-semibold">Tier-4 Root</span>
            </div>
            <div className="flex justify-between">
              <span>API Gateway:</span>
              <span className="text-zinc-300 font-mono">Render Prod</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-zinc-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Mobile Tab Pills */}
            <div className="md:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap font-medium ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Embedded Live Admin Dashboard */}
            <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </main>
      </div>
    </div>
  );
}
