if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") }); 
dotenv.config({ path: join(process.cwd(), ".env") }); 
const { prisma } = require("./src/lib/database");

async function check() {
  const user = await prisma.user.findUnique({ where: { email: "manager@justhob.com" }, include: { workspaces: true } });
  console.log("User:", user?.email, "Workspaces:", user?.workspaces.length);
  if(user && user.workspaces[0]) {
    const props = await prisma.property.count({ where: { workspaceId: user.workspaces[0].workspaceId } });
    console.log("Properties count:", props);
  }
}
check().finally(() => prisma.$disconnect());
