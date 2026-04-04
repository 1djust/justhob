'use client';

import * as React from 'react';
import { 
  CreditCard, 
  Search, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Calendar,
  Wallet,
  Building,
  Building2
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

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
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/payments${filter ? `?status=${filter}` : ''}`;
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
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${paymentId}/pay`, {
        method: 'PUT',
        credentials: 'include'
      });
      fetchPayments();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Loading ledger...</p>
      </div>
    );
  }

  const totalPending = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Payments</h3>
          <p className="text-sm text-zinc-500 mt-1">Track rental income and payment history</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold appearance-none hover:border-zinc-400 transition-all focus:ring-2 focus:ring-zinc-900/5 outline-none"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          {isPropertyManager && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
            >
              {showForm ? 'Cancel' : <><CreditCard className="w-4 h-4" /> New Payment</>}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5 font-bold" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Receivables</p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦{totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600/80 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full w-fit">
            <AlertCircle className="w-3 h-3" /> Unpaid Balance
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
           <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 font-bold" />
            </div>
            <ArrowDownRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Total Collected</p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full w-fit">
             <CheckCircle2 className="w-3 h-3" /> Settled Payments
          </div>
        </div>
      </div>

      {showForm && isPropertyManager && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <PaymentForm workspaceId={workspaceId} leases={leases} onComplete={() => { setShowForm(false); fetchPayments(); }} />
        </div>
      )}

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Wallet className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No payment history found. <br />
            {isPropertyManager && 'Record a new payment to update your ledger.'}
          </p>
        </div>
      ) : (
        <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden border-separate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Tenant / Property</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Status</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Due Date</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="text-right py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {payments.map(p => (
                  <tr key={p.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    <td className="py-5 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{p.lease?.tenant?.name}</span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" /> {p.lease?.property?.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className={p.status === 'PAID' 
                          ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                          : p.status === 'OVERDUE'
                          ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50'
                          : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50'
                        }>
                        {p.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2 text-zinc-500 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(p.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                        ₦{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {p.status === 'PENDING' && isPropertyManager && (
                          <button
                            onClick={() => handleMarkPaid(p.id)}
                            className="text-[10px] uppercase font-black px-4 py-2 rounded-full border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                          >
                            Mark Settled
                          </button>
                        )}
                        {p.status === 'PAID' && p.paidDate && (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                            Paid {new Date(p.paidDate).toLocaleDateString()}
                          </span>
                        )}
                        <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments`, {
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
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50/50 dark:bg-zinc-900/30 space-y-8 relative overflow-hidden">
      <div>
        <h4 className="text-xl font-bold mb-1">Record Settlement</h4>
        <p className="text-sm text-zinc-500">Capture a rent payment or deposit</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 relative">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Occupancy / Lease Agreement</label>
          <select 
            required 
            value={formData.leaseId} 
            onChange={e => handleLeaseChange(e.target.value)} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium appearance-none"
          >
            <option value="">Select active tenant lease...</option>
            {leases.map(l => (
              <option key={l.id} value={l.id}>
                {l.tenant?.name} @ {l.property?.name} (₦{l.yearlyRent?.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Payment Amount (₦)</label>
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            required 
            value={formData.amount} 
            onChange={e => setFormData({ ...formData, amount: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-bold tracking-tight" 
            placeholder="0.00" 
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Due Date</label>
          <input 
            type="date" 
            required 
            value={formData.dueDate} 
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium" 
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Status</label>
          <select 
            value={formData.status} 
            onChange={e => setFormData({ ...formData, status: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-bold appearance-none"
          >
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Reference / Note</label>
          <input 
            value={formData.note} 
            onChange={e => setFormData({ ...formData, note: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium" 
            placeholder="e.g. Annual Rent Payment 2024" 
          />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-at border-zinc-100 dark:border-zinc-800">
        <button 
          disabled={loading} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-8 py-3 rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}
