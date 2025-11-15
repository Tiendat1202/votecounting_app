import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma.js";

const router = express.Router();
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const { sessionId } = req.params;
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${sessionId}__${unique}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

function isRunning(startAt, endAt) {
  const now = Date.now();
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  return now >= s && now <= e;
}

// POST /api/uploads/:sessionId
router.post("/:sessionId", (req, res) => {
  upload.array("files", 20)(req, res, async (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File quá lớn (tối đa 20MB/ảnh)." : (err.message || "Upload lỗi.");
      return res.status(400).json({ success: false, message: msg });
    }
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ success: false, message: "Phiên không tồn tại." });

    // ❗ Bảo vệ: chỉ nhận upload khi phiên đang diễn ra
    if (!isRunning(session.startAt, session.endAt)) {
      // xoá file tạm đã ghi
      (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      return res.status(400).json({ success: false, message: "Phiên không ở trạng thái ĐANG DIỄN RA." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "Không có file nào." });
    }

    // Ghi metadata vào DB
    const created = await prisma.upload.createMany({
      data: req.files.map((f) => ({
        filename: f.filename,
        original: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        sessionId,
      }))
    });

    res.json({
      success: true,
      count: req.files.length,
      files: (req.files || []).map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        path: f.path,
      })),
      inserted: created.count
    });
  });
});

// GET /api/uploads/:sessionId
router.get("/:sessionId", async (req, res) => {
  const files = await prisma.upload.findMany({
    where: { sessionId: req.params.sessionId },
    orderBy: { createdAt: "desc" }
  });
  // Giữ tương thích FE cũ: trả mảng filename đơn giản
  res.json(files.map(f => f.filename));
});

// DELETE /api/uploads/:sessionId/:filename
router.delete("/:sessionId/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    await prisma.upload.delete({ where: { id: (await prisma.upload.findFirstOrThrow({ where: { filename } })).id } });
  } catch {
    return res.status(404).json({ success: false, message: "Ảnh không tồn tại trong DB." });
  }
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
  res.json({ success: true });
});

// DELETE /api/uploads/:sessionId
router.delete("/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const files = await prisma.upload.findMany({ where: { sessionId } });
  await prisma.upload.deleteMany({ where: { sessionId } });
  let deleted = 0;
  files.forEach((f) => {
    const p = path.join(uploadDir, f.filename);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); deleted++; } catch {} }
  });
  res.json({ success: true, deleted });
});

export default router;
