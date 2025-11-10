// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import sessionsRouter from "./routes/sessions.js";
import uploadsRouter from "./routes/uploads.js";
import statsRouter from "./routes/stats.js";
import authRouter from "./routes/auth.js";
import path from "path";

dotenv.config();
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,                     // 👈 CHO PHÉP COOKIE
  methods: ["GET","POST","DELETE"]
}));
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.resolve("uploads")));

app.use("/api/auth", authRouter);        // 👈 ROUTER AUTH
app.use("/api/sessions", sessionsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/stats", statsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`✅ Backend tại http://localhost:${PORT}`));
