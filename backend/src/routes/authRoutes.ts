import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User, UserRole, UserStatus } from "../entities/User";
import { authenticateJWT, AuthenticatedRequest, requireRole } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "please_set_a_secret";
const userRepo = () => AppDataSource.getRepository(User);

function toSafeUser(user: User) {
  const { password: _p, ...safe } = user as any;
  return safe;
}

router.post(
  "/register",
  body("fullName").trim().isLength({ min: 2, max: 120 }),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { fullName, email, password, role } = req.body;

    try {
      const repo = userRepo();
      const existing = await repo.findOneBy({ email });
      if (existing) return res.status(400).json({ message: "Email already in use" });

      const hashed = await bcrypt.hash(password, 10);
      const user = repo.create({
        fullName: fullName.trim(),
        email,
        password: hashed,
        role: role || "inspector",
        status: "pending"
      });

      await repo.save(user);
      const { password: _p, ...safe } = user as any;
      res.status(201).json(safe);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to register" });
    }
  }
);

router.post(
  "/login",
  body("email").isEmail(),
  body("password").exists(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, remember } = req.body;
    try {
      const repo = userRepo();
      const user = await repo.findOneBy({ email: String(email).trim().toLowerCase() });
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials" });

      if (user.status !== "active") {
        const statusMessage: Record<UserStatus, string> = {
          pending: "Tài khoản đang chờ admin duyệt",
          rejected: "Tài khoản đã bị từ chối. Vui lòng liên hệ admin",
          active: "",
        };
        return res.status(403).json({ message: statusMessage[user.status] || "Tài khoản chưa được kích hoạt" });
      }

      const expiresIn = remember ? "7d" : "1h";
      const token = jwt.sign(
        { userId: user.userId, fullName: user.fullName, email: user.email, role: user.role, status: user.status },
        JWT_SECRET,
        { expiresIn }
      );

      res.json({
        token,
        remember: !!remember,
        user: toSafeUser(user),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to login" });
    }
  }
);

router.get("/me", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const payload = (req as AuthenticatedRequest).user;
    if (!payload) return res.status(401).json({ message: "Unauthorized" });

    const repo = userRepo();
    const user = await repo.findOneBy({ userId: payload.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(toSafeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.get("/users", authenticateJWT, requireRole("admin"), async (_req: Request, res: Response) => {
  try {
    const users = await userRepo().find({ order: { createdAt: "DESC" } });
    res.json(users.map(toSafeUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không tải được danh sách người dùng" });
  }
});

router.patch("/users/:userId/status", authenticateJWT, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body as { status: UserStatus };
    if (!status || !["pending", "active", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const repo = userRepo();
    const user = await repo.findOneBy({ userId });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (user.role === "admin" && status !== "active") {
      return res.status(400).json({ message: "Không thể vô hiệu hóa tài khoản admin" });
    }

    user.status = status;
    user.approvedByUserId = (req as AuthenticatedRequest).user?.userId || null;
    user.approvedAt = status === "active" ? new Date() : null;
    await repo.save(user);
    res.json({ message: "Cập nhật trạng thái thành công", user: toSafeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không cập nhật được trạng thái" });
  }
});

router.delete("/users/:userId", authenticateJWT, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const repo = userRepo();
    const user = await repo.findOneBy({ userId });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Không thể xóa tài khoản admin" });
    }

    await repo.delete({ userId });
    res.json({ message: "Đã xóa người dùng" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không xóa được người dùng" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.json({ success: true, message: "Logged out" });
});

export default router;
