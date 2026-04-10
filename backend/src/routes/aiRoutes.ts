import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateJWT } from "../middleware/auth";
import aiService from "../services/aiService";
import { VoteService } from "../services/voteService";
import { AIResultFile } from "../types";

const router = Router();

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
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
router.post(
  "/process-ballot",
  authenticateJWT,
  upload.single("file"),
  async (req: Request, res: Response) => {
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
      const { VoteSession } = await import("../entities/VoteSession");
      const { AppDataSource } = await import("../config/database");
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const session = await sessionRepo.findOne({ where: { id: sessionId } });
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Map session type to ballot type
      console.log(`DEBUG: sessionId=${sessionId}, session.type="${session.type}"`);
      const ballotType = session.type === "tin-nhiem" ? "trust" : "surplus";
      console.log(`DEBUG: Mapped ballotType="${ballotType}"`);

      const imagePath = req.file.path;
      const voteId = `vote_${Date.now()}`;

      // Xử lý phiếu qua AI
      const aiResult = await aiService.processAndWait(
        ballotType as "trust" | "surplus",
        imagePath,
        1000, // poll every 1 second
        120000 // max wait 2 minutes
      );

      // DỌdn dẹp file tạm
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Lưu kết quả vào database
      const vote = await VoteService.processAndSaveVote(
        sessionId,
        voteId,
        ballotType as "trust" | "surplus",
        aiResult as any,
        req.file.originalname
      );

      // Extract validation result from aiResult if available
      const validation = (aiResult as any).validation || null;

      // Update vote with validation data if available
      if (validation) {
        vote.validity = validation.validity;
        vote.invalidReasons = JSON.stringify(validation.invalid_reasons || []);
        vote.agreeCount = validation.agree_count || 0;
        vote.doubleMarkCount = validation.double_mark_count || 0;
        
        // Update status based on validity
        if (validation.validity === "VALID") {
          vote.status = "valid";
        } else if (validation.validity === "INVALID") {
          vote.status = "invalid";
        }
        
        const { Vote } = await import("../entities/Vote");
        const voteRepo = AppDataSource.getRepository(Vote);
        await voteRepo.save(vote);
      }

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
          validity: vote.validity,
          invalidReasons: vote.invalidReasons ? JSON.parse(vote.invalidReasons) : [],
          agreeCount: vote.agreeCount,
        },
        result: {
          ok: aiResult.ok,
          error: aiResult.error,
          parsed: aiResult.parsed,
          validation: validation,
          latency_ms: aiResult.latency_ms,
          usage: aiResult.usage,
        },
      });
    } catch (error) {
      console.error("Error processing ballot:", error);

      // Clean up temp file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process ballot",
      });
    }
  }
);

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
router.post(
  "/batch-process",
  authenticateJWT,
  upload.array("files", 50),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { ballotType } = req.body;
      if (!ballotType || !["trust", "surplus"].includes(ballotType)) {
        return res.status(400).json({ error: "ballotType must be 'trust' or 'surplus'" });
      }

      const imagePaths = files.map((f) => f.path);

      // Submit batch to AI backend
      const batchResp = await aiService.submitBatch(
        ballotType as "trust" | "surplus",
        imagePaths
      );

      // Poll for results
      const results = [];

      const startTime = Date.now();
      const maxWaitMs = 300000; // 5 minutes max
      const pollIntervalMs = 2000;

      while (Date.now() - startTime < maxWaitMs) {
        const status = await aiService.getBatchStatus(batchResp.batch_id);

        if (status.done === batchResp.total) {
          // All done, fetch all results
          const resultFiles = await aiService.getBatchResults(batchResp.batch_id);
          for (const filename of resultFiles) {
            const resultFile = await aiService.getResultFile(batchResp.batch_id, filename);
            results.push(resultFile);
          }
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      // Clean up temp files
      for (const imagePath of imagePaths) {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
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
    } catch (error) {
      console.error("Error processing batch:", error);

      // Clean up temp files
      if (req.files) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process batch",
      });
    }
  }
);

/**
 * GET /api/ai/health
 * Check if AI backend is accessible
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const response = await aiService["client"].get("/");
    res.json({ ok: true, aiBackend: "online" });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: "AI backend is offline",
    });
  }
});

export default router;
