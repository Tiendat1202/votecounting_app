import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User } from "../entities/User";
import { authenticateJWT } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "please_set_a_secret";

const userRepo = () => AppDataSource.getRepository(User);

// Register (optional; you can omit in production if you only seed users)
router.post(
  "/register",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, role } = req.body;
    try {
      const repo = userRepo();
      const existing = await repo.findOneBy({ email });
      if (existing) return res.status(400).json({ message: "Email already in use" });

      const hashed = await bcrypt.hash(password, 10);
      const user = repo.create({
        email,
        password: hashed,
        role: role || "user"
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

// Login
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
      const user = await repo.findOneBy({ email });
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials" });

      const expiresIn = remember ? "7d" : "1h";
      const token = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn }
      );

      res.json({
        userId: user.userId,
        email: user.email,
        role: user.role,
        token,
        remember: !!remember
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to login" });
    }
  }
);

// Me - protected
router.get("/me", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const payload = (req as any).user;
    if (!payload) return res.status(401).json({ message: "Unauthorized" });

    const repo = userRepo();
    const user = await repo.findOneBy({ userId: payload.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const { password: _p, ...safe } = user as any;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Logout (stateless) - for stateful revoke, implement blacklist/store
router.post("/logout", (req: Request, res: Response) => {
  res.json({ success: true, message: "Logged out" });
});

export default router;