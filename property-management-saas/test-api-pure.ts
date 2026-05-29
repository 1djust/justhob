import Fastify from 'fastify';
import notificationRoutes from './apps/api/src/routes/notifications';
import { prisma } from './apps/api/src/lib/database';
import jwt from 'jsonwebtoken';

const fastify = Fastify();
const JWT_SECRET = "just-hub-secret-key-2024";

// Mock auth middleware for testing
fastify.decorateRequest('userId', '');
fastify.addHook('preHandler', async (request, reply) => {
  const auth = request.headers.authorization;
  if (auth) {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    request.userId = decoded.userId;
  }
});

fastify.register(notificationRoutes);

async function test() {
  const tenant = await prisma.user.findFirst({ where: { role: 'TENANT' } });
  if (!tenant) throw new Error("tenant not found");

  const token = jwt.sign({ userId: tenant.id }, JWT_SECRET);

  // Create a test unread notification
  const newNotif = await prisma.notification.create({
    data: {
      userId: tenant.id,
      title: 'API Test',
      message: 'Testing marks',
      type: 'TEST',
      isRead: false
    }
  });
  console.log('Created unread notif:', newNotif.id);

  const response = await fastify.inject({
    method: 'PATCH',
    url: `/${newNotif.id}/read`,
    headers: { authorization: `Bearer ${token}` }
  });
  console.log('PATCH response status:', response.statusCode);
  console.log('PATCH response body:', response.body);

  const check = await prisma.notification.findUnique({ where: { id: newNotif.id } });
  console.log('isRead after PATCH:', check?.isRead);
}

test().catch(console.error).finally(() => process.exit(0));
