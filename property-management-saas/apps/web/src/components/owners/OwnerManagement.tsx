'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
// import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTB)' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '032', name: 'Union Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '215', name: 'Unity Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '030', name: 'Heritage Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '212', name: 'Wema Bank' },
  { code: '035', name: 'ALAT by WEMA' },
  { code: '068', name: 'Standard Chartered Bank' }
];

interface OwnerManagementProps {
  workspaceId: string;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  payoutStrategy: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
}

export function OwnerManagement({ workspaceId }: OwnerManagementProps) {
  const [owners, setOwners] = React.useState<Owner[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const payoutStrategyLabels: Record<string, string> = {
    'DIRECT_TO_LANDLORD': 'Direct to Landlord',
    'MANAGER_COLLECTS': 'Manager Collects First'
  };

  const fetchOwners = async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/owners`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setOwners(data.owners || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (workspaceId) fetchOwners();
  }, [workspaceId]);

  const handleRemove = async (ownerId: string) => {
    if (!confirm('Remove this owner? Their properties will become unassigned.')) return;
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/owners/${ownerId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    fetchOwners();
  };

  if (loading) return <div className="mt-8">Loading owners...</div>;

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Property Owners</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage landlords who own properties in this workspace</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : 'Add Owner'}
        </button>
      </div>

      {showForm && (
        <AddOwnerForm workspaceId={workspaceId} onComplete={() => { setShowForm(false); fetchOwners(); }} />
      )}

      {owners.length === 0 ? (
        <div className="text-zinc-500 py-8 text-center border border-dashed border-border rounded-xl">
          No property owners added yet. Click &quot;Add Owner&quot; to invite a landlord.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left p-4 font-medium text-zinc-500">Name</th>
                <th className="text-left p-4 font-medium text-zinc-500">Email</th>
                <th className="text-left p-4 font-medium text-zinc-500">Payout Strategy</th>
                <th className="text-left p-4 font-medium text-zinc-500">Account Holder</th>
                <th className="text-left p-4 font-medium text-zinc-500">Bank Details</th>
                <th className="text-right p-4 font-medium text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(o => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4 font-medium">{o.name}</td>
                  <td className="p-4 text-zinc-500">{o.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      o.payoutStrategy === 'DIRECT_TO_LANDLORD' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {payoutStrategyLabels[o.payoutStrategy] || 'Not Set'}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500">
                    {o.accountName || '—'}
                  </td>
                  <td className="p-4 text-zinc-500">
                    {o.accountNumber ? `${o.bankCode} • ${o.accountNumber}` : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleRemove(o.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      Remove
                    </button>
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

function AddOwnerForm({ workspaceId, onComplete }: { workspaceId: string; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ 
    name: '', 
    email: '', 
    password: '',
    payoutStrategy: 'DIRECT_TO_LANDLORD',
    bankCode: '',
    accountNumber: '',
    accountName: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/workspaces/${workspaceId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add owner');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-6 border border-border rounded-xl bg-zinc-50 dark:bg-zinc-900/50 space-y-4">
      <h4 className="font-semibold text-lg mb-2">Add Property Owner</h4>
      <p className="text-sm text-zinc-500 mb-4">
        Add a landlord to this workspace. If the email is already registered, they will be added as an owner. Otherwise, a new account will be created with the password you provide.
      </p>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Full Name</label>
          <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="e.g. John Doe" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Email Address</label>
          <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="landlord@example.com" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Temporary Password (for new accounts)</label>
          <input value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="Leave empty for default: TempPass123!" />
        </div>

        <div className="md:col-span-2 border-t border-border pt-4 mt-2">
          <h5 className="text-sm font-bold mb-3">Payout Configuration</h5>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Payout Strategy</label>
              <select 
                value={formData.payoutStrategy} 
                onChange={e => setFormData({ ...formData, payoutStrategy: e.target.value })} 
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="DIRECT_TO_LANDLORD">Direct to Landlord (Automatic Payout)</option>
                <option value="MANAGER_COLLECTS">Manager Collects First (Manual Payout)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Bank Name</label>
              <select 
                required 
                value={formData.bankCode} 
                onChange={e => setFormData({ ...formData, bankCode: e.target.value })} 
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="">Select bank...</option>
                {NIGERIAN_BANKS.sort((a,b) => a.name.localeCompare(b.name)).map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Account Number</label>
              <input 
                required 
                maxLength={10}
                value={formData.accountNumber} 
                onChange={e => setFormData({ ...formData, accountNumber: e.target.value.replace(/[^0-9]/g, '') })} 
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" 
                placeholder="10-digit NUBAN" 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Account Holder Name</label>
              <input 
                required 
                value={formData.accountName} 
                onChange={e => setFormData({ ...formData, accountName: e.target.value })} 
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" 
                placeholder="Name exactly as it appears on the bank account" 
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            {formData.payoutStrategy === 'DIRECT_TO_LANDLORD' 
              ? 'Rent will be automatically split between manager and landlord during collection.' 
              : 'Rent will be paid fully to the manager, who then pays the landlord manually.'}
          </p>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button 
          disabled={loading || !formData.name || !formData.email || !formData.bankCode || formData.accountNumber.length !== 10 || !formData.accountName} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Owner'}
        </button>
      </div>
    </form>
  );
}
