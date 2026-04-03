'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { API_BASE_URL } from '@/lib/api';

interface MaintenanceRequest {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  property: { name: string };
}

interface TenantLease {
  property: { id: string; name: string; address: string };
}

interface PortalTenant {
  name: string;
  workspace?: { name: string };
  leases?: TenantLease[];
  maintenanceRequests?: MaintenanceRequest[];
}

export default function TenantPortalPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = React.useState<PortalTenant | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  // Form State
  const [description, setDescription] = React.useState('');
  const [propertyId, setPropertyId] = React.useState('');
  const [imageString, setImageString] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/tenants/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        if (data.tenant.leases?.length > 0) {
          setPropertyId(data.tenant.leases[0].property.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (tenantId) fetchTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files larger than 5MB to prevent DB bloat
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please upload an image under 5MB.");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageString(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/public/tenants/${tenantId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          description,
          imageUrl: imageString
        })
      });

      if (res.ok) {
        setSuccess(true);
        setDescription('');
        setImageString(null);
        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchTenant(); // Refresh history
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Portal Not Found</h1>
          <p className="text-zinc-500">This tenant link is invalid or has been deactivated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white dark:bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
            {tenant.workspace?.name?.charAt(0) || 'P'}
          </div>
          <h1 className="text-xl font-bold tracking-tight">{tenant.workspace?.name || 'Property'} Tenant Portal</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8 mt-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome, {tenant.name}</h2>
          <p className="text-zinc-500 mt-2">Submit and track maintenance requests for your property.</p>
        </div>

        {/* Submit Form */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">New Maintenance Request</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-4 rounded-md text-sm border border-green-200 dark:border-green-900">
                Your request has been successfully submitted! The landlord will be in touch.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Property</label>
              <select 
                required 
                value={propertyId} 
                onChange={e => setPropertyId(e.target.value)} 
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {tenant.leases?.length === 0 && <option value="">No active leases found</option>}
                {tenant.leases?.map((l) => (
                  <option key={l.property.id} value={l.property.id}>{l.property.name} - {l.property.address}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description of Issue</label>
              <textarea 
                required 
                rows={4} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Please describe the issue in detail..."
                className="w-full px-3 py-2 border border-border rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Photo (Optional)</label>
              <input 
                id="image-upload"
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700"
              />
              {imageString && (
                <div className="mt-3 w-32 h-32 rounded-md overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageString} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={submitting || !propertyId}
                className="w-full sm:w-auto bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-8 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>

        {/* Request History */}
        <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Your Request History</h3>
          </div>
          <div className="p-6">
            {!tenant.maintenanceRequests || tenant.maintenanceRequests.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">You haven&apos;t submitted any requests yet.</p>
            ) : (
              <div className="space-y-4">
                {tenant.maintenanceRequests.map((req) => (
                  <div key={req.id} className="border border-border rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{req.property.name}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        req.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{req.description}</p>
                    <div className="text-xs text-zinc-500">
                      Submitted on {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
