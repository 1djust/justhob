// Set environment variables BEFORE any imports that might use them
process.env.SUPABASE_URL = "https://gushvedprjygyauwzvnf.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1c2h2ZWRwcmp5Z3lhdXd6dm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwNzE5MywiZXhwIjoyMDkwMzgzMTkzfQ.0nmzWmQ2uk7Fi025Fv5J27KXBfGsVxcDuE5DTTd3wUU";
process.env.DATABASE_URL = "postgresql://postgres.gushvedprjygyauwzvnf:1%40ActionSupabase@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.JWT_SECRET = "just-hub-secret-key-2024";

import { app } from './apps/api/src/app';
import { prisma } from './apps/api/src/lib/database';

async function test() {
  console.log('Starting notification test...');
  
  const tenant = await prisma.user.findFirst({ where: { role: 'TENANT' } });
  if (!tenant) throw new Error("tenant not found");
  console.log('Testing with tenant:', tenant.email);

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: tenant.email, password: 'password123' }
  });

  if (response.statusCode !== 200) {
    console.error('Login failed:', response.statusCode, response.body);
    return;
  }

  const token = response.json().token;
  
  const notifsResp = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${token}` }
  });
  
  const notifs = notifsResp.json().notifications || [];
  const unread = notifs.filter((n: any) => !n.isRead);
  console.log(`Found ${notifs.length} total notifications, ${unread.length} unread.`);

  if (unread.length > 0) {
    const id = unread[0].id;
    console.log('Marking single as read:', id);
    const readResp = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${id}/read`,
      headers: { authorization: `Bearer ${token}` }
    });
    console.log('Mark read status:', readResp.statusCode, readResp.json());
  }

  console.log('Testing mark all as read...');
  const readAllResp = await app.inject({
    method: 'PATCH',
    url: `/api/notifications/read-all`,
    headers: { authorization: `Bearer ${token}` }
  });
  console.log('Mark all read status:', readAllResp.statusCode, readAllResp.json());
}

test().catch(console.error).finally(() => process.exit(0));
