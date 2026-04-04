'use client';

import * as React from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  Calendar, 
  Wallet,
  Building,
  Building2,
  User, 
  ExternalLink,
  ChevronRight,
  Filter,
  Image as ImageIcon
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface MaintenanceListProps {
  workspaceId: string;
  isPropertyManager?: boolean;
}

interface MaintenanceRequest {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  imageUrl?: string;
  property?: { name: string };
  tenant?: { name: string };
}

export function MaintenanceList({ workspaceId, isPropertyManager = true }: MaintenanceListProps) {
  const [requests, setRequests] = React.useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>('');

  const fetchRequests = React.useCallback(async () => {
    try {
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance${filter ? `?status=${filter}` : ''}`;
      const res = await apiFetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filter]);

  React.useEffect(() => {
    if (workspaceId) fetchRequests();
  }, [workspaceId, filter, fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      fetchRequests();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Scanning tickets...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Maintenance</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage and track repair requests across properties</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[10px] font-black uppercase tracking-widest appearance-none hover:border-zinc-400 transition-all focus:ring-4 focus:ring-zinc-900/5 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-900/30">
          <Wrench className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-bold text-center px-4 tracking-tight">
            No active maintenance tickets. <br />
            <span className="text-xs font-medium opacity-60 italic">Everything seems to be in order.</span>
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {requests.map(req => (
            <div key={req.id} className="group relative border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] bg-white dark:bg-zinc-950 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              <div className="flex justify-between items-start mb-5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' :
                  req.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50' :
                  'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                }`}>
                  {req.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {req.status.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 leading-relaxed group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                {req.description}
              </h4>
              
              {req.imageUrl && (
                <div className="relative mb-5 rounded-2xl overflow-hidden aspect-video bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 group/img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={req.imageUrl} alt="Issue evidence" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => window.open(req.imageUrl, '_blank')}
                      className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30 hover:bg-white/40 transition-all"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Property
                    </span>
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{req.property?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <User className="w-3 h-3" /> Tenant
                    </span>
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{req.tenant?.name}</p>
                  </div>
                </div>

                {isPropertyManager && (
                  <div className="flex gap-2 pt-4 border-t border-zinc-50 dark:border-zinc-900">
                    {req.status === 'PENDING' && (
                      <button 
                        onClick={() => handleUpdateStatus(req.id, 'IN_PROGRESS')} 
                        className="flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 hover:scale-[1.02] shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        Start Work
                      </button>
                    )}
                    {req.status === 'IN_PROGRESS' && (
                      <button 
                        onClick={() => handleUpdateStatus(req.id, 'COMPLETED')} 
                        className="flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        Resolve Issue
                      </button>
                    )}
                    {req.status !== 'PENDING' && (
                      <button 
                        onClick={() => handleUpdateStatus(req.id, 'PENDING')} 
                        className="flex-none p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group/btn"
                        title="Revert to Pending"
                      >
                         <Clock className="w-4 h-4 text-zinc-400 group-hover/btn:text-zinc-900 dark:group-hover/btn:text-zinc-100 transition-colors" />
                      </button>
                    )}
                    <button className="flex-none p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
