'use client';

import * as React from 'react';
import { RevenueChart } from './RevenueChart';
import { apiFetch, API_BASE_URL } from '@/lib/api';


interface DashboardStatsProps {
  workspaceId: string;
}

interface StatsData {
  stats: {
    totalProperties: number;
    totalTenants: number;
    rentCollected: number;
    pendingMaintenance: number;
  };
  chartData: { name: string; revenue: number }[];
}

export function DashboardStats({ workspaceId }: DashboardStatsProps) {
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!workspaceId) return;
    
    apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/stats`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setStats(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (!stats?.stats) return null;

  const { totalProperties, totalTenants, rentCollected, pendingMaintenance } = stats.stats;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Properties */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-sm text-zinc-500">Total Properties</h3>
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <p className="text-3xl font-bold mt-2">{totalProperties}</p>
        </div>

        {/* Total Tenants */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-sm text-zinc-500">Total Tenants</h3>
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mt-2">{totalTenants}</p>
        </div>

        {/* Rent Collected */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-sm text-zinc-500">Rent Collected</h3>
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mt-2">₦{rentCollected.toLocaleString()}</p>
        </div>

        {/* Pending Maintenance */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-sm text-zinc-500">Pending Fixes</h3>
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mt-2 text-amber-600 dark:text-amber-500">{pendingMaintenance}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-6">Revenue Overview (Last 6 Months)</h3>
        <div className="h-[300px] w-full">
          <RevenueChart data={stats.chartData} />
        </div>
      </div>
    </div>
  );
}
