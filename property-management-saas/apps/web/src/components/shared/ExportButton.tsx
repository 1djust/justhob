'use client';

import * as React from 'react';
import { FileDown, FileSpreadsheet, Lock, Loader2 } from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface ExportButtonProps {
  workspaceId: string;
  type: 'tenants' | 'payments' | 'properties';
  plan?: string;
}

export function ExportButton({ workspaceId, type, plan }: ExportButtonProps) {
  const [loading, setLoading] = React.useState<'csv' | 'pdf' | null>(null);
  const isEnterprise = plan === 'ENTERPRISE';

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!isEnterprise || !workspaceId) return;
    setLoading(format);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/export/${type}?format=${format}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      alert(err.message || 'Failed to export data');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2" aria-label="Export Form">
      {/* CSV Button */}
      <button
        onClick={() => handleExport('csv')}
        disabled={!isEnterprise || !!loading}
        title={isEnterprise ? `Download ${type} as CSV` : 'Upgrade to Enterprise to export data'}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
          isEnterprise
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:scale-105 active:scale-95'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 cursor-not-allowed'
        }`}
      >
        {loading === 'csv' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isEnterprise ? (
          <FileSpreadsheet className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        {loading === 'csv' ? 'Exporting...' : 'Export CSV'}
      </button>

      {/* PDF Button */}
      <button
        onClick={() => handleExport('pdf')}
        disabled={!isEnterprise || !!loading}
        title={isEnterprise ? `Download ${type} as PDF Report` : 'Upgrade to Enterprise for PDF Reports'}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
          isEnterprise
            ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:scale-105 active:scale-95'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 cursor-not-allowed'
        }`}
      >
        {loading === 'pdf' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isEnterprise ? (
          <FileDown className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        {loading === 'pdf' ? 'Generating...' : 'Download PDF'}
      </button>
    </div>
  );
}
