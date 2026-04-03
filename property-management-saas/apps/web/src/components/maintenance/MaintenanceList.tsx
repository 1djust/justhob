'use client';

import * as React from 'react';
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

  const fetchRequests = async () => {
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
  };

  React.useEffect(() => {
    if (workspaceId) fetchRequests();
  }, [workspaceId, filter, fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
      credentials: 'include'
    });
    fetchRequests();
  };

  if (loading) return <div className="mt-8">Loading maintenance requests...</div>;

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <h3 className="text-xl font-bold tracking-tight">Maintenance Requests</h3>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-sm px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <div className="text-zinc-500 py-8 text-center border border-dashed border-border rounded-xl">
          No maintenance requests found.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map(req => (
            <div key={req.id} className="border border-border p-5 rounded-xl bg-white dark:bg-zinc-950 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  req.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                  req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                }`}>
                  {req.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <p className="text-sm mb-4 flex-grow">{req.description}</p>
              
              {req.imageUrl && (
                <div className="mb-4 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={req.imageUrl} alt="Maintenance issue" className="w-full h-32 object-cover hover:opacity-90 cursor-pointer" onClick={() => window.open(req.imageUrl, '_blank')} />
                </div>
              )}

              <div className="pt-4 border-t border-border mt-auto">
                <div className="flex gap-4 text-xs text-zinc-500 mb-4">
                  <div>
                    <span className="block font-medium text-foreground">Property</span>
                    {req.property?.name}
                  </div>
                  <div>
                    <span className="block font-medium text-foreground">Tenant</span>
                    {req.tenant?.name}
                  </div>
                </div>

                {isPropertyManager && (
                  <div className="flex gap-2">
                    {req.status === 'PENDING' && (
                      <button onClick={() => handleUpdateStatus(req.id, 'IN_PROGRESS')} className="flex-1 text-xs font-medium py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                        Mark In Progress
                      </button>
                    )}
                    {req.status === 'IN_PROGRESS' && (
                      <button onClick={() => handleUpdateStatus(req.id, 'COMPLETED')} className="flex-1 text-xs font-medium py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors">
                        Mark Completed
                      </button>
                    )}
                    {req.status !== 'PENDING' && (
                      <button onClick={() => handleUpdateStatus(req.id, 'PENDING')} className="flex-1 text-xs font-medium py-2 rounded-md border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        Revert to Pending
                      </button>
                    )}
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
