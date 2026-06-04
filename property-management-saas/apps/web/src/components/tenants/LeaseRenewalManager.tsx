'use client';

import * as React from 'react';
import { FileText, CheckCircle2, AlertCircle, RefreshCw, X, Clock } from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function LeaseRenewalManager({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();

  const { data: renewals = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['renewals', workspaceId],
    queryFn: async () => {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/leases/renewals`, {
        credentials: 'include'
      });
      return data.renewals || [];
    },
    enabled: !!workspaceId
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ renewalId, status }: { renewalId: string, status: 'ACCEPTED' | 'REJECTED' }) => {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/leases/renewals/${renewalId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewals', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tenants', workspaceId] });
    },
    onError: (e: any) => {
      alert(e.message || 'Failed to review renewal');
    }
  });

  const handleReview = (renewalId: string, status: 'ACCEPTED' | 'REJECTED') => {
    reviewMutation.mutate({ renewalId, status });
  };

  if (loading) return <div className="animate-pulse h-32 bg-zinc-100 dark:bg-zinc-900 rounded-3xl" />;
  if (renewals.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Lease Renewals</h4>
        <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-black px-2 py-0.5 rounded-md ml-2">
          {renewals.length}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {renewals.map(r => (
          <div key={r.id} className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
            
            <div className="flex justify-between items-start mb-4 relative">
              <div>
                <h5 className="font-bold text-zinc-900 dark:text-zinc-100">{r.lease?.tenant?.name}</h5>
                <p className="text-xs text-zinc-500">{r.lease?.property?.name}</p>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg ${
                r.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                r.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {r.status}
              </span>
            </div>

            <div className="space-y-2 relative">
               <div className="flex justify-between text-sm">
                 <span className="text-zinc-500">Proposed Rent:</span>
                 <span className="font-bold text-zinc-900 dark:text-zinc-100">₦{r.proposedRent.toLocaleString()}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-zinc-500">Proposed Start:</span>
                 <span className="font-bold text-zinc-900 dark:text-zinc-100">{new Date(r.proposedStartDate).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-zinc-500">Initiator:</span>
                 <span className="font-bold text-zinc-900 dark:text-zinc-100">{r.initiatedBy}</span>
               </div>
            </div>
            
            {r.status === 'PENDING' && r.initiatedBy === 'TENANT' && (
              <div className="flex gap-2 mt-4 relative">
                <button 
                  onClick={() => handleReview(r.id, 'ACCEPTED')}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                </button>
                <button 
                  onClick={() => handleReview(r.id, 'REJECTED')}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm hover:bg-rose-700 flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}
            
            {r.status === 'PENDING' && r.initiatedBy === 'MANAGER' && (
              <div className="mt-4 text-xs font-medium text-amber-600 flex items-center gap-1 relative">
                <Clock className="w-3.5 h-3.5" /> Waiting for tenant response
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
