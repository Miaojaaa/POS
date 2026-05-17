"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
var client_1 = require("@prisma/client");
var adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
var path_1 = __importDefault(require("path"));
var globalForPrisma = globalThis;
function createPrisma() {
    var _a;
    var dbUrl = (_a = process.env.DATABASE_URL) !== null && _a !== void 0 ? _a : "file:".concat(path_1.default.join(process.cwd(), "dev.db"));
    var adapter = new adapter_better_sqlite3_1.PrismaBetterSqlite3({ url: dbUrl });
    return new client_1.PrismaClient({ adapter: adapter });
}
exports.prisma = (_a = globalForPrisma.prisma) !== null && _a !== void 0 ? _a : createPrisma();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
