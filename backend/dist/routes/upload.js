"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const aiService_1 = __importDefault(require("../services/aiService"));
const voteService_1 = require("../services/voteService");
const router = express_1.default.Router();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const sessionId = req.params.sessionId;
        const uploadDir = path_1.default.join(__dirname, "../../uploads", sessionId);
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path_1.default.extname(file.originalname);
        const name = path_1.default.basename(file.originalname, ext);
        cb(null, `${name}-${timestamp}${ext}`);
    },
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
    },
});
// Upload ảnh VÀ tự động xử lý AI
router.post("/api/upload/:sessionId", upload.array("files", 50), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
    }
    const { sessionId } = req.params;
    const uploadedFiles = req.files;
    const files = uploadedFiles.map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
    }));
    // Lấy ballotType từ query hoặc mặc định là "trust"
    const ballotType = req.query.ballotType || "trust";
    // Gửi ảnh cho AI xử lý ngay (background job)
    // Không đợi AI xong, trả về response ngay
    res.json({
        success: true,
        files,
        message: `Uploaded ${files.length} files. AI processing started in background.`
    });
    // Xử lý AI bất đồng bộ
    (async () => {
        for (const file of uploadedFiles) {
            try {
                const imagePath = file.path;
                const ballotId = `ballot_${Date.now()}_${file.filename}`;
                console.log(`Processing ${file.filename} with AI...`);
                // Gọi AI xử lý
                const aiResult = await aiService_1.default.processAndWait(ballotType, imagePath, 1000, // poll every 1 second
                120000 // max wait 2 minutes
                );
                // Lưu kết quả vào database
                await voteService_1.VoteService.processAndSaveVote(sessionId, ballotId, ballotType, aiResult, file.filename);
                console.log(`AI processed ${file.filename}: ${aiResult.parsed?.candidate_name || "N/A"}`);
            }
            catch (error) {
                console.error(`AI processing failed for ${file.filename}:`, error);
                // Lưu lỗi vào database với status invalid
                try {
                    await voteService_1.VoteService.processAndSaveVote(sessionId, `ballot_${Date.now()}_${file.filename}`, ballotType, {
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
// Get uploaded files
router.get("/api/uploads/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const uploadDir = path_1.default.join(__dirname, "../../uploads", sessionId);
    if (!fs_1.default.existsSync(uploadDir)) {
        return res.json([]);
    }
    const files = fs_1.default.readdirSync(uploadDir);
    res.json(files);
});
// Delete file
router.delete("/api/uploads/:sessionId/:filename", (req, res) => {
    const { sessionId, filename } = req.params;
    const filepath = path_1.default.join(__dirname, "../../uploads", sessionId, filename);
    if (fs_1.default.existsSync(filepath)) {
        fs_1.default.unlinkSync(filepath);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "File not found" });
});
// Delete all files in session
router.delete("/api/uploads/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const uploadDir = path_1.default.join(__dirname, "../../uploads", sessionId);
    if (fs_1.default.existsSync(uploadDir)) {
        fs_1.default.rmSync(uploadDir, { recursive: true });
    }
    res.json({ success: true });
});
exports.default = router;
