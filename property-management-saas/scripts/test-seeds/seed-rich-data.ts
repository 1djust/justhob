if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require("./apps/api/src/lib/database");

async function seedRichData() {
  console.log("🌱 Seeding rich data for Pro Manager...");

  // Find the Pro Manager workspace
  const proManager = await prisma.user.findUnique({
    where: { email: "manager_pro@justhob.com" },
  });

  if (!proManager) {
    console.error(
      "Pro Manager not found. Run setup-pro-ent-accounts.ts first.",
    );
    return;
  }

  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: { userId: proManager.id },
  });

  if (!workspaceMember) {
    console.error("Workspace not found for Pro Manager.");
    return;
  }

  const workspaceId = workspaceMember.workspaceId;

  // 1. Create multiple properties
  const propertiesData = [
    {
      name: "Lekki Phase 1 Apartments",
      address: "Admiralty Way, Lekki",
      units: 6,
    },
    { name: "Victoria Island Towers", address: "Adeola Odeku, VI", units: 8 },
    {
      name: "Ikoyi Luxury Villas",
      address: "Bourdillon Road, Ikoyi",
      units: 4,
    },
  ];

  for (const p of propertiesData) {
    const property = await prisma.property.create({
      data: {
        name: p.name,
        address: p.address,
        workspaceId,
        ownerId: proManager.id,
      },
    });

    // Create units for this property
    const units = [];
    for (let i = 1; i <= p.units; i++) {
      const isOccupied = Math.random() > 0.3; // 70% occupied
      const unit = await prisma.unit.create({
        data: {
          unitNumber: `A${i}`,
          type: "TWO_BEDROOM_FLAT",
          status: isOccupied ? "OCCUPIED" : "VACANT",
          propertyId: property.id,
          workspaceId,
        },
      });
      units.push(unit);

      if (isOccupied) {
        const realNames = [
          "Chinedu Okafor",
          "Aisha Bello",
          "Oluwaseun Adeyemi",
          "Ngozi Eze",
          "Tunde Bakare",
          "Emeka Nwosu",
          "Fatima Aliyu",
          "Damilola Coker",
          "Ifeanyi Okeke",
          "Zainab Usman",
          "Kehinde Ojo",
          "Babangida Musa",
          "Chioma Nnaji",
          "Abiola Johnson",
          "Samuel Kalu",
          "Ibrahim Yakubu",
        ];
        const randomName =
          realNames[Math.floor(Math.random() * realNames.length)];
        // Create Tenant
        const tenant = await prisma.tenant.create({
          data: {
            name: randomName,
            email: `${randomName.toLowerCase().replace(" ", ".")}@example.com`,
            phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
            workspaceId,
          },
        });

        const startDate = new Date();
        startDate.setMonth(
          startDate.getMonth() - Math.floor(Math.random() * 10),
        ); // random start in past 10 months
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Randomize lease status slightly, but mostly ACTIVE
        const leaseStatus = endDate < new Date() ? "EXPIRED" : "ACTIVE";

        const lease = await prisma.lease.create({
          data: {
            tenantId: tenant.id,
            propertyId: property.id,
            unitId: unit.id,
            startDate,
            endDate,
            yearlyRent: 2500000 + Math.random() * 1500000,
            status: leaseStatus,
          },
        });

        // Generate payments
        // 1 past payment (PAID)
        const pastDate = new Date(startDate);
        await prisma.payment.create({
          data: {
            leaseId: lease.id,
            workspaceId,
            amount: lease.yearlyRent,
            status: "PAID",
            dueDate: pastDate,
            paidDate: new Date(pastDate.getTime() + 86400000 * 2),
            note: "First year rent",
          },
        });

        // 1 possible upcoming or overdue payment depending on random
        const rand = Math.random();
        if (rand > 0.5) {
          const isOverdue = rand > 0.8;
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + (isOverdue ? -15 : 15)); // 15 days ago or 15 days from now
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
        if (Math.random() > 0.6) {
          await prisma.maintenanceRequest.create({
            data: {
              description: "AC not cooling properly in the master bedroom.",
              status: Math.random() > 0.5 ? "PENDING" : "IN_PROGRESS",
              tenantId: tenant.id,
              propertyId: property.id,
              workspaceId,
            },
          });
        }
      }
    }
  }

  console.log("✅ Rich data generated for Pro Manager workspace!");
}

seedRichData()
  .catch(console.error)
  .finally(() => process.exit(0));
