"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "please_set_a_secret";
const userRepo = () => database_1.AppDataSource.getRepository(User_1.User);
// Register (optional; you can omit in production if you only seed users)
router.post("/register", (0, express_validator_1.body)("email").isEmail(), (0, express_validator_1.body)("password").isLength({ min: 6 }), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password, role } = req.body;
    try {
        const repo = userRepo();
        const existing = await repo.findOneBy({ email });
        if (existing)
            return res.status(400).json({ message: "Email already in use" });
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const user = repo.create({
            email,
            password: hashed,
            role: role || "user"
        });
        await repo.save(user);
        const { password: _p, ...safe } = user;
        res.status(201).json(safe);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to register" });
    }
});
// Login
router.post("/login", (0, express_validator_1.body)("email").isEmail(), (0, express_validator_1.body)("password").exists(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password, remember } = req.body;
    try {
        const repo = userRepo();
        const user = await repo.findOneBy({ email });
        if (!user)
            return res.status(401).json({ message: "Invalid credentials" });
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match)
            return res.status(401).json({ message: "Invalid credentials" });
        const expiresIn = remember ? "7d" : "1h";
        const token = jsonwebtoken_1.default.sign({ userId: user.userId, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
        res.json({
            userId: user.userId,
            email: user.email,
            role: user.role,
            token,
            remember: !!remember
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to login" });
    }
});
// Me - protected
router.get("/me", auth_1.authenticateJWT, async (req, res) => {
    try {
        const payload = req.user;
        if (!payload)
            return res.status(401).json({ message: "Unauthorized" });
        const repo = userRepo();
        const user = await repo.findOneBy({ userId: payload.userId });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const { password: _p, ...safe } = user;
        res.json(safe);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user" });
    }
});
// Logout (stateless) - for stateful revoke, implement blacklist/store
router.post("/logout", (req, res) => {
    res.json({ success: true, message: "Logged out" });
});
exports.default = router;
