import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require("./apps/api/src/lib/database");

async function clearAllPro() {
  const user = await prisma.user.findUnique({ where: { email: "manager_pro@justhob.com" } });
  if (!user) return;
  const workspaceMember = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
  if (!workspaceMember) return;
  
  const wId = workspaceMember.workspaceId;
  
  // Wipe everything in this workspace
  await prisma.payment.deleteMany({ where: { workspaceId: wId } });
  await prisma.maintenanceRequest.deleteMany({ where: { workspaceId: wId } });
  await prisma.lease.deleteMany({ where: { tenant: { workspaceId: wId } } });
  await prisma.unit.deleteMany({ where: { workspaceId: wId } });
  await prisma.tenant.deleteMany({ where: { workspaceId: wId } });
  await prisma.property.deleteMany({ where: { workspaceId: wId } });
  
  console.log("✅ Wiped all data for PRO manager.");
}
clearAllPro().then(() => process.exit(0));
