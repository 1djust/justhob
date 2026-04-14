import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@property-management/database';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Test1234!';
const WORKSPACE_NAME = 'Seed Workspace';
const PROPERTY_NAME = 'Emerald Gardens';

const users = [
  {
    email: 'manager@justhob.com',
    name: 'Test Manager',
    role: 'PROPERTY_MANAGER' as const,
  },
  {
    email: 'landlord@justhob.com',
    name: 'Test Landlord',
    role: 'LANDLORD' as const,
  },
  {
    email: 'tenant@justhob.com',
    name: 'Test Tenant',
    role: 'TENANT' as const,
  }
];

async function seed() {
  console.log('--- Starting Role Seeding ---');

  try {
    // 1. Ensure Workspace exists
    let workspace = await prisma.workspace.findFirst({ where: { name: WORKSPACE_NAME } });
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: WORKSPACE_NAME,
        }
      });
      console.log(`Created workspace: ${workspace.name}`);
    }

    // 2. Ensure Property exists
    let property = await prisma.property.findFirst({ where: { name: PROPERTY_NAME, workspaceId: workspace.id } });
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: PROPERTY_NAME,
          address: '123 Testing Lane, Lagos',
          workspaceId: workspace.id,
        }
      });
      console.log(`Created property: ${property.name}`);
    }

    // 3. Ensure Unit exists
    let unit = await prisma.unit.findFirst({ where: { propertyId: property.id } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          unitNumber: 'A1',
          type: 'TWO_BEDROOM_FLAT',
          status: 'VACANT',
          propertyId: property.id,
          workspaceId: workspace.id,
        }
      });
      console.log(`Created unit: ${unit.unitNumber}`);
    }

    for (const userData of users) {
      console.log(`\nProcessing ${userData.role}: ${userData.email}`);

      // A. Supabase Auth
      const { data: usersData } = await supabase.auth.admin.listUsers();
      let supaUser = usersData?.users.find(u => u.email === userData.email);

      if (!supaUser) {
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { name: userData.name, role: userData.role }
        });
        if (createError) throw createError;
        supaUser = authData.user;
        console.log('Created user in Supabase Auth');
      } else {
        await supabase.auth.admin.updateUserById(supaUser.id, {
          email_confirm: true,
          password: DEFAULT_PASSWORD,
          user_metadata: { ...supaUser.user_metadata, name: userData.name, role: userData.role }
        });
        console.log('Updated user in Supabase Auth');
      }

      // B. Prisma User
      let dbUser = await prisma.user.findUnique({ where: { id: supaUser.id } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            id: supaUser.id,
            email: supaUser.email!,
            name: userData.name,
          }
        });
        console.log('Created user in Prisma');
      }

      // C. Workspace Membership
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: dbUser.id, workspaceId: workspace.id } }
      });

      if (!membership) {
        await prisma.workspaceMember.create({
          data: {
            userId: dbUser.id,
            workspaceId: workspace.id,
            role: userData.role,
          }
        });
        console.log(`Added user to workspace as ${userData.role}`);
      } else if (membership.role !== userData.role) {
        await prisma.workspaceMember.update({
          where: { id: membership.id },
          data: { role: userData.role }
        });
        console.log(`Updated workspace role to ${userData.role}`);
      }

      // D. Role-specific data
      if (userData.role === 'TENANT') {
        // Ensure a Tenant record exists in the workspace
        let tenantRecord = await prisma.tenant.findFirst({
           where: { workspaceId: workspace.id, email: userData.email } 
        });
        
        if (!tenantRecord) {
          tenantRecord = await prisma.tenant.create({
            data: {
              name: userData.name,
              email: userData.email,
              workspaceId: workspace.id,
            }
          });
          console.log('Created Tenant management record');
        }

        // Ensure a Lease exists for the unit
        const lease = await prisma.lease.findFirst({
          where: { tenantId: tenantRecord.id, unitId: unit.id }
        });

        if (!lease) {
          await prisma.lease.create({
            data: {
              tenantId: tenantRecord.id,
              propertyId: property.id,
              unitId: unit.id,
              startDate: new Date(),
              yearlyRent: 1200000,
              status: 'ACTIVE',
            }
          });
          await prisma.unit.update({
            where: { id: unit.id },
            data: { status: 'OCCUPIED' }
          });
          console.log('Created active lease and marked unit as occupied');
        }
      }
      
      if (userData.role === 'LANDLORD') {
        // Link property to landlord if not already linked
        if (property.ownerId !== dbUser.id) {
          await prisma.property.update({
             where: { id: property.id },
             data: { ownerId: dbUser.id }
          });
          console.log('Assigned property ownership to landlord');
        }
      }
    }

    console.log('\n--- Seeding Completed Successfully ---');
    console.log(`Credentials: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
