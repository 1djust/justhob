import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';
import { Type, Static } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { authenticate } from '../lib/middleware';

const PresignedUrlBody = Type.Object({
  fileName: Type.String(),
  contentType: Type.String(),
  bucket: Type.Optional(Type.String({ default: 'uploads' }))
});

export default async function uploadRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Optional: Authenticate uploads if required. We can keep it public for tenants if needed, 
  // or use the tenant ID for authorization. For now, this requires standard authentication.
  // We'll also create a public version for tenants on the public portal.

  // Secure route for logged-in managers/admins
  server.post<{ Body: Static<typeof PresignedUrlBody> }>('/presigned-url', {
    preHandler: authenticate,
    schema: { body: PresignedUrlBody }
  }, async (request, reply) => {
    const { fileName, contentType, bucket } = request.body;
    const bucketName = bucket || 'uploads';
    const filePath = `secure/${request.userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      request.log.error({ err: error }, 'Supabase Presigned URL Error');
      return reply.status(500).send({ error: 'Failed to generate upload URL' });
    }

    // The public URL can be constructed if the bucket is public, or we'd need another endpoint to view.
    // Assuming 'uploads' is a public bucket:
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;

    return reply.send({
      signedUrl: data.signedUrl,
      path: filePath,
      publicUrl,
      token: data.token
    });
  });

  // Public route for tenants
  server.post<{ Body: Static<typeof PresignedUrlBody> }>('/public/presigned-url', {
    schema: { body: PresignedUrlBody }
  }, async (request, reply) => {
    const { fileName, contentType, bucket } = request.body;
    const bucketName = bucket || 'uploads';
    const filePath = `public/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      request.log.error({ err: error }, 'Supabase Public Presigned URL Error');
      return reply.status(500).send({ error: 'Failed to generate upload URL' });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;

    return reply.send({
      signedUrl: data.signedUrl,
      path: filePath,
      publicUrl,
      token: data.token
    });
  });
}
