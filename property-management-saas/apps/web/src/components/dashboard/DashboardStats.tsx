"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Wallet,
  Wrench,
  ShieldCheck,
  AlertCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { RevenueChart } from "./RevenueChart";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DashboardStatsProps {
  workspaceId: string;
  userName?: string;
  plan?: string;
}

interface StatsData {
  stats: {
    totalProperties: number;
    totalTenants: number;
    rentCollected: number;
    pendingMaintenance: number;
    overduePaymentsCount?: number;
    expiringLeasesCount?: number;
  };
  chartData: { name: string; revenue: number }[];
}

export function DashboardStats({
  workspaceId,
  userName,
  plan,
}: DashboardStatsProps) {
  const queryClient = useQueryClient();
  const { socket, joinWorkspace } = useRealtime();

  const isPro = plan === "PRO" || plan === "ENTERPRISE";

  const { data: stats, isLoading: loading } = useQuery<StatsData>({
    queryKey: ["dashboard-stats", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/stats`,
        {
          credentials: "include",
        },
      );
      return data as StatsData;
    },
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (workspaceId) {
      joinWorkspace(workspaceId);
    }
  }, [workspaceId, joinWorkspace]);

  // Real-time listener
  React.useEffect(() => {
    if (socket && workspaceId) {
      const handleUpdate = () => {
        console.log("[Realtime] Stats update triggered");
        queryClient.invalidateQueries({
          queryKey: ["dashboard-stats", workspaceId],
        });
      };

      socket.on("PAYMENT_UPDATED", handleUpdate);
      socket.on("PAYMENT_SUBMITTED", handleUpdate);
      socket.on("MAINTENANCE_CREATED", handleUpdate);
      socket.on("PROPERTY_CREATED", handleUpdate);
      socket.on("PROPERTY_DELETED", handleUpdate);
      socket.on("TENANT_CREATED", handleUpdate);
      socket.on("TENANT_DELETED", handleUpdate);
      socket.on("LEASE_UPDATED", handleUpdate);
      socket.on("LEASE_RENEWED", handleUpdate);
      socket.on("LEASE_RENEWAL_REJECTED", handleUpdate);

      return () => {
        socket.off("PAYMENT_UPDATED", handleUpdate);
        socket.off("PAYMENT_SUBMITTED", handleUpdate);
        socket.off("MAINTENANCE_CREATED", handleUpdate);
        socket.off("PROPERTY_CREATED", handleUpdate);
        socket.off("PROPERTY_DELETED", handleUpdate);
        socket.off("TENANT_CREATED", handleUpdate);
        socket.off("TENANT_DELETED", handleUpdate);
        socket.off("LEASE_UPDATED", handleUpdate);
        socket.off("LEASE_RENEWED", handleUpdate);
        socket.off("LEASE_RENEWAL_REJECTED", handleUpdate);
      };
    }
  }, [socket, workspaceId, queryClient]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-[2rem] bg-secondary dark:bg-card border border-border"
          />
        ))}
      </div>
    );
  }

  if (!stats?.stats) return null;

  const { totalProperties, totalTenants, rentCollected, pendingMaintenance } =
    stats.stats;

  const statCards = [
    {
      title: "Total Properties",
      value: totalProperties,
      icon: Building2,
      color: "text-primary",
      bg: "bg-blue-500/10",
      trend: "+2 new",
    },
    {
      title: "Total Tenants",
      value: totalTenants,
      icon: Users,
      color: "text-teal-500",
      bg: "bg-teal-500/10",
      trend: "Active",
    },
    {
      title: "Rent Collected",
      value:
        rentCollected === 0 ? "₦0.00" : `₦${rentCollected.toLocaleString()}`,
      icon: Wallet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      trend: "+12% m/m",
    },
    {
      title: "Pending Fixes",
      value: pendingMaintenance,
      icon: Wrench,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      trend: "Urgent",
      urgent: pendingMaintenance > 0,
    },
    {
      title: "Overdue Payments",
      value: stats.stats.overduePaymentsCount || 0,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      trend: "Action needed",
      urgent: (stats.stats.overduePaymentsCount || 0) > 0,
    },
    {
      title: "Expiring Leases",
      value: stats.stats.expiringLeasesCount || 0,
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      trend: "Next 30 days",
      urgent: (stats.stats.expiringLeasesCount || 0) > 0,
    },
  ];

  const top4Cards = statCards.slice(0, 4);
  const secondaryCards = statCards.slice(4);

  return (
    <div
      className="flex flex-col w-full space-y-6"
      aria-label="Dashboard Stats Form"
    >
      {/* Hero Banner (Contains Cards) */}
      <div className="relative rounded-3xl overflow-hidden shadow-sm">
        {/* Realistic houses background image */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2075&q=80')] bg-cover bg-center" />

        {/* Subtle overlay to ensure white text readability without making it too dark */}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 via-slate-900/20 to-transparent" />

        {/* Content Container */}
        <div className="relative z-10 p-6 sm:p-8">
          {/* Top Row: Welcome Text & Date Picker */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
            <div>
              <h2 className="text-[32px] font-bold text-white mb-1 tracking-tight">
                Welcome back, {userName}!
              </h2>
              <p className="text-white/90 text-[15px] font-medium">
                Here&apos;s your property summary for today.
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900/90 dark:backdrop-blur-md text-slate-700 dark:text-zinc-200 px-4 py-2.5 rounded-lg text-[13px] font-semibold flex items-center shadow-sm border border-white/20 dark:border-zinc-700/50">
              <Calendar className="w-4 h-4 mr-2 text-slate-500 dark:text-zinc-400" />
              01 Nov 2025 - 31 Dec 2026
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {top4Cards.map((card, i) => {
              // Exact trend color logic
              const isNeutral =
                card.trend === "Active" || card.title.includes("Properties");
              const isNegative =
                card.urgent || card.trend.toLowerCase().includes("overdue");

              let trendColorClass = "text-[#10b981]"; // Emerald green for positive
              if (isNegative) trendColorClass = "text-red-500";
              else if (isNeutral)
                trendColorClass = "text-indigo-500 dark:text-indigo-400";

              // Clean up title (e.g. "Total Properties" instead of "TOTAL PROPERTIES")
              const cleanTitle = card.title
                .split(" ")
                .map(
                  (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
                )
                .join(" ");

              // Fallback trend subtext if trend doesn't have a space
              const trendParts = card.trend.split(" ");
              const trendValue = trendParts[0];
              const trendSubtext = trendParts.slice(1).join(" ") || "This Week";

              return (
                <div
                  key={i}
                  className="relative rounded-2xl bg-white dark:bg-zinc-900/80 dark:backdrop-blur-md p-6 shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col justify-between min-h-[150px] overflow-hidden border border-transparent dark:border-zinc-800"
                >
                  {/* Wavy background decoration mimicking reference */}
                  <div className="absolute right-0 top-0 bottom-0 w-2/3 overflow-hidden pointer-events-none rounded-r-2xl">
                    <div className="absolute right-[-20%] top-[10%] w-[120%] h-[150%] border-[16px] border-indigo-50/60 dark:border-indigo-500/10 rounded-[100%] transform -rotate-12 blur-[0.5px]" />
                    <div className="absolute right-[-45%] top-[-10%] w-[120%] h-[150%] border-[16px] border-teal-50/50 dark:border-teal-500/10 rounded-[100%] transform -rotate-12 blur-[0.5px]" />
                  </div>

                  <div className="relative z-10 flex flex-col h-full">
                    <p className="text-[15px] font-medium text-slate-800 dark:text-zinc-300 mb-1">
                      {cleanTitle}
                    </p>

                    <div className="flex items-center gap-1.5 mb-6">
                      <span
                        className={`text-[12px] font-bold ${trendColorClass}`}
                      >
                        {trendValue}
                      </span>
                      <span className="text-[12px] text-slate-400 dark:text-zinc-500 font-medium">
                        {trendSubtext}
                      </span>
                    </div>

                    <div className="flex items-end justify-between mt-auto">
                      <h4 className="text-[32px] leading-none font-bold text-[#0f172a] dark:text-white tracking-tight">
                        {card.value}
                      </h4>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Middle Section: Charts & Urgent Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
        {/* Revenue Updates */}
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
          <div className="flex justify-between items-center mb-8 relative z-10">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Revenue Updates
              </h3>
              <p className="text-xs font-semibold text-muted-foreground mt-1">
                Last 6 Months
              </p>
            </div>
            <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Monthly
            </div>
          </div>

          <div className="h-[280px] w-full relative z-10">
            {!isPro && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg animate-in zoom-in-95 duration-300">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">
                  Advanced Analytics
                </h4>
                <p className="text-muted-foreground text-center max-w-[280px] text-sm font-medium mb-6">
                  Upgrade to <span className="text-primary font-bold">PRO</span>{" "}
                  to unlock detailed charts.
                </p>
                <button
                  onClick={() => (window.location.href = "/#pricing")}
                  className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
            <div
              className={
                !isPro ? "opacity-20 grayscale pointer-events-none" : "h-full"
              }
            >
              <RevenueChart data={stats.chartData} />
            </div>
          </div>
        </div>

        {/* Secondary Widgets (Urgent Actions) */}
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-6">
            Action Needed
          </h3>
          <div className="space-y-4">
            {secondaryCards.map((card, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {card.title}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                      {card.trend}
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
