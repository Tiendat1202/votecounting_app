import express from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "./auth"; // đường dẫn tuỳ theo project

const router = express.Router();
const filePath = path.resolve("data/sessions.json");

// Đảm bảo file dữ liệu tồn tại
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

// Middleware chỉ cho admin
function requireAdmin(req, res, next) {
  // Nếu chưa đăng nhập hoặc role không phải admin, từ chối truy cập
  if (!req.user || (req.user.role && req.user.role.toLowerCase() !== "admin")) {
    return res.status(403).json({ error: "Bạn không có quyền truy cập chức năng này!" });
  }
  next();
}

// Lấy danh sách phiên (ai cũng xem được)
router.get("/", (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  res.json(data);
});

// Tạo phiên mới (chỉ admin mới tạo được)
router.post("/", authMiddleware, requireAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const newSession = {
    id: Date.now().toString(),
    ...req.body,
  };
  data.push(newSession);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.status(201).json(newSession);
});

export default router;