import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.sessionId;
    const uploadDir = path.join(__dirname, "../../uploads", sessionId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Upload ảnh
router.post("/api/upload/:sessionId", upload.array("files", 50), (req: Request, res: Response) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const files = (req.files as Express.Multer.File[]).map((f) => ({
    filename: f.filename,
    originalname: f.originalname,
    size: f.size,
  }));

  res.json({ success: true, files });
});

// Get uploaded files
router.get("/api/uploads/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads", sessionId);

  if (!fs.existsSync(uploadDir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(uploadDir);
  res.json(files);
});

// Delete file
router.delete("/api/uploads/:sessionId/:filename", (req: Request, res: Response) => {
  const { sessionId, filename } = req.params;
  const filepath = path.join(__dirname, "../../uploads", sessionId, filename);

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "File not found" });
});

// Delete all files in session
router.delete("/api/uploads/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads", sessionId);

  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true });
  }

  res.json({ success: true });
});

export default router;