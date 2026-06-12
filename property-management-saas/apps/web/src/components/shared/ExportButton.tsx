"use client";

import * as React from "react";
import { FileDown, FileSpreadsheet, Lock, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Button } from "./Button";

interface ExportButtonProps {
  workspaceId: string;
  type: "tenants" | "payments" | "properties";
  plan?: string;
}

export function ExportButton({ workspaceId, type, plan }: ExportButtonProps) {
  const [loading, setLoading] = React.useState<"csv" | "pdf" | null>(null);
  const isEnterprise = plan === "ENTERPRISE";

  const handleExport = async (format: "csv" | "pdf") => {
    if (!isEnterprise || !workspaceId) return;
    setLoading(format);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const response = await fetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/export/${type}?format=${format}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Export error:", errorObj);
      alert(errorObj.message || "Failed to export data");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2" aria-label="Export Form">
      {/* CSV Button */}
      <Button
        onClick={() => handleExport("csv")}
        disabled={!isEnterprise || !!loading}
        title={
          isEnterprise
            ? `Download ${type} as CSV`
            : "Upgrade to Enterprise to export data"
        }
        variant={isEnterprise ? "success" : "outline"}
        size="sm"
        className="rounded-full"
      >
        {loading === "csv" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isEnterprise ? (
          <FileSpreadsheet className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        {loading === "csv" ? "Exporting..." : "Export CSV"}
      </Button>

      {/* PDF Button */}
      <Button
        onClick={() => handleExport("pdf")}
        disabled={!isEnterprise || !!loading}
        title={
          isEnterprise
            ? `Download ${type} as PDF Report`
            : "Upgrade to Enterprise for PDF Reports"
        }
        variant={isEnterprise ? "danger" : "outline"}
        size="sm"
        className="rounded-full"
      >
        {loading === "pdf" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isEnterprise ? (
          <FileDown className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        {loading === "pdf" ? "Generating..." : "Download PDF"}
      </Button>
    </div>
  );
}
