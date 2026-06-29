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
  CheckCircle2,
  AlertTriangle,
  Eye,
  Ban,
  AlertOctagon,
  Activity,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  LogIn,
  XCircle,
  X,
  Check,
  ShieldCheck,
  Smartphone,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  Network,
  User,
  FileText,
} from "lucide-react";
import { SecurityLogs } from "./SecurityLogs";
import { AuditTrail } from "./AuditTrail";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { supabase } from "@/lib/supabase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AdminTab =
  | "overview"
  | "workspaces"
  | "upgrades"
  | "errors"
  | "payments"
  | "security"
  | "users"
  | "legal-leases"
  | "audit-trail";

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
  monthlyTarget: number;
  monthlyRevenueCollected: number;
  todayRevenue: number;
  trends: {
    users: number[];
    workspaces: number[];
    properties: number[];
    leases: number[];
    revenue: number[];
    overdue: number[];
    banned: number[];
    errors: number[];
  };
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  monthlySignups: Array<{ month: string; count: number }>;
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

// ===========================
// Curved SVG Sparkline Component
// ===========================
function Sparkline({
  data,
  color = "#0066FF",
}: {
  data: number[];
  color?: string;
}) {
  const width = 120;
  const height = 32;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const coords = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return { x, y };
  });

  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    const cpY2 = curr.y;
    linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }

  const fillPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;
  const gradientId = React.useId();

  return (
    <svg className="w-24 h-8" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ===========================
// Modern SaaS Status Badge Component
// ===========================
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30",
    PENDING:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
    INACTIVE:
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60",
    REJECTED:
      "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30",
    PAID: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30",
    OVERDUE:
      "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30",
    PARTIALLY_PAID:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
    UNDER_REVIEW:
      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30",
    FREE: "bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800",
    PRO: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30",
    ENTERPRISE:
      "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-200/50 dark:border-teal-900/30",
  };

  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight border",
        styles[status] ||
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface AdminDashboardProps {
  activeTab?: AdminTab;
  setActiveTab?: (tab: AdminTab) => void;
}

export function AdminDashboard({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}: AdminDashboardProps) {
  const [localActiveTab, setLocalActiveTab] =
    React.useState<AdminTab>("overview");

  const activeTab = propActiveTab ?? localActiveTab;
  const setActiveTab = propSetActiveTab ?? setLocalActiveTab;

  const headerDetails: Record<
    AdminTab,
    { title: string; description: string; label: string }
  > = {
    overview: {
      title: "Super Admin Console",
      description:
        "Monitor active tenants, workspaces state, upgrade logs, and core databases.",
      label: "Overview",
    },
    workspaces: {
      title: "Workspaces Audit",
      description:
        "Manage platform workspaces, subscription plans, and user permissions.",
      label: "Workspaces",
    },
    upgrades: {
      title: "Upgrade Requests",
      description:
        "Review and approve tier upgrade requests from workspace managers.",
      label: "Upgrade Requests",
    },
    errors: {
      title: "System Error Logs",
      description:
        "Inspect system error logs, network level issues, and operational health.",
      label: "System Logs",
    },
    payments: {
      title: "Payment History",
      description: "Track platform transactions, dues, and payment statuses.",
      label: "Payments",
    },
    security: {
      title: "Security & MFA Console",
      description:
        "Monitor auth logs, security events, and multi-factor auth enrollment.",
      label: "Security & MFA",
    },
    users: {
      title: "User Registry",
      description:
        "Search, audit roles, toggle access, and view workspace hierarchy on the platform.",
      label: "Users Management",
    },
    "legal-leases": {
      title: "Legal Lease Requests",
      description:
        "Review and verify proof of payment for legal lease drafting requests.",
      label: "Legal Leases",
    },
    "audit-trail": {
      title: "Manager Audit Trail",
      description:
        "Complete trace of all operational activities performed by property managers.",
      label: "Audit Trail",
    },
  };

  const currentHeader = headerDetails[activeTab];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          {/* Dynamic Breadcrumbs & Status Indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Super Admin
              </span>
              <span className="text-[10px] font-bold text-muted-foreground/50">
                /
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {currentHeader.label}
              </span>
            </div>
            <span className="text-muted-foreground/30">•</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Live
              </span>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            {currentHeader.title}
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {currentHeader.description}
          </p>
        </div>

        {/* Fake Search Widget (Command Palette Style) */}
        <div className="relative hidden md:block w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            readOnly
            placeholder="Search console actions..."
            className="w-full pl-10 pr-12 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl text-muted-foreground focus:outline-none cursor-pointer"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-card border border-border/80 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
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
        {activeTab === "users" && <UsersTab />}
        {activeTab === "legal-leases" && <LegalLeaseRequestsTab />}
        {activeTab === "audit-trail" && <AuditTrail />}
      </div>
    </div>
  );
}

// ===========================
// Overview Tab
// ===========================
function OverviewTab() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/super-admin/stats`),
  });

  React.useEffect(() => {
    if (socket) {
      const handleUserRegistered = (newUser: {
        name?: string;
        email: string;
      }) => {
        console.log("[Realtime] A new user registered:", newUser);
        toast.info(`New user registration: ${newUser.name || newUser.email}`);
        queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      };

      socket.on("USER_REGISTERED", handleUserRegistered);

      return () => {
        socket.off("USER_REGISTERED", handleUserRegistered);
      };
    }
  }, [socket, queryClient]);

  if (isLoading) return <LoadingSpinner />;

  const stats: AdminStats = data?.stats;
  const recentUsers = data?.recentUsers || [];

  const statCards = [
    {
      label: "Total Users",
      value: (stats?.totalUsers || 0).toLocaleString(),
      sub: `${stats?.activeUsers || 0} active`,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      sparkline: stats?.trends?.users || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#3b82f6",
    },
    {
      label: "Workspaces",
      value: (stats?.totalWorkspaces || 0).toLocaleString(),
      sub: `${stats?.activeWorkspaces || 0} active`,
      icon: Building2,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      sparkline: stats?.trends?.workspaces || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#6366f1",
    },
    {
      label: "Properties",
      value: (stats?.totalProperties || 0).toLocaleString(),
      sub: `${stats?.totalUnits || 0} units`,
      icon: Building2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      sparkline: stats?.trends?.properties || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#10b981",
    },
    {
      label: "Active Leases",
      value: (stats?.activeLeases || 0).toLocaleString(),
      sub: `of ${stats?.totalLeases || 0} total`,
      icon: UserCheck,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/20",
      sparkline: stats?.trends?.leases || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#14b8a6",
    },
    {
      label: "Revenue (Paid)",
      value: (stats?.totalRevenue || 0).toLocaleString(),
      isCurrency: true,
      sub: `${stats?.pendingPayments || 0} pending`,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      sparkline: stats?.trends?.revenue || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#10b981",
    },
    {
      label: "Overdue Payments",
      value: (stats?.overduePayments || 0).toLocaleString(),
      sub: "Action required",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      sparkline: stats?.trends?.overdue || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#f59e0b",
    },
    {
      label: "Banned Users",
      value: (stats?.inactiveUsers || 0).toLocaleString(),
      sub: "Globally disabled",
      icon: Ban,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/20",
      sparkline: stats?.trends?.banned || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#f43f5e",
    },
    {
      label: "Error Logs",
      value: (stats?.recentErrors || 0).toLocaleString(),
      sub: "Unresolved events",
      icon: AlertOctagon,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/20",
      sparkline: stats?.trends?.errors || [0, 0, 0, 0, 0, 0, 0],
      sparkColor: "#f43f5e",
    },
  ];

  // Helper to format currency values beautifully
  const formatCurrency = (val: number) => {
    if (val >= 1000000000)
      return `₦${(val / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
    if (val >= 1000000)
      return `₦${(val / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return `₦${val.toLocaleString()}`;
  };

  const monthlyRevenueData =
    stats?.monthlyRevenue ||
    Array.from({ length: 12 }, (_, i) => ({
      month: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][i],
      revenue: 0,
    }));
  const maxRevenue = Math.max(...monthlyRevenueData.map((d) => d.revenue), 1);

  const width = 600;
  const height = 200;
  const paddingX = 20;
  const paddingY = 40;

  const chartCoords = monthlyRevenueData.map((dataPoint, idx) => {
    const x =
      paddingX +
      (idx / (monthlyRevenueData.length - 1)) * (width - 2 * paddingX);
    const y =
      height -
      paddingY -
      (dataPoint.revenue / maxRevenue) * (height - 2 * paddingY);
    return { x, y };
  });

  let linePath = "";
  let fillPath = "";
  let peakCoords = { x: 300, y: 100, month: "Jan", revenue: 0 };

  if (chartCoords.length > 0) {
    linePath = `M ${chartCoords[0].x} ${chartCoords[0].y}`;
    for (let i = 1; i < chartCoords.length; i++) {
      const prev = chartCoords[i - 1];
      const curr = chartCoords[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    fillPath = `${linePath} L ${chartCoords[chartCoords.length - 1].x} ${height - 20} L ${chartCoords[0].x} ${height - 20} Z`;

    // Find the peak month (max revenue)
    let maxIndex = 0;
    let maxVal = -1;
    monthlyRevenueData.forEach((d, idx) => {
      if (d.revenue > maxVal) {
        maxVal = d.revenue;
        maxIndex = idx;
      }
    });
    if (chartCoords[maxIndex]) {
      peakCoords = {
        x: chartCoords[maxIndex].x,
        y: chartCoords[maxIndex].y,
        month: monthlyRevenueData[maxIndex].month,
        revenue: monthlyRevenueData[maxIndex].revenue,
      };
    }
  }

  const tooltipLeftPct = (peakCoords.x / width) * 100;
  const tooltipTopPct = (peakCoords.y / height) * 100;

  // Radial Target Circle Calculations
  const monthlyRevenueCollected = stats?.monthlyRevenueCollected || 0;
  const monthlyTarget = stats?.monthlyTarget || 100000;
  const targetPercent =
    Math.min(
      100,
      Math.round((monthlyRevenueCollected / (monthlyTarget || 1)) * 100),
    ) || 0;
  const targetRadius = 50;
  const targetCircumference = 2 * Math.PI * targetRadius;
  const targetStrokeDashoffset =
    targetCircumference - (targetCircumference * targetPercent) / 100;

  return (
    <div className="space-y-8">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                {stat.label}
              </span>
              <div className={cn("p-2 rounded-xl", stat.bg, stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <h4 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center">
                {stat.isCurrency && (
                  <span className="font-sans font-semibold text-xl mr-0.5 text-muted-foreground">
                    ₦
                  </span>
                )}
                {stat.value}
              </h4>
              <Sparkline data={stat.sparkline} color={stat.sparkColor} />
            </div>

            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  stat.color.includes("emerald") ||
                    stat.color.includes("teal") ||
                    stat.color.includes("blue") ||
                    stat.color.includes("indigo")
                    ? "bg-emerald-500"
                    : stat.color.includes("amber")
                      ? "bg-amber-500"
                      : "bg-rose-500",
                )}
              />
              <span className="text-xs text-muted-foreground font-semibold">
                {stat.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Handcrafted Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Revenue Growth Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Revenue Analytics
              </h3>
              <p className="text-xs text-muted-foreground">
                Monthly cash flow and subscription trends
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/40 rounded-lg text-xs font-semibold text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary" />
              This Year
            </div>
          </div>

          {/* Clean Handcrafted Area Chart in SVG */}
          <div className="relative w-full h-56 pt-2">
            <svg
              className="w-full h-full"
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066FF" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#0066FF" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              <line
                x1="0"
                y1="40"
                x2="600"
                y2="40"
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="90"
                x2="600"
                y2="90"
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="140"
                x2="600"
                y2="140"
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="180"
                x2="600"
                y2="180"
                stroke="var(--border)"
                strokeWidth="0.5"
              />

              {/* Area fill path */}
              {fillPath && <path d={fillPath} fill="url(#chartGradient)" />}

              {/* Spline line path */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#0066FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Peak Month Indicator */}
              {peakCoords && peakCoords.revenue > 0 && (
                <>
                  <circle
                    cx={peakCoords.x}
                    cy={peakCoords.y}
                    r="5.5"
                    fill="#0066FF"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <line
                    x1={peakCoords.x}
                    y1={peakCoords.y}
                    x2={peakCoords.x}
                    y2="180"
                    stroke="#0066FF"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                </>
              )}
            </svg>

            {/* Dynamic Interactive Tooltip Widget */}
            {peakCoords && peakCoords.revenue > 0 && (
              <div
                className="absolute bg-zinc-900 text-white dark:bg-card dark:text-foreground border border-zinc-800 dark:border-border rounded-xl shadow-lg p-2.5 text-center text-[10.5px] w-36 pointer-events-none animate-in fade-in zoom-in-95 duration-300"
                style={{
                  left: `calc(${tooltipLeftPct}% - 72px)`,
                  top: `calc(${tooltipTopPct}% - 60px)`,
                }}
              >
                <span className="font-bold block text-[10px] text-zinc-400 dark:text-muted-foreground uppercase tracking-wider">
                  {peakCoords.month} {new Date().getFullYear()}
                </span>
                <span className="font-extrabold text-sm block mt-0.5 text-emerald-400 dark:text-emerald-500">
                  {formatCurrency(peakCoords.revenue)}
                </span>
              </div>
            )}

            {/* X-Axis Labels */}
            <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-tight px-1">
              {monthlyRevenueData
                .filter((_, idx) => idx % 2 === 0 || idx === 11)
                .map((d, idx) => (
                  <span key={idx}>{d.month}</span>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Monthly Target Radial Chart */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Monthly Target
            </h3>
            <p className="text-xs text-muted-foreground">
              Workspace acquisition & sales target progress
            </p>
          </div>

          <div className="relative py-4 flex items-center justify-center">
            {/* SVG Circle Gauge */}
            <svg
              className="w-36 h-36 transform -rotate-90"
              viewBox="0 0 120 120"
            >
              {/* Back track */}
              <circle
                cx="60"
                cy="60"
                r={targetRadius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
                className="opacity-60"
              />
              {/* Active track with primary color */}
              <circle
                cx="60"
                cy="60"
                r={targetRadius}
                fill="none"
                stroke="#0066FF"
                strokeWidth="9"
                strokeDasharray={targetCircumference}
                strokeDashoffset={targetStrokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Absolute Centered Text */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {targetPercent}%
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-full mt-0.5">
                +{targetPercent}%
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center px-4 font-medium">
            {targetPercent >= 100
              ? "Amazing! You have fully achieved this month's revenue target!"
              : targetPercent >= 50
                ? "You've crossed the halfway mark! Keep pushing to hit the target."
                : "Acquisitions are ongoing. Every lease counts towards our goal."}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-border/50 mt-4">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Target
              </span>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(monthlyTarget)}
              </span>
            </div>
            <div className="border-x border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Revenue
              </span>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(monthlyRevenueCollected)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Today
              </span>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(stats?.todayRevenue || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Signup Feed Registry */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Active Platform Registrations
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time listing of newly registered user credentials
            </p>
          </div>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200/40">
            Auto-stream active
          </span>
        </div>

        <div className="divide-y divide-border/40 max-h-[320px] overflow-y-auto pr-1">
          {recentUsers.map(
            (
              u: {
                id: string;
                email: string;
                name: string | null;
                role: string;
                createdAt: string;
              },
              idx: number,
            ) => {
              // Create dynamic avatar initials background depending on index
              const avatarColors = [
                "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
                "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              ];
              const avatarColor = avatarColors[idx % avatarColors.length];
              const initials = u.name
                ? u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : u.email[0].toUpperCase();

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-3.5 hover:bg-muted/10 transition-colors px-2 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm",
                        avatarColor,
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {u.name || "Unnamed Operator"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
                    <span className="px-2 py-0.5 bg-muted rounded-md text-[10px] text-muted-foreground border border-border/40">
                      {u.role}
                    </span>
                    <span className="text-muted-foreground/80 hidden sm:inline text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()} at{" "}
                      {new Date(u.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            },
          )}

          {recentUsers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground font-semibold text-sm">
              No recent active user registration data available.
            </div>
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
    type: "deactivate" | "ban";
    targetId: string;
    title: string;
    desc: string;
    buttonText: string;
    bgClass: string;
  } | null>(null);
  const [upgradePlanWorkspace, setUpgradePlanWorkspace] =
    React.useState<WorkspaceAudit | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<
    "FREE" | "PRO" | "ENTERPRISE"
  >("PRO");
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

  const workspaces: WorkspaceAudit[] = data?.workspaces || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
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
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
        >
          <option value="">All Statuses</option>
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
          className="px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
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
                className="rounded-2xl border border-border/85 bg-card p-6 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: Workspace info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                      <h4 className="text-base font-bold text-foreground truncate mr-2">
                        {ws.name}
                      </h4>
                      <StatusBadge status={ws.status} />
                      <StatusBadge status={ws.plan} />
                      {isExpired && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/40">
                          Expired
                        </span>
                      )}
                    </div>
                    {owner && (
                      <div className="flex items-center gap-2 mb-3.5 text-xs text-muted-foreground font-semibold">
                        <span>Owner:</span>
                        <span className="text-foreground">
                          {owner.user.name || "Unnamed landlord"}
                        </span>
                        <span>({owner.user.email})</span>
                        {!owner.user.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/40">
                            Banned
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground font-bold uppercase tracking-tight">
                      <span className="bg-muted px-2.5 py-1 rounded-lg border border-border/40">
                        Properties: {ws._count.properties}
                      </span>
                      <span className="bg-muted px-2.5 py-1 rounded-lg border border-border/40">
                        Tenants: {ws._count.tenants}
                      </span>
                      <span className="bg-muted px-2.5 py-1 rounded-lg border border-border/40">
                        Units: {ws._count.units}
                      </span>
                      <span className="bg-muted px-2.5 py-1 rounded-lg border border-border/40">
                        Payments: {ws._count.payments}
                      </span>
                      {ws.subscriptionExpiresAt && (
                        <span className="text-muted-foreground/75 py-1">
                          Expires:{" "}
                          {new Date(
                            ws.subscriptionExpiresAt,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 lg:self-center">
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
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                        title="Approve & Activate (PRO, 12 months)"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Approve
                      </button>
                    )}
                    {ws.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => handleOpenUpgradeModal(ws)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                          title="Change / Manage Plan"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                          Manage Plan
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: "deactivate",
                              targetId: ws.id,
                              title: "Deactivate Workspace?",
                              desc: "Are you absolutely sure you want to deactivate this workspace? All associated users will instantly lose access to properties and data within it.",
                              buttonText: "Deactivate Workspace",
                              bgClass:
                                "bg-rose-500 hover:bg-rose-600 text-white shadow-sm border border-rose-500",
                            })
                          }
                          disabled={deactivateMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:border-rose-200 hover:text-rose-600 dark:hover:text-rose-400 text-muted-foreground text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                          title="Deactivate Workspace"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />{" "}
                          Deactivate
                        </button>
                      </>
                    )}
                    {ws.status !== "REJECTED" && ws.status !== "ACTIVE" && (
                      <button
                        onClick={() => rejectMutation.mutate(ws.id)}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:border-rose-200 hover:text-rose-600 text-muted-foreground text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                        title="Reject Workspace"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" /> Reject
                      </button>
                    )}
                    {owner && (
                      <>
                        <button
                          onClick={() => {
                            if (owner.user.isActive) {
                              setConfirmAction({
                                type: "ban",
                                targetId: owner.user.id,
                                title: "Ban User?",
                                desc: `Are you sure you want to ban ${owner.user.email || "this user"}? They will be completely locked out of the platform across all workspaces.`,
                                buttonText: "Ban User",
                                bgClass:
                                  "bg-rose-500 hover:bg-rose-600 text-white shadow-sm border border-rose-500",
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
                            "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer shadow-sm",
                            owner.user.isActive
                              ? "bg-card border-border hover:border-rose-200 text-rose-600 dark:text-rose-400"
                              : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40",
                          )}
                          title={
                            owner.user.isActive
                              ? "Ban this user"
                              : "Unban this user"
                          }
                        >
                          {owner.user.isActive ? (
                            <Ban className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
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
            <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 bg-blue-500/10 text-blue-500 rounded-2xl">
                <Building2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {searchTerm || statusFilter || planFilter
                    ? "No Matching Workspaces Found"
                    : "No Workspaces Registered"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm || statusFilter || planFilter
                    ? "There are currently no landlord workspaces matching your active search query or filter settings."
                    : "No property workspaces or portfolios have been registered on the platform yet."}
                </p>
              </div>
              {(searchTerm || statusFilter || planFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("");
                    setPlanFilter("");
                    setPage(1);
                  }}
                  className="mt-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer border border-border/60"
                >
                  Reset Active Filters
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Plan Management Modal */}
      {upgradePlanWorkspace && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Manage Workspace Plan
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update subscription parameters for{" "}
                <strong className="text-foreground">
                  {upgradePlanWorkspace.name}
                </strong>
                .
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Tier
                </label>
                <select
                  value={selectedPlan}
                  onChange={(e) =>
                    setSelectedPlan(
                      e.target.value as "FREE" | "PRO" | "ENTERPRISE",
                    )
                  }
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-card font-semibold text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer shadow-sm"
                >
                  <option value="FREE">Free Tier</option>
                  <option value="PRO">Pro Tier</option>
                  <option value="ENTERPRISE">Enterprise Tier</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Subscription Validity
                </label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-card font-semibold text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer shadow-sm"
                >
                  <option value={1}>1 Month Extension</option>
                  <option value={3}>3 Months Extension</option>
                  <option value={6}>6 Months Extension</option>
                  <option value={12}>12 Months (Recommended)</option>
                  <option value={24}>24 Months Extension</option>
                  <option value={36}>36 Months Extension</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
              <button
                onClick={() => setUpgradePlanWorkspace(null)}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  approveMutation.mutate({
                    id: upgradePlanWorkspace.id,
                    plan: selectedPlan,
                    durationMonths: selectedDuration,
                  })
                }
                disabled={approveMutation.isPending}
                className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
              >
                {approveMutation.isPending
                  ? "Saving changes..."
                  : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Action Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-foreground">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-500" />
              <h3 className="text-lg font-bold">{confirmAction.title}</h3>
            </div>

            <p className="text-muted-foreground text-xs mb-6 leading-relaxed">
              {confirmAction.desc}
            </p>

            <div className="flex items-center justify-end gap-3 text-xs">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
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
                  setConfirmAction(null);
                }}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold uppercase transition-colors tracking-wide border cursor-pointer",
                  confirmAction.bgClass,
                )}
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
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

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
    error:
      "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/40",
    warn: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/40",
    info: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60",
  };

  const handleCopyMessage = (message: string) => {
    navigator.clipboard.writeText(message);
    toast.success("Error logs detail copied to clipboard");
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
          className="px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
        >
          <option value="">All Severity Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {errors.map((err) => {
            const isExpanded = expandedLogId === err.id;
            return (
              <div
                key={err.id}
                className="rounded-2xl border border-border/85 bg-card p-5 flex flex-col gap-3.5 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                        levelColors[err.level] ||
                          "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 border-zinc-200/80",
                      )}
                    >
                      {err.level}
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Source: {err.source}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {new Date(err.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Collapsible Error Panel */}
                <div className="relative">
                  <div
                    className={cn(
                      "p-4 bg-muted/65 dark:bg-zinc-950/50 border border-border/50 rounded-xl text-xs font-mono text-foreground break-all leading-relaxed whitespace-pre-wrap transition-all duration-300 overflow-hidden",
                      !isExpanded && "max-h-20 mask-bottom",
                    )}
                  >
                    {err.message}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3.5 mt-3 pt-2">
                    <button
                      onClick={() =>
                        setExpandedLogId(isExpanded ? null : err.id)
                      }
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {isExpanded ? "Hide Details" : "Show Details"}
                    </button>
                    <button
                      onClick={() => handleCopyMessage(err.message)}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Log
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {errors.length === 0 && (
            <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {level ? `No ${level.toUpperCase()} Log Entries` : "All Systems Operational"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {level
                    ? `There are currently no platform log occurrences matching the "${level}" severity filter.`
                    : "No unhandled server errors or performance bottlenecks have been recorded recently."}
                </p>
              </div>
              {level && (
                <button
                  onClick={() => setLevel("")}
                  className="mt-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer border border-border/60"
                >
                  Clear Severity Filter
                </button>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
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
          className="px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
        >
          <option value="">All Statuses</option>
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
      ) : payments.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-2xl">
            <CreditCard className="w-10 h-10" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {status ? `No ${status.replace(/_/g, " ")} Payments` : "No Payment Records Found"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {status
                ? `There are currently no platform payments matching the "${status.replace(/_/g, " ")}" status filter.`
                : "No financial transactions, dues, or tenant payments have been recorded across platform workspaces."}
            </p>
          </div>
          {status && (
            <button
              onClick={() => setStatus("")}
              className="mt-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer border border-border/60"
            >
              Clear Status Filter
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tenant
                  </th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Property
                  </th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Workspace
                  </th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/10 transition-colors"
                  >
                    <td className="py-3.5 px-6">
                      <p className="font-bold text-foreground">
                        {p.lease.tenant.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.lease.tenant.email || "No email address"}
                      </p>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      {p.lease.property.name}
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground">
                      {p.workspace?.name || "—"}
                    </td>
                    <td className="py-3.5 px-6 font-extrabold text-foreground">
                      <span className="font-sans font-semibold text-xs text-muted-foreground mr-0.5">
                        ₦
                      </span>
                      {p.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground text-xs font-semibold">
                      {new Date(p.dueDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 p-4 border-t border-border/50">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
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
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-3 animate-in fade-in duration-300">
      <img
        src="/images/assets/logo-loading.webp"
        alt="Loading PropertyStack..."
        className="w-12 h-12 object-contain"
      />
      <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase animate-pulse">
        Fetching System Console...
      </span>
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

      const { error } = await supabase.auth.mfa.verify({
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border",
              isEnrolled
                ? "bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400"
                : "bg-muted text-muted-foreground border-border/40",
            )}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Two-Factor Auth (2FA)
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              Secure privilege level key protection.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 text-rose-700 dark:text-rose-400 font-bold text-[11px] uppercase">
            Security Warning: {error}
          </div>
        )}

        {isEnrolled ? (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                  MFA PROTECTION COMPLIANT
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Your platform session is secured with device clock sync.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Active Factors
              </h4>
              {totpFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-bold text-foreground text-xs">
                        Authenticator App
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Added:{" "}
                        {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnenroll(factor.id)}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-500 hover:text-white border border-rose-200/40 dark:border-rose-900/30 transition-all cursor-pointer"
                  >
                    Disable 2FA
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : factorId && qrCode ? (
          <div className="space-y-5 animate-in fade-in">
            <div className="p-4 rounded-xl bg-muted/50 border border-border text-foreground">
              <p className="font-bold text-primary text-xs mb-1">
                Step 1: Scan authentication code
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Scan this QR code using Google Authenticator, Authy, or standard
                system camera parameters to sync.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-muted/20 rounded-xl border border-border/60">
              <div className="bg-white p-3 rounded-2xl mb-4 border border-border/80 shadow-sm">
                <img
                  src={qrCode}
                  alt="MFA QR Sync Code"
                  width={170}
                  height={170}
                />
              </div>

              <div className="text-center w-full max-w-sm">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Secret key parameter:
                </p>
                <div className="flex items-center justify-center gap-2 p-2 bg-card border border-border rounded-xl shadow-sm">
                  <code className="text-xs font-mono font-bold tracking-wider text-primary">
                    {secret}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(secret || "");
                      toast.success("Secret key copied to clipboard");
                    }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/50 border border-border text-foreground">
              <p className="font-bold text-primary text-xs mb-1">
                Step 2: Enter synchronization pin
              </p>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                Provide the temporary 6-digit passcode.
              </p>
              <form onSubmit={handleVerify} className="flex gap-3">
                <input
                  type="text"
                  placeholder="000 000"
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-lg tracking-[0.3em] font-mono text-center text-foreground focus:outline-none focus:border-primary"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || verifyCode.length !== 6}
                  className="px-5 h-10 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase border border-primary disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Verify Key
                </button>
              </form>
            </div>

            <button
              onClick={() => {
                setFactorId(null);
                setQrCode(null);
              }}
              className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-border rounded-xl bg-card shadow-sm"
            >
              Cancel enrollment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Two-factor authentication is currently{" "}
              <strong className="text-rose-500 font-bold">disabled</strong>.
              Super administrator operators are required to protect their
              dashboard sessions with MFA constraints.
            </p>
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              Enable Authenticator App
            </button>
          </div>
        )}
      </div>

      {/* Disable 2FA Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold">Disable Session Protection?</h3>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Are you absolutely sure you want to disable Two-Factor
              Authentication? Disabling this fallback drops credential check
              down to simple static passwords, lowering overall system
              protection.
            </p>

            <div className="flex items-center justify-end gap-3 text-xs pt-2">
              <button
                onClick={() => setShowDisableConfirm(null)}
                disabled={loading}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnenroll}
                disabled={loading}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold uppercase transition-colors border border-rose-500 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Disabling..." : "Confirm disable"}
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
  const [selectedRequest, setSelectedRequest] =
    React.useState<UpgradeRequestAudit | null>(null);
  const [actionType, setActionType] = React.useState<
    "approve" | "reject" | null
  >(null);
  const [durationMonths, setDurationMonths] = React.useState<number>(12);
  const [rejectionReason, setRejectionReason] = React.useState<string>("");
  const [previewProofUrl, setPreviewProofUrl] = React.useState<string | null>(
    null,
  );

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
    mutationFn: async ({
      id,
      durationMonths,
    }: {
      id: string;
      durationMonths: number;
    }) => {
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
      queryClient.invalidateQueries({
        queryKey: ["super-admin-upgrade-requests"],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["super-admin-upgrade-requests"],
      });
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

  const handleOpenAction = (
    req: UpgradeRequestAudit,
    type: "approve" | "reject",
  ) => {
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
      <div className="flex justify-between items-center bg-muted/30 p-3 rounded-2xl border border-border/50">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "PENDING", label: "Pending Tickets" },
            { key: "APPROVED", label: "Approved Tickets" },
            { key: "REJECTED", label: "Declined Tickets" },
            { key: "", label: "All Tickets" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setStatusFilter(item.key);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                statusFilter === item.key
                  ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border/80">
              <AlertTriangle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-foreground">
                No Requests Found
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                There are no manually submitted subscription upgrade logs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-card rounded-2xl border border-border shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                    <th className="p-4.5 px-6">Workspace</th>
                    <th className="p-4.5 px-6">Requested By</th>
                    <th className="p-4.5 px-6">Requested Tier</th>
                    <th className="p-4.5 px-6">Payment Receipt</th>
                    <th className="p-4.5 px-6">Date Submitted</th>
                    <th className="p-4.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-muted/10 transition-colors"
                    >
                      <td className="p-4.5 px-6">
                        <div className="font-bold text-foreground">
                          {req.workspace?.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Current Tier: {req.workspace?.plan}
                        </div>
                      </td>
                      <td className="p-4.5 px-6">
                        <div className="font-bold text-foreground">
                          {req.user?.name || "Unnamed Landlord"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {req.user?.email}
                        </div>
                      </td>
                      <td className="p-4.5 px-6">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-primary/20 text-primary bg-primary/5 dark:bg-primary/25">
                          {req.requestedPlan}
                        </span>
                      </td>
                      <td className="p-4.5 px-6">
                        <button
                          onClick={() => setPreviewProofUrl(req.proofUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted text-foreground rounded-xl border border-border transition-colors font-bold text-xs shadow-sm cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                          View Receipt
                        </button>
                      </td>
                      <td className="p-4.5 px-6 text-muted-foreground font-semibold text-xs">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4.5 px-6 text-right">
                        {req.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenAction(req, "approve")}
                              className="px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenAction(req, "reject")}
                              className="px-3.5 py-1.5 bg-card border border-border hover:border-rose-200 hover:text-rose-600 text-muted-foreground rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end items-center gap-1.5">
                            <StatusBadge status={req.status} />
                            {req.status === "REJECTED" &&
                              req.rejectionReason && (
                                <div className="group relative">
                                  <Info className="w-4 h-4 text-rose-500 cursor-pointer ml-1" />
                                  <div className="absolute right-0 bottom-full mb-2.5 hidden group-hover:block w-52 bg-zinc-900 text-white dark:bg-card dark:text-foreground text-xs p-3 rounded-xl shadow-xl border border-zinc-800 dark:border-border z-[100] text-left leading-relaxed font-semibold">
                                    Declined reason: {req.rejectionReason}
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
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Proof Preview Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 px-6 border-b border-border flex justify-between items-center bg-muted/40">
              <h3 className="font-bold text-sm text-foreground">
                Transaction Receipt Preview
              </h3>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-3.5 py-1.5 bg-card hover:bg-muted text-foreground border border-border text-[11px] font-bold uppercase transition-colors rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
            <div className="flex-1 bg-muted/30 p-6 overflow-auto flex items-center justify-center min-h-[40vh] border-b border-border">
              {previewProofUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewProofUrl}
                  className="w-full h-[55vh] rounded-2xl border border-border bg-white"
                  title="PDF Transaction Proof"
                />
              ) : (
                <img
                  src={previewProofUrl}
                  alt="Payment Transaction Receipt"
                  className="max-h-[55vh] object-contain rounded-2xl border border-border shadow-sm"
                />
              )}
            </div>
            <div className="p-4 px-6 flex justify-end gap-3 bg-muted/40">
              <a
                href={previewProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                Open original file link
              </a>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Upgrade Modal */}
      {actionType === "approve" && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Approve Upgrade Request
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm target tier upgrade for{" "}
                <strong className="text-foreground">
                  {selectedRequest.workspace?.name}
                </strong>{" "}
                to{" "}
                <strong className="text-primary font-bold">
                  {selectedRequest.requestedPlan}
                </strong>
                .
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Plan Validity Duration
              </label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-card font-semibold text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer shadow-sm"
              >
                <option value={1}>1 Month Validity</option>
                <option value={3}>3 Months Validity</option>
                <option value={6}>6 Months Validity</option>
                <option value={12}>12 Months (Recommended)</option>
                <option value={24}>24 Months Validity</option>
                <option value={36}>36 Months Validity</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  approveMutation.mutate({
                    id: selectedRequest.id,
                    durationMonths,
                  })
                }
                disabled={approveMutation.isPending}
                className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
              >
                {approveMutation.isPending
                  ? "Confirming..."
                  : "Confirm Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Upgrade Modal */}
      {actionType === "reject" && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-rose-600">
                Decline Upgrade Request
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Decline the transaction upgrade ticket for{" "}
                <strong className="text-foreground">
                  {selectedRequest.workspace?.name}
                </strong>
                .
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Reason for decline
              </label>
              <textarea
                required
                placeholder="Specify logs: e.g. receipt signature mismatch, unpaid reference ledger..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-card font-medium text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({
                    id: selectedRequest.id,
                    reason: rejectionReason,
                  })
                }
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white border border-rose-500 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                {rejectMutation.isPending ? "Declining..." : "Decline Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================
// Users Tab
// ===========================
interface UserWorkspaceMember {
  id: string;
  role: string;
  workspace: {
    id: string;
    name: string;
    plan: string;
    status: string;
    subscriptionExpiresAt: string | null;
  };
}

interface UserAudit {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workspaces: UserWorkspaceMember[];
}

function UsersTab() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);

  const { data: profileDetails, isLoading: isProfileLoading } = useQuery({
    queryKey: ["super-admin-user-profile", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return null;
      const res = await apiFetch(
        `${API_BASE_URL}/api/super-admin/users/${selectedProfileId}/profile`,
      );
      return res as any;
    },
    enabled: !!selectedProfileId,
  });
  const [confirmAction, setConfirmAction] = React.useState<{
    type: "ban";
    targetId: string;
    title: string;
    desc: string;
    buttonText: string;
    bgClass: string;
  } | null>(null);

  const queryClient = useQueryClient();

  const [expandedManagerId, setExpandedManagerId] = React.useState<
    string | null
  >(null);
  const [expandedLandlords, setExpandedLandlords] = React.useState<
    Record<string, boolean>
  >({});
  const [expandedUserWorkspaces, setExpandedUserWorkspaces] = React.useState<
    Record<string, boolean>
  >({});

  interface TenantHierarchyInfo {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    propertyName: string;
  }

  interface LandlordHierarchyInfo {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
  }

  interface HierarchyItem {
    landlord: LandlordHierarchyInfo;
    propertiesCount: number;
    tenants: TenantHierarchyInfo[];
  }

  const { data: hierarchyData, isLoading: isHierarchyLoading } = useQuery({
    queryKey: ["super-admin-manager-hierarchy", expandedManagerId],
    queryFn: async () => {
      if (!expandedManagerId) return null;
      const res = await apiFetch(
        `${API_BASE_URL}/api/super-admin/users/${expandedManagerId}/hierarchy`,
      );
      return res as { hierarchy: HierarchyItem[] };
    },
    enabled: !!expandedManagerId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-users", page, searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (searchTerm) params.set("search", searchTerm);
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/users?${params.toString()}`,
      );
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
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
  });

  const users: UserAudit[] = data?.users || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {users.map((user) => {
            const initials = (user.name || user.email || "?")
              .split("@")[0]
              .slice(0, 2)
              .toUpperCase();
            const isExpanded = expandedUserWorkspaces[user.id] || false;
            const displayedWorkspaces = isExpanded
              ? user.workspaces
              : user.workspaces.slice(0, 2);
            const hasMore = user.workspaces.length > 2;

            return (
              <div
                key={user.id}
                className="rounded-2xl border border-border/85 bg-card p-6 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: User details & Workspaces */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm tracking-wide shrink-0 border border-primary/15">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name & Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className="text-base font-bold text-foreground truncate mr-2">
                            {user.name || "Unnamed User"}
                          </h4>
                          <StatusBadge
                            status={user.isActive ? "ACTIVE" : "INACTIVE"}
                          />
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight border bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60">
                            {user.role}
                          </span>
                        </div>

                        {/* Email & Date */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-semibold mb-2">
                          <span>{user.email}</span>
                          <span className="text-muted-foreground/30">•</span>
                          <span>
                            Registered:{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Workspaces Membership (Option A with overflow toggle) */}
                        {user.workspaces && user.workspaces.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
                            <span className="text-muted-foreground font-extrabold uppercase tracking-wider text-[9px] mr-1">
                              Workspaces:
                            </span>
                            {displayedWorkspaces.map((w) => (
                              <span
                                key={w.id}
                                className="bg-muted dark:bg-zinc-800/80 border border-border/40 text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-lg"
                              >
                                {w.workspace.name}{" "}
                                <span className="text-primary/75 text-[9px]">
                                  ({w.role})
                                </span>
                              </span>
                            ))}
                            {hasMore && (
                              <button
                                onClick={() =>
                                  setExpandedUserWorkspaces((prev) => ({
                                    ...prev,
                                    [user.id]: !isExpanded,
                                  }))
                                }
                                className="text-primary hover:text-primary/80 font-bold text-[10px] underline cursor-pointer"
                              >
                                {isExpanded
                                  ? "Show less"
                                  : `+${user.workspaces.length - 2} more`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/60 italic font-medium mt-3">
                            No active workspaces
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 lg:self-center">
                    {user.role !== "SUPER_ADMIN" && (
                      <>
                        <button
                          onClick={() => setSelectedProfileId(user.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                          title="View complete user profile details"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          Profile
                        </button>

                        <button
                          onClick={() =>
                            setExpandedManagerId(
                              expandedManagerId === user.id ? null : user.id,
                            )
                          }
                          className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                          title="View Landlords & Tenants under this manager"
                        >
                          <Network className="w-3.5 h-3.5 text-muted-foreground" />
                          Hierarchy
                          {expandedManagerId === user.id ? (
                            <ChevronUp className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (user.isActive) {
                              setConfirmAction({
                                type: "ban",
                                targetId: user.id,
                                title: "Ban User?",
                                desc: `Are you sure you want to ban ${user.email}? They will be completely locked out of the platform across all workspaces.`,
                                buttonText: "Ban User",
                                bgClass:
                                  "bg-rose-500 hover:bg-rose-600 text-white shadow-sm border border-rose-500",
                              });
                            } else {
                              toggleAccessMutation.mutate({
                                userId: user.id,
                                isActive: true,
                              });
                            }
                          }}
                          disabled={toggleAccessMutation.isPending}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer shadow-sm",
                            user.isActive
                              ? "bg-card border-border hover:border-rose-200 text-rose-600 dark:text-rose-400"
                              : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40",
                          )}
                          title={
                            user.isActive ? "Ban this user" : "Unban this user"
                          }
                        >
                          {user.isActive ? (
                            <Ban className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          {user.isActive ? "Ban" : "Unban"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Collapsible Workspace Hierarchy */}
                {expandedManagerId === user.id && (
                  <div className="mt-6 pt-6 border-t border-border/80 space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <Network className="w-4 h-4 text-primary/75" />
                      <span>Workspace Hierarchy</span>
                    </div>

                    {isHierarchyLoading ? (
                      <div className="flex items-center gap-2 py-6 justify-center text-xs text-muted-foreground font-bold">
                        <svg
                          className="animate-spin h-4 w-4 text-primary"
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
                        <span>Loading Workspace Hierarchy...</span>
                      </div>
                    ) : !hierarchyData ||
                      !hierarchyData.hierarchy ||
                      hierarchyData.hierarchy.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-border/60 rounded-2xl text-xs text-muted-foreground/80 font-bold bg-muted/20">
                        {
                          "No landlords or active tenants associated with this manager's workspace."
                        }
                      </div>
                    ) : (
                      <div className="relative pl-3 ml-2 border-l border-primary/20 space-y-4">
                        {hierarchyData.hierarchy.map((item) => {
                          const landlord = item.landlord;
                          const isLandlordExpanded =
                            !!expandedLandlords[landlord.id];
                          return (
                            <div key={landlord.id} className="relative pl-4">
                              {/* Hierarchy bullet connector */}
                              <div className="absolute left-[-16px] top-[18px] w-2.5 h-2.5 rounded-full bg-primary/35 border-2 border-card" />

                              {/* Landlord Card Header */}
                              <div
                                onClick={() =>
                                  setExpandedLandlords((prev) => ({
                                    ...prev,
                                    [landlord.id]: !isLandlordExpanded,
                                  }))
                                }
                                className="flex items-center justify-between p-4 rounded-2xl border border-border/75 bg-muted/30 hover:bg-muted/65 active:scale-[0.99] transition-all duration-200 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs tracking-wider border border-indigo-500/15 shrink-0">
                                    {landlord.name
                                      ? landlord.name.slice(0, 2).toUpperCase()
                                      : "LL"}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-foreground">
                                      Landlord: {landlord.name || "Unnamed"}
                                    </h5>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                                      {landlord.email} • {item.propertiesCount}{" "}
                                      properties owned
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProfileId(landlord.id);
                                    }}
                                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer mr-1"
                                    title="View Landlord Profile"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 tracking-tight">
                                    {item.tenants.length} tenants
                                  </span>
                                  {isLandlordExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>

                              {/* Nested Tenants Accordion */}
                              {isLandlordExpanded && (
                                <div className="mt-3 ml-4 pl-4 border-l border-border/70 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-250">
                                  {item.tenants.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground/60 italic font-bold py-2">
                                      {
                                        "No active tenants leased in this landlord's properties."
                                      }
                                    </p>
                                  ) : (
                                    item.tenants.map((t) => (
                                      <div
                                        key={t.id}
                                        className="flex items-center justify-between p-3.5 bg-card border border-border/60 hover:border-border rounded-xl transition-all shadow-sm"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-foreground">
                                              {t.name}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground font-bold ml-3.5">
                                            {t.email ? `${t.email} • ` : ""}
                                            {t.phone || "No phone number"}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-black border border-zinc-200/50 dark:border-zinc-700/40">
                                            {t.propertyName}
                                          </span>
                                          <button
                                            onClick={() => setSelectedProfileId(t.id)}
                                            className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                            title="View Tenant Profile Details"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {users.length === 0 && (
            <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 bg-blue-500/10 text-blue-500 rounded-2xl">
                <Users className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {searchTerm ? "No Matching Users Found" : "No Registered Users"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm
                    ? `There are currently no registered users matching the search query "${searchTerm}".`
                    : "No users, managers, tenants, or landlords have registered on the platform yet."}
                </p>
              </div>
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setPage(1);
                  }}
                  className="mt-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer border border-border/60"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-card border border-border disabled:opacity-30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-foreground">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-500" />
              <h3 className="text-lg font-bold">{confirmAction.title}</h3>
            </div>

            <p className="text-muted-foreground text-xs mb-6 leading-relaxed">
              {confirmAction.desc}
            </p>

            <div className="flex items-center justify-end gap-3 text-xs">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmAction.type === "ban") {
                    toggleAccessMutation.mutate({
                      userId: confirmAction.targetId,
                      isActive: false,
                    });
                  }
                  setConfirmAction(null);
                }}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold uppercase transition-colors tracking-wide border cursor-pointer",
                  confirmAction.bgClass,
                )}
              >
                {confirmAction.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Details Modal */}
      {selectedProfileId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-2xl w-full animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <h3 className="text-lg font-bold text-foreground">User Profile Details</h3>
              <button
                onClick={() => setSelectedProfileId(null)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin">
              {isProfileLoading ? (
                <div className="flex items-center gap-2 py-12 justify-center text-xs text-muted-foreground font-bold">
                  <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading Profile...</span>
                </div>
              ) : !profileDetails ? (
                <p className="text-center text-muted-foreground text-xs py-8">Failed to load profile details.</p>
              ) : (
                <>
                  {/* Basic Stats Block */}
                  <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Name</p>
                      <p className="text-sm font-bold text-foreground">{profileDetails.user.name || "Unnamed"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email</p>
                      <p className="text-sm font-bold text-foreground">{profileDetails.user.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</p>
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60 mt-1">
                        {profileDetails.user.role}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Registered At</p>
                      <p className="text-xs font-semibold text-muted-foreground">{new Date(profileDetails.user.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Workspaces Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Workspaces ({profileDetails.workspaces.length})</h4>
                    {profileDetails.workspaces.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No workspaces linked.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {profileDetails.workspaces.map((w: any) => (
                          <div key={w.workspaceId} className="p-3 bg-muted/30 border border-border/50 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-foreground">{w.name}</p>
                              <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">Role: {w.role}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-primary/10 text-primary border border-primary/15">{w.plan}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Properties Owned Section (For Landlords / Managers) */}
                  {profileDetails.propertiesOwned.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Properties Owned ({profileDetails.propertiesOwned.length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {profileDetails.propertiesOwned.map((p: any) => (
                          <div key={p.id} className="p-3 bg-muted/30 border border-border/50 rounded-xl">
                            <p className="text-xs font-bold text-foreground">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{p.address}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tenant Details (Leases, Payments, Maintenance) */}
                  {profileDetails.tenantDetails && (
                    <div className="space-y-6 pt-4 border-t border-border">
                      <h4 className="text-sm font-bold text-foreground">Tenant Leases & Records</h4>
                      
                      {/* Leases & Invoices */}
                      {profileDetails.tenantDetails.leases.map((lease: any) => (
                        <div key={lease.id} className="p-4 border border-border/80 bg-muted/10 rounded-2xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-foreground">{lease.property} — Unit {lease.unit}</p>
                              <p className="text-[10px] text-muted-foreground font-semibold">
                                {new Date(lease.startDate).toLocaleDateString()} to {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : "Present"}
                              </p>
                            </div>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                              lease.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200/50" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                            )}>
                              Lease: {lease.status}
                            </span>
                          </div>

                          {/* Payments List */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Invoices / Rent Payments</p>
                            {lease.payments.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground italic">No invoice records found for this lease.</p>
                            ) : (
                              <div className="border border-border/60 rounded-xl overflow-hidden text-xs">
                                <div className="grid grid-cols-3 bg-muted/40 p-2.5 font-bold border-b border-border/60 text-muted-foreground text-[10px] uppercase">
                                  <span>Due Date</span>
                                  <span>Amount</span>
                                  <span>Status</span>
                                </div>
                                <div className="divide-y divide-border/60 max-h-[150px] overflow-y-auto">
                                  {lease.payments.map((pay: any) => (
                                    <div key={pay.id} className="grid grid-cols-3 p-2.5 font-semibold text-foreground items-center">
                                      <span>{new Date(pay.dueDate).toLocaleDateString()}</span>
                                      <span>₦{pay.amount.toLocaleString()}</span>
                                      <span className={cn(
                                        "text-[9px] font-bold max-w-fit px-1.5 py-0.5 rounded",
                                        pay.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                                        pay.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                                        "bg-rose-100 text-rose-800"
                                      )}>
                                        {pay.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Maintenance Requests */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Maintenance Requests</p>
                        {profileDetails.tenantDetails.maintenanceRequests.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No maintenance requests submitted.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {profileDetails.tenantDetails.maintenanceRequests.map((req: any) => (
                              <div key={req.id} className="p-3 border border-border/60 rounded-xl bg-card flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold text-foreground">{req.title || "Untitled Issue"}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{req.description}</p>
                                  <p className="text-[9px] text-muted-foreground/60 font-semibold mt-1">Submitted: {new Date(req.createdAt).toLocaleDateString()}</p>
                                </div>
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                  req.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                )}>
                                  {req.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setSelectedProfileId(null)}
                className="px-5 py-2 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LegalLeaseRequestAudit {
  id: string;
  workspaceId: string;
  tenantId: string | null;
  leaseId: string;
  tenantName: string;
  tenantAddress: string;
  landlordName: string;
  landlordAddress: string;
  feeAmount: number;
  proofUrl: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name: string };
  tenant?: { id: string; name: string; email: string | null } | null;
  lease: {
    id: string;
    startDate: string;
    endDate: string | null;
    yearlyRent: number;
  };
}

function LegalLeaseRequestsTab() {
  const [selectedRequest, setSelectedRequest] =
    React.useState<LegalLeaseRequestAudit | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = React.useState<string | null>(
    null,
  );
  const [actionType, setActionType] = React.useState<
    "verify" | "reject" | null
  >(null);
  const [rejectionReason, setRejectionReason] = React.useState<string>("");

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ requests: LegalLeaseRequestAudit[] }>({
    queryKey: ["super-admin-legal-lease-requests"],
    queryFn: () => {
      return apiFetch(`${API_BASE_URL}/api/super-admin/legal-lease-requests`);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: "VERIFIED" | "REJECTED";
      reason?: string;
    }) => {
      return apiFetch(
        `${API_BASE_URL}/api/super-admin/legal-lease-requests/${id}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ status, reason }),
        },
      );
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "VERIFIED"
          ? "Legal lease request verified and activated!"
          : "Legal lease request rejected.",
      );
      queryClient.invalidateQueries({
        queryKey: ["super-admin-legal-lease-requests"],
      });
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason("");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Action failed");
    },
  });

  const requests = data?.requests || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-xs text-muted-foreground">
          Loading request registry...
        </p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
        <div className="p-3.5 bg-blue-500/10 text-blue-500 rounded-2xl">
          <FileText className="w-10 h-10" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">
            No Legal Lease Requests
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            There are currently no legal lease drafting or verification requests submitted by property managers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Requests Registry Table */}
      <div className="border border-border/80 rounded-3xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground">
                  Submitted
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground">
                  Workspace
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground">
                  Landlord
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground">
                  Tenant
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Fee
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-muted-foreground text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-muted/10 transition-colors"
                  >
                    <td className="p-4 text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-foreground">
                        {req.workspace?.name}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="font-bold">{req.landlordName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {req.landlordAddress}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="font-bold">{req.tenantName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {req.tenantAddress}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-right">
                      ₦
                      {req.feeAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold",
                            req.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                              : req.status === "VERIFIED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
                          )}
                        >
                          {req.status}
                        </span>
                        {req.status === "REJECTED" && req.rejectionReason && (
                          <div className="group relative">
                            <Info className="w-3.5 h-3.5 text-rose-500 cursor-pointer" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-zinc-900 text-white dark:bg-card dark:text-foreground text-[10px] p-2.5 rounded-xl shadow-xl border border-zinc-800 dark:border-border z-[100] text-left leading-relaxed font-semibold">
                              Reason: {req.rejectionReason}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPreviewProofUrl(req.proofUrl)}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="View Payment Proof"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {req.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setActionType("verify");
                              }}
                              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Verify Payment"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setActionType("reject");
                              }}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Reject Request"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Lightbox Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full max-h-[85vh] overflow-hidden bg-card border border-border rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setPreviewProofUrl(null)}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </button>
            <h3 className="text-sm font-bold mb-4 uppercase tracking-wider">
              Proof of Payment
            </h3>
            <div className="w-full h-[60vh] flex items-center justify-center bg-muted/20 border border-border/60 rounded-2xl overflow-auto">
              <img
                src={previewProofUrl}
                alt="Proof of payment document"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Verification / Action Modal */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-foreground">
              <AlertTriangle
                className={cn(
                  "w-6 h-6 flex-shrink-0",
                  actionType === "verify"
                    ? "text-emerald-500"
                    : "text-rose-500",
                )}
              />
              <h3 className="text-lg font-bold">
                {actionType === "verify"
                  ? "Verify Payment Proof"
                  : "Reject Legal Request"}
              </h3>
            </div>

            <p className="text-muted-foreground text-xs mb-6 leading-relaxed">
              {actionType === "verify"
                ? `Are you sure you want to verify the drafting fee payment of ₦${selectedRequest.feeAmount.toLocaleString()} for tenant "${selectedRequest.tenantName}"? This will activate the lease in PENDING_SIGNATURE status.`
                : `Are you sure you want to reject this request for tenant "${selectedRequest.tenantName}"? The lease status will be marked as REJECTED.`}
            </p>

            {actionType === "reject" && (
              <div className="space-y-1.5 mb-6">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Reason for rejection
                </label>
                <textarea
                  required
                  placeholder="Specify reason: e.g., proof of payment transaction ID is invalid, receipt is blurry..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-card font-medium text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 text-xs">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2.5 border border-border hover:bg-muted text-foreground rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={
                  verifyMutation.isPending ||
                  (actionType === "reject" && !rejectionReason.trim())
                }
                onClick={() =>
                  verifyMutation.mutate({
                    id: selectedRequest.id,
                    status: actionType === "verify" ? "VERIFIED" : "REJECTED",
                    reason:
                      actionType === "reject"
                        ? rejectionReason.trim()
                        : undefined,
                  })
                }
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold uppercase transition-colors tracking-wide border cursor-pointer",
                  actionType === "verify"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-lg shadow-emerald-550/20"
                    : "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-lg shadow-rose-550/20",
                )}
              >
                {actionType === "verify"
                  ? "Confirm & Verify"
                  : verifyMutation.isPending
                    ? "Rejecting..."
                    : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
