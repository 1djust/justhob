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
