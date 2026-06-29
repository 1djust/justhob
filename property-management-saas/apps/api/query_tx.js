"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const payments = await prisma.payment.findMany({
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { transactions: true }
    });
    console.log(JSON.stringify(payments, null, 2));
}
main().catch(console.error);
