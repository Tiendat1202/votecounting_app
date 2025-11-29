import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/database";
import { User } from "../entities/User";

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "password";

  const existing = await repo.findOneBy({ email: adminEmail });
  if (existing) {
    console.log("Admin user already exists:", adminEmail);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(adminPassword, 10);
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