"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import {
  History,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  UserCheck,
  CreditCard,
  FileText,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  workspaceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function AuditTrail() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (currentPage = page, query = searchQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";
      const data = (await apiFetch(
        `${API_BASE_URL}/api/super-admin/audit-logs?page=${currentPage}&limit=15${searchParam}`,
      )) as {
        logs: AuditLogEntry[];
        pagination: {
          totalPages: number;
          page: number;
        };
      };
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to fetch manager audit logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page, searchQuery);
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1, searchQuery);
  };

  const getActionIcon = (action: string) => {
    if (action.includes("PROPERTY")) {
      return <Building className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (action.includes("TENANT")) {
      return <UserCheck className="w-3.5 h-3.5 text-indigo-500" />;
    }
    if (action.includes("LEASE")) {
      return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (action.includes("PAYMENT") || action.includes("INVOICE")) {
      return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (action.includes("MAINTENANCE")) {
      return <Wrench className="w-3.5 h-3.5 text-rose-500" />;
    }
    return <History className="w-3.5 h-3.5 text-zinc-500" />;
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes("CREATE")) {
      return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30";
    }
    if (
      action.includes("DELETE") ||
      action.includes("REMOVE") ||
      action.includes("REJECT")
    ) {
      return "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30";
    }
    if (action.includes("UPDATE")) {
      return "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30";
    }
    return "bg-zinc-50 dark:bg-zinc-950/20 text-zinc-700 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-900/30";
  };

  return (
    <div className="space-y-6" aria-label="Manager Audit Trail Container">
      {/* Control Bar (Search + Refresh) */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex gap-2 w-full md:max-w-2xl"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by manager name, email, or log description details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl cursor-pointer hover:bg-primary/95 transition-all shadow-sm"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => fetchLogs(page, searchQuery)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-muted border border-border text-foreground transition-all text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm w-full md:w-auto justify-center"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground",
              isLoading && "animate-spin",
            )}
          />
          Refresh Audit Trail
        </button>
      </div>

      {/* Audit Log Table Container */}
      {error ? (
        <div className="p-5 bg-destructive/5 dark:bg-destructive/10 border border-destructive/10 text-destructive rounded-2xl flex flex-col items-center justify-center font-semibold text-sm shadow-sm gap-2">
          <AlertTriangle className="w-8 h-8 opacity-80 text-destructive" />
          <p>System Alert: {error}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
          {isLoading && logs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-semibold">
                Loading operation histories...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center border border-dashed border-border/60 rounded-2xl m-4">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-80" />
              <h4 className="text-sm font-bold text-foreground">
                No Logs Recorded
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No manager operations matching the specified filters have been
                registered.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Manager (Actor)</th>
                    <th className="px-6 py-4">Operation Type</th>
                    <th className="px-6 py-4">Audit Details</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">
                            {log.actorName}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {log.actorEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                            getActionBadgeClass(log.action),
                          )}
                        >
                          {getActionIcon(log.action)}
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-foreground font-medium max-w-md line-clamp-2">
                          {log.details}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-md border border-border/40 text-muted-foreground">
                          {log.ipAddress || "127.0.0.1"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-[11px] font-semibold">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-muted/10 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-semibold">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-card border border-border rounded-lg disabled:opacity-50 text-foreground cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-1.5 bg-card border border-border rounded-lg disabled:opacity-50 text-foreground cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
