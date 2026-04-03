'use client';

import * as React from 'react';
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
      .then(res => res.json())
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
      const res = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, accountNumber, accountName }),
        credentials: 'include'
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 p-6 shadow-sm mb-8 mt-8">
      <h3 className="text-xl font-bold mb-1">Payout Settings</h3>
      <p className="text-sm text-zinc-500 mb-6">Configure where rent payments should be deposited. We use secure automated payouts to instantly route funds to your account.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Bank Name</label>
            <select 
              required 
              value={bankCode} 
              onChange={e => setBankCode(e.target.value)} 
              className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Select your bank...</option>
              {NIGERIAN_BANKS.sort((a,b) => a.name.localeCompare(b.name)).map(b => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Number (NUBAN)</label>
            <input 
              type="text" 
              required 
              pattern="[0-9]{10}"
              maxLength={10}
              placeholder="0123456789"
              value={accountNumber} 
              onChange={e => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))} 
              className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" 
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Account Holder Name</label>
          <input 
            type="text" 
            required 
            placeholder="Exactly as it appears on the bank account"
            value={accountName} 
            onChange={e => setAccountName(e.target.value)} 
            className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500" 
          />
        </div>
        
        <div className="pt-2 flex items-center gap-4">
          <button 
            type="submit" 
            disabled={loading || accountNumber.length !== 10 || !accountName}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Bank Details'}
          </button>
          
          {success && (
            <span className="text-sm font-medium text-green-600 dark:text-green-500 flex items-center gap-1">
               ✅ Settings saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
