'use client';

import * as React from 'react';
import { 
  Building2, 
  Users, 
  Wallet, 
  Wrench, 
  TrendingUp, 
  ArrowUpRight 
} from 'lucide-react';
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
          <div key={i} className="h-32 rounded-[2rem] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
        ))}
      </div>
    );
  }

  if (!stats?.stats) return null;

  const { totalProperties, totalTenants, rentCollected, pendingMaintenance } = stats.stats;

  const statCards = [
    {
      title: 'Total Properties',
      value: totalProperties,
      icon: Building2,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      trend: '+2 new'
    },
    {
      title: 'Total Tenants',
      value: totalTenants,
      icon: Users,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      trend: 'Active'
    },
    {
      title: 'Rent Collected',
      value: `₦${rentCollected.toLocaleString()}`,
      icon: Wallet,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      trend: '+12% m/m'
    },
    {
      title: 'Pending Fixes',
      value: pendingMaintenance,
      icon: Wrench,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      trend: 'Urgent',
      urgent: pendingMaintenance > 0
    }
  ];

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, i) => (
          <div 
            key={i} 
            className="group relative rounded-[2rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-5 sm:p-6 shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl overflow-hidden"
          >
            <div className={`absolute -inset-px rounded-[2rem] bg-gradient-to-br from-white/20 to-transparent dark:from-zinc-800/10 opacity-0 group-hover:opacity-100 transition-opacity`} />
            
            <div className="relative flex justify-between items-start gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 truncate">{card.title}</p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl sm:text-4xl font-bold tracking-tighter truncate">{card.value}</h4>
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex whitespace-nowrap ${card.urgent ? 'bg-red-500/10 text-red-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                  <TrendingUp className="w-2.5 h-2.5" />
                  {card.trend}
                </div>
              </div>
              <div className={`rounded-2xl p-3 ${card.bg} ${card.color} shadow-inner shrink-0`}>
                <card.icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ArrowUpRight className="w-24 h-24 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="relative">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Revenue Overview</h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Financial performance (Last 6 Months)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Income</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <RevenueChart data={stats.chartData} />
          </div>
        </div>
      </div>
    </div>
  );
}
