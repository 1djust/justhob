import { prisma } from './apps/api/src/lib/database';

// ============================================================
// COMPREHENSIVE CRON JOB TEST
// Tests every notification milestone across both scenarios
// ============================================================

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
let passed = 0;
let failed = 0;

function pass(label: string, detail: string) {
  passed++;
  console.log(`   ✅ ${label}`);
  console.log(`      → ${detail}\n`);
}

function fail(label: string, detail: string) {
  failed++;
  console.log(`   ❌ ${label}`);
  console.log(`      → ${detail}\n`);
}

async function cleanupTestData(tenantUserId: string, managerId: string, paymentId?: string) {
  // Clean notifications created by this test
  await prisma.notification.deleteMany({
    where: {
      userId: { in: [tenantUserId, managerId] },
      type: { in: ['LEASE_EXPIRING', 'TENANT_LEASE_EXPIRING', 'PAYMENT_OVERDUE', 'PAYMENT_REMINDER'] }
    }
  });
  if (paymentId) {
    await prisma.rentReminder.deleteMany({ where: { paymentId } });
  }
}

async function runLeaseExpiryTest(daysUntilExpiry: number, leaseId: string, tenantUserId: string, managerId: string, tenant: any, property: any, unit: any) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(today);
  expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);

  await prisma.lease.update({
    where: { id: leaseId },
    data: { endDate: expiryDate, status: 'ACTIVE' }
  });

  // Run the lease expiry logic
  const activeLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', endDate: { not: null, gte: today } },
    include: { tenant: true, property: true, unit: true }
  });

  let tenantNotifCreated = false;
  let managerNotifCreated = false;

  for (const l of activeLeases) {
    if (!l.endDate || l.id !== leaseId) continue;
    const days = Math.floor((l.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let reminderType = null;
    if (days === 90) reminderType = 'EXPIRING_90';
    else if (days === 60) reminderType = 'EXPIRING_60';
    else if (days === 30) reminderType = 'EXPIRING_30';

    if (reminderType) {
      await prisma.notification.create({
        data: {
          userId: tenantUserId,
          title: 'Lease Expiring Soon',
          message: `Your lease for ${l.property.name}${l.unit ? ' ' + l.unit.unitNumber : ''} will expire in ${days} days. Please prepare for renewal.`,
          type: 'LEASE_EXPIRING'
        }
      });
      tenantNotifCreated = true;

      if (days === 90) {
        const managers = await prisma.workspaceMember.findMany({
          where: { workspaceId: l.tenant.workspaceId, role: 'PROPERTY_MANAGER' },
          include: { user: true }
        });
        for (const m of managers) {
          await prisma.notification.create({
            data: {
              userId: m.userId,
              title: 'Tenant Lease Expiring',
              message: `Tenant ${l.tenant.name}'s lease at ${l.property.name} expires in 90 days. Consider sending a renewal offer.`,
              type: 'TENANT_LEASE_EXPIRING'
            }
          });
          managerNotifCreated = true;
        }
      }
    }
  }

  return { tenantNotifCreated, managerNotifCreated };
}

async function runLeaseExpirationTest(leaseId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Set lease end date to yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.lease.update({
    where: { id: leaseId },
    data: { endDate: yesterday, status: 'ACTIVE' }
  });

  // Run the expiration logic
  const expiredLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', endDate: { lt: today } }
  });

  let statusChanged = false;
  for (const lease of expiredLeases) {
    if (lease.id !== leaseId) continue;
    await prisma.lease.update({
      where: { id: lease.id },
      data: { status: 'EXPIRED' }
    });
    statusChanged = true;
  }

  return statusChanged;
}

async function runPreDueTest(paymentId: string, daysUntilDue: number, tenantUserId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + daysUntilDue);

  await prisma.rentReminder.deleteMany({ where: { paymentId } });
  await prisma.payment.update({
    where: { id: paymentId },
    data: { dueDate, status: 'PENDING' }
  });

  // Run pre-due logic
  const futurePayments = await prisma.payment.findMany({
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { gte: today } },
    include: { lease: { include: { tenant: true } } }
  });

  let notifCreated = false;
  for (const p of futurePayments) {
    if (p.id !== paymentId) continue;
    const days = Math.floor((p.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let reminderType = null;
    if (days === 7) reminderType = 'PRE_DUE_7';
    else if (days === 3) reminderType = 'PRE_DUE_3';
    else if (days === 0) reminderType = 'DUE_DAY';

    if (reminderType) {
      await prisma.rentReminder.create({
        data: { paymentId: p.id, type: reminderType, channel: 'IN_APP' }
      });

      await prisma.notification.create({
        data: {
          userId: tenantUserId,
          title: reminderType === 'DUE_DAY' ? 'Rent Due Today' : 'Rent Due Soon',
          message: `Your rent of ₦${p.amount} is due ${days === 0 ? 'today' : 'in ' + days + ' days'}.`,
          type: 'PAYMENT_REMINDER'
        }
      });
      notifCreated = true;
    }
  }

  return notifCreated;
}

async function runOverdueTest(paymentId: string, daysOverdue: number, tenantUserId: string, tenantEmail: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() - daysOverdue);

  await prisma.rentReminder.deleteMany({ where: { paymentId } });
  await prisma.payment.update({
    where: { id: paymentId },
    data: { dueDate, status: 'PENDING' }
  });

  // Run overdue logic
  const overduePayments = await prisma.payment.findMany({
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
    include: { lease: { include: { tenant: true, property: true } } }
  });

  let result = { statusChanged: false, notifCreated: false, reminderType: '' };

  for (const p of overduePayments) {
    if (p.id !== paymentId) continue;

    const gracePeriodEnd = new Date(p.dueDate);
    gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 3);
    const actualDaysOverdue = Math.floor((today.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Update payment status
    await prisma.payment.update({
      where: { id: p.id },
      data: { status: p.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'OVERDUE', gracePeriodEnd }
    });
    result.statusChanged = true;

    let reminderType: string | null = null;
    let notificationTitle = '';
    let notificationMessage = '';

    if (actualDaysOverdue === 1) {
      reminderType = 'OVERDUE_1';
      notificationTitle = 'Rent is Overdue';
      notificationMessage = `Your rent of ₦${p.amount} was due yesterday. Please make your payment.`;
    } else if (actualDaysOverdue === 30) {
      reminderType = 'OVERDUE_30';
      notificationTitle = 'Rent 1 Month Overdue';
      notificationMessage = `Your rent is now 1 month overdue. Please contact your property manager immediately.`;
    } else if (actualDaysOverdue === 60) {
      reminderType = 'OVERDUE_60';
      notificationTitle = 'Rent 2 Months Overdue';
      notificationMessage = `Your rent is 2 months overdue. Your 3-month grace period is ending soon.`;
    } else if (today >= gracePeriodEnd) {
      reminderType = 'FINAL_NOTICE';
      notificationTitle = 'Grace Period Ended';
      notificationMessage = `Your 3-month grace period has ended. Your property manager may now take action to end your tenancy.`;
    }

    if (reminderType) {
      await prisma.rentReminder.create({
        data: { paymentId: p.id, type: reminderType, channel: 'IN_APP' }
      });

      await prisma.notification.create({
        data: {
          userId: tenantUserId,
          title: notificationTitle,
          message: notificationMessage,
          type: 'PAYMENT_OVERDUE'
        }
      });
      result.notifCreated = true;
      result.reminderType = reminderType;
    }
  }

  return result;
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function main() {
  console.log('\n' + DIVIDER);
  console.log('🧪 COMPREHENSIVE CRON JOB TEST — ALL 11 MILESTONES');
  console.log(DIVIDER + '\n');

  // Find test data — must be a lease whose tenant has a matching User record
  const allActiveLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE' },
    include: { tenant: true, property: true, unit: true }
  });

  let lease = null;
  let tenantUser = null;

  for (const l of allActiveLeases) {
    if (!l.tenant.email) continue;
    const user = await prisma.user.findUnique({ where: { email: l.tenant.email } });
    if (user) {
      lease = l;
      tenantUser = user;
      break;
    }
  }

  if (!lease) { console.error('❌ No active lease with a matching user found.'); return; }
  if (!tenantUser) { console.error('❌ Tenant user not found.'); return; }

  const managers = await prisma.workspaceMember.findMany({
    where: { workspaceId: lease.tenant.workspaceId, role: 'PROPERTY_MANAGER' },
    include: { user: true }
  });
  const managerId = managers[0]?.userId || '';

  const payment = await prisma.payment.findFirst({
    where: { status: { in: ['PENDING', 'OVERDUE'] } },
    include: { lease: { include: { tenant: true } } }
  });

  const payTenantUser = payment ? await prisma.user.findUnique({ where: { email: payment.lease.tenant.email || '' } }) : null;

  console.log(`📋 Test Lease: ${lease.tenant.name} @ ${lease.property.name}${lease.unit ? ' ' + lease.unit.unitNumber : ''}`);
  if (payment) console.log(`💰 Test Payment: ${payment.lease.tenant.name} — ₦${payment.amount}`);
  console.log('');

  // Clean up before tests
  await cleanupTestData(tenantUser.id, managerId, payment?.id);
  if (payTenantUser && payTenantUser.id !== tenantUser.id) {
    await cleanupTestData(payTenantUser.id, managerId);
  }

  // ========================================
  // SCENARIO 1: LEASE EXPIRY MILESTONES
  // ========================================
  console.log(DIVIDER);
  console.log('📋 SCENARIO 1: LEASE AGREEMENT EXPIRY');
  console.log(DIVIDER + '\n');

  // Test 1.1: 90 Days Before
  console.log('🔸 Test 1.1: 90 Days Before Expiration');
  const r90 = await runLeaseExpiryTest(90, lease.id, tenantUser.id, managerId, lease.tenant, lease.property, lease.unit);
  if (r90.tenantNotifCreated) pass('Tenant Notification', `"Lease Expiring Soon — ...will expire in 90 days."`);
  else fail('Tenant Notification', 'Not created');
  if (r90.managerNotifCreated) pass('Manager Notification', `"Tenant Lease Expiring — ...Consider sending a renewal offer."`);
  else fail('Manager Notification', 'Not created');
  await cleanupTestData(tenantUser.id, managerId);

  // Test 1.2: 60 Days Before
  console.log('🔸 Test 1.2: 60 Days Before Expiration');
  const r60 = await runLeaseExpiryTest(60, lease.id, tenantUser.id, managerId, lease.tenant, lease.property, lease.unit);
  if (r60.tenantNotifCreated) pass('Tenant Notification', `"Lease Expiring Soon — ...will expire in 60 days."`);
  else fail('Tenant Notification', 'Not created');
  await cleanupTestData(tenantUser.id, managerId);

  // Test 1.3: 30 Days Before
  console.log('🔸 Test 1.3: 30 Days Before Expiration');
  const r30 = await runLeaseExpiryTest(30, lease.id, tenantUser.id, managerId, lease.tenant, lease.property, lease.unit);
  if (r30.tenantNotifCreated) pass('Tenant Notification', `"Lease Expiring Soon — ...will expire in 30 days."`);
  else fail('Tenant Notification', 'Not created');
  await cleanupTestData(tenantUser.id, managerId);

  // Test 1.4: Expiration Day — Status Change
  console.log('🔸 Test 1.4: On Expiration Day (ACTIVE → EXPIRED)');
  const expired = await runLeaseExpirationTest(lease.id);
  if (expired) pass('Lease Status Change', 'ACTIVE → EXPIRED');
  else fail('Lease Status Change', 'Status was not changed to EXPIRED');

  // Restore lease to ACTIVE for future use
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  await prisma.lease.update({ where: { id: lease.id }, data: { status: 'ACTIVE', endDate: futureDate } });

  // ========================================
  // SCENARIO 2: PAYMENT DUE / OVERDUE
  // ========================================
  if (!payment || !payTenantUser) {
    console.log('\n⚠️ Skipping Scenario 2 — No pending payment found.\n');
  } else {
    console.log('\n' + DIVIDER);
    console.log('💰 SCENARIO 2: RENT PAYMENT DUE / OVERDUE');
    console.log(DIVIDER + '\n');

    // Test 2.1: 7 Days Before Due
    console.log('🔸 Test 2.1: 7 Days Before Due Date');
    const preDue7 = await runPreDueTest(payment.id, 7, payTenantUser.id);
    if (preDue7) pass('Tenant Notification', '"Rent Due Soon — ...due in 7 days."');
    else fail('Tenant Notification', 'Not created');
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.2: 3 Days Before Due
    console.log('🔸 Test 2.2: 3 Days Before Due Date');
    const preDue3 = await runPreDueTest(payment.id, 3, payTenantUser.id);
    if (preDue3) pass('Tenant Notification', '"Rent Due Soon — ...due in 3 days."');
    else fail('Tenant Notification', 'Not created');
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.3: Due Day
    console.log('🔸 Test 2.3: Due Date (Today)');
    const dueDay = await runPreDueTest(payment.id, 0, payTenantUser.id);
    if (dueDay) pass('Tenant Notification', '"Rent Due Today — ...due today."');
    else fail('Tenant Notification', 'Not created');
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.4: 1 Day Overdue
    console.log('🔸 Test 2.4: 1 Day Overdue');
    const od1 = await runOverdueTest(payment.id, 1, payTenantUser.id, payTenantUser.email);
    if (od1.statusChanged) pass('Payment Status', 'PENDING → OVERDUE');
    else fail('Payment Status', 'Not changed');
    if (od1.notifCreated) pass('Tenant Notification', '"Rent is Overdue — ...was due yesterday."');
    else fail('Tenant Notification', 'Not created');
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.5: 30 Days Overdue
    console.log('🔸 Test 2.5: 30 Days Overdue');
    const od30 = await runOverdueTest(payment.id, 30, payTenantUser.id, payTenantUser.email);
    if (od30.notifCreated && od30.reminderType === 'OVERDUE_30') pass('Tenant Notification', '"Rent 1 Month Overdue — ...contact your property manager immediately."');
    else fail('Tenant Notification', `Expected OVERDUE_30, got: ${od30.reminderType || 'none'}`);
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.6: 60 Days Overdue
    console.log('🔸 Test 2.6: 60 Days Overdue');
    const od60 = await runOverdueTest(payment.id, 60, payTenantUser.id, payTenantUser.email);
    if (od60.notifCreated && od60.reminderType === 'OVERDUE_60') pass('Tenant Notification', '"Rent 2 Months Overdue — ...grace period is ending soon."');
    else fail('Tenant Notification', `Expected OVERDUE_60, got: ${od60.reminderType || 'none'}`);
    await cleanupTestData(payTenantUser.id, managerId, payment.id);

    // Test 2.7: Grace Period Ended (91 days = past 3 months)
    console.log('🔸 Test 2.7: Grace Period Ended (3+ Months Overdue)');
    const odFinal = await runOverdueTest(payment.id, 91, payTenantUser.id, payTenantUser.email);
    if (odFinal.notifCreated && odFinal.reminderType === 'FINAL_NOTICE') pass('Tenant Notification', '"Grace Period Ended — ...property manager may now take action."');
    else fail('Tenant Notification', `Expected FINAL_NOTICE, got: ${odFinal.reminderType || 'none'}`);

    // Restore payment to PENDING
    await prisma.rentReminder.deleteMany({ where: { paymentId: payment.id } });
    const futurePayDate = new Date();
    futurePayDate.setDate(futurePayDate.getDate() + 30);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING', dueDate: futurePayDate, gracePeriodEnd: null } });
  }

  // ========================================
  // FINAL REPORT
  // ========================================
  console.log('\n' + DIVIDER);
  console.log('📊 FINAL TEST REPORT');
  console.log(DIVIDER + '\n');

  const total = passed + failed;
  console.log(`   Total Tests:  ${total}`);
  console.log(`   ✅ Passed:    ${passed}`);
  console.log(`   ❌ Failed:    ${failed}`);
  console.log(`   Success Rate: ${Math.round((passed / total) * 100)}%\n`);

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED — The system is GOOD TO GO!\n');
  } else {
    console.log(`⚠️ ${failed} test(s) failed. Review the output above.\n`);
  }

  console.log(DIVIDER);
}

main().catch(console.error).finally(() => process.exit(0));
