"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
dotenv.config({ path: (0, path_1.join)(process.cwd(), "../../.env") });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const manager = await prisma.user.findUnique({
        where: { email: "manager@justhob.com" }
    });
    if (!manager)
        return console.log("Manager not found");
    const workspaceMember = await prisma.workspaceMember.findFirst({
        where: { userId: manager.id }
    });
    if (!workspaceMember)
        return console.log("Workspace not found");
    const payments = await prisma.payment.findMany({
        where: { workspaceId: workspaceMember.workspaceId }
    });
    const statuses = ["PAID", "PENDING", "UNDER_REVIEW", "OVERDUE"];
    for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        const newStatus = statuses[i % statuses.length];
        await prisma.payment.update({
            where: { id: p.id },
            data: {
                status: newStatus,
                proofUrl: (newStatus === "UNDER_REVIEW") ? "https://example.com/proof.jpg" : p.proofUrl,
                rejectionReason: p.rejectionReason,
                paidDate: newStatus === "PAID" ? new Date() : p.paidDate
            }
        });
        console.log(`Updated ${p.id.slice(0, 8)}... to ${newStatus}`);
    }
    console.log("Done updating payment statuses!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
