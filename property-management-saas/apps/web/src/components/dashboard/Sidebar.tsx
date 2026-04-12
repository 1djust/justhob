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
  X
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function Sidebar({ activeView, onViewChange, isPropertyManager, userEmail, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

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
                {/* Active Indicator Tooltip (Optional, for collapsed state) */}
                {isCollapsed && isActive && (
                   <div className="absolute left-0 w-1 h-6 bg-zinc-900 dark:bg-white rounded-r-full" />
                )}
              </button>
            );
          })}
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
