"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const aiService_1 = __importDefault(require("../services/aiService"));
const voteService_1 = require("../services/voteService");
const router = (0, express_1.Router)();
// Configure multer for temporary file storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path_1.default.join(__dirname, "../../temp");
        if (!fs_1.default.existsSync(tempDir)) {
            fs_1.default.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        if (/image\/(png|jpe?g|webp)/i.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only PNG, JPG, WebP allowed."));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});
/**
 * POST /api/ai/process-ballot
 * Process single ballot image via AI backend
 *
 * Body:
 * - file: image file (multipart)
 * - ballotType: "trust" or "surplus"
 *
 * Returns:
 * {
 *   success: boolean,
 *   batchId: string,
 *   jobId: string,
 *   result: { ok, error, parsed, latency_ms, ... }
 * }
 */
router.post("/process-ballot", auth_1.authenticateJWT, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // Get sessionId from FormData body
        const sessionId = req.body.sessionId || req.query.sessionId;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        // Lấy session từ database để biết ballotType
        const { VoteSession } = await Promise.resolve().then(() => __importStar(require("../entities/VoteSession")));
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require("../config/database")));
        const sessionRepo = AppDataSource.getRepository(VoteSession);
        const session = await sessionRepo.findOne({ where: { id: sessionId } });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        // Map session type to ballot type
        console.log(`🔍 DEBUG: sessionId=${sessionId}, session.type="${session.type}"`);
        const ballotType = session.type === "tin-nhiem" ? "trust" : "surplus";
        console.log(`🔍 DEBUG: Mapped ballotType="${ballotType}"`);
        const imagePath = req.file.path;
        const voteId = `vote_${Date.now()}`;
        // Xử lý phiếu qua AI
        const aiResult = await aiService_1.default.processAndWait(ballotType, imagePath, 1000, // poll every 1 second
        120000 // max wait 2 minutes
        );
        // DỌdn dẹp file tạm
        if (fs_1.default.existsSync(imagePath)) {
            fs_1.default.unlinkSync(imagePath);
        }
        // Lưu kết quả vào database
        const vote = await voteService_1.VoteService.processAndSaveVote(sessionId, voteId, ballotType, aiResult, req.file.originalname);
        // Trả về kết quả
        return res.json({
            success: aiResult.ok,
            batchId: aiResult.batch_id,
            jobId: aiResult.job_id,
            vote: {
                id: vote.id,
                voteId: vote.voteId,
                selectedCandidate: vote.selectedCandidate,
                confidenceScore: vote.confidenceScore,
                status: vote.status,
            },
            result: {
                ok: aiResult.ok,
                error: aiResult.error,
                parsed: aiResult.parsed,
                latency_ms: aiResult.latency_ms,
                usage: aiResult.usage,
            },
        });
    }
    catch (error) {
        console.error("Error processing ballot:", error);
        // Clean up temp file if exists
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to process ballot",
        });
    }
});
/**
 * POST /api/ai/batch-process
 * Process multiple ballot images in one batch
 *
 * Body:
 * - files: multiple image files (multipart)
 * - ballotType: "trust" or "surplus"
 *
 * Returns:
 * {
 *   success: boolean,
 *   batchId: string,
 *   total: number,
 *   results: [ { jobId, parsed, ok, ... }, ... ]
 * }
 */
router.post("/batch-process", auth_1.authenticateJWT, upload.array("files", 50), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
        const { ballotType } = req.body;
        if (!ballotType || !["trust", "surplus"].includes(ballotType)) {
            return res.status(400).json({ error: "ballotType must be 'trust' or 'surplus'" });
        }
        const imagePaths = files.map((f) => f.path);
        // Submit batch to AI backend
        const batchResp = await aiService_1.default.submitBatch(ballotType, imagePaths);
        // Poll for results
        const results = [];
        const startTime = Date.now();
        const maxWaitMs = 300000; // 5 minutes max
        const pollIntervalMs = 2000;
        while (Date.now() - startTime < maxWaitMs) {
            const status = await aiService_1.default.getBatchStatus(batchResp.batch_id);
            if (status.done === batchResp.total) {
                // All done, fetch all results
                const resultFiles = await aiService_1.default.getBatchResults(batchResp.batch_id);
                for (const filename of resultFiles) {
                    const resultFile = await aiService_1.default.getResultFile(batchResp.batch_id, filename);
                    results.push(resultFile);
                }
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        // Clean up temp files
        for (const imagePath of imagePaths) {
            if (fs_1.default.existsSync(imagePath)) {
                fs_1.default.unlinkSync(imagePath);
            }
        }
        return res.json({
            success: true,
            batchId: batchResp.batch_id,
            total: batchResp.total,
            processed: results.length,
            results: results.map((r) => ({
                jobId: r.job_id,
                ok: r.ok,
                error: r.error,
                parsed: r.parsed,
                latency_ms: r.latency_ms,
            })),
        });
    }
    catch (error) {
        console.error("Error processing batch:", error);
        // Clean up temp files
        if (req.files) {
            const files = req.files;
            for (const file of files) {
                if (fs_1.default.existsSync(file.path)) {
                    fs_1.default.unlinkSync(file.path);
                }
            }
        }
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to process batch",
        });
    }
});
/**
 * GET /api/ai/health
 * Check if AI backend is accessible
 */
router.get("/health", async (req, res) => {
    try {
        const response = await aiService_1.default["client"].get("/");
        res.json({ ok: true, aiBackend: "online" });
    }
    catch (error) {
        res.status(503).json({
            ok: false,
            error: "AI backend is offline",
        });
    }
});
exports.default = router;
