import 'dotenv/config';
import { prisma } from './lib/database';
import { Prisma } from '@prisma/client';

async function setupFreeTenant() {
  const managerEmail = 'free-manager@justhob.com';
  
  // 1. Get Free Workspace
  const user = await prisma.user.findUnique({
    where: { email: managerEmail },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (!user || user.workspaces.length === 0) {
    console.error('Free manager not found. Did you run setup-tiers.ts?');
    return;
  }

  const workspace = user.workspaces[0].workspace;

  // 2. Create 1 Property
  let property = await prisma.property.findFirst({ where: { workspaceId: workspace.id } });
  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Free Tier Property',
        address: '123 Free Street',
        workspaceId: workspace.id
      }
    });
  }

  // 3. Create 1 Unit
  let unit = await prisma.unit.findFirst({ where: { workspaceId: workspace.id } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        unitNumber: 'A1',
        type: 'MINI_FLAT',
        propertyId: property.id,
        workspaceId: workspace.id
      }
    });
  }

  // 4. Create 1 Tenant User (Auth + Prisma)
  const tenantEmail = 'free-tenant@justhob.com';
  let tenantUser = await prisma.user.findUnique({ where: { email: tenantEmail } });
  
  if (!tenantUser) {
    tenantUser = await prisma.user.create({
      data: {
        id: 'free-tenant-user-id', // Mock ID for testing since we aren't creating via Supabase here
        email: tenantEmail,
        name: 'Free Tenant'
      }
    });
  }

  // 5. Add Tenant to Workspace as Member
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: tenantUser.id, workspaceId: workspace.id }
  });

  if (!member) {
    await prisma.workspaceMember.create({
      data: {
        userId: tenantUser.id,
        workspaceId: workspace.id,
        role: 'TENANT'
      }
    });
  }

  // 6. Create Tenant Profile & Lease
  let tenantProfile = await prisma.tenant.findFirst({ where: { email: tenantEmail, workspaceId: workspace.id } });
  
  if (!tenantProfile) {
    tenantProfile = await prisma.tenant.create({
      data: {
        name: 'Free Tenant',
        email: tenantEmail,
        workspaceId: workspace.id
      }
    });

    await prisma.lease.create({
      data: {
        tenantId: tenantProfile.id,
        propertyId: property.id,
        unitId: unit.id,
        startDate: new Date(),
        yearlyRent: 500000,
        status: 'ACTIVE'
      }
    });
  }

  console.log('✅ Free Tenant Setup Complete!');
  console.log(`Tenant Email: ${tenantEmail}`);
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Property ID: ${property.id}`);
  
  // Now simulate creating 4 maintenance requests
  console.log('\n--- Testing Limits ---');
  
  for (let i = 1; i <= 4; i++) {
    try {
      await prisma.$transaction(async (tx: any) => {
        // Lock the workspace record to prevent race conditions on limit checks
        await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspace.id} FOR UPDATE`;

        const ws = await tx.workspace.findUnique({ where: { id: workspace.id } });
        if (ws?.plan === 'FREE') {
          const activeCount = await tx.maintenanceRequest.count({
            where: { 
              workspaceId: workspace.id, 
              status: { in: ['PENDING', 'IN_PROGRESS'] } 
            }
          });
          
          if (activeCount >= 3) {
            throw new Error('LIMIT_MAINTENANCE');
          }
        }

        await tx.maintenanceRequest.create({
          data: {
            tenantId: tenantProfile.id,
            propertyId: property.id,
            workspaceId: workspace.id,
            description: `Issue ticket ${i}`,
            status: 'PENDING'
          }
        });
      }).catch((err: any) => {
        if (err.message === 'LIMIT_MAINTENANCE') {
          throw new Error('Free plan limit reached: Maximum 3 active maintenance tickets allowed. Please upgrade your plan.');
        }
        throw err;
      });
      console.log(`✅ Successfully created Maintenance Ticket ${i}`);
    } catch (e: any) {
      console.log(`❌ Failed creating Maintenance Ticket ${i}: ${e.message}`);
    }
  }

  // Now test PRO Plan
  console.log('\n--- Testing PRO Plan Limits ---');
  
  const proUser = await prisma.user.findUnique({
    where: { email: 'manager@justhob.com' },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (proUser && proUser.workspaces.length > 0) {
    const proWs = proUser.workspaces[0].workspace;
    const proProperty = await prisma.property.findFirst({ where: { workspaceId: proWs.id } });
    const proTenant = await prisma.tenant.findFirst({ where: { workspaceId: proWs.id } });

    if (proProperty && proTenant) {
      for (let i = 1; i <= 4; i++) {
        try {
          await prisma.$transaction(async (tx: any) => {
            const ws = await tx.workspace.findUnique({ where: { id: proWs.id } });
            if (ws?.plan === 'FREE') {
              const activeCount = await tx.maintenanceRequest.count({
                where: { workspaceId: proWs.id, status: { in: ['PENDING', 'IN_PROGRESS'] } }
              });
              if (activeCount >= 3) throw new Error('LIMIT_MAINTENANCE');
            }

            await tx.maintenanceRequest.create({
              data: {
                tenantId: proTenant.id,
                propertyId: proProperty.id,
                workspaceId: proWs.id,
                description: `Pro Issue ticket ${i}`,
                status: 'PENDING'
              }
            });
          });
          console.log(`✅ PRO Plan: Successfully created Maintenance Ticket ${i}`);
        } catch (e: any) {
          console.log(`❌ PRO Plan Failed: ${e.message}`);
        }
      }
    } else {
      console.log('Pro Property or Tenant not found. Run setup-pro-test.ts first.');
    }
  }

  console.log('\n✅ Test complete.');
}

setupFreeTenant().catch(console.error).finally(() => process.exit());
