import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding test users...\n');

  const password = await bcrypt.hash('Test1234!', 10);

  // 1. Create Property Manager
  const pm = await prisma.user.upsert({
    where: { email: 'manager@justhub.com' },
    update: {},
    create: { email: 'manager@justhub.com', name: 'Adebayo Manager', password }
  });
  console.log('✅ Property Manager:', pm.email);

  // 2. Create Landlord (Owner)
  const landlord = await prisma.user.upsert({
    where: { email: 'owner@justhub.com' },
    update: {},
    create: { email: 'owner@justhub.com', name: 'Chioma Owner', password }
  });
  console.log('✅ Landlord:', landlord.email);

  // 3. Create Tenant
  const tenantUser = await prisma.user.upsert({
    where: { email: 'tenant@justhub.com' },
    update: {},
    create: { email: 'tenant@justhub.com', name: 'Emeka Tenant', password }
  });
  console.log('✅ Tenant User:', tenantUser.email);

  // 4. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'test-workspace-001' },
    update: {},
    create: { id: 'test-workspace-001', name: 'Just Hub Properties' }
  });
  console.log('\n🏢 Workspace:', workspace.name);

  // 5. Assign roles
  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: pm.id, workspaceId: workspace.id } },
    update: { role: 'PROPERTY_MANAGER' },
    create: { userId: pm.id, workspaceId: workspace.id, role: 'PROPERTY_MANAGER' }
  });

  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: landlord.id, workspaceId: workspace.id } },
    update: { role: 'LANDLORD' },
    create: { userId: landlord.id, workspaceId: workspace.id, role: 'LANDLORD' }
  });

  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: tenantUser.id, workspaceId: workspace.id } },
    update: { role: 'TENANT' },
    create: { userId: tenantUser.id, workspaceId: workspace.id, role: 'TENANT' }
  });
  console.log('✅ Roles assigned\n');

  // 6. Create test properties
  const prop1 = await prisma.property.upsert({
    where: { id: 'test-prop-001' },
    update: {},
    create: {
      id: 'test-prop-001',
      name: 'Lekki Phase 1 Apartments',
      address: '12 Admiralty Way, Lekki Phase 1, Lagos',
      type: 'Residential',
      units: 8,
      workspaceId: workspace.id,
      ownerId: landlord.id
    }
  });

  const prop2 = await prisma.property.upsert({
    where: { id: 'test-prop-002' },
    update: {},
    create: {
      id: 'test-prop-002',
      name: 'Victoria Island Office Complex',
      address: '45 Adeola Odeku St, Victoria Island, Lagos',
      type: 'Commercial',
      units: 12,
      workspaceId: workspace.id,
      ownerId: landlord.id
    }
  });

  const prop3 = await prisma.property.upsert({
    where: { id: 'test-prop-003' },
    update: {},
    create: {
      id: 'test-prop-003',
      name: 'Ikoyi Luxury Villas',
      address: '8 Bourdillon Rd, Ikoyi, Lagos',
      type: 'Residential',
      units: 4,
      workspaceId: workspace.id,
      ownerId: null // Unassigned
    }
  });
  console.log('🏠 Properties created:', prop1.name, '|', prop2.name, '|', prop3.name);

  // 7. Create a test tenant record
  const tenant = await prisma.tenant.upsert({
    where: { id: 'test-tenant-001' },
    update: {},
    create: {
      id: 'test-tenant-001',
      name: 'Emeka Tenant',
      email: 'tenant@justhub.com',
      phone: '+2348012345678',
      workspaceId: workspace.id
    }
  });

  // 8. Create a lease
  await prisma.lease.upsert({
    where: { id: 'test-lease-001' },
    update: {},
    create: {
      id: 'test-lease-001',
      tenantId: tenant.id,
      propertyId: prop1.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      yearlyRent: 2400000,
      status: 'ACTIVE'
    }
  });
  console.log('📋 Lease created for', tenant.name);

  console.log('\n🎉 Seeding complete!\n');
  console.log('═══════════════════════════════════════════');
  console.log('  TEST LOGIN CREDENTIALS');
  console.log('  Password for ALL accounts: Test1234!');
  console.log('═══════════════════════════════════════════');
  console.log('  🔧 Property Manager: manager@justhub.com');
  console.log('  🏠 Landlord (Owner): owner@justhub.com');
  console.log('  👤 Tenant:           tenant@justhub.com');
  console.log('═══════════════════════════════════════════\n');

  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
