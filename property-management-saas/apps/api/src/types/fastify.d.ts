import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: 'OWNER' | 'MANAGER' | 'TENANT' | 'PROPERTY_MANAGER' | 'LANDLORD' | 'SUPER_ADMIN';
    globalUserRole?: 'SUPER_ADMIN' | 'PROPERTY_MANAGER' | 'LANDLORD' | 'TENANT';
    isAAL2?: boolean;
  }
}
