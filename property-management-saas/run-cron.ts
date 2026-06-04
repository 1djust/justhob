const { prisma } = require('./apps/api/src/lib/database');

async function testCron() {
  console.log("Starting test...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futurePayments = await prisma.payment.findMany({
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { gte: today } },
    include: { lease: { include: { tenant: true } } }
  });

  for (const payment of futurePayments) {
    const daysUntilDue = Math.floor((payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let reminderType = null;
    if (daysUntilDue === 7 || daysUntilDue === 6) reminderType = 'PRE_DUE_7';

    if (reminderType) {
        console.log(`[Admin Cron] Looking for managers for workspace: ${payment.lease.tenant.workspaceId}`);
        const managers = await prisma.workspaceMember.findMany({
          where: { workspaceId: payment.lease.tenant.workspaceId, role: 'PROPERTY_MANAGER' },
          include: { user: true }
        });
        console.log(`[Admin Cron] Found ${managers.length} managers`);
        
        for (const manager of managers) {
              const managerNotif = await prisma.notification.create({
                data: {
                  userId: manager.userId,
                  title: reminderType === 'DUE_DAY' ? 'Tenant Rent Due Today' : 'Tenant Rent Due Soon',
                  message: `Tenant ${payment.lease.tenant.name}'s rent of ₦${payment.amount} is due in ${daysUntilDue} days.`,
                  type: 'TENANT_PAYMENT_REMINDER'
                }
              });
              console.log("CREATED NOTIF FOR MANAGER: ", managerNotif.id);
        }
    }
  }
}

testCron().catch(console.error).finally(() => process.exit(0));
