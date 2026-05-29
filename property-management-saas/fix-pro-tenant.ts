import { prisma } from './apps/api/src/lib/database';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), 'apps/api/.env') });

async function fixProTenant() {
  const email = 'pro-tenant@justhob.com';
  let tenant = await prisma.tenant.findFirst({
    where: { email },
    include: { leases: true }
  });

  if (!tenant) {
    console.log(`Creating tenant ${email}...`);
    // Find an existing workspace to attach to
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@justhob.com' } });
    const workspaceMember = await prisma.workspaceMember.findFirst({ where: { userId: adminUser?.id } });
    
    if (!workspaceMember) {
      console.error('No workspace found to attach tenant to.');
      process.exit(1);
    }

    const workspaceId = workspaceMember.workspaceId;

    tenant = await prisma.tenant.create({
      data: {
        workspaceId,
        email,
        name: 'Pro Tenant',
        phone: '+2348000000003',
      },
      include: { leases: true }
    });
  }

  if (tenant.leases.length === 0) {
    console.log(`Creating lease for ${email}...`);
    // Find or create a property
    let property = await prisma.property.findFirst({ where: { workspaceId: tenant.workspaceId } });
    if (!property) {
      property = await prisma.property.create({
        data: {
          workspaceId: tenant.workspaceId,
          name: 'Premium Suite 3',
          address: '789 Pro Avenue',
          type: 'APARTMENT'
        }
      });
    }

    // Create a unit
    let unit = await prisma.unit.findFirst({ where: { propertyId: property.id, status: 'VACANT' } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: 'A3',
          rentAmount: 300000,
          status: 'VACANT'
        }
      });
    }

    await prisma.lease.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        workspaceId: tenant.workspaceId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        rentAmount: 300000,
        status: 'ACTIVE',
        paymentCycle: 'YEARLY'
      }
    });
  }
  
  console.log(`Tenant ${email} is ready for setup-mega-test.ts!`);
}

fixProTenant().catch(console.error).finally(() => process.exit(0));
