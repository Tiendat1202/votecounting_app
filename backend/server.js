import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";

import authRouter from "./routes/auth.js";
import sessionsRouter from "./routes/sessions.db.js";  // 👈 dùng bản DB
import uploadsRouter from "./routes/uploads.db.js";    // 👈 dùng bản DB
// optional: stats DB
import statsRouter from "./routes/stats.db.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET","POST","DELETE"]
}));
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.resolve("uploads")));

app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/stats", statsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`✅ Backend DB tại http://localhost:${PORT}`));
