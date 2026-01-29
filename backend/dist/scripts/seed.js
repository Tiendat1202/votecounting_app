"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
async function seed() {
    await database_1.AppDataSource.initialize();
    const repo = database_1.AppDataSource.getRepository(User_1.User);
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "password";
    const existing = await repo.findOneBy({ email: adminEmail });
    if (existing) {
        console.log("Admin user already exists:", adminEmail);
        process.exit(0);
    }
    const hashed = await bcryptjs_1.default.hash(adminPassword, 10);
    const admin = repo.create({
        email: adminEmail,
        password: hashed,
        role: "admin"
    });
    await repo.save(admin);
    console.log("Admin user created:", adminEmail);
    process.exit(0);
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
