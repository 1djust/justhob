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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promises_1 = __importDefault(require("dns/promises"));
const supabase_js_1 = require("@supabase/supabase-js");
async function main() {
    // DNS fallback for Supabase pooler in WSL
    const host = "aws-1-eu-north-1.pooler.supabase.com";
    try {
        const ips = await promises_1.default.resolve4(host);
        if (ips && ips.length > 0) {
            const ip = ips[0];
            if (process.env.DATABASE_URL) {
                process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
            }
            if (process.env.DIRECT_URL) {
                process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
            }
        }
    }
    catch (err) {
        // Silent fallback
    }
    const { PrismaClient } = await Promise.resolve().then(() => __importStar(require("@prisma/client")));
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DIRECT_URL || process.env.DATABASE_URL,
            },
        },
    });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    try {
        console.log("Fetching users from Supabase Auth...");
        let allSupaUsers = [];
        let page = 1;
        const perPage = 100;
        while (true) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
                page,
                perPage,
            });
            if (error) {
                throw new Error(`Failed to list users: ${error.message}`);
            }
            if (!data?.users || data.users.length === 0) {
                break;
            }
            allSupaUsers = allSupaUsers.concat(data.users);
            if (data.users.length < perPage) {
                break;
            }
            page++;
        }
        console.log(`Retrieved ${allSupaUsers.length} users from Supabase Auth.`);
        let createdCount = 0;
        let updatedCount = 0;
        for (const supaUser of allSupaUsers) {
            const email = supaUser.email?.toLowerCase();
            if (!email)
                continue;
            const existingUser = await prisma.user.findUnique({
                where: { id: supaUser.id },
            });
            const metadata = supaUser.user_metadata || {};
            const name = metadata.name || email.split("@")[0];
            // Determine role: must match the Role enum in database (SUPER_ADMIN, PROPERTY_MANAGER, LANDLORD, TENANT)
            let role = metadata.role || "PROPERTY_MANAGER";
            if (!["SUPER_ADMIN", "PROPERTY_MANAGER", "LANDLORD", "TENANT"].includes(role)) {
                role = "PROPERTY_MANAGER";
            }
            if (!existingUser) {
                console.log(`Creating user in Prisma: ${email} (ID: ${supaUser.id}, Role: ${role})`);
                // Also check if user exists by email but different ID
                const existingByEmail = await prisma.user.findUnique({
                    where: { email },
                });
                if (existingByEmail) {
                    console.log(`User email ${email} exists with different ID ${existingByEmail.id}. Updating ID...`);
                    await prisma.$executeRaw `UPDATE "User" SET id = ${supaUser.id} WHERE email = ${email}`;
                    await prisma.user.update({
                        where: { id: supaUser.id },
                        data: {
                            role: role,
                            name,
                        },
                    });
                    updatedCount++;
                }
                else {
                    await prisma.user.create({
                        data: {
                            id: supaUser.id,
                            email,
                            name,
                            role: role,
                            isActive: true,
                            createdAt: supaUser.created_at ? new Date(supaUser.created_at) : undefined,
                        },
                    });
                    createdCount++;
                }
            }
            else {
                // Update role, metadata, and fix createdAt if desynced
                const supaCreatedAt = supaUser.created_at ? new Date(supaUser.created_at) : null;
                const needsDateFix = supaCreatedAt && Math.abs(existingUser.createdAt.getTime() - supaCreatedAt.getTime()) > 60000;
                if (existingUser.role !== role || existingUser.name !== name || existingUser.email !== email || needsDateFix) {
                    console.log(`Updating user in Prisma: ${email} (Role: ${existingUser.role} -> ${role}${needsDateFix ? ', fixing createdAt' : ''})`);
                    await prisma.user.update({
                        where: { id: supaUser.id },
                        data: {
                            email,
                            role: role,
                            name,
                            ...(needsDateFix && supaCreatedAt ? { createdAt: supaCreatedAt } : {}),
                        },
                    });
                    updatedCount++;
                }
            }
        }
        console.log(`Sync completed successfully! Created: ${createdCount}, Updated/Healed: ${updatedCount}`);
    }
    catch (error) {
        console.error("Sync failed:", error.message || error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
