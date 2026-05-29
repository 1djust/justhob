'use client';

import * as React from 'react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
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
  AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalProperties: number;
  totalUnits: number;
  totalTenants: number;
  totalRevenue: number;
}

export function AdminDashboard() {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [managers, setManagers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [cronLoading, setCronLoading] = React.useState(false);
  const [cronResults, setCronResults] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, managersData] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/admin/stats`),
          apiFetch(`${API_BASE_URL}/api/admin/managers`)
        ]);
        setStats(statsData.stats);
        setManagers(managersData.managers);
      } catch (e) {
        console.error('Failed to fetch admin data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredManagers = managers.filter(m => 
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const triggerCrons = async () => {
    setCronLoading(true);
    setCronResults(null);
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/admin/trigger-crons`, { method: 'POST' });
      setCronResults(data);
    } catch (e: any) {
      setCronResults({ success: false, message: e.message || 'Failed to trigger cron jobs' });
    } finally {
      setCronLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Properties', value: stats?.totalProperties || 0, icon: Building2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Tenants', value: stats?.totalTenants || 0, icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Total Revenue', value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-3xl" />
        <div className="relative mt-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Platform Admin</span>
          </div>
          <h2 className="text-5xl font-bold tracking-tighter sm:text-6xl text-zinc-900 dark:text-white">Platform Control</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mt-4 text-lg font-medium max-w-2xl leading-relaxed">
            Manage the entire JustHub ecosystem from one place.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div 
            key={i}
            className="p-6 rounded-[2rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02]"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-3xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight">{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* System Jobs Panel */}
      <div className="relative rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-8 shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">System Jobs</h3>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Lease Expiry & Payment Overdue Checker</p>
          </div>
          <button
            onClick={triggerCrons}
            disabled={cronLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 text-white text-sm font-bold shadow-lg hover:bg-rose-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {cronLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {cronLoading ? 'Running...' : 'Run System Jobs Now'}
          </button>
        </div>

        {cronResults && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              cronResults.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' 
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
            }`}>
              {cronResults.success 
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <AlertTriangle className="w-5 h-5 text-rose-600" />
              }
              <span className={`text-sm font-bold ${cronResults.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {cronResults.message}
              </span>
            </div>

            {cronResults.results?.leaseExpiry?.length > 0 && (
              <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                  <Timer className="w-4 h-4" /> Lease Expiry Notifications Sent
                </h4>
                {cronResults.results.leaseExpiry.map((item: any, i: number) => (
                  <div key={i} className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    • <span className="font-bold text-zinc-900 dark:text-zinc-200">{item.tenant}</span> @ {item.property} — {item.daysLeft} days left → Notified: {item.notified}
                  </div>
                ))}
              </div>
            )}

            {cronResults.results?.overdueChecker?.length > 0 && (
              <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/30">
                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Payment Alerts Triggered
                </h4>
                {cronResults.results.overdueChecker.map((item: any, i: number) => (
                  <div key={i} className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    • <span className="font-bold text-zinc-900 dark:text-zinc-200">{item.tenant}</span> — ₦{item.amount?.toLocaleString()} — Type: {item.type} {item.daysOverdue !== undefined ? `(${item.daysOverdue} days overdue)` : `(${item.daysUntilDue} days until due)`}
                  </div>
                ))}
              </div>
            )}

            {cronResults.results?.leaseExpirations?.length > 0 && (
              <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">Leases Marked as Expired</h4>
                <p className="text-sm text-zinc-500">{cronResults.results.leaseExpirations.length} lease(s) changed to EXPIRED status.</p>
              </div>
            )}

            {cronResults.results?.leaseExpiry?.length === 0 && cronResults.results?.overdueChecker?.length === 0 && cronResults.results?.leaseExpirations?.length === 0 && (
              <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-center">
                <p className="text-sm text-zinc-500 font-medium">No actions taken — all leases and payments are within normal ranges.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Managers Table */}
      <div className="relative rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-8 shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Property Managers</h3>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Global Manager List</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Manager</th>
                <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Email</th>
                <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Workspaces</th>
                <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredManagers.map((manager) => (
                <tr key={manager.id} className="border-b border-zinc-50 dark:border-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                        {manager.name ? manager.name.charAt(0) : manager.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{manager.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">{manager.email}</td>
                  <td className="py-4 px-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-wrap gap-2">
                      {manager.workspaces?.map((w: any) => (
                        <span key={w.workspace.id} className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold">
                          {w.workspace.name}
                        </span>
                      ))}
                      {manager.workspaces?.length === 0 && <span className="text-zinc-400 italic">None</span>}
                    </div>
                  </td>
                  <td className="py-4 px-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(manager.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredManagers.length === 0 && (
            <div className="py-20 text-center text-zinc-400 font-medium italic">
              No managers found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
