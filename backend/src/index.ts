import "reflect-metadata";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { In } from "typeorm";

// Load environment variables FIRST before any other imports
const envPath = process.env.NODE_ENV === "production" 
  ? path.join(__dirname, "../.env.production")
  : path.join(__dirname, "../.env");
dotenv.config({ path: envPath });
console.log(`📁 Loading env from: ${envPath}`);

import { AppDataSource } from "./config/database";
import { VoteSession } from "./entities/VoteSession";
import { Vote } from "./entities/Vote";
import { User } from "./entities/User";
import { AuditLog } from "./entities/AuditLog";
import voteRoutes from "./routes/voteRoutes";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import voteControllerRoutes from "./routes/voteControllerRoutes";
import { renderReport, safeReportFileName } from "./services/reportTemplates";
import { errorHandler } from "./middleware/errorHandler";
import {
  attachOptionalUser,
  authenticateJWT,
  requireRole,
  AuthenticatedRequest,
} from "./middleware/auth";
import {
  computeSessionPermissions,
  requireSessionUploadPermission,
  requireSessionBallotViewPermission,
  requireSessionReviewPermission,
  requireSessionOwnerOrAdmin,
  requireSessionReportPermission,
} from "./middleware/sessionAuthorization";
import { SessionMember, SessionRole } from "./entities/SessionMember";
import aiService from "./services/aiService";
import { VoteService } from "./services/voteService";
import {
  buildEvaluationOptions,
  extractEvaluationOption,
} from "./utils/evaluationOptions";

const app = express();
const PORT = process.env.PORT || 5050;

// Setup uploads directory
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionDir = path.join(uploadsDir, req.params.sessionId || "temp");
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
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
      cb(new Error("Invalid file type"));
    }
  },
});

type CountingStatus =
  | "idle"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

type CountingJob = {
  sessionId: string;
  status: CountingStatus;
  total: number;
  processed: number;
  failed: number;
  currentFile?: string | null;
  message?: string;
  startedAt: string;
  finishedAt?: string | null;
};

const countingJobs = new Map<string, CountingJob>();

function getSessionUploadDir(sessionId: string) {
  return path.join(uploadsDir, sessionId);
}

function listSessionImageFiles(sessionId: string) {
  const sessionDir = getSessionUploadDir(sessionId);
  if (!fs.existsSync(sessionDir)) return [];
  return fs
    .readdirSync(sessionDir)
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
    .sort();
}

function getBallotTypeFromSessionType(
  sessionType?: string | null,
): "trust" | "surplus" {
  const normalized = String(sessionType || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "-");

  return ["tin-nhiem", "trust", "tin-nhiem-phieu"].includes(normalized)
    ? "trust"
    : "surplus";
}

function serializeCountingJob(job: CountingJob) {
  const percent =
    job.total === 0
      ? 0
      : Math.min(100, Math.floor((job.processed / job.total) * 100));
  return {
    ...job,
    percent,
    isProcessing: job.status === "processing",
    canStart: job.status !== "processing" && job.total > 0,
  };
}

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Serve uploads folder
app.use("/uploads", express.static(uploadsDir));

// Initialize Database
AppDataSource.initialize()
  .then(() => {
    console.log("Database connection established");
    ensureNewRoleModel().catch((error) =>
      console.error("Role model migration failed:", error),
    );
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Vote Counting API is running 🚀" });
});

// Existing routes
app.use("/api", voteRoutes);

// Mount real auth routes (replace the previous fake endpoints)
app.use("/api/auth", authRoutes);

// Mount AI routes
app.use("/api/ai", aiRoutes);

// Mount vote controller routes
app.use("/api/votes", voteControllerRoutes);

async function ensureNewRoleModel() {
  const userRepo = AppDataSource.getRepository(User);
  const sessionRepo = AppDataSource.getRepository(VoteSession);
  const memberRepo = AppDataSource.getRepository(SessionMember);

  const users = await userRepo.find();
  for (const user of users) {
    if ((user as any).role !== "admin" && (user as any).role !== "user") {
      (user as any).role = "user";
      await userRepo.save(user);
    }
  }

  const sessions = await sessionRepo.find();
  for (const session of sessions) {
    if (!session.createdByUserId) continue;
    const existing = await memberRepo.findOne({
      where: { sessionId: session.id, userId: session.createdByUserId },
    });
    if (!existing) {
      await memberRepo.save(
        memberRepo.create({
          sessionId: session.id,
          userId: session.createdByUserId,
          userEmail: session.createdByEmail || "",
          userFullName: session.createdByName || null,
          role: "inspector",
          addedByUserId: session.createdByUserId,
        }),
      );
    } else if (existing.role !== "inspector") {
      existing.role = "inspector";
      await memberRepo.save(existing);
    }
  }
}

// ===== SESSIONS =====
async function serializeSession(
  session: VoteSession,
  payload?: AuthenticatedRequest,
) {
  let createdByName = session.createdByName || null;
  if (!createdByName && session.createdByUserId) {
    const owner = await AppDataSource.getRepository(User).findOne({
      where: { userId: session.createdByUserId },
    });
    createdByName = owner?.fullName || null;
  }

  const permissions = payload?.user
    ? await computeSessionPermissions(session, payload)
    : undefined;
  return {
    ...session,
    createdByName,
    permissions,
  };
}

app.get(
  "/api/sessions",
  attachOptionalUser,
  async (req: Request, res: Response) => {
    try {
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const sessions = await sessionRepo.find({ order: { createdAt: "DESC" } });

      const payload = req as AuthenticatedRequest;
      const items = await Promise.all(
        sessions.map((session) => serializeSession(session, payload)),
      );

      res.json(items);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  },
);

app.get(
  "/api/sessions/:sessionId",
  attachOptionalUser,
  async (req: Request, res: Response) => {
    try {
      const session = await AppDataSource.getRepository(VoteSession).findOne({
        where: { id: req.params.sessionId },
      });
      if (!session)
        return res
          .status(404)
          .json({ error: "Không tìm thấy phiên kiểm phiếu" });

      const payload = req as AuthenticatedRequest;
      const item = await serializeSession(session, payload);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không tải được thông tin phiên" });
    }
  },
);

app.post(
  "/api/sessions",
  authenticateJWT,
  requireRole("admin", "user"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        type,
        voteRule,
        evaluationOptions,
        electionUnit,
        location,
        startAt,
        endAt,
        candidates,
        seats,
        minWinPercent,
      } = req.body;
      const currentUser = (req as AuthenticatedRequest).user;
      const ballotType = getBallotTypeFromSessionType(type);
      const isTrustVote = ballotType === "trust";

      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const newSession = sessionRepo.create({
        id: Date.now().toString(),
        name,
        type,
        voteRule:
          voteRule || (isTrustVote ? "custom-evaluation" : "elect-by-seats"),
        evaluationOptions: isTrustVote
          ? JSON.stringify(
              Array.isArray(evaluationOptions) && evaluationOptions.length > 0
                ? evaluationOptions
                    .map((x: any) => String(x).trim())
                    .filter(Boolean)
                : ["Đồng ý", "Không đồng ý"],
            )
          : null,
        electionUnit: electionUnit || null,
        location: location || null,
        startAt,
        endAt,
        candidates,
        createdByUserId: currentUser?.userId || null,
        createdByEmail: currentUser?.email || null,
        createdByName: currentUser?.fullName || null,
        seatsToElect: isTrustVote
          ? null
          : seats
            ? Math.floor(Number(seats))
            : null,
        minWinningPercent: isTrustVote
          ? null
          : minWinPercent !== undefined && minWinPercent !== null
            ? Number(minWinPercent)
            : 50,
      });

      await sessionRepo.save(newSession);
      if (currentUser?.userId) {
        const memberRepo = AppDataSource.getRepository(SessionMember);
        await memberRepo.save(
          memberRepo.create({
            sessionId: newSession.id,
            userId: currentUser.userId,
            userEmail: currentUser.email,
            userFullName: currentUser.fullName || null,
            role: "inspector",
            addedByUserId: currentUser.userId,
          }),
        );
      }
      res.json(await serializeSession(newSession, req as AuthenticatedRequest));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create session" });
    }
  },
);

app.patch(
  "/api/sessions/:sessionId/close",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const session = await sessionRepo.findOne({
        where: { id: req.params.sessionId },
      });
      if (!session)
        return res
          .status(404)
          .json({ error: "Không tìm thấy phiên kiểm phiếu" });

      const now = new Date();
      const currentEnd = new Date(session.endAt).getTime();
      if (!Number.isNaN(currentEnd) && currentEnd <= now.getTime()) {
        return res
          .status(400)
          .json({ error: "Phiên này đã kết thúc, không cần đóng sớm nữa" });
      }

      session.endAt = now.toISOString();
      session.closedEarlyAt = now;
      session.closedEarlyByUserId =
        (req as AuthenticatedRequest).user?.userId || null;
      await sessionRepo.save(session);

      res.json({
        message: "Đã đóng phiên sớm",
        session: await serializeSession(session, req as AuthenticatedRequest),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không thể đóng phiên sớm" });
    }
  },
);









app.get(
  "/api/sessions/:sessionId/members",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const rows = await AppDataSource.getRepository(SessionMember).find({
        where: { sessionId: req.params.sessionId },
        order: { createdAt: "ASC" },
      });
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không tải được thành viên phiên" });
    }
  },
);

app.post(
  "/api/sessions/:sessionId/members",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { userId, role } = req.body as {
        userId?: string;
        role?: SessionRole;
      };
      if (!userId || (role !== "inspector" && role !== "supervisor")) {
        return res
          .status(400)
          .json({ error: "Thiếu người dùng hoặc vai trò không hợp lệ" });
      }

      const user = await AppDataSource.getRepository(User).findOne({
        where: { userId },
      });
      if (!user)
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
      if (user.status !== "active")
        return res
          .status(400)
          .json({ error: "Tài khoản này chưa được admin duyệt" });
      if (user.role === "admin")
        return res
          .status(400)
          .json({ error: "Không thêm admin làm thành viên phiên" });

      const currentUser = (req as AuthenticatedRequest).user!;
      const memberRepo = AppDataSource.getRepository(SessionMember);
      const existing = await memberRepo.findOne({
        where: { sessionId, userId },
      });
      if (existing) {
        existing.role = role;
        existing.userEmail = user.email;
        existing.userFullName = user.fullName || null;
        existing.addedByUserId = currentUser.userId;
        await memberRepo.save(existing);
        return res.json({
          message: "Đã cập nhật vai trò thành viên",
          member: existing,
        });
      }

      const member = memberRepo.create({
        sessionId,
        userId,
        userEmail: user.email,
        userFullName: user.fullName || null,
        role,
        addedByUserId: currentUser.userId,
      });
      await memberRepo.save(member);
      res.status(201).json({ message: "Đã thêm thành viên phiên", member });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không thêm được thành viên phiên" });
    }
  },
);

app.delete(
  "/api/sessions/:sessionId/members/:memberId",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const memberRepo = AppDataSource.getRepository(SessionMember);
      const member = await memberRepo.findOne({
        where: { id: req.params.memberId, sessionId: req.params.sessionId },
      });
      if (!member)
        return res.status(404).json({ error: "Không tìm thấy thành viên" });
      if (member.role === "owner")
        return res.status(400).json({ error: "Không thể xóa chủ phiên" });
      await memberRepo.delete({ id: member.id });
      res.json({ message: "Đã xóa thành viên khỏi phiên" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không xóa được thành viên phiên" });
    }
  },
);

// ===== STATS =====
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const totalSessions = await sessionRepo.count();

    res.json({
      totalSessions,
      totalVotes: 0,
      activeSession: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ===== UPLOADS =====
app.post(
  "/api/uploads/:sessionId",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionUploadPermission,
  upload.array("files", 50),
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const allImages = listSessionImageFiles(sessionId);
    const currentJob = countingJobs.get(sessionId);
    if (currentJob && currentJob.status === "processing") {
      currentJob.total = Math.max(currentJob.total, allImages.length);
    } else {
      countingJobs.set(sessionId, {
        sessionId,
        status: "uploaded",
        total: allImages.length,
        processed: 0,
        failed: 0,
        currentFile: null,
        message: "Đã upload phiếu. Nhấn Bắt đầu kiểm phiếu để hệ thống xử lý.",
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });
    }

    res.json({
      success: true,
      files: files.map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
      })),
      totalUploaded: allImages.length,
      message: `Đã upload ${files.length} phiếu. Hệ thống sẽ chưa kiểm phiếu cho đến khi bạn bấm Bắt đầu kiểm phiếu.`,
    });
  },
);

app.post(
  "/api/sessions/:sessionId/start-counting",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionUploadPermission,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const currentJob = countingJobs.get(sessionId);

    if (currentJob?.status === "processing") {
      return res.status(409).json({
        error: "Phiên này đang được kiểm phiếu",
        progress: serializeCountingJob(currentJob),
      });
    }

    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const voteRepository = AppDataSource.getRepository(Vote);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ error: "Không tìm thấy phiên kiểm phiếu" });
    }

    const imageFiles = listSessionImageFiles(sessionId);
    if (imageFiles.length === 0) {
      return res.status(400).json({ error: "Chưa có phiếu nào để kiểm" });
    }

    const voteType = getBallotTypeFromSessionType(session.type);
    const job: CountingJob = {
      sessionId,
      status: "processing",
      total: imageFiles.length,
      processed: 0,
      failed: 0,
      currentFile: null,
      message: "Đang kiểm phiếu...",
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    countingJobs.set(sessionId, job);

    // Tính lại toàn bộ ảnh hiện có để kết quả luôn khớp với danh sách phiếu mới nhất.
    await voteRepository.delete({ sessionId });

    res.json({
      success: true,
      message: "Đã bắt đầu kiểm phiếu",
      progress: serializeCountingJob(job),
    });

    (async () => {
      for (let index = 0; index < imageFiles.length; index += 1) {
        const filename = imageFiles[index];
        const activeJob = countingJobs.get(sessionId);
        if (!activeJob || activeJob.status !== "processing") break;

        activeJob.currentFile = filename;
        activeJob.message = `Đang xử lý phiếu ${index + 1}/${activeJob.total}`;

        try {
          const imagePath = path.join(getSessionUploadDir(sessionId), filename);
          const voteId = `vote_${Date.now()}_${index}_${filename}`;

          console.log(
            `[counting] START session=${sessionId} file=${filename} voteType=${voteType} imagePath=${imagePath}`,
          );
          
          const aiResult = await aiService.processAndWait(
            voteType,
            imagePath,
            1000,
            120000,
          );

          console.log(`[counting] AI RESULT for ${filename}:`, {
            ok: aiResult?.ok,
            hasError: !!aiResult?.error,
            errorMsg: aiResult?.error,
            hasParsed: !!aiResult?.parsed,
            batchId: aiResult?.batch_id,
          });

          const vote = await VoteService.processAndSaveVote(
            sessionId,
            voteId,
            voteType,
            aiResult,
            filename,
            session.seatsToElect,
            session.voteRule,
            session.evaluationOptions,
          );

          console.log(`[counting] SAVED VOTE for ${filename}:`, {
            voteId: vote.id,
            status: vote.status,
            selectedCandidate: vote.selectedCandidate,
            confidenceScore: vote.confidenceScore,
          });
        } catch (error) {
          activeJob.failed += 1;
          console.error(
            `[counting] ❌ AI processing EXCEPTION for ${filename}:`,
            error instanceof Error ? error.message : String(error),
          );
          console.error("Full error:", error);
          try {
            const failedVote = await VoteService.processAndSaveVote(
              sessionId,
              `vote_${Date.now()}_${index}_${filename}`,
              voteType,
              {
                ok: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "AI processing failed",
                parsed: null,
              } as any,
              filename,
              session.seatsToElect,
              session.voteRule,
              session.evaluationOptions,
            );
            console.log(`[counting] SAVED ERROR RECORD for ${filename}:`, {
              voteId: failedVote.id,
              status: failedVote.status,
              notes: failedVote.notes,
            });
          } catch (saveError) {
            console.error(
              `[counting] ❌ Failed to save error record for ${filename}:`,
              saveError,
            );
          }
        } finally {
          const latestJob = countingJobs.get(sessionId);
          if (latestJob) {
            latestJob.processed = Math.min(
              latestJob.total,
              latestJob.processed + 1,
            );
          }
        }
      }

      const finishedJob = countingJobs.get(sessionId);
      if (finishedJob && finishedJob.status === "processing") {
        finishedJob.status = finishedJob.failed > 0 ? "failed" : "completed";
        finishedJob.processed = finishedJob.total;
        finishedJob.currentFile = null;
        finishedJob.finishedAt = new Date().toISOString();
        finishedJob.message =
          finishedJob.failed > 0
            ? `Đã kiểm xong, có ${finishedJob.failed} phiếu lỗi cần xem lại.`
            : "Đã kiểm phiếu xong.";
        console.log(
          `[counting] completed session=${sessionId} total=${finishedJob.total} failed=${finishedJob.failed}`,
        );
      }
    })();
  },
);

app.get(
  "/api/uploads/:sessionId",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionBallotViewPermission,
  (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionDir = path.join(uploadsDir, sessionId);

    try {
      if (!fs.existsSync(sessionDir)) {
        return res.json([]);
      }

      const files = fs
        .readdirSync(sessionDir)
        .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
        .sort((a, b) => {
          const aStat = fs.statSync(path.join(sessionDir, a));
          const bStat = fs.statSync(path.join(sessionDir, b));
          return bStat.mtimeMs - aStat.mtimeMs;
        });
      res.json(files);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to list files" });
    }
  },
);

app.delete(
  "/api/uploads/:sessionId/:filename",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionUploadPermission,
  async (req: Request, res: Response) => {
    const { sessionId, filename } = req.params;
    const filepath = path.join(uploadsDir, sessionId, filename);

    try {
      // Xóa file ảnh
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Xóa vote trong database dựa trên imageUrl
      const voteRepository = AppDataSource.getRepository(Vote);
      await voteRepository.delete({
        sessionId: sessionId,
        imageUrl: filename,
      });

      const remainingTotal = listSessionImageFiles(sessionId).length;
      countingJobs.set(sessionId, {
        sessionId,
        status: remainingTotal > 0 ? "uploaded" : "idle",
        total: remainingTotal,
        processed: 0,
        failed: 0,
        currentFile: null,
        message:
          remainingTotal > 0
            ? "Đã cập nhật danh sách phiếu. Nhấn Bắt đầu kiểm phiếu để tính lại."
            : "Chưa có phiếu.",
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      res.json({ message: "File and vote deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  },
);

app.delete(
  "/api/uploads/:sessionId",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionUploadPermission,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionDir = path.join(uploadsDir, sessionId);

    try {
      // Xóa tất cả file ảnh
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      // Xóa tất cả votes của session trong database
      const voteRepository = AppDataSource.getRepository(Vote);
      await voteRepository.delete({ sessionId: sessionId });
      countingJobs.delete(sessionId);

      res.json({ message: "All files and votes deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete files" });
    }
  },
);

// ===== RESULTS =====
app.get("/api/results/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const voteRepository = AppDataSource.getRepository(Vote);
    const votes = await voteRepository.find({
      where: { sessionId },
      relations: ["session"],
      order: { createdAt: "DESC" },
    });
    res.json({
      success: true,
      message: "Votes retrieved successfully",
      data: votes,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

/**
 * GET /api/sessions/:sessionId/progress
 * Trả về tiến trình kiểm phiếu cho một phiên.
 */
app.get(
  "/api/sessions/:sessionId/progress",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const activeJob = countingJobs.get(sessionId);
      if (activeJob?.status === "processing") {
        return res.json(serializeCountingJob(activeJob));
      }

      const voteRepository = AppDataSource.getRepository(Vote);
      const uploadedTotal = listSessionImageFiles(sessionId).length;
      const processedVotes = await voteRepository.count({
        where: { sessionId },
      });
      const processed =
        uploadedTotal > 0
          ? Math.min(uploadedTotal, processedVotes)
          : processedVotes;
      const total = uploadedTotal || processedVotes;

      if (activeJob) {
        activeJob.total = total;
        activeJob.processed = activeJob.status === "uploaded" ? 0 : total;
        return res.json(serializeCountingJob(activeJob));
      }

      const status: CountingStatus =
        total === 0
          ? "idle"
          : processedVotes === 0
            ? "uploaded"
            : processedVotes >= total
              ? "completed"
              : "uploaded";

      const percent =
        total === 0 ? 0 : Math.min(100, Math.floor((processed / total) * 100));
      res.json({
        sessionId,
        status,
        total,
        processed,
        failed: 0,
        percent,
        isProcessing: false,
        canStart: uploadedTotal > 0 && status !== "completed",
        message:
          status === "uploaded"
            ? "Đã có phiếu upload, chờ bấm Bắt đầu kiểm phiếu."
            : status === "completed"
              ? "Đã kiểm phiếu xong."
              : "Chưa có phiếu.",
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to get progress" });
    }
  },
);

async function computeSessionSummaryData(sessionId: string) {
  const voteRepository = AppDataSource.getRepository(Vote);
  const sessionRepo = AppDataSource.getRepository(VoteSession);

  const [votes, session] = await Promise.all([
    voteRepository.find({ where: { sessionId }, order: { createdAt: "ASC" } }),
    sessionRepo.findOne({ where: { id: sessionId } }),
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  const voteType = getBallotTypeFromSessionType(session.type);
  const voteRule =
    session.voteRule ||
    (voteType === "trust" ? "custom-evaluation" : "elect-by-seats");
  const isTrustVote = voteType === "trust";
  const evaluationOptions = buildEvaluationOptions(
    session.evaluationOptions,
    voteType,
    voteRule,
  );

  type Tally = {
    selected: number;
    notSelected: number;
    empty: number;
    optionCounts: Record<string, number>;
  };

  const createEmptyTally = (): Tally => ({
    selected: 0,
    notSelected: 0,
    empty: 0,
    optionCounts: Object.fromEntries(
      evaluationOptions.map((opt) => [opt.key, 0]),
    ),
  });

  const tally = new Map<string, Tally>();
  const candidateLookup = new Map<string, string>();

  const normalizeVietnameseName = (s: string) => {
    const loose = String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { loose, compact: loose.replace(/\s+/g, "") };
  };

  const registerAlias = (alias: string, canonicalName: string) => {
    const normalized = normalizeVietnameseName(alias);
    if (normalized.loose && !candidateLookup.has(normalized.loose))
      candidateLookup.set(normalized.loose, canonicalName);
    if (normalized.compact && !candidateLookup.has(normalized.compact))
      candidateLookup.set(normalized.compact, canonicalName);
  };

  (session.candidates || []).forEach((name) => {
    const originalName = String(name || "").trim();
    if (!originalName) return;
    const normalized = normalizeVietnameseName(originalName);
    const existingCanonical =
      candidateLookup.get(normalized.loose) ||
      candidateLookup.get(normalized.compact);
    const canonicalName = existingCanonical || originalName;
    if (!tally.has(canonicalName)) tally.set(canonicalName, createEmptyTally());
    registerAlias(originalName, canonicalName);
  });

  let totalBallots = votes.length;
  let validBallots = 0;
  let invalidBallots = 0;
  let failedBallots = 0;

  const parseBool = (value: any) => {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string")
      return ["true", "1", "yes", "y", "co", "x", "selected", "chon"].includes(
        value.trim().toLowerCase(),
      );
    return false;
  };

  for (const vote of votes) {
    if (vote.status === "valid") validBallots++;
    else if (vote.status === "invalid") invalidBallots++;
    else if (vote.status === "failed") failedBallots++;
    if (vote.status !== "valid") continue;

    let rawData: any = null;
    try {
      rawData = vote.rawData ? JSON.parse(vote.rawData) : null;
    } catch {
      /* keep null */
    }

    const findDetails = (obj: any): any[] | null => {
      if (!obj || typeof obj !== "object") return null;
      if (Array.isArray(obj.ballot_details)) return obj.ballot_details;
      if (Array.isArray(obj.candidates)) return obj.candidates;
      for (const key of ["parsed", "full_analysis", "parsed_full"]) {
        const nested = findDetails(obj[key]);
        if (nested) return nested;
      }
      return null;
    };

    const rows = findDetails(rawData);
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const name = (
        row.name ||
        row.label ||
        row.candidate_name ||
        row.full_name ||
        ""
      )
        .toString()
        .trim();
      if (!name) continue;

      const normalizedRow = normalizeVietnameseName(name);
      const foundKey =
        candidateLookup.get(normalizedRow.loose) ||
        candidateLookup.get(normalizedRow.compact);
      if (!foundKey) {
        console.warn(
          `[summary] Bỏ qua tên không có trong danh sách ứng viên: "${name}"`,
        );
        continue;
      }

      registerAlias(name, foundKey);
      const entry = tally.get(foundKey)!;

      if (isTrustVote) {
        const option = extractEvaluationOption(row, evaluationOptions);
        if (option)
          entry.optionCounts[option.key] =
            (entry.optionCounts[option.key] || 0) + 1;
        else entry.empty++;
      } else {
        const agree = parseBool(row.agree);
        const disagree = parseBool(row.disagree);
        const selected =
          row.selected !== undefined
            ? parseBool(row.selected)
            : agree && !disagree;
        if (selected) entry.selected++;
        else entry.notSelected++;
      }
    }
  }

  const candidateList = Array.from(tally.entries()).map(([name, t]) => {
    const evaluationCounts = evaluationOptions.map((opt) => {
      const count = t.optionCounts[opt.key] || 0;
      return {
        key: opt.key,
        label: opt.label,
        count,
        percent:
          validBallots > 0 ? +((count / validBallots) * 100).toFixed(2) : 0,
      };
    });
    const primaryCount = isTrustVote
      ? evaluationCounts[0]?.count || 0
      : t.selected;

    const legacyByLabel = (labels: string[]) => {
      const normalizedLabels = labels.map((x) =>
        x
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      );
      return (
        evaluationCounts.find((item) =>
          normalizedLabels.includes(
            item.label
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ),
        )?.count || 0
      );
    };

    return {
      name,
      evaluationCounts,
      evaluationOptions: evaluationOptions.map((opt) => ({
        key: opt.key,
        label: opt.label,
      })),
      agree: legacyByLabel(["Đồng ý"]),
      disagree: legacyByLabel(["Không đồng ý"]),
      selected: t.selected,
      notSelected: t.notSelected,
      empty: t.empty,
      trustHigh: legacyByLabel(["Tín nhiệm cao"]),
      trustMedium: legacyByLabel(["Tín nhiệm"]),
      trustLow: legacyByLabel(["Tín nhiệm thấp"]),
      votesReceived: primaryCount,
      percent:
        validBallots > 0
          ? +((primaryCount / validBallots) * 100).toFixed(2)
          : 0,
      agreePercent:
        validBallots > 0
          ? +((legacyByLabel(["Đồng ý"]) / validBallots) * 100).toFixed(2)
          : 0,
      disagreePercent:
        validBallots > 0
          ? +((legacyByLabel(["Không đồng ý"]) / validBallots) * 100).toFixed(2)
          : 0,
      selectedPercent:
        validBallots > 0 ? +((t.selected / validBallots) * 100).toFixed(2) : 0,
      notSelectedPercent:
        validBallots > 0
          ? +((t.notSelected / validBallots) * 100).toFixed(2)
          : 0,
    };
  });

  candidateList.sort((a, b) => b.votesReceived - a.votesReceived);

  if (!isTrustVote) {
    const thresholdPct = session.minWinningPercent ?? 50;
    const seatsToElect = session.seatsToElect ?? null;
    candidateList.forEach((c, idx) => {
      const meetsThreshold =
        validBallots > 0 &&
        (c.votesReceived / validBallots) * 100 >= thresholdPct;
      const withinSeats = seatsToElect === null || idx < seatsToElect;
      (c as any).isElected = meetsThreshold && withinSeats;
      (c as any).percent =
        validBallots > 0
          ? +((c.votesReceived / validBallots) * 100).toFixed(2)
          : 0;
    });
  } else {
    candidateList.forEach((c) => {
      (c as any).isElected = false;
    });
  }

  console.log(
    `[summary] session=${sessionId} type=${voteType} total=${totalBallots} valid=${validBallots} invalid=${invalidBallots} failed=${failedBallots}`,
  );

  return {
    success: true,
    sessionId,
    sessionName: session.name,
    voteType,
    voteRule,
    evaluationOptions: evaluationOptions.map((opt) => ({
      key: opt.key,
      label: opt.label,
    })),
    electionUnit: session.electionUnit,
    location: session.location,
    seatsToElect: session.seatsToElect,
    minWinningPercent: session.minWinningPercent,
    totalBallots,
    validBallots,
    invalidBallots,
    failedBallots,
    candidates: candidateList,
  };
}

/**
 * GET /api/results/:sessionId/summary
 * Tổng hợp kết quả bầu cử theo từng ứng viên dựa trên rawData của AI.
 * - trust: đếm agree/disagree/empty theo từng ứng viên (chuẩn từ ballot_details)
 * - surplus: đếm selected/not-selected theo từng ứng viên
 */
app.get(
  "/api/results/:sessionId/summary",
  async (req: Request, res: Response) => {
    try {
      const summary = await computeSessionSummaryData(req.params.sessionId);
      return res.json(summary);
    } catch (error) {
      console.error("Error in /api/results/:sessionId/summary:", error);
      res.status(500).json({ error: "Failed to compute summary" });
    }
  },
);

app.post(
  "/api/results/:sessionId/report/preview",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionReportPermission,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { templateId, fields, customTemplate } = req.body || {};
      const summary = await computeSessionSummaryData(sessionId);

      const content = renderReport({
        templateId,
        fields,
        customTemplate,
        summary,
      });

      return res.json({ success: true, content });
    } catch (error) {
      console.error("Preview report error:", error);
      return res
        .status(500)
        .json({ error: "Không tạo được bản xem trước biên bản" });
    }
  },
);

app.post(
  "/api/results/:sessionId/report/export.txt",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionReportPermission,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { templateId, fields, customTemplate } = req.body || {};
      const summary = await computeSessionSummaryData(sessionId);

      const content = renderReport({
        templateId,
        fields,
        customTemplate,
        summary,
      });

      const filename = `${safeReportFileName(summary.sessionName)}.txt`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      return res.send(content);
    } catch (error) {
      console.error("Export report error:", error);
      return res.status(500).json({ error: "Không xuất được biên bản" });
    }
  },
);

/**
 * GET /api/results/:sessionId/ballots
 * Trả về danh sách phiếu thô (raw) để hiển thị và duyệt tay.
 */
app.get(
  "/api/results/:sessionId/ballots",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionBallotViewPermission,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const voteRepository = AppDataSource.getRepository(Vote);
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const [votes, session] = await Promise.all([
        voteRepository.find({
          where: { sessionId },
          order: { createdAt: "ASC" },
        }),
        sessionRepo.findOne({ where: { id: sessionId } }),
      ]);
      if (!session) return res.status(404).json({ error: "Session not found" });
      const ballots = votes.map((v) => ({
        id: v.id,
        voteId: v.voteId,
        status: v.status,
        imageUrl: v.imageUrl,
        selectedCandidate: v.selectedCandidate,
        validationNotes: v.validationNotes,
        confidenceScore: v.confidenceScore,
        sessionId: v.sessionId,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        session: { candidates: session.candidates || [] },
      }));
      return res.json({ success: true, votes: ballots });
    } catch (error) {
      console.error("Error in /api/results/:sessionId/ballots:", error);
      res.status(500).json({ error: "Failed to fetch ballots" });
    }
  },
);

app.get(
  "/api/results/:sessionId/audit-logs",
  authenticateJWT,
  requireRole("admin", "user"),
  requireSessionReviewPermission,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const voteId = req.query.voteId ? String(req.query.voteId) : null;
      const limitRaw = Number(req.query.limit ?? 50);
      const offsetRaw = Number(req.query.offset ?? 0);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
        : 50;
      const offset = Number.isFinite(offsetRaw)
        ? Math.max(0, Math.floor(offsetRaw))
        : 0;

      const where: { sessionId: string; voteId?: string } = { sessionId };
      if (voteId) where.voteId = voteId;

      const auditRepo = AppDataSource.getRepository(AuditLog);
      const [logs, total] = await auditRepo.findAndCount({
        where,
        order: { changeAt: "DESC" },
        take: limit,
        skip: offset,
      });

      const userIds = Array.from(
        new Set(logs.map((log) => log.userId).filter(Boolean)),
      );
      const users = userIds.length
        ? await AppDataSource.getRepository(User).find({
            where: { userId: In(userIds) },
          })
        : [];
      const userMap = new Map(
        users.map((u) => [
          u.userId,
          {
            userId: u.userId,
            email: u.email,
            fullName: u.fullName,
            workUnit: u.workUnit ?? null,
          },
        ]),
      );

      const safeParse = (input: string) => {
        try {
          return JSON.parse(input);
        } catch {
          return { raw: input };
        }
      };

      return res.json({
        total,
        logs: logs.map((log) => ({
          logId: log.logId,
          voteId: log.voteId,
          sessionId: log.sessionId,
          changeAt: log.changeAt,
          user:
            userMap.get(log.userId) ||
            ({
              userId: log.userId,
              email: null,
              fullName: null,
              workUnit: null,
            } as const),
          oldData: safeParse(log.oldData),
          newData: safeParse(log.newData),
        })),
      });
    } catch (error) {
      console.error("Error in /api/results/:sessionId/audit-logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  },
);

app.get("/api/results", async (req: Request, res: Response) => {
  try {
    const voteRepository = AppDataSource.getRepository(Vote);
    const votes = await voteRepository.find({
      relations: ["session"],
      order: { createdAt: "DESC" },
    });
    res.json({
      success: true,
      message: "Votes retrieved successfully",
      data: votes,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

// ===== HEALTH =====
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
  });
});

// Error Handler
app.use(errorHandler);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
