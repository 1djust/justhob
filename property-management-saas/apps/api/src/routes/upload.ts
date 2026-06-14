import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { authenticate } from "../lib/middleware";

const PresignedUrlBody = Type.Object({
  fileName: Type.String(),
  contentType: Type.String(),
  bucket: Type.Optional(Type.String({ default: "uploads" })),
});

export default async function uploadRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Ensure "uploads" bucket exists in Supabase storage
  const bucketName = "uploads";
  supabaseAdmin.storage.getBucket(bucketName).then(({ error }) => {
    if (error) {
      if (error.message.includes("not found") || error.message.includes("does not exist") || (error as any).status === 404 || (error as any).status === 400) {
        fastify.log.info(`Supabase storage bucket '${bucketName}' not found. Creating it...`);
        supabaseAdmin.storage.createBucket(bucketName, { public: true }).then(({ error: createError }) => {
          if (createError) {
            fastify.log.error({ err: createError }, `Failed to create Supabase storage bucket '${bucketName}'`);
          } else {
            fastify.log.info(`Successfully created public Supabase storage bucket '${bucketName}'`);
          }
        });
      } else {
        fastify.log.error({ err: error }, `Error checking Supabase storage bucket '${bucketName}'`);
      }
    } else {
      fastify.log.info(`Supabase storage bucket '${bucketName}' already exists`);
    }
  }).catch(err => {
    fastify.log.error({ err }, "Unhandled error during Supabase storage bucket initialization");
  });

  // Optional: Authenticate uploads if required. We can keep it public for tenants if needed,
  // or use the tenant ID for authorization. For now, this requires standard authentication.
  // We'll also create a public version for tenants on the public portal.

  // Secure route for logged-in managers/admins
  server.post<{ Body: Static<typeof PresignedUrlBody> }>(
    "/presigned-url",
    {
      preHandler: authenticate,
      schema: { body: PresignedUrlBody },
    },
    async (request, reply) => {
      const { fileName, contentType } = request.body;
      const bucketName = "uploads"; // Security: Hardcode bucket to prevent exhaustion
      
      // Basic extension check for safety
      const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
      const isAllowed = allowedExts.some(ext => fileName.toLowerCase().endsWith(ext));
      if (!isAllowed) {
        return reply.status(400).send({ error: "Only images and PDFs are allowed" });
      }

      const filePath = `secure/${request.userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(filePath);

      if (error) {
        request.log.error({ err: error }, "Supabase Presigned URL Error");
        return reply
          .status(500)
          .send({ error: "Failed to generate upload URL" });
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;

      return reply.send({
        signedUrl: data.signedUrl,
        path: filePath,
        publicUrl,
        token: data.token,
      });
    },
  );

  // Authenticated route for public uploads (e.g. tenant profile pictures)
  server.post<{ Body: Static<typeof PresignedUrlBody> }>(
    "/public/presigned-url",
    {
      preHandler: authenticate, // Security: Must be authenticated even for public assets
      schema: { body: PresignedUrlBody },
    },
    async (request, reply) => {
      const { fileName, contentType } = request.body;
      const bucketName = "uploads"; // Security: Hardcode bucket

      const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
      const isAllowed = allowedExts.some(ext => fileName.toLowerCase().endsWith(ext));
      if (!isAllowed) {
        return reply.status(400).send({ error: "Only images and PDFs are allowed" });
      }

      const filePath = `public/${request.userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(filePath);

      if (error) {
        request.log.error(
          { err: error },
          "Supabase Public Presigned URL Error",
        );
        return reply
          .status(500)
          .send({ error: "Failed to generate upload URL" });
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;

      return reply.send({
        signedUrl: data.signedUrl,
        path: filePath,
        publicUrl,
        token: data.token,
      });
    },
  );
}
