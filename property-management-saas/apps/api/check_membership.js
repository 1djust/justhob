"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const tenant = await prisma.tenant.findFirst({
        where: { email: 'tenant@justhob.com', workspaceId: 'test-workspace-001', deletedAt: null }
    });
    if (!tenant)
        return console.log("Tenant not found");
    try {
        const payments = await prisma.payment.findMany({
            where: { lease: { tenantId: tenant.id } },
            include: {
                lease: {
                    include: {
                        property: { select: { id: true, name: true, address: true } }
                    }
                }
            },
            orderBy: { dueDate: "desc" }
        });
        console.log("Payments returned:", payments.length);
        console.log(JSON.stringify(payments, null, 2));
    }
    catch (e) {
        console.error("Error querying payments:", e);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
