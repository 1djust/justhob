"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  CreditCard,
  Wrench,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  CalendarRange,
  Activity,
  TrendingUp,
  AlertOctagon,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Utility function to merge tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DashboardView =
  | "dashboard"
  | "properties"
  | "tenants"
  | "owners"
  | "payments"
  | "maintenance"
  | "settings"
  | "admin"
  | "admin-overview"
  | "admin-users"
  | "admin-workspaces"
  | "admin-upgrades"
  | "admin-errors"
  | "admin-payments"
  | "admin-security";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: DashboardView) => void;
  isPropertyManager: boolean;
  userEmail?: string;
  plan?: string;
  onLogout: () => void;
  workspaceId?: string | null;
  isSuperAdmin?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function Sidebar({
  activeView,
  onViewChange,
  isPropertyManager,
  userEmail,
  plan,
  onLogout,
  workspaceId,
  isSuperAdmin,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [selectedNotification, setSelectedNotification] =
    React.useState<Notification | null>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const data = await apiFetch(`${API_BASE_URL}/api/notifications`, {
        silent: true,
      } as unknown as RequestInit);
      return (data.notifications || []) as Notification[];
    },
    refetchOnWindowFocus: true,
  });
  const notifications = notificationsData || [];

  const { data: statsData } = useQuery({
    queryKey: ["workspace-stats", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/stats`,
        { silent: true } as unknown as RequestInit,
      );
      return data.stats;
    },
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });
  const stats = statsData || null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const { socket } = useRealtime();

  React.useEffect(() => {
    if (socket) {
      const handleRealtimeNotif = () => {
        console.log("[Realtime] New notification/event received");
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({
          queryKey: ["workspace-stats", workspaceId],
        });
      };

      socket.on("PAYMENT_SUBMITTED", handleRealtimeNotif);
      socket.on("PAYMENT_UPDATED", handleRealtimeNotif);
      socket.on("MAINTENANCE_CREATED", handleRealtimeNotif);
      socket.on("PROPERTY_CREATED", handleRealtimeNotif);
      socket.on("PROPERTY_DELETED", handleRealtimeNotif);
      socket.on("TENANT_CREATED", handleRealtimeNotif);
      socket.on("TENANT_DELETED", handleRealtimeNotif);
      socket.on("NOTIFICATION_CREATED", handleRealtimeNotif);
      socket.on("TENANT_OVERDUE", handleRealtimeNotif);

      return () => {
        socket.off("PAYMENT_SUBMITTED", handleRealtimeNotif);
        socket.off("PAYMENT_UPDATED", handleRealtimeNotif);
        socket.off("MAINTENANCE_CREATED", handleRealtimeNotif);
        socket.off("PROPERTY_CREATED", handleRealtimeNotif);
        socket.off("PROPERTY_DELETED", handleRealtimeNotif);
        socket.off("TENANT_CREATED", handleRealtimeNotif);
        socket.off("TENANT_DELETED", handleRealtimeNotif);
        socket.off("NOTIFICATION_CREATED", handleRealtimeNotif);
        socket.off("TENANT_OVERDUE", handleRealtimeNotif);
      };
    }
  }, [socket, queryClient, workspaceId]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
      ]);
      queryClient.setQueryData<Notification[]>(["notifications"], (old) =>
        old?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["notifications"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
      ]);
      queryClient.setQueryData<Notification[]>(["notifications"], (old) =>
        old?.map((n) => ({ ...n, isRead: true })),
      );
      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["notifications"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAsRead = (id: string) => markAsReadMutation.mutate(id);
  const markAllRead = () => markAllReadMutation.mutate();

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "PAYMENT_SUBMITTED":
        return <FileCheck className="w-4 h-4 text-primary" />;
      case "PAYMENT_APPROVED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "PAYMENT_REJECTED":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "MAINTENANCE_CREATED":
        return <Wrench className="w-4 h-4 text-amber-500" />;
      case "TENANT_LEASE_EXPIRING":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "PAYMENT_OVERDUE":
        return <ShieldAlert className="w-4 h-4 text-destructive" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "properties", label: "Properties", icon: Building2 },
    { id: "tenants", label: "Tenants", icon: Users, managerOnly: true },
    { id: "owners", label: "Owners", icon: UserCheck, managerOnly: true },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "occupancy", label: "Occupancy", icon: CalendarRange },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "settings", label: "Settings", icon: Settings, managerOnly: true },
  ];

  const filteredItems = isSuperAdmin
    ? []
    : navItems.filter((item) => !item.managerOnly || isPropertyManager);

  const adminItems = [
    { id: "admin-overview", label: "Overview", icon: Activity },
    { id: "admin-users", label: "Users", icon: Users },
    { id: "admin-workspaces", label: "Workspaces", icon: Building2 },
    { id: "admin-upgrades", label: "Upgrade Requests", icon: TrendingUp },
    { id: "admin-errors", label: "System Logs", icon: AlertOctagon },
    { id: "admin-payments", label: "Payments", icon: DollarSign },
    { id: "admin-security", label: "Security & MFA", icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Menu Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-md bg-white dark:bg-background border border-border shadow-sm text-foreground active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-background border-r border-border transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Header/Logo Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <img src="/images/assets/logo.png" alt="PropertyStack Logo" className="h-8 w-auto" />
              <span className="font-bold text-lg tracking-tight whitespace-nowrap bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500 bg-clip-text text-transparent">
                PropertyStack
              </span>
            </div>
          )}
          <div className={cn("hidden lg:block", isCollapsed && "mx-auto")}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md hover:bg-secondary dark:hover:bg-card transition-colors text-muted-foreground hover:text-foreground dark:hover:text-zinc-200"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md hover:bg-secondary dark:hover:bg-card text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 custom-scrollbar">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id as DashboardView);
                  if (isMobileOpen) setIsMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                    isActive ? "scale-100" : "group-hover:scale-110",
                  )}
                />
                {!isCollapsed && (
                  <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                )}
                {/* Show badge on Payments nav for payments UNDER_REVIEW */}
                {item.id === "payments" &&
                  !isCollapsed &&
                  stats?.underReviewPayments > 0 && (
                    <span className="ml-auto bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                      {stats.underReviewPayments}
                    </span>
                  )}
                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md" />
                )}
              </button>
            );
          })}

          {isSuperAdmin && (
            <div className="mt-6 pt-4 border-t border-border/80">
              <p className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
                Super Admin Console
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onViewChange(item.id as DashboardView);
                      if (isMobileOpen) setIsMobileOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-sm",
                      isActive
                        ? "bg-primary/10 text-primary font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground dark:hover:text-zinc-200 hover:bg-muted/50 dark:hover:bg-zinc-800/30",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                        isActive ? "scale-100" : "group-hover:scale-115",
                      )}
                    />
                    {!isCollapsed && (
                      <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.label}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Notification Bell */}
          {!isSuperAdmin && (
            <div
              ref={notifRef}
              className="relative mt-4 pt-4 border-t border-border"
            >
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                "text-muted-foreground hover:text-foreground dark:hover:text-zinc-200 hover:bg-secondary dark:hover:bg-card",
              )}
            >
              <div className="relative">
                <Bell className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                  Notifications
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div
                className={cn(
                  "absolute z-[60] bg-white dark:bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200",
                  isCollapsed
                    ? "left-full ml-2 top-0 w-80"
                    : "left-0 bottom-full mb-2 w-full",
                )}
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h4 className="text-sm font-bold text-foreground">
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] font-bold text-primary hover:text-primary uppercase tracking-wider"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.type === "PAYMENT_SUBMITTED") {
                            onViewChange("payments");
                          } else if (n.type === "MAINTENANCE_CREATED") {
                            onViewChange("maintenance");
                          } else if (
                            n.type === "PAYMENT_APPROVED" ||
                            n.type === "PAYMENT_REJECTED"
                          ) {
                            onViewChange("payments");
                          }
                          setSelectedNotification(n);
                          setShowNotifications(false);
                        }}
                        className={cn(
                          "flex items-start gap-3 p-3.5 border-b border-zinc-50 dark:border-zinc-900 transition-colors cursor-pointer",
                          !n.isRead
                            ? "bg-primary/5/50 dark:bg-blue-950/10 hover:bg-primary/5 dark:hover:bg-blue-950/20"
                            : "hover:bg-secondary/50 dark:hover:bg-card/50",
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-xs truncate",
                              !n.isRead
                                ? "font-bold text-foreground"
                                : "font-medium text-muted-foreground",
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">
                            {new Date(n.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {!n.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </nav>

        {/* Bottom Actions/Footer */}
        <div className="p-4 border-t border-border bg-secondary/50/50 dark:bg-card/20">
          {!isCollapsed && userEmail && (
            <div className="px-3 py-3 mb-4 bg-card rounded-xl border border-border/60 shadow-sm transition-all">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Profile
                </p>
                {plan && (
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight",
                      plan === "PRO"
                        ? "bg-primary/10 text-primary dark:bg-indigo-900/40 dark:text-indigo-300"
                        : plan === "ENTERPRISE"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-secondary text-muted-foreground dark:bg-secondary dark:text-muted-foreground",
                    )}
                  >
                    {plan}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold truncate text-foreground dark:text-zinc-200">
                {userEmail}
              </p>
            </div>
          )}

          <div className={cn("space-y-1.5", isCollapsed ? "items-center" : "")}>
            <div
              className={cn(
                "flex items-center gap-2 px-1",
                isCollapsed ? "justify-center" : "",
              )}
            >
              <ThemeToggle />
              {!isCollapsed && (
                <span className="text-sm font-medium text-muted-foreground">
                  Appearance
                </span>
              )}
            </div>

            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all duration-200 group active:scale-[0.98]",
                isCollapsed && "justify-center",
              )}
            >
              <LogOut className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              {!isCollapsed && (
                <span className="font-medium text-sm">Sign out</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Notification Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedNotification(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/50/50 dark:bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-secondary border border-border dark:border-zinc-700 flex items-center justify-center shadow-sm">
                  {getNotifIcon(selectedNotification.type)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg leading-tight">
                    Notification
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                    {new Date(selectedNotification.createdAt).toLocaleString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-2 rounded-xl hover:bg-secondary dark:hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <h4 className="text-xl font-bold text-foreground mb-3">
                {selectedNotification.title}
              </h4>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base whitespace-pre-wrap">
                {selectedNotification.message}
              </p>
            </div>

            {/* Footer */}
            <div className="p-6 bg-secondary/50 dark:bg-card/50 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-6 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 font-bold text-sm shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
              >
                Close
              </button>
              {(selectedNotification.type === "PAYMENT_SUBMITTED" || 
                selectedNotification.type === "PAYMENT_APPROVED" || 
                selectedNotification.type === "PAYMENT_REJECTED") && (
                <button
                  onClick={() => {
                    onViewChange("payments");
                    setSelectedNotification(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  Go to Payments
                </button>
              )}
              {selectedNotification.type === "MAINTENANCE_CREATED" && (
                <button
                  onClick={() => {
                    onViewChange("maintenance");
                    setSelectedNotification(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  View Maintenance
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsLogoutModalOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex flex-col items-center justify-center pt-8 pb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-bold text-foreground text-xl">
                Sign Out
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 pb-6 text-center">
              <p className="text-muted-foreground text-sm">
                Are you sure you want to sign out? You will need to log back in
                to access your dashboard.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 bg-secondary/50 dark:bg-card/50 border-t border-border flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white dark:bg-secondary text-foreground border border-border dark:border-zinc-700 font-bold text-sm shadow-sm hover:bg-secondary/50 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm shadow-sm hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
        }
      `}</style>
    </>
  );
}
