"use client";
// Linter override: label placeholder aria-label

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { ShieldAlert, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SecurityLogEntry {
  id: string;
  eventType: string;
  ipAddress: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export function SecurityLogs() {
  const [logs, setLogs] = useState<SecurityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/audit-logs") as { logs: SecurityLogEntry[] };
      setLogs(data.logs || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to fetch security logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "FAILED_LOGIN":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "UNAUTHORIZED_API_ACCESS":
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case "RATE_LIMIT_EXCEEDED":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Security Audit Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor anomalous events, failed logins, and unauthorized access attempts.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex flex-col items-center justify-center">
          <ShieldAlert className="w-10 h-10 mb-4 opacity-50" />
          <p className="font-medium">{error}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          {isLoading && logs.length === 0 ? (
            <div className="p-12 flex justify-center">
              <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No security anomalies detected.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-secondary/50">
                            {getEventIcon(log.eventType)}
                          </div>
                          <span className="font-medium">{log.eventType.replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-secondary px-2 py-1 rounded-md">
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.details ? (
                          <div className="text-xs text-muted-foreground max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
