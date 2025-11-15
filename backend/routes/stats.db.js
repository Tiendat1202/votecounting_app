import express from "express";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const [totalSessions, totalUploads] = await Promise.all([
    prisma.session.count(),
    prisma.upload.count(),
  ]);

  const sessions = await prisma.session.findMany({ select: { id: true, startAt: true, endAt: true } });
  const now = Date.now();
  let running = 0, finished = 0, upcoming = 0;
  sessions.forEach(s => {
    const st = new Date(s.startAt).getTime();
    const en = new Date(s.endAt).getTime();
    if (now < st) upcoming++;
    else if (now >= st && now <= en) running++;
    else finished++;
  });

  res.json({ totalSessions, totalUploads, running, finished, upcoming });
});

export default router;
