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
import { ThemeToggle } from "@/components/ThemeToggle";

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
    <div className="min-h-screen bg-zinc-50/70 dark:bg-zinc-950 text-foreground flex flex-col transition-colors duration-200">
      {/* Top God-Mode Command Bar */}
      <header className="h-16 border-b border-border/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-foreground text-base">PropertyStack</span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                GOD MODE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Super Administrator Control Center</p>
          </div>
        </div>

        {/* Global telemetry & Admin Profile */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-border text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground font-mono font-medium">System: Operational</span>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-foreground">{user?.name || "Super Admin"}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{user?.email}</div>
          </div>

          <div className="pl-1 border-l border-border/60 flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-border/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-4 flex flex-col justify-between shrink-0 hidden md:flex transition-colors duration-200">
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80">
              Platform Governance
            </div>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950 border border-border/80 text-[11px] text-muted-foreground space-y-1.5">
            <div className="flex justify-between">
              <span>Security Level:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Tier-4 Root</span>
            </div>
            <div className="flex justify-between">
              <span>API Gateway:</span>
              <span className="text-foreground font-mono font-medium">Render Prod</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-zinc-50/70 dark:bg-zinc-950 transition-colors duration-200">
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs whitespace-nowrap font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-card text-muted-foreground border border-border"
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
