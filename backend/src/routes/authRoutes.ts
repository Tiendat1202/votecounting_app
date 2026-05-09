import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User, UserRole, UserStatus } from "../entities/User";
import { authenticateJWT, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { emailService } from "../services/emailService";

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
  body("workUnit").trim().isLength({ min: 2, max: 255 }),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { fullName, workUnit, email, password } = req.body;

    try {
      const repo = userRepo();
      const normalizedEmail = String(email).trim().toLowerCase();
      const existing = await repo.findOneBy({ email: normalizedEmail });
      if (existing) return res.status(400).json({ message: "Email already in use" });

      const hashed = await bcrypt.hash(password, 10);
      const user = repo.create({
        fullName: fullName.trim(),
        workUnit: workUnit.trim(),
        email: normalizedEmail,
        password: hashed,
        role: "user",
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
      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await repo.findOneBy({ email: normalizedEmail });
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


router.get("/active-users", authenticateJWT, requireRole("admin", "user"), async (_req: Request, res: Response) => {
  try {
    const users = await userRepo().find({ where: { status: "active" }, order: { fullName: "ASC" } });
    res.json(users.filter((user) => user.role !== "admin").map(toSafeUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không tải được danh sách người dùng đang hoạt động" });
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

// Debug endpoint to send approval email (development only)
router.post("/debug/send-approval", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ message: "Forbidden" });
  try {
    const { email, fullName } = req.body as { email?: string; fullName?: string };
    if (!email) return res.status(400).json({ message: "Missing email" });
    const ok = await emailService.sendUserApprovalEmail(email, fullName || "");
    if (ok) return res.json({ message: "Sent (or queued)" });
    return res.status(500).json({ message: "Failed to send (check logs)" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

router.patch("/users/:userId/status", authenticateJWT, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body as { status: UserStatus };
    if (!status || !["active", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const repo = userRepo();
    const user = await repo.findOneBy({ userId });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (user.status !== "pending") {
      return res.status(400).json({ message: "Tài khoản đã được xử lý trước đó" });
    }
    if (user.role === "admin" && status !== "active") {
      return res.status(400).json({ message: "Không thể vô hiệu hóa tài khoản admin" });
    }

    user.status = status;
    user.approvedByUserId = (req as AuthenticatedRequest).user?.userId || null;
    user.approvedAt = status === "active" ? new Date() : null;
    await repo.save(user);

    // Send email notification based on status change
    if (status === "active") {
      // Approve email
      await emailService.sendUserApprovalEmail(user.email, user.fullName || "");
    } else if (status === "rejected") {
      // Rejection email
      await emailService.sendUserRejectionEmail(user.email, user.fullName || "");
    }

    res.json({ message: "Cập nhật trạng thái thành công", user: toSafeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không cập nhật được trạng thái" });
  }
});

router.patch("/users/:userId/role", authenticateJWT, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body as { role: UserRole };
    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }

    const repo = userRepo();
    const user = await repo.findOneBy({ userId });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const currentUserId = (req as AuthenticatedRequest).user?.userId;
    if (currentUserId && user.userId === currentUserId && role !== "admin") {
      return res.status(400).json({ message: "Không thể tự hạ quyền admin" });
    }

    if (role === "admin" && user.status !== "active") {
      return res.status(400).json({ message: "Chỉ cấp quyền admin cho tài khoản đã được duyệt" });
    }

    if (user.role === "admin" && role !== "admin") {
      const adminCount = await repo.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Phải còn ít nhất một tài khoản admin" });
      }
    }

    user.role = role;
    await repo.save(user);
    res.json({ message: "Cập nhật vai trò thành công", user: toSafeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không cập nhật được vai trò" });
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
