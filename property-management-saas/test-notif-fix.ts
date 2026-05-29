process.env.DATABASE_URL = "postgresql://postgres.gushvedprjygyauwzvnf:1%40ActionSupabase@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.SUPABASE_URL = "https://gushvedprjygyauwzvnf.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1c2h2ZWRwcmp5Z3lhdXd6dm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwNzE5MywiZXhwIjoyMDkwMzgzMTkzfQ.0nmzWmQ2uk7Fi025Fv5J27KXBfGsVxcDuE5DTTd3wUU";
process.env.JWT_SECRET = "just-hub-secret-key-2024";

import { app } from './apps/api/src/app.ts';
import { prisma } from './apps/api/src/lib/database.ts';

async function test() {
  const email = 'omolola.iseyemi@example.com';
  const tenant = await prisma.user.findUnique({ where: { email } });
  if (!tenant) throw new Error("tenant not found");

  console.log('Generating token for:', email);
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: tenant.email, password: 'password123' }
  });

  if (response.statusCode !== 200) {
    console.error('Login failed');
    return;
  }

  const token = response.json().token;

  console.log('Fetching notifications...');
  const notifsResp = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${token}` }
  });
  
  const notifs = notifsResp.json().notifications || [];
  console.log('Notifications count:', notifs.length);
  
  const unreadCount = notifs.filter((n: any) => !n.isRead).length;
  console.log('Unread count BEFORE mark-all:', unreadCount);

  if (unreadCount > 0) {
     console.log('Calling mark-all-as-read...');
     const readAllResp = await app.inject({
       method: 'PATCH',
       url: `/api/notifications/read-all`,
       headers: { authorization: `Bearer ${token}` }
     });
     console.log('Mark all read status:', readAllResp.statusCode);
     
     const notifsAfterResp = await app.inject({
        method: 'GET',
        url: '/api/notifications',
        headers: { authorization: `Bearer ${token}` }
      });
      const unreadCountAfter = notifsAfterResp.json().notifications.filter((n: any) => !n.isRead).length;
      console.log('Unread count AFTER mark-all:', unreadCountAfter);
  } else {
    console.log('No unread notifications to test with.');
    // Create one for testing
    console.log('Creating a test notification...');
    const newNotif = await prisma.notification.create({
      data: {
        userId: tenant.id,
        title: 'Test Notification',
        message: 'This is a test',
        type: 'TEST',
        isRead: false
      }
    });
    console.log('Created notif:', newNotif.id);
    
    console.log('Calling mark-as-read for:', newNotif.id);
    const readResp = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${newNotif.id}/read`,
      headers: { authorization: `Bearer ${token}` }
    });
    console.log('Mark read status:', readResp.statusCode);
    
    const checkNotif = await prisma.notification.findUnique({ where: { id: newNotif.id } });
    console.log('Notification isRead in DB:', checkNotif?.isRead);
  }
}

test().catch(console.error).finally(() => process.exit(0));
