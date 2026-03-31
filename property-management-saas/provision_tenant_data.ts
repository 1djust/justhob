
import { prisma } from './packages/database';

async function main() {
  const email = 'tenant-final@test.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found');

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, role: 'TENANT' },
    include: { workspace: true }
  });
  if (!membership) throw new Error('No tenant membership found');

  const workspaceId = membership.workspaceId;
  console.log('Target Workspace:', membership.workspace.name, workspaceId);

  // 1. Create Tenant record
  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-final-id' }, // Just a stable ID for debugging
    update: { email, name: user.name || 'Final Tenant', workspaceId },
    create: { 
      id: 'tenant-final-id',
      email, 
      name: user.name || 'Final Tenant', 
      workspaceId 
    }
  });
  console.log('Tenant Record Created:', tenant.id);

  // 2. Find a property in the workspace
  const property = await prisma.property.findFirst({ where: { workspaceId } });
  if (!property) {
    console.log('No property found in workspace. Creating one...');
    const newProperty = await prisma.property.create({
      data: {
        name: 'Ocean View Apartments',
        address: '123 Beach Blvd, Miami, FL',
        type: 'APARTMENT',
        workspaceId
      }
    });
    console.log('Property Created:', newProperty.id);
    
    // 3. Create Lease
    const lease = await prisma.lease.create({
      data: {
        tenantId: tenant.id,
        propertyId: newProperty.id,
        startDate: new Date(),
        monthlyRent: 1500,
        status: 'ACTIVE'
      }
    });
    console.log('Lease Created:', lease.id);
  } else {
    // Check for existing lease
    const existingLease = await prisma.lease.findFirst({ where: { tenantId: tenant.id, status: 'ACTIVE' } });
    if (!existingLease) {
      const lease = await prisma.lease.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          startDate: new Date(),
          monthlyRent: 1500,
          status: 'ACTIVE'
        }
      });
      console.log('Lease Created for existing property:', lease.id);
    } else {
      console.log('Lease already exists:', existingLease.id);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
