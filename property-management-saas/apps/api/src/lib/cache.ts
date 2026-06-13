// Shared cache manager for API endpoints to support multi-endpoint invalidation
export const meCache = new Map<string, { response: any; expiresAt: number }>();
export const statsCache = new Map<string, { response: any; expiresAt: number }>();
export const propertiesCache = new Map<string, { response: any; expiresAt: number }>();
export const tenantsCache = new Map<string, { response: any; expiresAt: number }>();
export const paymentsCache = new Map<string, { response: any; expiresAt: number }>();
export const maintenanceCache = new Map<string, { response: any; expiresAt: number }>();

// Cache TTL configuration (in milliseconds)
export const CACHE_TTL = 120 * 1000; // 2 minutes

// Invalidate all cached data for a specific workspace
export const clearWorkspaceCache = (workspaceId: string) => {
  console.log(`[CACHE] Invalidating cache for workspace: ${workspaceId}`);
  
  // Stats Cache Invalidation
  for (const key of statsCache.keys()) {
    if (key.includes(workspaceId)) statsCache.delete(key);
  }
  
  // Properties Cache Invalidation
  for (const key of propertiesCache.keys()) {
    if (key.includes(workspaceId)) propertiesCache.delete(key);
  }
  
  // Tenants Cache Invalidation
  for (const key of tenantsCache.keys()) {
    if (key.includes(workspaceId)) tenantsCache.delete(key);
  }
  
  // Payments Cache Invalidation
  for (const key of paymentsCache.keys()) {
    if (key.includes(workspaceId)) paymentsCache.delete(key);
  }
  
  // Maintenance Cache Invalidation
  for (const key of maintenanceCache.keys()) {
    if (key.includes(workspaceId)) maintenanceCache.delete(key);
  }
};

// Periodic garbage collection for expired entries
setInterval(() => {
  const now = Date.now();
  
  for (const [key, entry] of meCache.entries()) {
    if (entry.expiresAt < now) meCache.delete(key);
  }
  for (const [key, entry] of statsCache.entries()) {
    if (entry.expiresAt < now) statsCache.delete(key);
  }
  for (const [key, entry] of propertiesCache.entries()) {
    if (entry.expiresAt < now) propertiesCache.delete(key);
  }
  for (const [key, entry] of tenantsCache.entries()) {
    if (entry.expiresAt < now) tenantsCache.delete(key);
  }
  for (const [key, entry] of paymentsCache.entries()) {
    if (entry.expiresAt < now) paymentsCache.delete(key);
  }
  for (const [key, entry] of maintenanceCache.entries()) {
    if (entry.expiresAt < now) maintenanceCache.delete(key);
  }
}, 30 * 1000).unref();
