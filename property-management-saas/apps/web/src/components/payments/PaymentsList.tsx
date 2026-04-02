'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';

interface Lease {
  id: string;
  tenant?: { name: string };
  property?: { name: string };
  yearlyRent?: number;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  lease?: {
    tenant?: { name: string };
    property?: { name: string };
  };
}

interface PaymentsListProps {
  workspaceId: string;
  leases: Lease[];
  isPropertyManager?: boolean;
}

export function PaymentsList({ workspaceId, leases, isPropertyManager = true }: PaymentsListProps) {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [filter, setFilter] = React.useState<string>('');

  const fetchPayments = async () => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/payments${filter ? `?status=${filter}` : ''}`;
      const res = await apiFetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (workspaceId) fetchPayments();
  }, [workspaceId, filter]);

  const handleMarkPaid = async (paymentId: string) => {
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/payments/${paymentId}/pay`, {
      method: 'PUT',
      credentials: 'include'
    });
    fetchPayments();
  };

  if (loading) return <div className="mt-8">Loading payments...</div>;

  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <h3 className="text-xl font-bold tracking-tight">Rent Payments</h3>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
          {isPropertyManager && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {showForm ? 'Cancel' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Pending</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">₦{totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Collected</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">₦{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {showForm && isPropertyManager && (
        <PaymentForm workspaceId={workspaceId} leases={leases} onComplete={() => { setShowForm(false); fetchPayments(); }} />
      )}

      {payments.length === 0 ? (
        <div className="text-zinc-500 py-8 text-center border border-dashed border-border rounded-xl">
          No payments found. {isPropertyManager && 'Click "Record Payment" to get started.'}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left p-4 font-medium text-zinc-500">Tenant</th>
                <th className="text-left p-4 font-medium text-zinc-500">Property</th>
                <th className="text-left p-4 font-medium text-zinc-500">Amount</th>
                <th className="text-left p-4 font-medium text-zinc-500">Due Date</th>
                <th className="text-left p-4 font-medium text-zinc-500">Status</th>
                <th className="text-right p-4 font-medium text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-4 font-medium">{p.lease?.tenant?.name}</td>
                  <td className="p-4 text-zinc-500">{p.lease?.property?.name}</td>
                  <td className="p-4 font-medium">₦{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-zinc-500">{new Date(p.dueDate).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      p.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      p.status === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {p.status === 'PENDING' && isPropertyManager && (
                      <button
                        onClick={() => handleMarkPaid(p.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                    {p.status === 'PAID' && p.paidDate && (
                      <span className="text-xs text-zinc-500">Paid {new Date(p.paidDate).toLocaleDateString()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentForm({ workspaceId, leases, onComplete }: { workspaceId: string; leases: Lease[]; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ leaseId: '', amount: '', dueDate: '', status: 'PENDING', note: '' });
  const [loading, setLoading] = React.useState(false);

  const handleLeaseChange = (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    setFormData({
      ...formData,
      leaseId,
      amount: lease?.yearlyRent ? String(lease.yearlyRent) : formData.amount
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-6 border border-border rounded-xl bg-zinc-50 dark:bg-zinc-900/50 space-y-4">
      <h4 className="font-semibold text-lg mb-2">Record Payment</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Lease (Tenant → Property)</label>
          <select required value={formData.leaseId} onChange={e => handleLeaseChange(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500">
            <option value="">Select a lease...</option>
            {leases.map(l => (
              <option key={l.id} value={l.id}>
                {l.tenant?.name} → {l.property?.name} (₦{l.yearlyRent}/yr)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Amount (₦)</label>
          <input type="number" step="0.01" min="0" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Due Date</label>
          <input type="date" required value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Status</label>
          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500">
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Note (optional)</label>
          <input value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="e.g. March rent" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button disabled={loading} type="submit" className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Payment'}
        </button>
      </div>
    </form>
  );
}
