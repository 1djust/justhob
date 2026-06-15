"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { PropertiesList } from "@/components/properties/PropertiesList";
import { TenantsList } from "@/components/tenants/TenantsList";
import { PaymentsList } from "@/components/payments/PaymentsList";
import { MaintenanceList } from "@/components/maintenance/MaintenanceList";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { OverdueTenantsWidget } from "@/components/dashboard/OverdueTenantsWidget";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { OwnerManagement } from "@/components/owners/OwnerManagement";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { OccupancyTimeline } from "@/components/occupancy/OccupancyTimeline";
import { IdleTimeoutProvider } from "@/components/auth/IdleTimeoutProvider";
import { Plus, ShieldCheck } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  plan: string;
}

interface WorkspaceMember {
  workspace: Workspace;
  role: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  globalRole?: string;
  workspaces?: WorkspaceMember[];
  mustChangePassword?: boolean;
}

type DashboardView =
  | "dashboard"
  | "properties"
  | "tenants"
  | "owners"
  | "payments"
  | "occupancy"
  | "maintenance"
  | "settings"
  | "admin";

export default function DashboardPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const [activeView, setActiveView] =
    React.useState<DashboardView>("dashboard");
  const router = useRouter();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<
    string | null
  >(null);
  const [properties, setProperties] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [leases, setLeases] = React.useState<{ id: string }[]>([]);

  const activeRole = user?.workspaces?.find(
    (w) => w.workspace.id === selectedWorkspaceId,
  )?.role;
  const isPropertyManager = activeRole === "PROPERTY_MANAGER";

  React.useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/auth/me`)
      .then((data) => {
        if (data.user?.mustChangePassword && data.user?.role !== "PROPERTY_MANAGER") {
          router.push("/login");
          return;
        }
        setUser(data.user);
        if (data.user?.globalRole === "SUPER_ADMIN") {
          setActiveView("admin");
        }
        if (data.user?.workspaces?.length > 0) {
          const priority: Record<string, number> = {
            PROPERTY_MANAGER: 1,
            LANDLORD: 2,
            TENANT: 3,
            SUPER_ADMIN: 4,
          };
          const sortedWorkspaces = [...data.user.workspaces].sort((a, b) => {
            const pA = priority[a.role] ?? 99;
            const pB = priority[b.role] ?? 99;
            return pA - pB;
          });
          setSelectedWorkspaceId(
            (prev) => prev || sortedWorkspaces[0]?.workspace?.id || null,
          );
        }
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  React.useEffect(() => {
    if (selectedWorkspaceId) {
      // Preload properties
      apiFetch(
        `${API_BASE_URL}/api/workspaces/${selectedWorkspaceId}/properties`,
      )
        .then((data) => setProperties(data.properties || []))
        .catch((e) => console.error("Failed to preload properties:", e));

      // Preload leases
      apiFetch(`${API_BASE_URL}/api/workspaces/${selectedWorkspaceId}/leases`)
        .then((data) => setLeases(data.leases || []))
        .catch((e) => console.error("Failed to preload leases:", e));
    }
  }, [selectedWorkspaceId]);

  const handleLogout = async () => {
    await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" });
    if (typeof window !== "undefined") {
      try {
        const { supabase } = await import("@/lib/supabase");
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Local signout failed", e);
      }
    }
    router.push("/login");
  };

  const createInitialWorkspace = async () => {
    setCreatingWorkspace(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Properties" }),
      });
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="relative flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <img
            src="/images/assets/logo-loading.webp"
            alt="PropertyStack Loading..."
            className="w-20 h-20 object-contain"
          />
          <span className="text-muted-foreground font-bold tracking-widest uppercase text-[10px] animate-pulse">
            PropertyStack
          </span>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    if (activeView === "admin" && user?.globalRole === "SUPER_ADMIN") {
      return <AdminDashboard />;
    }

    if (!selectedWorkspaceId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="rounded-[2.5rem] border border-white/20 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-12 shadow-2xl text-center max-w-md w-full animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-zinc-900 dark:bg-white rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl">
              <Plus className="w-10 h-10 text-white dark:text-zinc-950" />
            </div>
            <h3 className="text-3xl font-bold mb-4 tracking-tighter text-zinc-900 dark:text-white">
              Get Started
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed font-medium">
              You need to create a Workspace to start managing your properties
              and tenants.
            </p>
            <button
              onClick={createInitialWorkspace}
              disabled={creatingWorkspace}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-8 py-4 rounded-2xl text-sm font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl"
            >
              {creatingWorkspace
                ? "Creating..."
                : 'Create "My Properties" Workspace'}
            </button>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case "dashboard":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Dashboard
              </h2>
            </div>

            <DashboardStats
              workspaceId={selectedWorkspaceId}
              userName={user?.name?.split(' ')[0] || user?.email?.split('@')[0] || "there"}
              plan={
                user?.workspaces?.find(
                  (w) => w?.workspace?.id === selectedWorkspaceId,
                )?.workspace?.plan
              }
            />

            <OverdueTenantsWidget workspaceId={selectedWorkspaceId} />

            <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    Active Workspaces
                  </h3>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-1">
                    Manage your team and roles
                  </p>
                </div>
              </div>

              <div className="relative">
                {user?.workspaces && user.workspaces.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {user.workspaces.map((member) => (
                      <div
                        key={member.workspace?.id}
                        onClick={() => {
                          setSelectedWorkspaceId(member.workspace.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`group relative flex flex-col p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          selectedWorkspaceId === member.workspace?.id
                            ? "bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-900 dark:border-zinc-700 shadow-md"
                            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div
                            className={`p-3 rounded-xl ${selectedWorkspaceId === member.workspace?.id ? "bg-white/10 text-white" : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-sm border border-zinc-200 dark:border-zinc-700"}`}
                          >
                            <img src="/images/assets/logo.png" alt="PropertyStack" className="w-5 h-5 object-contain" />
                          </div>
                          <div
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              selectedWorkspaceId === member.workspace?.id
                                ? "bg-white/20 text-white"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {member.role.replace("_", " ")}
                          </div>
                        </div>
                        <h4 className="text-lg font-bold tracking-tight mb-2">
                          {member.workspace?.name}
                        </h4>
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-medium ${selectedWorkspaceId === member.workspace?.id ? "text-zinc-400" : "text-zinc-500"}`}
                          >
                            {member.role === "PROPERTY_MANAGER"
                              ? "Full Access"
                              : "View Only"}
                          </span>
                          {selectedWorkspaceId === member.workspace?.id && (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-12 font-medium">
                    You are not a member of any workspaces yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      case "properties":
        return (
          <PropertiesList
            workspaceId={selectedWorkspaceId}
            onPropertiesLoaded={setProperties}
            isPropertyManager={isPropertyManager}
            plan={
              user?.workspaces?.find(
                (w) => w?.workspace?.id === selectedWorkspaceId,
              )?.workspace?.plan
            }
          />
        );
      case "tenants":
        return isPropertyManager ? (
          <TenantsList
            workspaceId={selectedWorkspaceId}
            properties={properties}
            onLeasesLoaded={setLeases}
          />
        ) : null;
      case "owners":
        return isPropertyManager ? (
          <OwnerManagement workspaceId={selectedWorkspaceId} />
        ) : null;
      case "payments":
        return (
          <PaymentsList
            workspaceId={selectedWorkspaceId}
            leases={leases}
            isPropertyManager={isPropertyManager}
            plan={
              user?.workspaces?.find(
                (w) => w?.workspace?.id === selectedWorkspaceId,
              )?.workspace?.plan
            }
          />
        );
      case "occupancy":
        return (
          <div className="h-[750px]">
            <OccupancyTimeline workspaceId={selectedWorkspaceId!} />
          </div>
        );
      case "maintenance":
        return (
          <MaintenanceList
            workspaceId={selectedWorkspaceId}
            isPropertyManager={isPropertyManager}
          />
        );
      case "settings":
        return isPropertyManager ? (
          <WorkspaceSettings workspaceId={selectedWorkspaceId} />
        ) : null;
      case "admin":
        return user?.globalRole === "SUPER_ADMIN" ? <AdminDashboard /> : null;
      default:
        return null;
    }
  };

  return (
    <IdleTimeoutProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          isPropertyManager={isPropertyManager}
          userEmail={user?.email}
          plan={
            user?.workspaces?.find(
              (w) => w?.workspace?.id === selectedWorkspaceId,
            )?.workspace?.plan
          }
          onLogout={handleLogout}
          workspaceId={selectedWorkspaceId}
          isSuperAdmin={user?.globalRole === "SUPER_ADMIN"}
        />

        <main className="flex-1 lg:ml-64 transition-all duration-300 min-h-screen">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </IdleTimeoutProvider>
  );
}

// aria-label
