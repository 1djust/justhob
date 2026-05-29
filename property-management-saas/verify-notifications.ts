import { prisma } from './apps/api/src/lib/database';

async function verify() {
  console.log('==========================================');
  console.log('👁️  VISUAL VERIFICATION — What Each User Sees');
  console.log('==========================================\n');

  // 1. Manager View
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👔 MANAGER VIEW (manager@justhob.com)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const manager = await prisma.user.findUnique({ where: { email: 'manager@justhob.com' } });
  if (manager) {
    const mNotifs = await prisma.notification.findMany({
      where: { userId: manager.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const unread = mNotifs.filter((n: any) => !n.isRead);
    console.log(`🔔 Notification Bell Badge: ${unread.length} unread\n`);

    for (const n of mNotifs) {
      const icon = n.isRead ? '  ' : '🔴';
      const typeIcon = n.type.includes('EXPIR') ? '📅' : n.type.includes('OVERDUE') ? '💸' : n.type.includes('PAYMENT') ? '💰' : '📋';
      console.log(`${icon} ${typeIcon} ${n.title}`);
      console.log(`      ${n.message}`);
      console.log(`      ${n.isRead ? '(Read)' : '(Unread)'} — ${n.createdAt.toLocaleString()}\n`);
    }
  }

  // 2. Tenant View (Test Tenant — Scenario 1)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏠 TENANT VIEW — Test Tenant (tenant@justhob.com)');
  console.log('   → Should see: "Lease Expiring Soon" notification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tenant = await prisma.user.findUnique({ where: { email: 'tenant@justhob.com' } });
  if (tenant) {
    const tNotifs = await prisma.notification.findMany({
      where: { userId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const unread = tNotifs.filter((n: any) => !n.isRead);
    console.log(`🔔 Notification Bell Badge: ${unread.length} unread\n`);

    for (const n of tNotifs) {
      const icon = n.isRead ? '  ' : '🔴';
      const typeIcon = n.type.includes('EXPIR') ? '📅' : n.type.includes('OVERDUE') ? '💸' : n.type.includes('PAYMENT') ? '💰' : '📋';
      console.log(`${icon} ${typeIcon} ${n.title}`);
      console.log(`      ${n.message}`);
      console.log(`      ${n.isRead ? '(Read)' : '(Unread)'} — ${n.createdAt.toLocaleString()}\n`);
    }
  }

  // 3. Free Tenant View (Scenario 2)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏠 TENANT VIEW — Free Tenant (free-tenant@justhob.com)');
  console.log('   → Should see: "Rent is Overdue" notification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const freeTenant = await prisma.user.findUnique({ where: { email: 'free-tenant@justhob.com' } });
  if (freeTenant) {
    const ftNotifs = await prisma.notification.findMany({
      where: { userId: freeTenant.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const unread = ftNotifs.filter((n: any) => !n.isRead);
    console.log(`🔔 Notification Bell Badge: ${unread.length} unread\n`);

    for (const n of ftNotifs) {
      const icon = n.isRead ? '  ' : '🔴';
      const typeIcon = n.type.includes('EXPIR') ? '📅' : n.type.includes('OVERDUE') ? '💸' : n.type.includes('PAYMENT') ? '💰' : '📋';
      console.log(`${icon} ${typeIcon} ${n.title}`);
      console.log(`      ${n.message}`);
      console.log(`      ${n.isRead ? '(Read)' : '(Unread)'} — ${n.createdAt.toLocaleString()}\n`);
    }
  }

  // 4. Payment Status Verification
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PAYMENT STATUS VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overduePayments = await prisma.payment.findMany({
    where: { status: 'OVERDUE' },
    include: { lease: { include: { tenant: true, property: true } } },
    take: 5
  });

  for (const p of overduePayments) {
    console.log(`💸 ${p.lease.tenant.name} — ${p.lease.property.name}`);
    console.log(`   Amount: ₦${p.amount.toLocaleString()} | Status: ${p.status}`);
    console.log(`   Due: ${p.dueDate.toISOString().split('T')[0]} | Grace Period Ends: ${p.gracePeriodEnd?.toISOString().split('T')[0] || 'N/A'}\n`);
  }

  // 5. Rent Reminder Audit
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 RENT REMINDER AUDIT LOG');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const reminders = await prisma.rentReminder.findMany({
    orderBy: { sentAt: 'desc' },
    take: 5,
    include: { payment: { include: { lease: { include: { tenant: true } } } } }
  });

  for (const r of reminders) {
    console.log(`📌 Type: ${r.type} | Channel: ${r.channel}`);
    console.log(`   Tenant: ${r.payment.lease.tenant.name} | Sent: ${r.sentAt.toLocaleString()}\n`);
  }

  console.log('==========================================');
  console.log('✅ Verification Complete!');
  console.log('==========================================');
  console.log('\n💡 You can also open these URLs to see it live:');
  console.log('   Manager Dashboard: http://localhost:3000/login (manager@justhob.com / Test1234!)');
  console.log('   Tenant App: Already running via ./run.sh');
}

verify().catch(console.error).finally(() => process.exit(0));
