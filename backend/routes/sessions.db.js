import express from "express";
import { prisma } from "../db/prisma.js";

const router = express.Router();

// GET /api/sessions
router.get("/", async (_req, res) => {
  const items = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    include: { candidates: true },
  });
  res.json(items);
});

// POST /api/sessions
router.post("/", async (req, res) => {
  const { name, type, startAt, endAt, candidates } = req.body || {};
  if (!name || !type || !startAt || !endAt || !Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ message: "Thiếu dữ liệu tạo phiên." });
  }
  const created = await prisma.session.create({
    data: {
      name,
      type,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      candidates: {
        create: candidates.map((n) => ({ name: n }))
      }
    },
    include: { candidates: true }
  });
  res.json(created);
});

// GET /api/sessions/:id
router.get("/:id", async (req, res) => {
  const item = await prisma.session.findUnique({
    where: { id: req.params.id },
    include: { candidates: true, uploads: true }
  });
  if (!item) return res.status(404).json({ message: "Không tìm thấy phiên." });
  res.json(item);
});

// DELETE /api/sessions/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.session.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ success: false, message: "Không tìm thấy phiên." });
  }
});

export default router;
