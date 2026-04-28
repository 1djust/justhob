import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: 'OWNER' | 'MANAGER' | 'TENANT' | 'PROPERTY_MANAGER' | 'LANDLORD';
  }
}
