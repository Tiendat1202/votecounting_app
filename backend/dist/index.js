"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./config/database");
const VoteSession_1 = require("./entities/VoteSession");
const Vote_1 = require("./entities/Vote");
const voteRoutes_1 = __importDefault(require("./routes/voteRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const voteControllerRoutes_1 = __importDefault(require("./routes/voteControllerRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const aiService_1 = __importDefault(require("./services/aiService"));
const voteService_1 = require("./services/voteService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5050;
// Setup uploads directory
const uploadsDir = path_1.default.join(__dirname, "../uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer config
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const sessionDir = path_1.default.join(uploadsDir, req.params.sessionId || "temp");
        if (!fs_1.default.existsSync(sessionDir)) {
            fs_1.default.mkdirSync(sessionDir, { recursive: true });
        }
        cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        if (/image\/(png|jpe?g|webp)/i.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type"));
        }
    }
});
// Middleware
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    credentials: true
}));
app.use(express_1.default.json());
// Serve uploads folder
app.use("/uploads", express_1.default.static(uploadsDir));
// Initialize Database
database_1.AppDataSource.initialize()
    .then(() => {
    console.log("Database connection established");
})
    .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
});
// Routes
app.get("/", (req, res) => {
    res.json({ message: "Vote Counting API is running 🚀" });
});
// Existing routes
app.use("/api", voteRoutes_1.default);
// Mount real auth routes (replace the previous fake endpoints)
app.use("/api/auth", authRoutes_1.default);
// Mount AI routes
app.use("/api/ai", aiRoutes_1.default);
// Mount vote controller routes
app.use("/api/votes", voteControllerRoutes_1.default);
// ===== SESSIONS =====
app.get("/api/sessions", async (req, res) => {
    try {
        const sessionRepo = database_1.AppDataSource.getRepository(VoteSession_1.VoteSession);
        const sessions = await sessionRepo.find();
        res.json(sessions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});
app.post("/api/sessions", async (req, res) => {
    try {
        const { name, type, startAt, endAt, candidates } = req.body;
        const sessionRepo = database_1.AppDataSource.getRepository(VoteSession_1.VoteSession);
        const newSession = sessionRepo.create({
            id: Date.now().toString(),
            name,
            type,
            startAt,
            endAt,
            candidates
        });
        await sessionRepo.save(newSession);
        res.json(newSession);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create session" });
    }
});
// ===== STATS =====
app.get("/api/stats", async (req, res) => {
    try {
        const sessionRepo = database_1.AppDataSource.getRepository(VoteSession_1.VoteSession);
        const totalSessions = await sessionRepo.count();
        res.json({
            totalSessions,
            totalVotes: 0,
            activeSession: null
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});
// ===== UPLOADS =====
app.post("/api/uploads/:sessionId", upload.array("files", 50), async (req, res) => {
    const { sessionId } = req.params;
    const files = req.files || [];
    if (files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
    }
    // Lấy voteType từ query hoặc mặc định là "trust"
    const voteType = req.query.voteType || "trust";
    // Trả response ngay
    res.json({
        success: true,
        files: files.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            size: f.size
        })),
        message: `Uploaded ${files.length} files. AI processing started in background.`
    });
    // Xử lý AI bất đồng bộ
    (async () => {
        for (const file of files) {
            try {
                const imagePath = file.path;
                const voteId = `vote_${Date.now()}_${file.filename}`;
                console.log(`Processing ${file.filename} with AI (voteType: ${voteType})...`);
                // Gọi AI xử lý
                const aiResult = await aiService_1.default.processAndWait(voteType, imagePath, 1000, // poll every 1 second
                120000 // max wait 2 minutes
                );
                // Lưu kết quả vào database
                await voteService_1.VoteService.processAndSaveVote(sessionId, voteId, voteType, aiResult, file.filename);
                console.log(`AI processed ${file.filename}: ${aiResult.parsed?.candidate_name || "N/A"}`);
            }
            catch (error) {
                console.error(`AI processing failed for ${file.filename}:`, error);
                // Lưu lỗi vào database với status invalid
                try {
                    await voteService_1.VoteService.processAndSaveVote(sessionId, `vote_${Date.now()}_${file.filename}`, voteType, {
                        ok: false,
                        error: error instanceof Error ? error.message : "AI processing failed",
                        parsed: null,
                    }, file.filename);
                }
                catch (saveError) {
                    console.error(`Failed to save error record:`, saveError);
                }
            }
        }
    })();
});
app.get("/api/uploads/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const sessionDir = path_1.default.join(uploadsDir, sessionId);
    try {
        if (!fs_1.default.existsSync(sessionDir)) {
            return res.json([]);
        }
        const files = fs_1.default.readdirSync(sessionDir);
        res.json(files);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to list files" });
    }
});
app.delete("/api/uploads/:sessionId/:filename", (req, res) => {
    const { sessionId, filename } = req.params;
    const filepath = path_1.default.join(uploadsDir, sessionId, filename);
    try {
        if (fs_1.default.existsSync(filepath)) {
            fs_1.default.unlinkSync(filepath);
        }
        res.json({ message: "File deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete file" });
    }
});
app.delete("/api/uploads/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const sessionDir = path_1.default.join(uploadsDir, sessionId);
    try {
        if (fs_1.default.existsSync(sessionDir)) {
            fs_1.default.rmSync(sessionDir, { recursive: true, force: true });
        }
        res.json({ message: "All files deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete files" });
    }
});
// ===== RESULTS =====
app.get("/api/results/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const voteRepository = database_1.AppDataSource.getRepository(Vote_1.Vote);
        const votes = await voteRepository.find({
            where: { sessionId },
            relations: ["session"],
            order: { createdAt: "DESC" }
        });
        res.json({
            success: true,
            message: "Votes retrieved successfully",
            data: votes
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch votes" });
    }
});
app.get("/api/results", async (req, res) => {
    try {
        const voteRepository = database_1.AppDataSource.getRepository(Vote_1.Vote);
        const votes = await voteRepository.find({
            relations: ["session"],
            order: { createdAt: "DESC" }
        });
        res.json({
            success: true,
            message: "Votes retrieved successfully",
            data: votes
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch votes" });
    }
});
// ===== HEALTH =====
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date()
    });
});
// Error Handler
app.use(errorHandler_1.errorHandler);
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
