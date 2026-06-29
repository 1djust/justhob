"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const tenant = await prisma.tenant.findFirst({
        where: { email: 'tenant@justhob.com' },
        include: { workspace: true }
    });
    console.log("Tenant allowPartialPayments:", tenant?.allowPartialPayments);
    console.log("Workspace allowPartialPayments:", tenant?.workspace?.allowPartialPayments);
}
main().catch(console.error).finally(() => prisma.$disconnect());
