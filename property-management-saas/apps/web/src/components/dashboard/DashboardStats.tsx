'use client';

import * as React from 'react';
import { 
  Building2, 
  Users, 
  Wallet, 
  Wrench, 
  TrendingUp, 
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Clock
} from 'lucide-react';
import { RevenueChart } from './RevenueChart';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { useRealtime } from '@/components/providers/RealtimeProvider';

interface DashboardStatsProps {
  workspaceId: string;
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

export function DashboardStats({ workspaceId, plan }: DashboardStatsProps) {
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { socket, joinWorkspace } = useRealtime();

  const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

  const fetchStats = React.useCallback(() => {
    if (!workspaceId) return;
    apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/stats`, {
      credentials: 'include'
    })
      .then(data => {
        setStats(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  React.useEffect(() => {
    fetchStats();
    if (workspaceId) {
      joinWorkspace(workspaceId);
    }
  }, [workspaceId, fetchStats, joinWorkspace]);

  // Real-time listener
  React.useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        console.log('[Realtime] Stats update triggered');
        fetchStats();
      };

      socket.on('PAYMENT_UPDATED', handleUpdate);
      socket.on('PAYMENT_SUBMITTED', handleUpdate);
      socket.on('MAINTENANCE_CREATED', handleUpdate);
      socket.on('PROPERTY_CREATED', handleUpdate);
      socket.on('PROPERTY_DELETED', handleUpdate);
      socket.on('TENANT_CREATED', handleUpdate);
      socket.on('TENANT_DELETED', handleUpdate);
      socket.on('LEASE_UPDATED', handleUpdate);
      socket.on('LEASE_RENEWED', handleUpdate);
      socket.on('LEASE_RENEWAL_REJECTED', handleUpdate);

      return () => {
        socket.off('PAYMENT_UPDATED', handleUpdate);
        socket.off('PAYMENT_SUBMITTED', handleUpdate);
        socket.off('MAINTENANCE_CREATED', handleUpdate);
        socket.off('PROPERTY_CREATED', handleUpdate);
        socket.off('PROPERTY_DELETED', handleUpdate);
        socket.off('TENANT_CREATED', handleUpdate);
        socket.off('TENANT_DELETED', handleUpdate);
        socket.off('LEASE_UPDATED', handleUpdate);
        socket.off('LEASE_RENEWED', handleUpdate);
        socket.off('LEASE_RENEWAL_REJECTED', handleUpdate);
      };
    }
  }, [socket, fetchStats]);

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
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
      trend: 'Active'
    },
    {
      title: 'Rent Collected',
      value: rentCollected === 0 ? '₦0.00' : `₦${rentCollected.toLocaleString()}`,
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
    },
    {
      title: 'Overdue Payments',
      value: stats.stats.overduePaymentsCount || 0,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      trend: 'Action needed',
      urgent: (stats.stats.overduePaymentsCount || 0) > 0
    },
    {
      title: 'Expiring Leases',
      value: stats.stats.expiringLeasesCount || 0,
      icon: Clock,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      trend: 'Next 30 days',
      urgent: (stats.stats.expiringLeasesCount || 0) > 0
    }
  ];

  return (
    <div className="space-y-10" aria-label="Dashboard Stats Form">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
                  <h4 className="text-3xl sm:text-4xl font-bold tracking-tighter truncate text-zinc-900 dark:text-white">{card.value}</h4>
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
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none -z-10">
          <ArrowUpRight className="w-24 h-24 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Revenue Overview</h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Financial performance (Last 6 Months)</p>
            </div>
            {isPro && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Income</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="h-[350px] w-full relative">
            {!isPro && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/10 dark:bg-zinc-900/10 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/30">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Advanced Analytics</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-[280px] text-sm font-medium mb-6">
                  Upgrade to <span className="text-indigo-600 dark:text-indigo-400 font-bold">PRO</span> to unlock detailed revenue charts and financial trends.
                </p>
                <button 
                  onClick={() => window.location.href = '/#pricing'}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
            <div className={!isPro ? 'opacity-20 grayscale pointer-events-none' : ''}>
              <RevenueChart data={stats.chartData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
