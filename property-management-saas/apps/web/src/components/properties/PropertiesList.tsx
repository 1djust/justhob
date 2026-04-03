'use client';

import * as React from 'react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
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
  UserCircle
} from 'lucide-react';

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
  owner?: { name?: string; email: string };
  units?: Unit[];
}

const propertyTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  ROOM_SELF_CONTAIN: { label: 'Self-Contain', icon: Layout, description: 'Single room + utilities' },
  MINI_FLAT: { label: 'Mini Flat', icon: Square, description: '1 Bedroom + Parlour' },
  ROOM_PARLOUR_SELF_CONTAIN: { label: 'R&P S/C', icon: Box, description: 'Room & Parlour' },
  SINGLE_ROOM: { label: 'Single Room', icon: User, description: 'Basic single room' },
  TWO_BEDROOM_FLAT: { label: '2-Bed Flat', icon: Layers, description: 'Spacious family flat' },
  THREE_BEDROOM_FLAT: { label: '3-Bed Flat', icon: Grid, description: 'Large luxury flat' },
  DUPLEX: { label: 'Duplex', icon: Home, description: 'Two-story building' },
  OTHERS: { label: 'Others', icon: MoreHorizontal, description: 'Custom unit type' }
};

export function PropertiesList({ workspaceId, onPropertiesLoaded, isPropertyManager = true }: { workspaceId: string; onPropertiesLoaded?: (props: Property[]) => void; isPropertyManager?: boolean }) {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);

  const fetchProperties = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/properties`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties || []);
        onPropertiesLoaded?.(data.properties || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (workspaceId) fetchProperties();
  }, [workspaceId]);


  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-zinc-500">Loading your properties...</p>
    </div>
  );

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Properties</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage your buildings and rental units</p>
        </div>
        {isPropertyManager && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
          >
            {showForm ? 'Cancel' : <><Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Add Property</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <PropertyForm workspaceId={workspaceId} onComplete={() => { setShowForm(false); fetchProperties(); }} />
        </div>
      )}

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Building className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No properties found in this workspace. <br />
            {isPropertyManager && 'Get started by creating your first property.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p, idx) => (
            <div 
              key={p.id} 
              className="group border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl bg-white dark:bg-zinc-950 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                  <Building className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-full">
                    {p.units?.length || 0} Units
                  </span>
                </div>
              </div>

              <h4 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 leading-tight">{p.name}</h4>
              <div className="flex items-center gap-1.5 text-sm text-zinc-500 mt-2 mb-6">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{p.address}</span>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <UserCircle className="w-4 h-4 text-zinc-400" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Landlord</span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {p.owner ? (p.owner.name || p.owner.email) : 'Unassigned'}
                    </span>
                  </div>
                </div>
                
                {p.units && p.units.length > 0 && (
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto no-scrollbar">
                      {p.units.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 group/unit hover:border-zinc-400 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-950 flex items-center justify-center text-[10px] font-bold border border-zinc-100 dark:border-zinc-800">
                              {u.unitNumber}
                            </div>
                            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                              {propertyTypeConfig[u.type]?.label || u.type}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                            u.status === 'OCCUPIED' 
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50' 
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                          }`}>
                            {u.status === 'OCCUPIED' ? (
                              <><XCircle className="w-3 h-3" /> Taken</>
                            ) : (
                              <><CheckCircle2 className="w-3 h-3" /> Vacant</>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyForm({ workspaceId, onComplete }: { workspaceId: string, onComplete: () => void }) {
  const [formData, setFormData] = React.useState<{ name: string; address: string; ownerId: string }>({ 
    name: '', 
    address: '', 
    ownerId: '' 
  });
  const [units, setUnits] = React.useState<{ unitNumber: string; type: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [owners, setOwners] = React.useState<{ id: string; name: string; email: string }[]>([]);

  const addUnit = () => {
    setUnits([...units, { unitNumber: '', type: 'MINI_FLAT' }]);
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const updateUnit = (index: number, field: string, value: string) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  React.useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/owners`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : { owners: [] })
      .then(data => setOwners(data.owners || []))
      .catch(e => console.error(e));
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData, units, ownerId: formData.ownerId || undefined };
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-white dark:bg-zinc-950 shadow-2xl space-y-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 dark:bg-zinc-900/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
      
      <div className="relative">
        <h4 className="text-xl font-bold mb-1">Create New Property</h4>
        <p className="text-sm text-zinc-500">Details for the building and its apartments</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 relative">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Property Name</label>
          <input 
            required 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-medium" 
            placeholder="e.g. Skyline Towers" 
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Address</label>
          <input 
            required 
            value={formData.address} 
            onChange={e => setFormData({ ...formData, address: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-medium" 
            placeholder="Physical location..." 
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Assign Landlord</label>
          <select 
            value={formData.ownerId} 
            onChange={e => setFormData({ ...formData, ownerId: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-medium appearance-none"
          >
            <option value="">Search or select landlord...</option>
            {owners.map(o => (
              <option key={o.id} value={o.id}>{o.name} - {o.email}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-8 mt-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h5 className="text-sm font-bold uppercase tracking-widest">Units / Apartments</h5>
              <p className="text-[11px] text-zinc-500 mt-0.5">Add individual flats or rooms in this building</p>
            </div>
            <button 
              type="button" 
              onClick={addUnit}
              className="flex items-center gap-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 px-4 py-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Unit
            </button>
          </div>
          
          <div className="space-y-4">
            {units.map((unit, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start bg-zinc-50/50 dark:bg-zinc-900/30 p-6 rounded-[1.5rem] border border-zinc-100 dark:border-zinc-800 group relative">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Flat #</label>
                  <input 
                    required 
                    value={unit.unitNumber} 
                    onChange={e => updateUnit(index, 'unitNumber', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/20" 
                    placeholder="e.g. B2" 
                  />
                </div>
                <div className="md:col-span-8 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Flat Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(propertyTypeConfig).map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = unit.type === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateUnit(index, 'type', key)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all group/type ${
                            isSelected 
                              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 shadow-md' 
                              : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-1.5 group-hover/type:scale-110 transition-transform ${isSelected ? 'text-zinc-50 dark:text-zinc-900' : 'text-zinc-400'}`} />
                          <span className="text-[9px] font-bold whitespace-nowrap">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="absolute top-4 right-4 md:static md:col-span-1 flex justify-end md:self-center">
                  <button 
                    type="button" 
                    onClick={() => removeUnit(index)}
                    className="text-zinc-400 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {units.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-10 border-2 border-dotted border-zinc-100 dark:border-zinc-800 rounded-[1.5rem]">
                No units added. This building will be tracked as a single unit by default.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 relative border-t border-zinc-100 dark:border-zinc-800">
        <button 
          disabled={loading} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-8 py-3 rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Property'}
        </button>
      </div>
    </form>
  );
}
