"use client";

import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { apiFetch } from "@/lib/api";
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Globe,
  Smartphone,
  Laptop,
  Code2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Activity,
} from "lucide-react";
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
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchIp, setSearchIp] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 6;

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = (await apiFetch("/api/admin/audit-logs")) as {
        logs: SecurityLogEntry[];
      };
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

  const getEventConfig = (type: string) => {
    switch (type) {
      case "FAILED_LOGIN":
        return {
          label: "Failed Login Attempt",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
          badgeClass:
            "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        };
      case "UNAUTHORIZED_API_ACCESS":
        return {
          label: "Unauthorized API Access",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />,
          badgeClass:
            "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
        };
      case "RATE_LIMIT_EXCEEDED":
        return {
          label: "Rate Limit Exceeded",
          icon: <Activity className="w-3.5 h-3.5 text-orange-500" />,
          badgeClass:
            "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
        };
      default:
        return {
          label: type.replace(/_/g, " "),
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />,
          badgeClass:
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        };
    }
  };

  const getMethodBadge = (method?: string) => {
    if (!method) return null;
    const m = method.toUpperCase();
    const classes: Record<string, string> = {
      GET: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      PATCH:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      DELETE:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    };
    return (
      <span
        className={cn(
          "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border tracking-wider",
          classes[m] || "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
        )}
      >
        {m}
      </span>
    );
  };

  const getUserAgentBadge = (ua?: string) => {
    if (!ua) return null;
    if (
      ua.includes("Dart") ||
      ua.includes("Flutter") ||
      ua.includes("Mobile")
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-medium">
          <Smartphone className="w-3 h-3" /> Mobile Client
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20 text-[11px] font-medium">
        <Laptop className="w-3 h-3" /> Web Browser
      </span>
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesType = filterType === "ALL" || log.eventType === filterType;
    const matchesIp =
      !searchIp ||
      log.ipAddress.toLowerCase().includes(searchIp.toLowerCase()) ||
      (log.details?.url &&
        String(log.details.url).toLowerCase().includes(searchIp.toLowerCase()));
    return matchesType && matchesIp;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <div className="space-y-4" aria-label="Security Audit Logs Container">
      {/* Sleek Header Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              Security Telemetry Registry
              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold rounded-full border border-border">
                {filteredLogs.length} events
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Real-time anomaly detection & network access registry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              fetchLogs();
            }}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-background hover:bg-muted border border-border text-foreground transition-all text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm w-full sm:w-auto"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground",
                isLoading && "animate-spin",
              )}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by IP address or API URL endpoint..."
            value={searchIp}
            onChange={(e) => {
              setSearchIp(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary shadow-sm"
          />
        </div>

        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 text-xs bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary shadow-sm appearance-none cursor-pointer font-medium"
          >
            <option value="ALL">All Event Types</option>
            <option value="UNAUTHORIZED_API_ACCESS">Unauthorized Access</option>
            <option value="FAILED_LOGIN">Failed Logins</option>
            <option value="RATE_LIMIT_EXCEEDED">Rate Limits Exceeded</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Error / Content Display */}
      {error ? (
        <div className="p-5 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex flex-col items-center justify-center font-semibold text-xs shadow-sm gap-2">
          <ShieldAlert className="w-7 h-7 opacity-80" />
          <p>Security Service Alert: {error}</p>
        </div>
      ) : isLoading && logs.length === 0 ? (
        <div className="p-12 bg-card border border-border/80 rounded-2xl flex flex-col items-center justify-center gap-2.5 shadow-sm">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground font-semibold">
            Loading telemetry feed...
          </span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-10 text-center bg-card border border-dashed border-border/80 rounded-2xl shadow-sm">
          <ShieldCheck className="w-9 h-9 mx-auto mb-2 text-emerald-500 opacity-90" />
          <h4 className="text-xs font-bold text-foreground">
            All Systems Secure
          </h4>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
            No network security anomalies or unauthorized events match your
            active filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedLogs.map((log) => {
            const config = getEventConfig(log.eventType);
            const details = log.details as Record<string, any> | null;
            const url = details?.url;
            const method = details?.method;
            const userAgent = details?.userAgent;
            const isExpanded = expandedLogId === log.id;

            return (
              <div
                key={log.id}
                className="bg-card hover:bg-muted/20 border border-border/80 rounded-xl p-3 transition-all shadow-sm flex flex-col gap-2"
              >
                {/* Compact Top Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                        config.badgeClass,
                      )}
                    >
                      {config.icon}
                      {config.label}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-mono text-[11px] font-bold border border-border/60">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      {log.ipAddress}
                    </span>

                    {getMethodBadge(method)}

                    {url && (
                      <span className="font-mono text-[11px] font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/40 text-foreground truncate max-w-[220px]">
                        {url}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium self-end sm:self-auto">
                    {getUserAgentBadge(userAgent)}
                    <span className="text-muted-foreground/40">•</span>
                    <span
                      title={format(
                        new Date(log.createdAt),
                        "yyyy-MM-dd HH:mm:ss",
                      )}
                    >
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* Optional Expandable Inspector button */}
                {details && Object.keys(details).length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() =>
                        setExpandedLogId(isExpanded ? null : log.id)
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      <Code2 className="w-3 h-3" />
                      {isExpanded ? "Hide Payload" : "Inspect Payload"}
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}

                {/* Collapsible Raw JSON Inspector */}
                {isExpanded && details && (
                  <div className="mt-1 p-3 bg-muted/60 dark:bg-zinc-950/70 rounded-lg border border-border/60 text-xs font-mono overflow-x-auto text-foreground">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">
                      Raw Telemetry Attributes:
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {/* Clean Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1">
              <span className="text-xs text-muted-foreground font-medium">
                Showing page <strong className="text-foreground">{page}</strong>{" "}
                of <strong className="text-foreground">{totalPages}</strong> (
                {filteredLogs.length} total events)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold disabled:opacity-40 hover:bg-muted text-foreground transition-all cursor-pointer shadow-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold disabled:opacity-40 hover:bg-muted text-foreground transition-all cursor-pointer shadow-sm"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
