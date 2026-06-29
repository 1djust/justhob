"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("=== Raw DB Query Performance ===");
    const startConnect = Date.now();
    await prisma.$connect();
    console.log(`Connected to DB in ${Date.now() - startConnect}ms`);
    const workspaceId = "468f2272-f15d-4fe7-88a4-cdf26893c48d";
    const queries = [
        { name: "Count Workspace", run: () => prisma.workspace.count() },
        {
            name: "Query Properties",
            run: () => prisma.property.findMany({ where: { workspaceId } }),
        },
        {
            name: "Query Tenants",
            run: () => prisma.tenant.findMany({ where: { workspaceId, deletedAt: null } }),
        },
        {
            name: "Query Payments",
            run: () => prisma.payment.findMany({ where: { workspaceId } }),
        },
    ];
    for (const q of queries) {
        console.log(`Running: ${q.name}...`);
        const start = Date.now();
        const res = await q.run();
        console.log(`  Done in ${Date.now() - start}ms, results count: ${res.length ?? res}`);
    }
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
