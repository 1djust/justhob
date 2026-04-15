'use client';

import * as React from 'react';
import { 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  Landmark,
  ArrowRight,
  Info
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

// Common Nigerian Banks and their NIBSS codes
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

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const [bankCode, setBankCode] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  // Load existing data
  React.useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/workspaces`, { credentials: 'include' })
      .then(data => {
        const ws = data.workspaces?.find((w: { id: string; bankCode?: string; accountNumber?: string; accountName?: string }) => w.id === workspaceId);
        if (ws) {
          setBankCode(ws.bankCode || '');
          setAccountNumber(ws.accountNumber || '');
          setAccountName(ws.accountName || '');
        }
      });
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, accountNumber, accountName }),
        credentials: 'include'
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mt-10">
      <div className="max-w-3xl">
        <div className="mb-10">
          <h3 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Payout Settings</h3>
          <p className="text-sm text-zinc-500 mt-2 font-medium">Configure where management fees and direct rent should be settled.</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 rounded-[3rem] blur-xl opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          
          <form onSubmit={handleSubmit} className="relative p-10 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-white dark:bg-zinc-950 shadow-sm space-y-10">
            <div className="flex items-center gap-4 mb-2">
               <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-50 dark:text-zinc-900 shadow-xl">
                 <Landmark className="w-6 h-6" />
               </div>
               <div>
                  <h4 className="text-lg font-bold tracking-tight">Settlement Account</h4>
                  <p className="text-xs text-zinc-400 font-medium">Active Bank Authorization</p>
               </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Financial Institution</label>
                <div className="relative">
                  <select 
                    required 
                    value={bankCode} 
                    onChange={e => setBankCode(e.target.value)} 
                    className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-bold appearance-none cursor-pointer"
                  >
                    <option value="">Select your bank...</option>
                    {NIGERIAN_BANKS.sort((a,b) => a.name.localeCompare(b.name)).map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">NUBAN Number (10 Digits)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber} 
                    onChange={e => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))} 
                    className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-black tracking-[0.2em] placeholder:tracking-normal placeholder:font-normal" 
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-300">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Legal Account Name</label>
              <input 
                type="text" 
                required 
                placeholder="EXACTLY AS IT APPEARS ON BANK STATEMENT"
                value={accountName} 
                onChange={e => setAccountName(e.target.value)} 
                className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-bold placeholder:font-normal" 
              />
            </div>

            <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-start gap-4">
              <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xs font-medium text-zinc-500 leading-relaxed">
                By clicking save, you authorize the platform to route automated settlements to this account. Payouts are typically processed within 24 hours of successful tenant payment clearance.
              </p>
            </div>
            
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                {success && (
                  <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" /> Payout verified
                  </div>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={loading || accountNumber.length !== 10 || !accountName}
                className="group flex items-center gap-3 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-10 py-4 rounded-full text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 tracking-[0.2em] uppercase"
              >
                {loading ? 'Authorizing...' : (
                  <>
                    Save Configuration
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-10 p-8 rounded-[2rem] border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center gap-5">
           <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
             <Info className="w-5 h-5" />
           </div>
           <p className="text-xs text-zinc-400 font-medium leading-relaxed">
             Need to split payouts across multiple accounts? <br />
             <span className="text-zinc-500 font-bold underline cursor-pointer">Contact support for Advanced Treasury features.</span>
           </p>
        </div>
      </div>
    </div>
  );
}
