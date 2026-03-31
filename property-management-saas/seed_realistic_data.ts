import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding realistic property management data...\n');

  const password = await bcrypt.hash('Test1234!', 10);

  // ═══════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════

  const pm = await prisma.user.upsert({
    where: { email: 'adebayo@justhub.ng' },
    update: {},
    create: { email: 'adebayo@justhub.ng', name: 'Adebayo Ogunlesi', password }
  });

  const owner1 = await prisma.user.upsert({
    where: { email: 'chioma.eze@gmail.com' },
    update: {},
    create: { email: 'chioma.eze@gmail.com', name: 'Chioma Eze', password }
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'musa.abdullahi@yahoo.com' },
    update: {},
    create: { email: 'musa.abdullahi@yahoo.com', name: 'Musa Abdullahi', password }
  });

  const tenantUser1 = await prisma.user.upsert({
    where: { email: 'emeka.obi@gmail.com' },
    update: {},
    create: { email: 'emeka.obi@gmail.com', name: 'Emeka Obi', password }
  });

  const tenantUser2 = await prisma.user.upsert({
    where: { email: 'fatima.bello@gmail.com' },
    update: {},
    create: { email: 'fatima.bello@gmail.com', name: 'Fatima Bello', password }
  });

  const tenantUser3 = await prisma.user.upsert({
    where: { email: 'tunde.williams@gmail.com' },
    update: {},
    create: { email: 'tunde.williams@gmail.com', name: 'Tunde Williams', password }
  });

  console.log('✅ 6 users created');

  // ═══════════════════════════════════════
  // WORKSPACE
  // ═══════════════════════════════════════

  const workspace = await prisma.workspace.upsert({
    where: { id: 'ws-justhub-lagos' },
    update: {},
    create: {
      id: 'ws-justhub-lagos',
      name: 'JustHub Lagos Properties',
      bankCode: '058',
      accountNumber: '0123456789'
    }
  });

  console.log('🏢 Workspace: JustHub Lagos Properties');

  // ═══════════════════════════════════════
  // WORKSPACE MEMBERS (Roles)
  // ═══════════════════════════════════════

  const members = [
    { userId: pm.id, role: 'PROPERTY_MANAGER' as const },
    { userId: owner1.id, role: 'LANDLORD' as const },
    { userId: owner2.id, role: 'LANDLORD' as const },
    { userId: tenantUser1.id, role: 'TENANT' as const },
    { userId: tenantUser2.id, role: 'TENANT' as const },
    { userId: tenantUser3.id, role: 'TENANT' as const },
  ];

  for (const m of members) {
    await prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: m.userId, workspaceId: workspace.id } },
      update: { role: m.role },
      create: { userId: m.userId, workspaceId: workspace.id, role: m.role }
    });
  }

  console.log('✅ Roles assigned (1 PM, 2 Owners, 3 Tenants)');

  // ═══════════════════════════════════════
  // PROPERTIES (7 realistic Lagos properties)
  // ═══════════════════════════════════════

  const properties = [
    { id: 'prop-lekki-phase1', name: 'Lekki Gardens Estate - Block A', address: '12 Admiralty Way, Lekki Phase 1, Lagos', type: 'Residential', units: 16, ownerId: owner1.id },
    { id: 'prop-vi-office', name: 'Adeola Odeku Office Tower', address: '45 Adeola Odeku Street, Victoria Island, Lagos', type: 'Commercial', units: 24, ownerId: owner1.id },
    { id: 'prop-ikoyi-villa', name: 'Bourdillon Court Residences', address: '8 Bourdillon Road, Ikoyi, Lagos', type: 'Residential', units: 6, ownerId: owner1.id },
    { id: 'prop-ajah-estate', name: 'Abraham Adesanya Palm View', address: '22 Abraham Adesanya Estate, Ajah, Lagos', type: 'Residential', units: 32, ownerId: owner2.id },
    { id: 'prop-surulere-plaza', name: 'Surulere Business Plaza', address: '15 Adeniran Ogunsanya St, Surulere, Lagos', type: 'Commercial', units: 10, ownerId: owner2.id },
    { id: 'prop-yaba-tech', name: 'Yaba Tech Hub Suites', address: '3 Herbert Macaulay Way, Yaba, Lagos', type: 'Commercial', units: 8, ownerId: owner2.id },
    { id: 'prop-oniru-unassigned', name: 'Oniru Private Estate - Phase 2', address: '1 Palace Road, Oniru, Victoria Island, Lagos', type: 'Residential', units: 12, ownerId: null },
  ];

  for (const p of properties) {
    await prisma.property.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, workspaceId: workspace.id }
    });
  }

  console.log('🏠 7 properties created (3 for Chioma, 3 for Musa, 1 unassigned)');

  // ═══════════════════════════════════════
  // TENANTS
  // ═══════════════════════════════════════

  const tenants = [
    { id: 'ten-emeka', name: 'Emeka Obi', email: 'emeka.obi@gmail.com', phone: '+234 801 234 5678' },
    { id: 'ten-fatima', name: 'Fatima Bello', email: 'fatima.bello@gmail.com', phone: '+234 803 456 7890' },
    { id: 'ten-tunde', name: 'Tunde Williams', email: 'tunde.williams@gmail.com', phone: '+234 805 678 9012' },
    { id: 'ten-ngozi', name: 'Ngozi Okafor', email: 'ngozi.okafor@gmail.com', phone: '+234 807 890 1234' },
    { id: 'ten-ibrahim', name: 'Ibrahim Yusuf', email: 'ibrahim.yusuf@gmail.com', phone: '+234 809 012 3456' },
    { id: 'ten-aisha', name: 'Aisha Mohammed', email: 'aisha.m@gmail.com', phone: '+234 802 345 6789' },
  ];

  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, workspaceId: workspace.id }
    });
  }

  console.log('👥 6 tenants created');

  // ═══════════════════════════════════════
  // LEASES
  // ═══════════════════════════════════════

  const leases = [
    { id: 'lease-001', tenantId: 'ten-emeka', propertyId: 'prop-lekki-phase1', startDate: new Date('2025-06-01'), endDate: new Date('2026-05-31'), yearlyRent: 3600000, status: 'ACTIVE' as const },
    { id: 'lease-002', tenantId: 'ten-fatima', propertyId: 'prop-lekki-phase1', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31'), yearlyRent: 3200000, status: 'ACTIVE' as const },
    { id: 'lease-003', tenantId: 'ten-tunde', propertyId: 'prop-vi-office', startDate: new Date('2025-01-01'), endDate: new Date('2026-12-31'), yearlyRent: 8500000, status: 'ACTIVE' as const },
    { id: 'lease-004', tenantId: 'ten-ngozi', propertyId: 'prop-ikoyi-villa', startDate: new Date('2025-03-01'), endDate: new Date('2026-02-28'), yearlyRent: 12000000, status: 'ACTIVE' as const },
    { id: 'lease-005', tenantId: 'ten-ibrahim', propertyId: 'prop-ajah-estate', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), yearlyRent: 1800000, status: 'ACTIVE' as const },
    { id: 'lease-006', tenantId: 'ten-aisha', propertyId: 'prop-surulere-plaza', startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), yearlyRent: 4200000, status: 'ACTIVE' as const },
  ];

  for (const l of leases) {
    await prisma.lease.upsert({
      where: { id: l.id },
      update: {},
      create: l
    });
  }

  console.log('📋 6 active leases created');

  // ═══════════════════════════════════════
  // PAYMENTS (Mix of PAID, PENDING, OVERDUE)
  // ═══════════════════════════════════════

  const payments = [
    // Emeka - Lekki (₦3.6M/yr = ₦300K/month)
    { id: 'pay-001', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2025-10-01'), paidDate: new Date('2025-10-03'), status: 'PAID' as const, note: 'October 2025 rent' },
    { id: 'pay-002', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2025-11-01'), paidDate: new Date('2025-11-01'), status: 'PAID' as const, note: 'November 2025 rent' },
    { id: 'pay-003', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2025-12-01'), paidDate: new Date('2025-12-05'), status: 'PAID' as const, note: 'December 2025 rent' },
    { id: 'pay-004', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-02'), status: 'PAID' as const, note: 'January 2026 rent' },
    { id: 'pay-005', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2026-02-01'), paidDate: new Date('2026-02-01'), status: 'PAID' as const, note: 'February 2026 rent' },
    { id: 'pay-006', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2026-03-01'), paidDate: new Date('2026-03-04'), status: 'PAID' as const, note: 'March 2026 rent' },
    { id: 'pay-007', leaseId: 'lease-001', amount: 300000, dueDate: new Date('2026-04-01'), status: 'PENDING' as const, note: 'April 2026 rent' },

    // Fatima - Lekki
    { id: 'pay-008', leaseId: 'lease-002', amount: 266667, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-03'), status: 'PAID' as const, note: 'January 2026 rent' },
    { id: 'pay-009', leaseId: 'lease-002', amount: 266667, dueDate: new Date('2026-02-01'), paidDate: new Date('2026-02-02'), status: 'PAID' as const, note: 'February 2026 rent' },
    { id: 'pay-010', leaseId: 'lease-002', amount: 266667, dueDate: new Date('2026-03-01'), status: 'OVERDUE' as const, note: 'March 2026 rent - OVERDUE' },

    // Tunde - VI Office (₦8.5M/yr)
    { id: 'pay-011', leaseId: 'lease-003', amount: 4250000, dueDate: new Date('2025-07-01'), paidDate: new Date('2025-07-01'), status: 'PAID' as const, note: 'H2 2025 office rent' },
    { id: 'pay-012', leaseId: 'lease-003', amount: 4250000, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-05'), status: 'PAID' as const, note: 'H1 2026 office rent' },

    // Ngozi - Ikoyi Villa (₦12M/yr = ₦1M/month)
    { id: 'pay-013', leaseId: 'lease-004', amount: 1000000, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-01'), status: 'PAID' as const, note: 'January 2026 rent' },
    { id: 'pay-014', leaseId: 'lease-004', amount: 1000000, dueDate: new Date('2026-02-01'), paidDate: new Date('2026-02-03'), status: 'PAID' as const, note: 'February 2026 rent' },
    { id: 'pay-015', leaseId: 'lease-004', amount: 1000000, dueDate: new Date('2026-03-01'), paidDate: new Date('2026-03-01'), status: 'PAID' as const, note: 'March 2026 rent' },
    { id: 'pay-016', leaseId: 'lease-004', amount: 1000000, dueDate: new Date('2026-04-01'), status: 'PENDING' as const, note: 'April 2026 rent' },

    // Ibrahim - Ajah Estate (₦1.8M/yr = ₦150K/month)
    { id: 'pay-017', leaseId: 'lease-005', amount: 150000, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-04'), status: 'PAID' as const, note: 'January 2026 rent' },
    { id: 'pay-018', leaseId: 'lease-005', amount: 150000, dueDate: new Date('2026-02-01'), status: 'OVERDUE' as const, note: 'February 2026 rent - OVERDUE' },
    { id: 'pay-019', leaseId: 'lease-005', amount: 150000, dueDate: new Date('2026-03-01'), status: 'PENDING' as const, note: 'March 2026 rent' },

    // Aisha - Surulere Plaza (₦4.2M/yr = ₦350K/month)
    { id: 'pay-020', leaseId: 'lease-006', amount: 350000, dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-01'), status: 'PAID' as const, note: 'January 2026 rent' },
    { id: 'pay-021', leaseId: 'lease-006', amount: 350000, dueDate: new Date('2026-02-01'), paidDate: new Date('2026-02-02'), status: 'PAID' as const, note: 'February 2026 rent' },
    { id: 'pay-022', leaseId: 'lease-006', amount: 350000, dueDate: new Date('2026-03-01'), paidDate: new Date('2026-03-03'), status: 'PAID' as const, note: 'March 2026 rent' },
  ];

  for (const p of payments) {
    await prisma.payment.upsert({
      where: { id: p.id },
      update: {},
      create: p
    });
  }

  console.log('💰 22 payments created (16 paid, 3 pending, 3 overdue)');

  // ═══════════════════════════════════════
  // MAINTENANCE REQUESTS
  // ═══════════════════════════════════════

  const maintenanceRequests = [
    { id: 'maint-001', description: 'Water leaking from ceiling in Unit 4B bathroom. The leak appears to be coming from the flat above. Getting worse during rainfall.', status: 'PENDING' as const, tenantId: 'ten-emeka', propertyId: 'prop-lekki-phase1', workspaceId: workspace.id },
    { id: 'maint-002', description: 'Air conditioning unit in the reception area has stopped working completely. Temperature is unbearable for office staff and visitors.', status: 'IN_PROGRESS' as const, tenantId: 'ten-tunde', propertyId: 'prop-vi-office', workspaceId: workspace.id },
    { id: 'maint-003', description: 'Security gate motor is faulty and the gate cannot close properly at night. This is a serious security concern.', status: 'PENDING' as const, tenantId: 'ten-ngozi', propertyId: 'prop-ikoyi-villa', workspaceId: workspace.id },
    { id: 'maint-004', description: 'Broken window pane in the master bedroom due to recent storm. Need urgent replacement for safety.', status: 'COMPLETED' as const, tenantId: 'ten-fatima', propertyId: 'prop-lekki-phase1', workspaceId: workspace.id },
    { id: 'maint-005', description: 'Generator servicing overdue. The backup generator has not been serviced in 6 months and is making unusual noise.', status: 'IN_PROGRESS' as const, tenantId: 'ten-ibrahim', propertyId: 'prop-ajah-estate', workspaceId: workspace.id },
    { id: 'maint-006', description: 'Parking lot lights are not working on the 2nd floor. Multiple bulbs need replacement. Tenants feel unsafe parking at night.', status: 'PENDING' as const, tenantId: 'ten-aisha', propertyId: 'prop-surulere-plaza', workspaceId: workspace.id },
    { id: 'maint-007', description: 'Elevator stuck between floors twice this week. Needs professional inspection and maintenance urgently.', status: 'PENDING' as const, tenantId: 'ten-tunde', propertyId: 'prop-vi-office', workspaceId: workspace.id },
  ];

  for (const m of maintenanceRequests) {
    await prisma.maintenanceRequest.upsert({
      where: { id: m.id },
      update: {},
      create: m
    });
  }

  console.log('🔧 7 maintenance requests created (4 pending, 2 in progress, 1 completed)');

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════

  console.log('\n🎉 Realistic seeding complete!\n');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  TEST LOGIN CREDENTIALS (Password: Test1234!)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔧 Property Manager:  adebayo@justhub.ng');
  console.log('     → Sees ALL 7 properties, all tenants, all payments');
  console.log('');
  console.log('  🏠 Landlord #1:       chioma.eze@gmail.com');
  console.log('     → Owns: Lekki Gardens, VI Office Tower, Ikoyi Villa');
  console.log('     → 4 tenants, ₦27.3M total rent');
  console.log('');
  console.log('  🏠 Landlord #2:       musa.abdullahi@yahoo.com');
  console.log('     → Owns: Ajah Palm View, Surulere Plaza, Yaba Tech Hub');
  console.log('     → 2 tenants, ₦6M total rent');
  console.log('');
  console.log('  👤 Tenant #1:         emeka.obi@gmail.com');
  console.log('  👤 Tenant #2:         fatima.bello@gmail.com');
  console.log('  👤 Tenant #3:         tunde.williams@gmail.com');
  console.log('══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
