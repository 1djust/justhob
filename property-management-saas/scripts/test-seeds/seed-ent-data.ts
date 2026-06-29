if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require("./apps/api/src/lib/database");

async function seedEntData() {
  console.log("🌱 Seeding realistic Enterprise data for manager_ent...");

  // Find the Enterprise Manager workspace
  const entManager = await prisma.user.findUnique({
    where: { email: "manager_ent@justhob.com" },
  });

  if (!entManager) {
    console.error(
      "Enterprise Manager not found. Run setup-pro-ent-accounts.ts first.",
    );
    return;
  }

  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: { userId: entManager.id },
  });

  if (!workspaceMember) {
    console.error("Workspace not found for Enterprise Manager.");
    return;
  }

  const workspaceId = workspaceMember.workspaceId;

  // 1. Create multiple large properties
  const propertiesData = [
    {
      name: "Eko Atlantic Highrise",
      address: "Ahmadu Bello Way, VI",
      units: 20,
    },
    {
      name: "Banana Island Estates",
      address: "Banana Island, Ikoyi",
      units: 15,
    },
    { name: "Ikeja GRA Mansions", address: "Isaac John, Ikeja GRA", units: 12 },
    {
      name: "Abuja Central Plaza",
      address: "Central Business District, Abuja",
      units: 25,
    },
  ];

  for (const p of propertiesData) {
    const property = await prisma.property.create({
      data: {
        name: p.name,
        address: p.address,
        workspaceId,
        ownerId: entManager.id,
      },
    });

    // Create units for this property
    const units = [];
    for (let i = 1; i <= p.units; i++) {
      const isOccupied = Math.random() > 0.15; // 85% occupied
      const unit = await prisma.unit.create({
        data: {
          unitNumber: `B${i}`,
          type: i % 3 === 0 ? "THREE_BEDROOM_FLAT" : "TWO_BEDROOM_FLAT",
          status: isOccupied ? "OCCUPIED" : "VACANT",
          propertyId: property.id,
          workspaceId,
        },
      });
      units.push(unit);

      if (isOccupied) {
        // Create Tenant
        const tenant = await prisma.tenant.create({
          data: {
            name: `Ent Tenant ${property.name.split(" ")[0]} ${i}`,
            email: `ent_tenant_${property.id.substring(0, 4)}_${i}@example.com`,
            phone: `081${Math.floor(10000000 + Math.random() * 90000000)}`,
            workspaceId,
          },
        });

        const startDate = new Date();
        startDate.setMonth(
          startDate.getMonth() - Math.floor(Math.random() * 24),
        ); // up to 2 years ago
        const endDate = new Date(startDate);
        endDate.setFullYear(
          endDate.getFullYear() + (Math.random() > 0.5 ? 1 : 2),
        ); // 1 or 2 year lease

        const leaseStatus = endDate < new Date() ? "EXPIRED" : "ACTIVE";

        const lease = await prisma.lease.create({
          data: {
            tenantId: tenant.id,
            propertyId: property.id,
            unitId: unit.id,
            startDate,
            endDate,
            yearlyRent: 5000000 + Math.random() * 10000000, // 5M to 15M
            status: leaseStatus,
          },
        });

        // 2 past payments (PAID)
        const pastDate1 = new Date(startDate);
        await prisma.payment.create({
          data: {
            leaseId: lease.id,
            workspaceId,
            amount: lease.yearlyRent,
            status: "PAID",
            dueDate: pastDate1,
            paidDate: new Date(
              pastDate1.getTime() + 86400000 * Math.floor(Math.random() * 10),
            ),
            note: "Initial Rent Payment",
          },
        });

        // 1 upcoming or overdue payment depending on random
        const targetDate = new Date();
        const rand = Math.random();
        if (rand > 0.3) {
          // 70% chance of having another payment pending/overdue
          const isOverdue = rand > 0.7; // 30% overdue, 40% pending
          targetDate.setDate(targetDate.getDate() + (isOverdue ? -30 : 30));
          await prisma.payment.create({
            data: {
              leaseId: lease.id,
              workspaceId,
              amount: lease.yearlyRent,
              status: isOverdue ? "OVERDUE" : "PENDING",
              dueDate: targetDate,
              note: isOverdue ? "Overdue Rent" : "Upcoming Rent",
            },
          });
        }

        // Generate maintenance request occasionally
        if (Math.random() > 0.7) {
          await prisma.maintenanceRequest.create({
            data: {
              description: "Water pressure is very low in the guest bathroom.",
              status:
                Math.random() > 0.5
                  ? "PENDING"
                  : Math.random() > 0.5
                    ? "IN_PROGRESS"
                    : "COMPLETED",
              tenantId: tenant.id,
              propertyId: property.id,
              workspaceId,
            },
          });
        }
      }
    }
  }

  console.log(
    "✅ Rich realistic Enterprise data generated for manager_ent@justhob.com!",
  );
}

seedEntData()
  .catch(console.error)
  .finally(() => process.exit(0));
