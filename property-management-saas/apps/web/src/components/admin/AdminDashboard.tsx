"use client";

import * as React from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  Search,
  UserCheck,
  ShieldAlert,
  Play,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Ban,
  UserX,
  AlertOctagon,
  Activity,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  XCircle,
  Check,
  ShieldCheck,
  Smartphone,
  Copy,
  Info,
} from "lucide-react";
import { SecurityLogs } from "./SecurityLogs";
import { Button } from "../shared/Button";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AdminTab = "overview" | "workspaces" | "upgrades" | "errors" | "payments" | "security";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalWorkspaces: number;
  activeWorkspaces: number;
  pendingWorkspaces: number;
  inactiveWorkspaces: number;
  totalProperties: number;
  totalUnits: number;
  totalTenants: number;
  totalLeases: number;
  activeLeases: number;
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  recentErrors: number;
}

interface WorkspaceMemberUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
}

interface WorkspaceAudit {
  id: string;
  name: string;
  status: string;
  plan: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  members: Array<{ role: string; user: WorkspaceMemberUser }>;
  _count: {
    properties: number;
    tenants: number;
    units: number;
    payments: number;
  };
}

interface ErrorLogEntry {
  id: string;
  level: string;
  message: string;
  source: string;
  createdAt: string;
}

interface PaymentEntry {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate: string | null;
  createdAt: string;
  lease: {
    tenant: { id: string; name: string; email: string | null };
    property: { id: string; name: string; address: string };
  };
  workspace: { id: string; name: string } | null;
}

const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "workspaces", label: "Workspaces & Users", icon: Building2 },
  { id: "upgrades", label: "Upgrade Requests", icon: TrendingUp },
  { id: "errors", label: "System Logs", icon: AlertOctagon },
  { id: "payments", label: "Global Payments", icon: DollarSign },
  { id: "security", label: "Security & Audits", icon: ShieldCheck },
];

// ===========================
// Status Badge Component
// ===========================
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    INACTIVE: "bg-secondary text-muted-foreground dark:bg-secondary dark:text-muted-foreground",
    REJECTED:
      "bg-destructive/10 text-rose-700 dark:bg-destructive/30 dark:text-rose-400",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    OVERDUE: "bg-destructive/10 text-rose-700 dark:bg-destructive/30 dark:text-rose-400",
    PARTIALLY_PAID:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    UNDER_REVIEW:
      "bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary",
    FREE: "bg-secondary text-muted-foreground dark:bg-secondary dark:text-muted-foreground",
    PRO: "bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary",
    ENTERPRISE:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
        styles[status] || "bg-secondary text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ===========================
// Main Admin Dashboard
// ===========================
export function AdminDashboard() {
  const [activeTab, setActiveTab] = React.useState<AdminTab>("overview");
  const queryClient = useQueryClient();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 -top-4 w-24 h-24 bg-destructive/10 rounded-full blur-3xl" />
        <div className="relative mt-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
              God Mode
            </span>
          </div>
          <h2 className="text-5xl font-bold tracking-tighter sm:text-6xl text-foreground">
            Super Admin
          </h2>
          <p className="text-muted-foreground mt-4 text-lg font-medium max-w-2xl leading-relaxed">
            Full platform control. Monitor, manage, and audit the entire
            PropertyStack ecosystem.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.97]",
                isActive
                  ? "bg-destructive text-white shadow-lg shadow-rose-500/20"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "workspaces" && <WorkspacesTab />}
      {activeTab === "upgrades" && <UpgradeRequestsTab />}
      {activeTab === "errors" && <ErrorsTab />}
      {activeTab === "payments" && <PaymentsTab />}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <SecurityLogs />
          </div>
          <div className="lg:col-span-1">
            <SecurityTab />
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================
// Overview Tab
// ===========================
function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/super-admin/stats`),
  });

  if (isLoading) return <LoadingSpinner />;

  const stats: AdminStats = data?.stats;
  const recentUsers = data?.recentUsers || [];

  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers || 0,
      sub: `${stats?.activeUsers || 0} active`,
      icon: Users,
      color: "text-primary",
      bg: "bg-blue-500/10",
    },
    {
      label: "Workspaces",
      value: stats?.totalWorkspaces || 0,
      sub: `${stats?.activeWorkspaces || 0} active`,
      icon: Building2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Properties",
      value: stats?.totalProperties || 0,
      sub: `${stats?.totalUnits || 0} units`,
      icon: Building2,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Active Leases",
      value: stats?.activeLeases || 0,
      sub: `of ${stats?.totalLeases || 0} total`,
      icon: UserCheck,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Revenue (Paid)",
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      sub: `${stats?.pendingPayments || 0} pending`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Overdue",
      value: stats?.overduePayments || 0,
      sub: "payments overdue",
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Banned Users",
      value: stats?.inactiveUsers || 0,
      sub: "globally disabled",
      icon: Ban,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Error Logs",
      value: stats?.recentErrors || 0,
      sub: "total entries",
      icon: AlertOctagon,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="p-5 rounded-[1.5rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-xl shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                stat.bg,
              )}
            >
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {stat.label}
            </p>
            <h4 className="text-2xl font-black text-foreground mt-0.5 tracking-tight">
              {stat.value}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Signups */}
      <div className="rounded-[2rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-md p-6 shadow-xl">
        <h3 className="text-lg font-bold tracking-tight text-foreground mb-4">
          Recent Signups
        </h3>
        <div className="space-y-3">
          {recentUsers.map(
            (u: {
              id: string;
              email: string;
              name: string | null;
              role: string;
              createdAt: string;
            }) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground dark:text-foreground">
                    {u.name
                      ? u.name.charAt(0).toUpperCase()
                      : u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {u.name || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={u.role} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================
// Workspaces & Users Audit Tab
// ===========================
function WorkspacesTab() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState<{
    type: "deactivate" | "ban" | "impersonate";
    targetId: string;
    title: string;
    desc: string;
    buttonText: string;
    bgClass: string;
  } | null>(null);
  const [upgradePlanWorkspace, setUpgradePlanWorkspace] = React.useState<WorkspaceAudit | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<"FREE" | "PRO" | "ENTERPRISE">("PRO");
  const [selectedDuration, setSelectedDuration] = React.useState<number>(12);

  const handleOpenUpgradeModal = (ws: WorkspaceAudit) => {
    setUpgradePlanWorkspace(ws);
    setSelectedPlan(ws.plan as "FREE" | "PRO" | "ENTERPRISE");
    setSelectedDuration(12);
  };
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      "super-admin-workspaces",
      page,
      searchTerm,
      statusFilter,
      planFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter) params.set("status", statusFilter);
      if (planFilter) params.set("plan", planFilter);
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/workspaces?${params.toString()}`,
      );
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      plan,
      durationMonths,
    }: {
      id: string;
      plan: string;
      durationMonths: number;
    }) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/workspaces/${id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ plan, durationMonths }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Workspace plan updated successfully");
      queryClient.invalidateQueries({ queryKey: ["super-admin-workspaces"] });
      setUpgradePlanWorkspace(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/workspaces/${id}/deactivate`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
    },
    onSuccess: () => {
      toast.success("Workspace deactivated");
      queryClient.invalidateQueries({ queryKey: ["super-admin-workspaces"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/workspaces/${id}/reject`,
        {
          method: "POST",
        },
      );
    },
    onSuccess: () => {
      toast.success("Workspace rejected");
      queryClient.invalidateQueries({ queryKey: ["super-admin-workspaces"] });
    },
  });

  const toggleAccessMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/users/${userId}/toggle-access`,
        {
          method: "POST",
          body: JSON.stringify({ isActive }),
        },
      );
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "User unbanned" : "User banned");
      queryClient.invalidateQueries({ queryKey: ["super-admin-workspaces"] });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/users/${userId}/impersonate`,
        {
          method: "POST",
        },
      );
    },
    onSuccess: (data) => {
      if (data.impersonation?.actionLink) {
        toast.success(
          `Impersonating ${data.impersonation.targetUser.email}. Opening new tab...`,
        );
      } else {
        toast.error("Could not generate impersonation link");
      }
    },
  });

  const workspaces: WorkspaceAudit[] = data?.workspaces || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by workspace name or owner email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 rounded-2xl bg-card border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-destructive/20"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="INACTIVE">Inactive</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 rounded-2xl bg-card border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-destructive/20"
        >
          <option value="">All Plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => {
            const owner = ws.members.find((m) => m.role === "PROPERTY_MANAGER");
            const isExpired =
              ws.subscriptionExpiresAt &&
              new Date(ws.subscriptionExpiresAt) < new Date();
            return (
              <div
                key={ws.id}
                className="rounded-[1.5rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-md p-6 shadow-lg transition-all hover:shadow-xl"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Workspace info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-foreground truncate">
                        {ws.name}
                      </h4>
                      <StatusBadge status={ws.status} />
                      <StatusBadge status={ws.plan} />
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-rose-700 dark:bg-destructive/30 dark:text-rose-400">
                          EXPIRED
                        </span>
                      )}
                    </div>
                    {owner && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold">
                          {owner.user.name
                            ? owner.user.name.charAt(0).toUpperCase()
                            : owner.user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {owner.user.name || "N/A"} ·{" "}
                          <span className="text-muted-foreground">
                            {owner.user.email}
                          </span>
                        </span>
                        {!owner.user.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/10 text-destructive dark:bg-destructive/30 dark:text-rose-400">
                            BANNED
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground font-medium">
                      <span>{ws._count.properties} properties</span>
                      <span>{ws._count.tenants} tenants</span>
                      <span>{ws._count.units} units</span>
                      <span>{ws._count.payments} payments</span>
                      {ws.subscriptionExpiresAt && (
                        <span>
                          Expires:{" "}
                          {new Date(
                            ws.subscriptionExpiresAt,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ws.status !== "ACTIVE" && (
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            id: ws.id,
                            plan: "PRO",
                            durationMonths: 12,
                          })
                        }
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow hover:bg-emerald-600 active:scale-[0.97] transition-all disabled:opacity-50"
                        title="Approve & Activate (PRO, 12 months)"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {ws.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => handleOpenUpgradeModal(ws)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow hover:bg-primary/90 active:scale-[0.97] transition-all"
                          title="Change / Manage Plan"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Plan
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: "deactivate",
                              targetId: ws.id,
                              title: "Deactivate Workspace?",
                              desc: "Are you absolutely sure you want to deactivate this workspace? All associated users will instantly lose access to properties and data within it.",
                              buttonText: "Yes, Deactivate",
                              bgClass: "bg-destructive hover:bg-rose-600",
                            })
                          }
                          disabled={deactivateMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-bold shadow hover:bg-zinc-300 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all disabled:opacity-50"
                          title="Deactivate Workspace"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      </>
                    )}
                    {ws.status !== "REJECTED" && ws.status !== "ACTIVE" && (
                      <button
                        onClick={() => rejectMutation.mutate(ws.id)}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 dark:bg-rose-900/20 text-destructive dark:text-rose-400 text-xs font-bold shadow hover:bg-rose-200 dark:hover:bg-rose-900/40 active:scale-[0.97] transition-all disabled:opacity-50"
                        title="Reject Workspace"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    {owner && (
                      <>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: "impersonate",
                              targetId: owner.user.id,
                              title: "Impersonate User?",
                              desc: `Are you sure you want to log in as ${owner.user.email || "this user"}? You will be granted full access to their workspaces and be able to perform actions on their behalf.`,
                              buttonText: "Yes, Login As User",
                              bgClass: "bg-blue-500 hover:bg-primary",
                            })
                          }
                          disabled={impersonateMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary text-xs font-bold shadow hover:bg-primary/20 dark:hover:bg-blue-900/40 active:scale-[0.97] transition-all disabled:opacity-50"
                          title="Login as this user"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Login As
                        </button>
                        <button
                          onClick={() => {
                            if (owner.user.isActive) {
                              setConfirmAction({
                                type: "ban",
                                targetId: owner.user.id,
                                title: "Ban User?",
                                desc: `Are you sure you want to ban ${owner.user.email || "this user"}? They will be completely locked out of the platform across all workspaces.`,
                                buttonText: "Yes, Ban User",
                                bgClass: "bg-destructive hover:bg-rose-600",
                              });
                            } else {
                              toggleAccessMutation.mutate({
                                userId: owner.user.id,
                                isActive: true,
                              });
                            }
                          }}
                          disabled={toggleAccessMutation.isPending}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow active:scale-[0.97] transition-all disabled:opacity-50",
                            owner.user.isActive
                              ? "bg-destructive/10 dark:bg-rose-900/20 text-destructive dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/40"
                              : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40",
                          )}
                          title={
                            owner.user.isActive
                              ? "Ban this user"
                              : "Unban this user"
                          }
                        >
                          {owner.user.isActive ? (
                            <Ban className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                          {owner.user.isActive ? "Ban" : "Unban"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {workspaces.length === 0 && (
            <div className="py-20 text-center text-muted-foreground font-medium">
              No workspaces found.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-secondary/50 dark:hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-secondary/50 dark:hover:bg-secondary transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reusable Action Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div
              className={`flex items-center gap-4 mb-4 ${confirmAction.bgClass.includes("rose") ? "text-destructive" : "text-primary"}`}
            >
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                {confirmAction.title}
              </h3>
            </div>

            <p className="text-muted-foreground font-medium mb-6 leading-relaxed">
              {confirmAction.desc}
            </p>

            <div className="flex items-center justify-end gap-3 font-semibold">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-secondary hover:bg-secondary dark:hover:bg-zinc-700 text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmAction.type === "deactivate") {
                    deactivateMutation.mutate(confirmAction.targetId);
                  }
                  if (confirmAction.type === "ban") {
                    toggleAccessMutation.mutate({
                      userId: confirmAction.targetId,
                      isActive: false,
                    });
                  }
                  if (confirmAction.type === "impersonate") {
                    // Open window synchronously to bypass pop-up blockers
                    const newWin = window.open("about:blank", "_blank");
                    try {
                      const data = await impersonateMutation.mutateAsync(
                        confirmAction.targetId,
                      );
                      if (data?.impersonation?.actionLink && newWin) {
                        newWin.location.href = data.impersonation.actionLink;
                      } else if (newWin) {
                        newWin.close();
                      }
                    } catch (e) {
                      if (newWin) newWin.close();
                    }
                  }
                  setConfirmAction(null);
                }}
                className={`px-6 py-2 text-white rounded-lg transition-colors shadow-lg ${confirmAction.bgClass}`}
              >
                {confirmAction.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================
// Error Logs Tab
// ===========================
function ErrorsTab() {
  const [page, setPage] = React.useState(1);
  const [level, setLevel] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-errors", page, level],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "30");
      if (level) params.set("level", level);
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/errors?${params.toString()}`,
      );
    },
  });

  const errors: ErrorLogEntry[] = data?.errors || [];
  const totalPages = data?.totalPages || 1;

  const levelColors: Record<string, string> = {
    error: "bg-destructive/10 text-rose-700 dark:bg-destructive/30 dark:text-rose-400",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    info: "bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 rounded-2xl bg-card border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-destructive/20"
        >
          <option value="">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {errors.map((err) => (
            <div
              key={err.id}
              className="rounded-[1.5rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      levelColors[err.level] || "bg-secondary text-muted-foreground",
                    )}
                  >
                    {err.level}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {err.source}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                  {new Date(err.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-foreground font-mono break-all leading-relaxed">
                {err.message}
              </p>
            </div>
          ))}

          {errors.length === 0 && (
            <div className="py-20 text-center text-muted-foreground font-medium">
              No error logs found. System is healthy.
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================
// Global Payments Tab
// ===========================
function PaymentsTab() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-payments", page, status],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (status) params.set("status", status);
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/payments?${params.toString()}`,
      );
    },
  });

  const payments: PaymentEntry[] = data?.payments || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 rounded-2xl bg-card border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-destructive/20"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="rounded-[2rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Tenant
                  </th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Property
                  </th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Workspace
                  </th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Amount
                  </th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Status
                  </th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-50 dark:border-zinc-900/50 hover:bg-secondary/50 dark:hover:bg-card/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm font-bold text-foreground">
                        {p.lease.tenant.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.lease.tenant.email || "No email"}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-medium">
                      {p.lease.property.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {p.workspace?.name || "—"}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-foreground">
                      ₦{p.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(p.dueDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payments.length === 0 && (
            <div className="py-20 text-center text-muted-foreground font-medium">
              No payments found.
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 p-4 border-t border-border">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================
// Loading Spinner
// ===========================
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="animate-spin h-8 w-8 border-4 border-rose-500 border-t-transparent rounded-full" />
    </div>
  );
}

// ===========================
// Security & 2FA Tab
// ===========================
function SecurityTab() {
  const [loading, setLoading] = React.useState(false);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [showDisableConfirm, setShowDisableConfirm] = React.useState<
    string | null
  >(null);

  const { data: factorsData, refetch } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const totpFactors =
    factorsData?.all?.filter(
      (f) => f.factor_type === "totp" && f.status === "verified",
    ) || [];
  const isEnrolled = totpFactors.length > 0;

  const handleEnroll = async () => {
    setLoading(true);
    setError("");
    try {
      // Clean up any existing unverified factors to prevent "already exists" errors
      const unverifiedFactors =
        factorsData?.all?.filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        ) || [];
      for (const factor of unverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `PropertyStack Admin ${new Date().getTime()}`,
      });
      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to start enrollment");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verifyCode.length !== 6) return;

    setLoading(true);
    setError("");
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (error) throw error;

      toast.success("Two-Factor Authentication enabled successfully!");
      setFactorId(null);
      setQrCode(null);
      refetch();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = (id: string) => {
    setShowDisableConfirm(id);
  };

  const confirmUnenroll = async () => {
    if (!showDisableConfirm) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: showDisableConfirm,
      });
      if (error) throw error;
      toast.success("2FA disabled");
      refetch();
    } catch (err: unknown) {
      const errorObj = err as Error;
      toast.error(errorObj.message || "Failed to disable 2FA");
    } finally {
      setLoading(false);
      setShowDisableConfirm(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="rounded-[2rem] border border-white/20 dark:border-border bg-white/50 dark:bg-card/50 backdrop-blur-md p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isEnrolled
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-secondary text-muted-foreground dark:bg-secondary",
            )}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Two-Factor Authentication
            </h3>
            <p className="text-muted-foreground font-medium">
              Add an extra layer of security to your Super Admin account.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-destructive text-sm font-medium">
            {error}
          </div>
        )}

        {isEnrolled ? (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-800 dark:text-emerald-400">
                  2FA is successfully enabled
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                  Your account is protected. You will be required to enter a
                  code from your authenticator app when signing in.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-widest">
                Active Factors
              </h4>
              {totpFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-bold text-foreground">
                        Authenticator App
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnenroll(factor.id)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    Disable
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : factorId && qrCode ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 dark:bg-primary/10 dark:border-primary/30">
              <p className="font-bold text-blue-800 dark:text-primary mb-1">
                Step 1: Scan the QR Code
              </p>
              <p className="text-sm text-primary dark:text-primary">
                Open Google Authenticator, Authy, or Apple Passwords and scan
                this QR code.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-background rounded-2xl border border-border">
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                <img src={qrCode} alt="2FA QR Code" width={200} height={200} />
              </div>

              <div className="text-center w-full max-w-sm">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Or enter this code manually
                </p>
                <div className="flex items-center justify-center gap-2 p-3 bg-secondary/50 dark:bg-card rounded-xl border border-border">
                  <code className="text-sm font-mono font-bold tracking-wider text-foreground">
                    {secret}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(secret || "");
                      toast.success("Secret copied to clipboard");
                    }}
                    className="p-1.5 rounded-lg hover:bg-secondary dark:hover:bg-secondary text-muted-foreground transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 dark:bg-primary/10 dark:border-primary/30">
              <p className="font-bold text-blue-800 dark:text-primary mb-1">
                Step 2: Verify Code
              </p>
              <p className="text-sm text-primary dark:text-primary mb-4">
                Enter the 6-digit code generated by your app to complete setup.
              </p>
              <form onSubmit={handleVerify} className="flex gap-3">
                <input
                  type="text"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="flex-1 h-12 rounded-xl border border-primary/20 dark:border-primary/20 bg-card px-4 text-xl tracking-[0.5em] font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring/50"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || verifyCode.length !== 6}
                  className="px-6 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Verify
                </button>
              </form>
            </div>

            <button
              onClick={() => {
                setFactorId(null);
                setQrCode(null);
              }}
              className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-zinc-800 dark:hover:text-foreground"
            >
              Cancel Setup
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Two-factor authentication is currently{" "}
              <strong className="text-destructive">disabled</strong> for your
              account. As a Super Admin, it is highly recommended to enable this
              to prevent unauthorized access to the platform.
            </p>
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              Setup Authenticator App
            </button>
          </div>
        )}
      </div>

      {/* Custom Disable 2FA Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4 text-destructive">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                Disable 2FA?
              </h3>
            </div>

            <p className="text-muted-foreground font-medium mb-6 leading-relaxed">
              Are you absolutely sure you want to disable Two-Factor
              Authentication? As a Super Admin, this will severely weaken your
              account security and expose the entire platform to higher risk.
            </p>

            <div className="flex items-center justify-end gap-3 font-semibold">
              <button
                onClick={() => setShowDisableConfirm(null)}
                disabled={loading}
                className="px-4 py-2 bg-secondary hover:bg-secondary dark:hover:bg-zinc-700 text-foreground rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnenroll}
                disabled={loading}
                className="px-6 py-2 bg-destructive hover:bg-rose-600 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50"
              >
                {loading ? "Disabling..." : "Yes, Disable 2FA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface UpgradeRequestAudit {
  id: string;
  workspaceId: string;
  userId: string;
  proofUrl: string;
  requestedPlan: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    plan: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

function UpgradeRequestsTab() {
  const [statusFilter, setStatusFilter] = React.useState<string>("PENDING");
  const [page, setPage] = React.useState(1);
  const [selectedRequest, setSelectedRequest] = React.useState<UpgradeRequestAudit | null>(null);
  const [actionType, setActionType] = React.useState<"approve" | "reject" | null>(null);
  const [durationMonths, setDurationMonths] = React.useState<number>(12);
  const [rejectionReason, setRejectionReason] = React.useState<string>("");
  const [previewProofUrl, setPreviewProofUrl] = React.useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-upgrade-requests", page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (statusFilter) params.set("status", statusFilter);
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/upgrade-requests?${params.toString()}`,
      );
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, durationMonths }: { id: string; durationMonths: number }) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/upgrade-requests/${id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ durationMonths }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Upgrade request approved successfully!");
      queryClient.invalidateQueries({ queryKey: ["super-admin-upgrade-requests"] });
      setSelectedRequest(null);
      setActionType(null);
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to approve request");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/upgrade-requests/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Upgrade request rejected");
      queryClient.invalidateQueries({ queryKey: ["super-admin-upgrade-requests"] });
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason("");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to reject request");
    },
  });

  const requests: UpgradeRequestAudit[] = data?.requests || [];
  const totalPages = data?.totalPages || 1;

  const handleOpenAction = (req: UpgradeRequestAudit, type: "approve" | "reject") => {
    setSelectedRequest(req);
    setActionType(type);
    if (type === "approve") {
      setDurationMonths(12);
    } else {
      setRejectionReason("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border">
        <div className="flex gap-2">
          {["PENDING", "APPROVED", "REJECTED", ""].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                (statusFilter === status)
                  ? "bg-destructive text-white shadow-md shadow-rose-500/10"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              )}
            >
              {status || "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-base font-bold text-foreground">No upgrade requests found</h4>
              <p className="text-xs text-muted-foreground mt-1">There are no manual upgrade requests matching this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-card rounded-3xl border border-border shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="p-5">Workspace</th>
                    <th className="p-5">Requested By</th>
                    <th className="p-5">Requested Tier</th>
                    <th className="p-5">Proof Of Payment</th>
                    <th className="p-5">Date Submitted</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-5">
                        <div className="font-bold text-foreground">{req.workspace?.name}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">Current Plan: {req.workspace?.plan}</div>
                      </td>
                      <td className="p-5">
                        <div className="font-bold text-foreground">{req.user?.name || "N/A"}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{req.user?.email}</div>
                      </td>
                      <td className="p-5">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-primary/10 text-primary">
                          {req.requestedPlan}
                        </span>
                      </td>
                      <td className="p-5">
                        <button
                          onClick={() => setPreviewProofUrl(req.proofUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted text-foreground rounded-lg border border-border transition-colors font-bold text-[10px] uppercase"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      </td>
                      <td className="p-5 font-semibold text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-5 text-right">
                        {req.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenAction(req, "approve")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenAction(req, "reject")}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end items-center gap-1">
                            <StatusBadge status={req.status} />
                            {req.status === "REJECTED" && req.rejectionReason && (
                              <div className="group relative">
                                <Info className="w-4 h-4 text-rose-500 cursor-pointer ml-1" />
                                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 bg-zinc-950 text-white text-[10px] p-2 rounded-lg shadow-xl border border-zinc-800 z-[100] text-left font-medium">
                                  {req.rejectionReason}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <span className="text-xs text-muted-foreground font-semibold">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proof Preview Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-base">Proof of Payment Receipt</h3>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="p-1 hover:bg-muted text-muted-foreground rounded-lg transition-colors font-bold text-xs"
              >
                Close
              </button>
            </div>
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 p-6 overflow-auto flex items-center justify-center min-h-[40vh]">
              {previewProofUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewProofUrl}
                  className="w-full h-[60vh] rounded-xl border border-border bg-white"
                  title="PDF Proof"
                />
              ) : (
                <img
                  src={previewProofUrl}
                  alt="Payment Proof"
                  className="max-h-[60vh] object-contain rounded-xl shadow-md border border-border"
                />
              )}
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <a
                href={previewProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                Open Original Tab
              </a>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {actionType === "approve" && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Approve Upgrade Request</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade <strong className="text-foreground">{selectedRequest.workspace?.name}</strong> to the <strong className="uppercase text-primary">{selectedRequest.requestedPlan}</strong> plan.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Subscription Duration (Months)</label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full px-4 py-3 border border-border rounded-xl bg-card font-bold text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Recommended)</option>
                <option value={24}>24 Months</option>
                <option value={36}>36 Months</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => approveMutation.mutate({ id: selectedRequest.id, durationMonths })}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-emerald-500/10"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {actionType === "reject" && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Decline Upgrade Request</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Decline the upgrade request for <strong className="text-foreground">{selectedRequest.workspace?.name}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rejection Explanation</label>
              <textarea
                required
                placeholder="Specify details, e.g., 'Bank receipt number not matching transfer ledger' or 'Amount paid is incomplete'..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-border rounded-xl bg-card font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: selectedRequest.id, reason: rejectionReason })}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-rose-500/10 disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Declining..." : "Decline Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
