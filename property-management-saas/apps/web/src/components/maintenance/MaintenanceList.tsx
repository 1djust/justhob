"use client";

import * as React from "react";
import {
  Wrench,
  Search,
  Filter,
  MoreVertical,
  X,
  Plus,
  MessageSquare,
  CheckCircle2,
  Clock,
  Play,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { MaintenanceChat } from "./MaintenanceChat";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../shared/Button";

interface MaintenanceListProps {
  workspaceId: string;
  isPropertyManager?: boolean;
}

interface MaintenanceRequest {
  id: string;
  description: string;
  status: string;
  priority: string;
  vendor?: string;
  createdAt: string;
  imageUrl?: string;
  property?: { name: string };
  tenant?: { name: string };
}

export function MaintenanceList({
  workspaceId,
  isPropertyManager = true,
}: MaintenanceListProps) {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = React.useState<string>("");
  const [filterLocation, setFilterLocation] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [selectedRequestId, setSelectedRequestId] = React.useState<
    string | null
  >(null);
  const [unreadRequests, setUnreadRequests] = React.useState<Set<string>>(
    new Set(),
  );

  const [selectedTickets, setSelectedTickets] = React.useState<Set<string>>(
    new Set(),
  );
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  const { socket } = useRealtime();

  const { data: requests = [], isLoading: loading } = useQuery<
    MaintenanceRequest[]
  >({
    queryKey: ["maintenance", workspaceId, filterType],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance${filterType ? `?status=${filterType}` : ""}`;
      const data = await apiFetch(url, { credentials: "include" });
      return data.requests || [];
    },
    enabled: !!workspaceId,
  });

  React.useEffect(() => {
    if (!socket) return;

    const handleNotification = ({ requestId }: { requestId: string }) => {
      if (selectedRequestId !== requestId) {
        setUnreadRequests((prev) => new Set([...Array.from(prev), requestId]));
      }
      queryClient.invalidateQueries({ queryKey: ["maintenance", workspaceId] });
    };

    socket.on("maintenance-notification", handleNotification);

    return () => {
      socket.off("maintenance-notification", handleNotification);
    };
  }, [socket, selectedRequestId, workspaceId, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: string;
    }) => {
      await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance", workspaceId] });
    },
  });

  const handleUpdateStatus = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({ id, newStatus });
    setOpenMenuId(null);
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === filteredRequests.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const toggleSelectTicket = (id: string) => {
    const next = new Set(selectedTickets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTickets(next);
  };

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filteredRequests = requests.filter((req) => {
    if (
      searchQuery &&
      !req.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !req.property?.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Scanning tickets...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Header Row (Matches Mockup) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">
          Maintenance Plan
        </h3>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search maintenance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Add Maintenance Button */}
          {isPropertyManager && (
            <Button>
              <Plus className="w-4 h-4" />
              Add Maintenance
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Type:
          </span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent border-none text-zinc-500 font-medium cursor-pointer focus:ring-0 outline-none p-0"
          >
            <option value="">All Maintenance</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Location:
          </span>
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-transparent border-none text-zinc-500 font-medium cursor-pointer focus:ring-0 outline-none p-0"
          >
            <option value="">All</option>
            {/* Populate unique locations */}
          </select>
        </div>

        {/* Layout Toggles (Mocking the Grid/List icons from the mockup) */}
        <div className="flex items-center gap-2 ml-4 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 h-8 w-8"
          >
            <LayoutGrid className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 h-8 w-8"
          >
            <List className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-900/30">
          <Wrench className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-bold text-center px-4 tracking-tight">
            No active maintenance tickets.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                      checked={
                        selectedTickets.size > 0 &&
                        selectedTickets.size === filteredRequests.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Apartment</th>
                  <th className="px-6 py-4">Responsible</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors ${selectedTickets.has(req.id) ? "bg-primary/5 dark:bg-primary/5" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                        checked={selectedTickets.has(req.id)}
                        onChange={() => toggleSelectTicket(req.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {unreadRequests.has(req.id) && (
                        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                      {req.description.length > 25
                        ? req.description.substring(0, 25) + "..."
                        : req.description}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {req.property?.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {req.tenant?.name || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold ${
                          req.priority === "HIGH"
                            ? "text-rose-600"
                            : req.priority === "MEDIUM"
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {req.priority
                          ? req.priority.charAt(0).toUpperCase() +
                            req.priority.slice(1).toLowerCase()
                          : "Medium"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          req.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                            : req.status === "IN_PROGRESS"
                              ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50"
                              : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                        }`}
                      >
                        {req.status === "COMPLETED" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : req.status === "IN_PROGRESS" ? (
                          <Play className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {req.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {req.vendor || "Unassigned"}
                    </td>
                    <td className="px-6 py-4 text-center relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === req.id ? null : req.id);
                        }}
                        className="text-zinc-400"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </Button>

                      {/* Action Dropdown Menu */}
                      {openMenuId === req.id && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-100 dark:border-zinc-800 z-10 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequestId(req.id);
                              setUnreadRequests((prev) => {
                                const next = new Set(prev);
                                next.delete(req.id);
                                return next;
                              });
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 flex items-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4 text-zinc-400" />
                            View Timeline
                          </button>

                          {isPropertyManager && (
                            <>
                              {req.status === "PENDING" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(req.id, "IN_PROGRESS");
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-primary font-medium flex items-center gap-2"
                                >
                                  <Play className="w-4 h-4 text-primary" />
                                  Start Work
                                </button>
                              )}

                              {req.status === "IN_PROGRESS" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(req.id, "COMPLETED");
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-emerald-600 font-medium flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  Mark Completed
                                </button>
                              )}

                              {req.status !== "PENDING" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(req.id, "PENDING");
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-amber-600 flex items-center gap-2"
                                >
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  Revert to Pending
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Chat Drawer */}
      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm cursor-pointer"
            onClick={() => setSelectedRequestId(null)}
          />
          <div className="relative w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-500">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSelectedRequestId(null)}
              className="absolute -left-12 top-6 rounded-full shadow-xl hover:scale-110 active:scale-95"
            >
              <X className="w-4 h-4" />
            </Button>
            <div className="h-full border-l border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-l-[3rem]">
              <MaintenanceChat
                workspaceId={workspaceId}
                requestId={selectedRequestId}
                isPropertyManager={isPropertyManager}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
