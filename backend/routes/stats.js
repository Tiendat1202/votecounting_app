import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();
const filePath = path.resolve("data/sessions.json");

// Giả lập số liệu thống kê
router.get("/", (req, res) => {
  const now = Date.now();
  const sessions = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const running = sessions.filter(
    (s) =>
      new Date(s.startAt).getTime() <= now &&
      new Date(s.endAt).getTime() >= now
  );
  const finished = sessions.filter((s) => new Date(s.endAt).getTime() < now);
  const upcoming = sessions.filter((s) => new Date(s.startAt).getTime() > now);

  res.json({
    totalSessions: sessions.length,
    running: running.length,
    finished: finished.length,
    upcoming: upcoming.length,
  });
});

export default router;
