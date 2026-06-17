"use client";

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
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
      case "UNAUTHORIZED_API_ACCESS":
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
      case "RATE_LIMIT_EXCEEDED":
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />;
      default:
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case "FAILED_LOGIN":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30";
      case "UNAUTHORIZED_API_ACCESS":
        return "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30";
      case "RATE_LIMIT_EXCEEDED":
        return "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-900/30";
      default:
        return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-2">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Security Audit Logs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time security analytics, anomaly detection, and access registry logs.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted border border-border text-foreground transition-all text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isLoading && "animate-spin")} />
          Refresh Logs
        </button>
      </div>

      {error ? (
        <div className="p-5 bg-destructive/5 dark:bg-destructive/10 border border-destructive/10 text-destructive rounded-2xl flex flex-col items-center justify-center font-semibold text-sm shadow-sm gap-2">
          <ShieldAlert className="w-8 h-8 opacity-80 text-destructive" />
          <p>System Alert: {error}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
          {isLoading && logs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-semibold">Fetching active logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center border border-dashed border-border/60 rounded-2xl m-4">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-80" />
              <h4 className="text-sm font-bold text-foreground">All Systems Secure</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No unauthorized events or network security anomalies have been recorded recently.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Telemetry Details</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                            getEventBadgeClass(log.eventType)
                          )}>
                            {getEventIcon(log.eventType)}
                            {log.eventType.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-md border border-border/40 text-muted-foreground">
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.details ? (
                          <div className="text-xs text-muted-foreground max-w-xs truncate font-medium" title={JSON.stringify(log.details)}>
                            {JSON.stringify(log.details)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs font-semibold">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
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
