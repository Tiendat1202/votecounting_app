import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  
  const hashedPassword = await bcrypt.hash("123456", 10);

  // Tạo user admin@example.com
  await prisma.user.upsert({
  where: { email: "admin@example.com" },
  update: { role: "ADMIN" },
  create: {
    email: "admin@example.com",
    password: hashedPassword,
    role: "ADMIN"
    },
  });

  // Nếu muốn thêm user thường
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      password: hashedPassword,
      role: "USER"
    },
  });
}
main()
  .then(() => {
    console.log(" Seed xong user test");
  })
  .catch((err) => {
    console.error("Seed lỗi:", err);
  })
  .finally(() => prisma.$disconnect());