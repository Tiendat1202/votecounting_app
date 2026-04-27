import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/database";
import { User } from "../entities/User";

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@vote.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const adminFullName = process.env.SEED_ADMIN_FULLNAME || "Quản trị hệ thống";

  const existing = await repo.findOneBy({ email: adminEmail });
  if (existing) {
    existing.role = "admin";
    existing.status = "active";
    existing.fullName = existing.fullName || adminFullName;
    await repo.save(existing);
    console.log("Admin user already exists and has been normalized:", adminEmail);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(adminPassword, 10);
  const admin = repo.create({
    fullName: adminFullName,
    email: adminEmail,
    password: hashed,
    role: "admin",
    status: "active",
  });

  await repo.save(admin);
  console.log("Admin user created:", adminEmail);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
