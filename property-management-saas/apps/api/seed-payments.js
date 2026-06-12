"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var path_1 = require("path");
dotenv.config({ path: (0, path_1.join)(process.cwd(), "../../.env") });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var manager, wm, workspaceId, properties, leases, statuses, i, lease, newStatus, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, prisma.user.findUnique({ where: { email: "manager@justhob.com" } })];
                case 1:
                    manager = _a.sent();
                    if (!manager) {
                        console.error("Manager not found");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.workspaceMember.findFirst({ where: { userId: manager.id, role: "PROPERTY_MANAGER" } })];
                case 2:
                    wm = _a.sent();
                    if (!wm) {
                        console.error("Workspace member not found");
                        return [2 /*return*/];
                    }
                    workspaceId = wm.workspaceId;
                    return [4 /*yield*/, prisma.property.findMany({ where: { workspaceId: workspaceId } })];
                case 3:
                    properties = _a.sent();
                    if (properties.length === 0) {
                        console.error("No properties");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.lease.findMany({
                            where: { propertyId: { in: properties.map(function (p) { return p.id; }) } }
                        })];
                case 4:
                    leases = _a.sent();
                    if (leases.length === 0) {
                        console.error("No leases found to attach payments to");
                        return [2 /*return*/];
                    }
                    statuses = ["PAID", "PENDING", "UNDER_REVIEW", "REJECTED", "OVERDUE"];
                    i = 0;
                    _a.label = 5;
                case 5:
                    if (!(i < 15)) return [3 /*break*/, 8];
                    lease = leases[i % leases.length];
                    newStatus = statuses[i % statuses.length];
                    return [4 /*yield*/, prisma.payment.create({
                            data: {
                                workspaceId: workspaceId,
                                leaseId: lease.id,
                                amount: Math.floor(Math.random() * 500000) + 100000,
                                dueDate: new Date(Date.now() + (i - 7) * 86400000 * 5),
                                status: newStatus,
                                proofUrl: (newStatus === "UNDER_REVIEW" || newStatus === "REJECTED") ? "https://example.com/proof.jpg" : undefined,
                                rejectionReason: newStatus === "REJECTED" ? "Receipt image is blurry" : undefined,
                                paidDate: newStatus === "PAID" ? new Date() : undefined,
                                transactionId: "TXN-".concat(Date.now(), "-").concat(i)
                            }
                        })];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    i++;
                    return [3 /*break*/, 5];
                case 8:
                    console.log("Successfully seeded 15 payments with mixed statuses!");
                    return [3 /*break*/, 10];
                case 9:
                    err_1 = _a.sent();
                    console.error("ERROR:", err_1);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
main().finally(function () { return prisma.$disconnect(); });
