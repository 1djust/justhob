if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") }); 
dotenv.config({ path: join(process.cwd(), ".env") }); 
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
const prisma = new PrismaClient();

async function run() {
  try {
    const email = "djokn@gmail.com";
    
    // Check if Tenant record exists
    const tenantRecord = await prisma.tenant.findFirst({ where: { email } });
    if (!tenantRecord) {
      console.log(`No Tenant record found with email ${email}`);
    } else {
      console.log(`Found Tenant record: ${tenantRecord.name}`);
    }

    // Check if User record exists
    let user = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await hash("Test1234!", 10);

    if (!user) {
      console.log(`User account not found for ${email}. Creating it now...`);
      user = await prisma.user.create({
        data: {
          email,
          name: tenantRecord?.name || "Test Tenant",
          password: passwordHash,
        }
      });
      console.log(`Created User account for ${email}`);
      
      if (tenantRecord) {
        // Link to workspace as TENANT
        await prisma.workspaceMember.create({
          data: {
            workspaceId: tenantRecord.workspaceId,
            userId: user.id,
            role: "TENANT"
          }
        });
        console.log(`Linked User to Workspace ${tenantRecord.workspaceId}`);
      }
    } else {
      console.log(`User account exists for ${email}. Resetting password to Test1234!`);
      await prisma.user.update({
        where: { email },
        data: { password: passwordHash }
      });
      console.log(`Password reset successfully.`);
    }

    console.log("Done. They can log in with: djokn@gmail.com / Test1234!");
  } catch (e) {
    console.log("ERROR", e);
  }
}
run().finally(() => prisma.$disconnect());
