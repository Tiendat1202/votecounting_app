// backend/prisma.config.ts
import 'dotenv/config';                     // 👈 bắt buộc để .env được nạp
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',         // đường dẫn schema
});
