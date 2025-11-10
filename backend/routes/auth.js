// routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "token";

/** Demo user store (có thể thay bằng DB) */
const users = [
  {
    id: "1",
    email: "admin@example.com",
    role: "admin",
    // password = 123456
    passwordHash: bcrypt.hashSync("123456", 10),
  },
  {
    id: "2",
    email: "user@example.com",
    role: "user",
    // password = 123456
    passwordHash: bcrypt.hashSync("123456", 10),
  },
];

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  // Set cookie httpOnly
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true nếu chạy HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ id: user.id, email: user.email, role: user.role });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const { id, email, role } = req.user;
  res.json({ id, email, role });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: false });
  res.json({ ok: true });
});

export default router;
