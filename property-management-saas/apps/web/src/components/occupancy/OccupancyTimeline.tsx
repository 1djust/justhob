"use client";

import * as React from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  User
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { TimelineLeaseModal } from "./TimelineLeaseModal";
import { TimelineCreateLeaseModal } from "./TimelineCreateLeaseModal";

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Lease {
  id: string;
  startDate: string;
  endDate?: string;
  status: string;
  tenant: Tenant;
}

interface Unit {
  id: string;
  unitNumber: string;
  leases: Lease[];
}

interface Property {
  id: string;
  name: string;
  units: Unit[];
}

interface TimelineResponse {
  properties: Property[];
  year: number;
}

export function OccupancyTimeline({ workspaceId }: { workspaceId: string }) {
  const [targetYear, setTargetYear] = React.useState(new Date().getFullYear());
  const [selectedLease, setSelectedLease] = React.useState<Lease | null>(null);
  const [newLeaseState, setNewLeaseState] = React.useState<{
    unitId: string;
    propertyId: string;
    startDate: string;
  } | null>(null);

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: ["timeline", workspaceId, targetYear],
    queryFn: async () => {
      return apiFetch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/timeline?year=${targetYear}`,
        { credentials: "include" }
      );
    },
    enabled: !!workspaceId,
  });

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Helper to calculate left position and width of a lease block
  const getLeaseStyle = (startDateStr: string, endDateStr?: string | null) => {
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date(targetYear, 11, 31);
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

    // Clamp dates to the current viewing year
    const effectiveStart = start < yearStart ? yearStart : start;
    const effectiveEnd = end > yearEnd ? yearEnd : end;

    const msInYear = yearEnd.getTime() - yearStart.getTime();
    const startOffsetMs = effectiveStart.getTime() - yearStart.getTime();
    const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();

    const left = (startOffsetMs / msInYear) * 100;
    const width = (durationMs / msInYear) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0, width)}%`,
    };
  };

  // Helper to get today's line position
  const getNowLineStyle = () => {
    const now = new Date();
    if (now.getFullYear() !== targetYear) return { display: "none" };
    
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);
    const msInYear = yearEnd.getTime() - yearStart.getTime();
    const offset = now.getTime() - yearStart.getTime();
    
    return { left: `${(offset / msInYear) * 100}%` };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-primary text-white border-primary/20";
      case "PENDING_RENEWAL": return "bg-amber-500 text-white border-amber-600/20";
      default: return "bg-zinc-500 text-white border-zinc-600/20";
    }
  };

  // Generate distinct colors for overlapping or multiple tenants if needed
  const blockColors = [
    "bg-indigo-600 text-white",
    "bg-sky-600 text-white",
    "bg-cyan-600 text-white",
    "bg-teal-600 text-white",
    "bg-blue-600 text-white",
  ];

  if (isLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="font-medium animate-pulse text-sm">Loading timeline...</p>
        </div>
      </div>
    );
  }

  const properties = data?.properties || [];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#060B19] rounded-2xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Occupancy Timeline</h2>
            <p className="text-sm text-zinc-500 font-medium">Room availability & lease overview</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTargetYear(y => y - 1)}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="px-6 py-2 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-primary/20">
            {targetYear}
          </div>
          
          <button 
            onClick={() => setTargetYear(y => y + 1)}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
        <div className="min-w-[1200px] h-full flex flex-col relative pb-10">
          
          {/* Months Header Row */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800/60 sticky top-0 z-20 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-sm">
            <div className="w-64 flex-shrink-0 p-4 border-r border-zinc-100 dark:border-zinc-800/60">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Properties & Units</span>
            </div>
            <div className="flex-1 flex relative">
              {months.map((month, i) => (
                <div key={month} className="flex-1 text-center py-4 border-r border-zinc-100 dark:border-zinc-800/60 last:border-0 relative">
                  <span className="text-xs font-bold text-zinc-500">{month}</span>
                </div>
              ))}
              
              {/* "Now" Marker Line inside Header */}
              {targetYear === new Date().getFullYear() && (
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-blue-500 z-30"
                  style={getNowLineStyle()}
                >
                  <div className="absolute -top-3 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    Now
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grid Area with "Now" Line spanning height */}
          <div className="flex flex-1 relative min-h-[400px]">
             {/* "Now" Vertical Guide Line */}
             {targetYear === new Date().getFullYear() && (
                <div 
                  className="absolute top-0 bottom-0 w-[1px] bg-blue-500/50 z-10 border-l border-dashed border-blue-500"
                  style={{ ...getNowLineStyle(), marginLeft: '16rem' /* offset for sidebar */ }}
                />
             )}

            {/* Background Grid Columns */}
            <div className="absolute top-0 bottom-0 left-64 right-0 flex pointer-events-none z-0">
              {months.map((month) => (
                <div key={month} className="flex-1 border-r border-zinc-50 dark:border-zinc-800/30 last:border-0" />
              ))}
            </div>

            {/* Rows (Properties and Units) */}
            <div className="w-full flex flex-col z-10">
              {properties.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8 text-zinc-400 text-sm font-medium">
                  No properties found for {targetYear}.
                </div>
              ) : (
                properties.map((property) => (
                  <div key={property.id} className="flex flex-col">
                    {/* Property Header Row */}
                    <div className="flex border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
                      <div className="w-64 flex-shrink-0 p-4 border-r border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2">
                         <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-3 h-3 text-zinc-500" />
                         </div>
                         <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{property.name}</span>
                      </div>
                      <div className="flex-1" /> {/* Empty timeline space for property row */}
                    </div>

                    {/* Unit Rows */}
                    {property.units.map((unit, uIdx) => (
                      <div key={unit.id} className="flex border-b border-zinc-100 dark:border-zinc-800/60 relative hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors group">
                        
                        {/* Left Sidebar Label */}
                        <div className="w-64 flex-shrink-0 py-5 px-4 pl-10 border-r border-zinc-100 dark:border-zinc-800/60 flex flex-col justify-center">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            Unit {unit.unitNumber}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-400 truncate">
                            {property.name}
                          </span>
                        </div>

                        {/* Timeline Area for this Unit */}
                        <div 
                          className="flex-1 relative py-2 px-1 cursor-crosshair"
                          onClick={(e) => {
                            // Calculate clicked date
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percentage = clickX / rect.width;
                            const yearStart = new Date(targetYear, 0, 1).getTime();
                            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
                            const clickedDateMs = yearStart + (yearEnd - yearStart) * percentage;
                            const clickedDate = new Date(clickedDateMs);
                            setNewLeaseState({
                              unitId: unit.id,
                              propertyId: property.id,
                              startDate: clickedDate.toISOString().split("T")[0]
                            });
                          }}
                        >
                          {unit.leases.map((lease, i) => {
                            const style = getLeaseStyle(lease.startDate, lease.endDate);
                            const colorClass = blockColors[i % blockColors.length];
                            
                            return (
                              <div
                                key={lease.id}
                                className={`absolute top-3 bottom-3 rounded-full flex items-center px-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border ${colorClass} bg-opacity-90 dark:bg-opacity-80 border-white/10`}
                                style={style}
                                title={`${lease.tenant.name} (${new Date(lease.startDate).toLocaleDateString()} - ${lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing'})`}
                                onClick={(e) => {
                                  e.stopPropagation(); // prevent triggering unit click
                                  setSelectedLease(lease);
                                }}
                              >
                                <div className="flex items-center gap-2 truncate min-w-0 w-full">
                                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                                    <User className="w-3 h-3 text-white" />
                                  </div>
                                  <span className="text-xs font-bold text-white truncate">
                                    {lease.tenant.name}
                                  </span>
                                  {/* Date Range if width allows */}
                                  <span className="text-[10px] font-medium text-white/70 truncate ml-auto hidden sm:block">
                                    {new Date(lease.startDate).getMonth() + 1}.{new Date(lease.startDate).getDate()} - 
                                    {lease.endDate ? ` ${new Date(lease.endDate).getMonth() + 1}.${new Date(lease.endDate).getDate()}` : ' ∞'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Legend */}
      <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center gap-6">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
            <span className="text-xs font-semibold text-zinc-500">Active Lease</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-600 shadow-sm" />
            <span className="text-xs font-semibold text-zinc-500">Overlapping / Alternate</span>
         </div>
      </div>

      {selectedLease && (
        <TimelineLeaseModal
          workspaceId={workspaceId}
          lease={selectedLease}
          onClose={() => setSelectedLease(null)}
        />
      )}

      {newLeaseState && (
        <TimelineCreateLeaseModal
          workspaceId={workspaceId}
          prefillUnitId={newLeaseState.unitId}
          prefillPropertyId={newLeaseState.propertyId}
          prefillStartDate={newLeaseState.startDate}
          onClose={() => setNewLeaseState(null)}
        />
      )}
    </div>
  );
}
