import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();
const filePath = path.resolve("data/sessions.json");

// Đảm bảo file dữ liệu tồn tại
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

// Lấy danh sách phiên
router.get("/", (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  res.json(data);
});

// Tạo phiên mới
router.post("/", (req, res) => {
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
