'use client';

import * as React from 'react';
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
  AlertCircle
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRealtime } from '@/components/providers/RealtimeProvider';

/**
 * Utility function to merge tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DashboardView = 'dashboard' | 'properties' | 'tenants' | 'owners' | 'payments' | 'maintenance' | 'settings';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: DashboardView) => void;
  isPropertyManager: boolean;
  userEmail?: string;
  onLogout: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function Sidebar({ activeView, onViewChange, isPropertyManager, userEmail, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/notifications`, { silent: true } as any);
      setNotifications(data.notifications || []);
    } catch (e) {
      // Silent fail
    }
  }, []);

  const { socket } = useRealtime();

  React.useEffect(() => {
    fetchNotifications();
    
    if (socket) {
      const handleRealtimeNotif = () => {
        console.log('[Realtime] New notification event received');
        fetchNotifications();
      };

      socket.on('PAYMENT_SUBMITTED', handleRealtimeNotif);
      socket.on('PAYMENT_UPDATED', handleRealtimeNotif);
      socket.on('MAINTENANCE_CREATED', handleRealtimeNotif);

      return () => {
        socket.off('PAYMENT_SUBMITTED', handleRealtimeNotif);
        socket.off('PAYMENT_UPDATED', handleRealtimeNotif);
        socket.off('MAINTENANCE_CREATED', handleRealtimeNotif);
      };
    }
  }, [fetchNotifications, socket]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await apiFetch(`${API_BASE_URL}/api/notifications/read-all`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      // Silent fail
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT_SUBMITTED': return <FileCheck className="w-4 h-4 text-blue-500" />;
      case 'PAYMENT_APPROVED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'PAYMENT_REJECTED': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'tenants', label: 'Tenants', icon: Users, managerOnly: true },
    { id: 'owners', label: 'Owners', icon: UserCheck, managerOnly: true },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'settings', label: 'Settings', icon: Settings, managerOnly: true },
  ];

  const filteredItems = navItems.filter(item => !item.managerOnly || isPropertyManager);

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
          className="p-2 rounded-md bg-white dark:bg-zinc-950 border border-border shadow-sm text-foreground active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-zinc-950 border-r border-border transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header/Logo Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500 bg-clip-text text-transparent">
              Just Hub
            </span>
          )}
          <div className={cn("hidden lg:block", isCollapsed && "mx-auto")}>
             <button 
               onClick={() => setIsCollapsed(!isCollapsed)} 
               className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
               title={isCollapsed ? "Expand" : "Collapse"}
             >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
             </button>
          </div>
          <button 
            onClick={() => setIsMobileOpen(false)} 
            className="lg:hidden p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500"
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
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive 
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-transform duration-200", 
                  isActive ? "scale-100" : "group-hover:scale-110"
                )} />
                {!isCollapsed && (
                  <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                )}
                {/* Show badge on Payments nav when there are PAYMENT_SUBMITTED notifications */}
                {item.id === 'payments' && !isCollapsed && unreadCount > 0 && notifications.some(n => !n.isRead && n.type === 'PAYMENT_SUBMITTED') && (
                  <span className="ml-auto bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {notifications.filter(n => !n.isRead && n.type === 'PAYMENT_SUBMITTED').length}
                  </span>
                )}
                {/* Active Indicator Tooltip (Optional, for collapsed state) */}
                {isCollapsed && isActive && (
                   <div className="absolute left-0 w-1 h-6 bg-zinc-900 dark:bg-white rounded-r-full" />
                )}
              </button>
            );
          })}

          {/* Notification Bell */}
          <div ref={notifRef} className="relative mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
            >
              <div className="relative">
                <Bell className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">Notifications</span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className={cn(
                "absolute z-[60] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200",
                isCollapsed ? "left-full ml-2 top-0 w-80" : "left-0 bottom-full mb-2 w-full"
              )}>
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.type === 'PAYMENT_SUBMITTED') {
                            onViewChange('payments');
                            setShowNotifications(false);
                          }
                        }}
                        className={cn(
                          "flex items-start gap-3 p-3.5 border-b border-zinc-50 dark:border-zinc-900 transition-colors cursor-pointer",
                          !n.isRead
                            ? "bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0">{getNotifIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs truncate",
                            !n.isRead ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-600 dark:text-zinc-400"
                          )}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-bold">
                            {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Actions/Footer */}
        <div className="p-4 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/20">
          {!isCollapsed && userEmail && (
            <div className="px-3 py-3 mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-sm transition-all">
              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-0.5">Manager Profile</p>
              <p className="text-sm font-semibold truncate text-zinc-700 dark:text-zinc-200">{userEmail}</p>
            </div>
          )}
          
          <div className={cn("space-y-1.5", isCollapsed ? "items-center" : "")}>
            <div className={cn("flex items-center gap-2 px-1", isCollapsed ? "justify-center" : "")}>
               <ThemeToggle />
               {!isCollapsed && <span className="text-sm font-medium text-zinc-500">Appearance</span>}
            </div>
            
            <button
              onClick={onLogout}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all duration-200 group active:scale-[0.98]",
                isCollapsed && "justify-center"
              )}
            >
              <LogOut className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              {!isCollapsed && <span className="font-medium text-sm">Sign out</span>}
            </button>
          </div>
        </div>
      </aside>

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
