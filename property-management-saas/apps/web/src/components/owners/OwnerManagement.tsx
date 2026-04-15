'use client';

import * as React from 'react';
import { 
  UserPlus, 
  Trash2, 
  Building2, 
  Mail, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  CreditCard,
  ChevronRight,
  Search,
  MoreVertical,
  Banknote,
  Landmark
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

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
    'DIRECT_TO_LANDLORD': 'Landlord Receives Directly',
    'MANAGER_COLLECTS': 'Manager Collects First'
  };

  const fetchOwners = async () => {
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/owners`, {
        credentials: 'include'
      });
      setOwners(data.owners || []);
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
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/owners/${ownerId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchOwners();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Retrieving owners...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Landlords</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage property owners and payout configurations</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2.5 rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          {showForm ? 'Cancel' : <><UserPlus className="w-4 h-4" /> Add Owner</>}
        </button>
      </div>

      {showForm && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <AddOwnerForm workspaceId={workspaceId} onComplete={() => { setShowForm(false); fetchOwners(); }} />
        </div>
      )}

      {owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-900/30">
          <Landmark className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-bold text-center px-4 tracking-tight">
            No owners registered yet. <br />
            <span className="text-xs font-medium opacity-60 italic whitespace-nowrap">Invite landlords to begin managing their properties.</span>
          </p>
        </div>
      ) : (
        <div className="rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden border-separate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Owner Identity</th>
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Payout Strategy</th>
                  <th className="text-left py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Bank Settlement</th>
                  <th className="text-right py-6 px-8 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {owners.map(o => (
                  <tr key={o.id} className="group hover:bg-zinc-50/30 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-800">
                          {o.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{o.name}</span>
                          <span className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3" /> {o.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-8">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        o.payoutStrategy === 'DIRECT_TO_LANDLORD' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' 
                          : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                      }`}>
                        {o.payoutStrategy === 'DIRECT_TO_LANDLORD' ? <ShieldCheck className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                        {payoutStrategyLabels[o.payoutStrategy] || 'NOT SET'}
                      </span>
                    </td>
                    <td className="py-6 px-8">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                          {o.accountName || '—'}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-500 tracking-wider">
                          {o.accountNumber ? `NUBAN: ${o.accountNumber}` : 'Account Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRemove(o.id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                          title="Remove Owner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      onComplete();
    } catch (e: any) {
      setError(e.message || 'Failed to add owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-white dark:bg-zinc-950 shadow-2xl space-y-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 dark:bg-zinc-900/50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
      
      <div>
        <h4 className="text-xl font-bold mb-1">Onboard New Landlord</h4>
        <p className="text-sm text-zinc-500">Configure owner details and payment agreements</p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-100 dark:border-rose-900/50 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2 relative">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Full Identity</label>
          <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal" placeholder="e.g. Johnathan Doe" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Communication Email</label>
          <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal" placeholder="landlord@example.com" />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Access Authentication (Temporary Password)</label>
          <input value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold placeholder:font-normal" placeholder="Defaults to: TempPass123!" />
        </div>

        <div className="md:col-span-2 space-y-8 pt-6">
          <div className="flex items-center gap-3">
             <div className="h-[1px] flex-1 bg-zinc-100 dark:border-zinc-800" />
             <span className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">Settlement Configuration</span>
             <div className="h-[1px] flex-1 bg-zinc-100 dark:border-zinc-800" />
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Payout Protocol</label>
              <select 
                value={formData.payoutStrategy} 
                onChange={e => setFormData({ ...formData, payoutStrategy: e.target.value })} 
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="DIRECT_TO_LANDLORD">LANDLORD RECEIVES DIRECTLY (Tenant transfers to Landlord)</option>
                <option value="MANAGER_COLLECTS">MANAGER COLLECTS FIRST (Tenant transfers to Manager)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Receiving Financial Institution</label>
              <select 
                required 
                value={formData.bankCode} 
                onChange={e => setFormData({ ...formData, bankCode: e.target.value })} 
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="">Select bank...</option>
                {NIGERIAN_BANKS.sort((a,b) => a.name.localeCompare(b.name)).map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">NUBAN Account Number</label>
              <input 
                required 
                maxLength={10}
                value={formData.accountNumber} 
                onChange={e => setFormData({ ...formData, accountNumber: e.target.value.replace(/[^0-9]/g, '') })} 
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 font-black tracking-[0.2em]" 
                placeholder="0000000000" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Holder Name (Legal)</label>
              <input 
                required 
                value={formData.accountName} 
                onChange={e => setFormData({ ...formData, accountName: e.target.value })} 
                className="w-full px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 font-bold placeholder:font-normal" 
                placeholder="AS SEEN ON BANK RECORDS" 
              />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
             <Banknote className="w-4 h-4 text-zinc-400 mt-0.5" />
             <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">
               {formData.payoutStrategy === 'DIRECT_TO_LANDLORD' 
                 ? 'FUNDS PROTOCOL: Tenant pays to Landlord\'s account, sends proof to you, and you verify receipt in the system.' 
                 : 'FUNDS PROTOCOL: Tenant pays to your account, sends proof, and you manually disburse to the Landlord later.'}
             </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button 
          disabled={loading || !formData.name || !formData.email || !formData.bankCode || formData.accountNumber.length !== 10 || !formData.accountName} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-10 py-4 rounded-full text-sm font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 tracking-widest uppercase"
        >
          {loading ? 'Processing...' : 'Authorize Add'}
        </button>
      </div>
    </form>
  );
}
