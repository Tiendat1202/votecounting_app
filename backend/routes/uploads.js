import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

// Thư mục lưu ảnh
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ Cấu hình multer (ghi tên file có sessionId để dễ lọc)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const { sessionId } = req.params;
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${sessionId}__${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // giới hạn 10MB
});

// ✅ Upload nhiều ảnh
router.post("/:sessionId", upload.array("files", 10), (req, res) => {
  const { sessionId } = req.params;
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Không có file nào được tải lên" });
  }

  const uploaded = req.files.map((f) => ({
    sessionId,
    filename: f.filename,
    originalname: f.originalname,
    size: f.size,
    mimetype: f.mimetype,
    path: f.path,
    uploadedAt: new Date().toISOString(),
  }));

  res.json({
    success: true,
    count: uploaded.length,
    files: uploaded,
  });
});

// ✅ Lấy danh sách ảnh của phiên
router.get("/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const files = fs
    .readdirSync(uploadDir)
    .filter((name) => name.startsWith(sessionId + "__"));
  res.json(files);
});

// 🗑️ Xóa 1 ảnh cụ thể
router.delete("/:sessionId/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Ảnh không tồn tại" });
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: "Đã xóa ảnh thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi khi xóa ảnh" });
  }
});

// 🧹 Xóa toàn bộ ảnh của 1 phiên
router.delete("/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const files = fs
    .readdirSync(uploadDir)
    .filter((name) => name.startsWith(sessionId + "__"));
  let deleted = 0;
  files.forEach((name) => {
    try {
      fs.unlinkSync(path.join(uploadDir, name));
      deleted++;
    } catch (err) {
      console.error("Không thể xóa file:", name, err);
    }
  });
  res.json({ success: true, deleted, message: `Đã xóa ${deleted} ảnh.` });
});

export default router;
