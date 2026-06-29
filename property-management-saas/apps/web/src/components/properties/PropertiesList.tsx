"use client";

import * as React from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import {
  Building,
  Home,
  Layout,
  Square,
  Layers,
  Grid,
  Box,
  User,
  MoreHorizontal,
  Plus,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  UserCircle,
  AlertCircle,
  X,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  Users,
  UploadCloud,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ExportButton } from "@/components/shared/ExportButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Lease {
  id: string;
  yearlyRent: number;
  tenant: { id: string; name: string };
  unit: { id: string; unitNumber: string } | null;
}

interface Unit {
  id: string;
  unitNumber: string;
  type: string;
  status: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  imageUrl?: string | null;
  owner?: { name?: string; email: string };
  units?: Unit[];
  leases?: Lease[];
}

// Curated set of realistic property photos for placeholders
const PROPERTY_IMAGES = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=400&fit=crop",
];

function getPropertyImage(propertyId: string): string {
  // Deterministic image selection based on property ID
  let hash = 0;
  for (let i = 0; i < propertyId.length; i++) {
    hash = (hash << 5) - hash + propertyId.charCodeAt(i);
    hash |= 0;
  }
  return PROPERTY_IMAGES[Math.abs(hash) % PROPERTY_IMAGES.length];
}

function getPropertyStatus(property: Property): {
  label: string;
  color: string;
} {
  const totalUnits = property.units?.length || 0;
  const occupiedUnits =
    property.units?.filter((u) => u.status === "OCCUPIED").length || 0;

  if (totalUnits === 0)
    return {
      label: "No Units",
      color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400",
    };
  if (occupiedUnits === totalUnits)
    return {
      label: "Fully Occupied",
      color:
        "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
    };
  if (occupiedUnits === 0)
    return {
      label: "100% Vacant",
      color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400",
    };
  return {
    label: "Partially Vacant",
    color:
      "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
  };
}

function getTotalRent(property: Property): number {
  return property.leases?.reduce((sum, l) => sum + (l.yearlyRent || 0), 0) || 0;
}

function getUniqueTenants(property: Property): string[] {
  const tenantNames = property.leases?.map((l) => l.tenant.name) || [];
  return [...new Set(tenantNames)];
}

const propertyTypeConfig: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  ROOM_SELF_CONTAIN: {
    label: "Self-Contain",
    icon: Layout,
    description: "Single room + utilities",
  },
  MINI_FLAT: {
    label: "Mini Flat",
    icon: Square,
    description: "1 Bedroom + Parlour",
  },
  ROOM_PARLOUR_SELF_CONTAIN: {
    label: "R&P S/C",
    icon: Box,
    description: "Room & Parlour",
  },
  SINGLE_ROOM: {
    label: "Single Room",
    icon: User,
    description: "Basic single room",
  },
  TWO_BEDROOM_FLAT: {
    label: "2-Bed Flat",
    icon: Layers,
    description: "Spacious family flat",
  },
  THREE_BEDROOM_FLAT: {
    label: "3-Bed Flat",
    icon: Grid,
    description: "Large luxury flat",
  },
  DUPLEX: { label: "Duplex", icon: Home, description: "Two-story building" },
  OTHERS: {
    label: "Others",
    icon: MoreHorizontal,
    description: "Custom unit type",
  },
};

type ViewMode = "grid" | "list";

export function PropertiesList({
  workspaceId,
  onPropertiesLoaded,
  isPropertyManager = true,
  plan,
}: {
  workspaceId: string;
  onPropertiesLoaded?: (props: Property[]) => void;
  isPropertyManager?: boolean;
  plan?: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [propertyToDelete, setPropertyToDelete] =
    React.useState<Property | null>(null);
  const [propertyToReassign, setPropertyToReassign] =
    React.useState<Property | null>(null);
  const [propertyToAddUnits, setPropertyToAddUnits] =
    React.useState<Property | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [locationFilter, setLocationFilter] = React.useState("all");

  const { data: properties = [], isLoading: loading } = useQuery<Property[]>({
    queryKey: ["properties", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(`/api/workspaces/${workspaceId}/properties`, {
        credentials: "include",
      });
      const props = data.properties || [];
      if (onPropertiesLoaded) onPropertiesLoaded(props);
      return props;
    },
    enabled: !!workspaceId,
  });

  const { data: owners = [] } = useQuery<
    { id: string; name: string; email: string }[]
  >({
    queryKey: ["owners", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(`/api/workspaces/${workspaceId}/owners`, {
        credentials: "include",
      });
      return data.owners || [];
    },
    enabled: !!workspaceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await apiFetch(
        `/api/workspaces/${workspaceId}/properties/${propertyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      setPropertyToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["properties", workspaceId] });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({
      propertyId,
      ownerId,
    }: {
      propertyId: string;
      ownerId: string;
    }) => {
      const property = properties.find((p) => p.id === propertyId);
      if (!property) throw new Error("Property not found");
      await apiFetch(
        `/api/workspaces/${workspaceId}/properties/${propertyId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: property.name,
            address: property.address,
            ownerId: ownerId || null,
          }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      setPropertyToReassign(null);
      queryClient.invalidateQueries({ queryKey: ["properties", workspaceId] });
    },
  });

  const handleDeleteProperty = (propertyId: string) =>
    deleteMutation.mutate(propertyId);
  const handleReassignProperty = (propertyId: string, ownerId: string) =>
    reassignMutation.mutate({ propertyId, ownerId });

  const addUnitsMutation = useMutation({
    mutationFn: async ({
      propertyId,
      units,
    }: {
      propertyId: string;
      units: { unitNumber: string; type: string }[];
    }) => {
      await apiFetch(
        `/api/workspaces/${workspaceId}/properties/${propertyId}/units`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ units }),
          credentials: "include",
        },
      );
    },
    onSuccess: () => {
      setPropertyToAddUnits(null);
      queryClient.invalidateQueries({ queryKey: ["properties", workspaceId] });
      toast.success("Apartment units added successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add units");
    },
  });

  const deleting = deleteMutation.isPending;
  const reassigning = reassignMutation.isPending;

  // Derive unique locations for the filter dropdown
  const uniqueLocations = React.useMemo(() => {
    const locations = properties.map((p) => {
      // Extract city/area from address (take first meaningful part)
      const parts = p.address.split(",").map((s) => s.trim());
      return parts[0] || p.address;
    });
    return [...new Set(locations)];
  }, [properties]);

  // Filter properties
  const filteredProperties = React.useMemo(() => {
    return properties.filter((p) => {
      const matchesSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === "all" || p.units?.some((u) => u.type === typeFilter);

      const matchesLocation =
        locationFilter === "all" ||
        p.address.toLowerCase().includes(locationFilter.toLowerCase());

      return matchesSearch && matchesType && matchesLocation;
    });
  }, [properties, searchQuery, typeFilter, locationFilter]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">
          Loading your properties...
        </p>
      </div>
    );

  return (
    <>
      <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Property
              </h3>
            </div>
            {isPropertyManager && (
              <div className="flex items-center gap-3">
                <ExportButton
                  workspaceId={workspaceId}
                  type="properties"
                  plan={plan}
                />
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="group relative flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] transition-all active:scale-95"
                >
                  {showForm ? (
                    "Cancel"
                  ) : (
                    <>
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />{" "}
                      Add Properties
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">Type: All Properties</option>
                {Object.entries(propertyTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* Location Filter */}
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">Location: All</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* View Toggles */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 ml-0 sm:ml-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <PropertyForm
              workspaceId={workspaceId}
              onComplete={() => setShowForm(false)}
              onClose={() => setShowForm(false)}
            />
          )}
        </AnimatePresence>

        {filteredProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
            <Building className="w-12 h-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium text-center px-4">
              {properties.length === 0 ? (
                <>
                  No properties found in this workspace. <br />
                  {isPropertyManager &&
                    "Get started by creating your first property."}
                </>
              ) : (
                "No properties match your current filters."
              )}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* ===== GRID VIEW ===== */
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProperties.map((p, idx) => (
              <PropertyGridCard
                key={p.id}
                property={p}
                index={idx}
                isPropertyManager={isPropertyManager}
                onDelete={() => setPropertyToDelete(p)}
                onReassign={() => setPropertyToReassign(p)}
                onAddUnits={() => setPropertyToAddUnits(p)}
              />
            ))}
          </div>
        ) : (
          /* ===== LIST VIEW ===== */
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-[80px_1.5fr_1fr_1fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <div></div>
              <div>Model Name</div>
              <div>Location</div>
              <div>Rent</div>
              <div>Asset</div>
              <div>Tenants</div>
              <div>Status</div>
            </div>
            {/* Table Rows */}
            {filteredProperties.map((p, idx) => (
              <PropertyListRow
                key={p.id}
                property={p}
                index={idx}
                isPropertyManager={isPropertyManager}
                onDelete={() => setPropertyToDelete(p)}
                onReassign={() => setPropertyToReassign(p)}
                onAddUnits={() => setPropertyToAddUnits(p)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {propertyToDelete && (
          <DeleteConfirmationModal
            property={propertyToDelete}
            isDeleting={deleting}
            onConfirm={() => handleDeleteProperty(propertyToDelete.id)}
            onClose={() => setPropertyToDelete(null)}
          />
        )}
        {propertyToReassign && (
          <ReassignOwnerModal
            property={propertyToReassign}
            owners={owners}
            isReassigning={reassigning}
            onConfirm={(ownerId) =>
              handleReassignProperty(propertyToReassign.id, ownerId)
            }
            onClose={() => setPropertyToReassign(null)}
          />
        )}
        {propertyToAddUnits && (
          <AddUnitsModal
            property={propertyToAddUnits}
            isSaving={addUnitsMutation.isPending}
            onConfirm={(units) =>
              addUnitsMutation.mutate({
                propertyId: propertyToAddUnits.id,
                units,
              })
            }
            onClose={() => setPropertyToAddUnits(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   GRID VIEW CARD
   ============================================================ */
function PropertyGridCard({
  property,
  index,
  isPropertyManager,
  onDelete,
  onReassign,
  onAddUnits,
}: {
  property: Property;
  index: number;
  isPropertyManager: boolean;
  onDelete: () => void;
  onReassign: () => void;
  onAddUnits: () => void;
}) {
  const status = getPropertyStatus(property);
  const totalRent = getTotalRent(property);
  const tenants = getUniqueTenants(property);
  const unitCount = property.units?.length || 0;
  const image = property.imageUrl || getPropertyImage(property.id);

  return (
    <div
      className="group border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Property Image */}
      <div className="relative h-[180px] overflow-hidden">
        <img
          src={image}
          alt={property.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Location & Rent overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end justify-between">
          <div className="flex items-center gap-1 text-white/90 text-[11px] font-medium">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[140px]">
              {property.address.split(",")[0]}
            </span>
          </div>
          {totalRent > 0 && (
            <span className="text-white text-[11px] font-bold bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-md">
              ₦{totalRent.toLocaleString()}/Flat
            </span>
          )}
        </div>

        {/* Delete button */}
        {isPropertyManager && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-3 right-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-zinc-500 hover:text-rose-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
            title="Delete Property"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-bold text-[15px] text-zinc-900 dark:text-white leading-tight mb-3 line-clamp-1">
          {property.name}
        </h4>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Building className="w-3.5 h-3.5" />
            <span>
              {unitCount} {unitCount === 1 ? "Apartment" : "Apartments"}
            </span>
          </div>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide ${status.color}`}
          >
            {status.label}
          </span>
        </div>

        {/* Tenant Row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>Tenants</span>
          </div>
          {tenants.length > 0 ? (
            <div className="flex -space-x-2">
              {tenants.slice(0, 3).map((name, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-primary/10 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[9px] font-bold text-primary"
                  title={name}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              ))}
              {tenants.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                  +{tenants.length - 3}
                </div>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400 italic">No tenants</span>
          )}
        </div>

        {isPropertyManager && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddUnits();
            }}
            className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 text-[11px] font-bold text-zinc-755 dark:text-zinc-300 transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-450" />
            Add Apartment
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LIST VIEW ROW
   ============================================================ */
function PropertyListRow({
  property,
  index,
  isPropertyManager,
  onDelete,
  onReassign,
  onAddUnits,
}: {
  property: Property;
  index: number;
  isPropertyManager: boolean;
  onDelete: () => void;
  onReassign: () => void;
  onAddUnits: () => void;
}) {
  const status = getPropertyStatus(property);
  const totalRent = getTotalRent(property);
  const tenants = getUniqueTenants(property);
  const unitCount = property.units?.length || 0;
  const image = property.imageUrl || getPropertyImage(property.id);

  return (
    <div className="group grid grid-cols-[80px_1.5fr_1fr_1fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-4 items-center border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
      {/* Thumbnail */}
      <div className="w-[64px] h-[48px] rounded-xl overflow-hidden">
        <img
          src={image}
          alt={property.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Name */}
      <div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-0.5">
          Model Name
        </div>
        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
          {property.name}
        </p>
      </div>

      {/* Location */}
      <div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-0.5">
          Location
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 truncate">
          {property.address.split(",")[0]}
        </p>
      </div>

      {/* Rent */}
      <div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-0.5">
          Rent
        </div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {totalRent > 0 ? `₦${totalRent.toLocaleString()}/Flat` : "—"}
        </p>
      </div>

      {/* Asset (Units) */}
      <div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-0.5">
          Asset
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {unitCount} {unitCount === 1 ? "Apartment" : "Apartments"}
        </p>
      </div>

      {/* Tenants */}
      <div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-0.5">
          Tenants
        </div>
        {tenants.length > 0 ? (
          <div className="flex -space-x-1.5">
            {tenants.slice(0, 3).map((name, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-primary/10 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[9px] font-bold text-primary"
                title={name}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            ))}
            {tenants.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                +{tenants.length - 3}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400 italic">—</span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide ${status.color}`}
        >
          {status.label}
        </span>
        {isPropertyManager && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddUnits();
              }}
              className="text-zinc-400 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/60 opacity-0 group-hover:opacity-100"
              title="Add Apartments"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-zinc-400 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100"
              title="Delete Property"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DELETE CONFIRMATION MODAL
   ============================================================ */
function DeleteConfirmationModal({
  property,
  isDeleting,
  onConfirm,
  onClose,
}: {
  property: Property;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const isConfirmed = confirmName === property.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl text-zinc-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Delete Property?
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
            This action is{" "}
            <span className="text-rose-500 font-bold uppercase tracking-tight">
              permanent
            </span>
            . Deleting{" "}
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              &quot;{property.name}&quot;
            </span>{" "}
            will also remove all associated units, leases, and payment history.
          </p>

          <div className="space-y-4 mb-8">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">
              Type property name to confirm
            </label>
            <input
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={property.name}
              className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:focus:ring-rose-400/50 transition-all font-medium text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              disabled={!isConfirmed || isDeleting}
              onClick={onConfirm}
              className={`w-full py-4 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isConfirmed && !isDeleting
                  ? "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-rose-500/25"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? "Deleting..." : "Permanently Delete Property"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-bold text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="h-1.5 bg-rose-600 dark:bg-rose-500 w-full" />
      </motion.div>
    </div>
  );
}

/* ============================================================
   PROPERTY FORM
   ============================================================ */
function ImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { signedUrl, publicUrl } = await apiFetch(
        "/api/uploads/presigned-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          credentials: "include",
        },
      );

      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      onChange(publicUrl);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 bg-zinc-50 dark:bg-zinc-900/50 text-center hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-500">Uploading...</p>
        </div>
      ) : value ? (
        <div className="relative h-32 rounded-xl overflow-hidden shadow-sm">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-xs font-bold flex items-center gap-1">
              <UploadCloud className="w-3 h-3" /> Change
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Click or drag property photo
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              High-quality JPG or PNG
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyForm({
  workspaceId,
  onComplete,
  onClose,
}: {
  workspaceId: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    name: "",
    address: "",
    ownerId: "",
    imageUrl: "",
  });
  const [units, setUnits] = React.useState<
    { unitNumber: string; type: string }[]
  >([]);

  const { data: owners = [] } = useQuery<
    { id: string; name: string; email: string }[]
  >({
    queryKey: ["owners", workspaceId],
    queryFn: async () => {
      const data = await apiFetch(`/api/workspaces/${workspaceId}/owners`, {
        credentials: "include",
      });
      return data.owners || [];
    },
    enabled: !!workspaceId,
  });

  const addUnit = () =>
    setUnits([...units, { unitNumber: "", type: "MINI_FLAT" }]);
  const removeUnit = (index: number) =>
    setUnits(units.filter((_, i) => i !== index));
  const updateUnit = (index: number, field: string, value: string) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        units,
        ownerId: formData.ownerId || undefined,
        imageUrl: formData.imageUrl || undefined,
      };
      await apiFetch(`/api/workspaces/${workspaceId}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties", workspaceId] });
      onComplete();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };
  const loading = createMutation.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%", opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md bg-zinc-50 dark:bg-zinc-950 h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h4 className="text-lg font-bold text-zinc-900 dark:text-white">
              Create Property
            </h4>
            <p className="text-xs text-zinc-500">
              Add a new building to your portfolio
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Card 1: Image Upload */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Property Photo
            </h5>
            <ImageUploader
              value={formData.imageUrl}
              onChange={(url) => setFormData({ ...formData, imageUrl: url })}
            />
          </div>

          {/* Card 2: Property Details */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
              Details
            </h5>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500">
                Property Name
              </label>
              <input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-primary/30 text-sm"
                placeholder="e.g. Skyline Towers"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500">
                Address
              </label>
              <input
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-primary/30 text-sm"
                placeholder="Physical location..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500">
                Assign Landlord
              </label>
              <select
                value={formData.ownerId}
                onChange={(e) =>
                  setFormData({ ...formData, ownerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-primary/30 text-sm appearance-none"
              >
                <option value="">No Landlord (Internal)</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 3: Unit Configuration */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Units
              </h5>
              <button
                type="button"
                onClick={addUnit}
                className="flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {units.map((unit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                >
                  <div className="w-16">
                    <input
                      required
                      value={unit.unitNumber}
                      onChange={(e) =>
                        updateUnit(index, "unitNumber", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-primary/20 bg-white dark:bg-zinc-900"
                      placeholder="A1"
                    />
                  </div>
                  <div className="flex-1">
                    <select
                      value={unit.type}
                      onChange={(e) =>
                        updateUnit(index, "type", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-primary/20 bg-white dark:bg-zinc-900 appearance-none"
                    >
                      {Object.entries(propertyTypeConfig).map(
                        ([key, config]) => (
                          <option key={key} value={key}>
                            {config.label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUnit(index)}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {units.length === 0 && (
                <p className="text-[10px] text-zinc-500 text-center py-4 italic">
                  No units added. Tracked as a single property.
                </p>
              )}
            </div>
          </div>

          {/* Spacer to ensure scrolling past the footer */}
          <div className="h-10" />
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 sticky bottom-0 z-10">
          <button
            disabled={loading}
            onClick={handleSubmit}
            className="w-full bg-primary text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Creating..." : "Save Property"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ============================================================
   REASSIGN OWNER MODAL
   ============================================================ */
function ReassignOwnerModal({
  property,
  owners,
  isReassigning,
  onConfirm,
  onClose,
}: {
  property: Property;
  owners: { id: string; name: string; email: string }[];
  isReassigning: boolean;
  onConfirm: (ownerId: string) => void;
  onClose: () => void;
}) {
  const [selectedOwnerId, setSelectedOwnerId] = React.useState(
    property.owner?.email || "",
  );

  // Find owner by ID if possible, but the owner object in property might only have email
  // Let's use the actual owner ID if it exists
  React.useEffect(() => {
    const owner = owners.find((o) => o.email === property.owner?.email);
    if (owner) setSelectedOwnerId(owner.id);
  }, [property.owner, owners]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xl font-bold">Assign Landlord</h4>
            <p className="text-sm text-zinc-500 mt-1">
              Assign &quot;{property.name}&quot; to an owner
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">
              Select New Landlord
            </label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-medium appearance-none"
            >
              <option value="">No Landlord (Unassigned)</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} - {o.email}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Changing the landlord will update who receives payouts and can
              manage units for this property.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            disabled={isReassigning}
            onClick={() => onConfirm(selectedOwnerId)}
            className="w-full bg-primary text-white py-3.5 rounded-full text-sm font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isReassigning ? "Updating..." : "Confirm Assignment"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ============================================================
   ADD APARTMENTS / UNITS MODAL
   ============================================================ */
function AddUnitsModal({
  property,
  isSaving,
  onConfirm,
  onClose,
}: {
  property: Property;
  isSaving: boolean;
  onConfirm: (units: { unitNumber: string; type: string }[]) => void;
  onClose: () => void;
}) {
  const [units, setUnits] = React.useState<{ unitNumber: string; type: string }[]>([
    { unitNumber: "", type: "MINI_FLAT" },
  ]);

  const addUnit = () =>
    setUnits([...units, { unitNumber: "", type: "MINI_FLAT" }]);

  const removeUnit = (index: number) =>
    setUnits(units.filter((_, i) => i !== index));

  const updateUnit = (index: number, field: string, value: string) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const handleSave = () => {
    const invalid = units.some((u) => !u.unitNumber.trim());
    if (invalid) {
      toast.error("Please fill in all unit numbers");
      return;
    }
    onConfirm(units);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 flex justify-between items-center border-b border-zinc-150 dark:border-zinc-900">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Add Apartments / Units
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Adding units to {property.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {property.units && property.units.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Existing Units ({property.units.length})
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto border border-zinc-200/60 dark:border-zinc-800 p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                {property.units.map((u) => (
                  <span key={u.id} className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/40">
                    Unit {u.unitNumber}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                New Units to Add
              </label>
              <button
                type="button"
                onClick={addUnit}
                className="flex items-center gap-1 text-[10px] font-black text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </div>

            <div className="space-y-2">
              {units.map((unit, index) => (
                <div key={index} className="flex gap-2.5 items-center">
                  <div className="flex-1">
                    <input
                      required
                      placeholder="Unit Number (e.g. A1)"
                      value={unit.unitNumber}
                      onChange={(e) => updateUnit(index, "unitNumber", e.target.value)}
                      className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <select
                      value={unit.type}
                      onChange={(e) => updateUnit(index, "type", e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer"
                    >
                      {Object.entries(propertyTypeConfig).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                  {units.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUnit(index)}
                      className="p-2 text-zinc-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-150 dark:border-zinc-900 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Saving..." : "Add Apartments"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
