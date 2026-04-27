import "reflect-metadata";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AppDataSource } from "./config/database";
import { VoteSession } from "./entities/VoteSession";
import { Vote } from "./entities/Vote";
import { User } from "./entities/User";
import voteRoutes from "./routes/voteRoutes";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import voteControllerRoutes from "./routes/voteControllerRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { attachOptionalUser, authenticateJWT, requireRole, AuthenticatedRequest } from "./middleware/auth";
import { computeSessionPermissions, requireSessionUploadPermission, requireSessionBallotViewPermission, requireSessionOwnerOrAdmin } from "./middleware/sessionAuthorization";
import { SessionAccessRequest, SessionAccessAction } from "./entities/SessionAccessRequest";
import aiService from "./services/aiService";
import { VoteService } from "./services/voteService";

dotenv.config();

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
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Serve uploads folder
app.use("/uploads", express.static(uploadsDir));

// Initialize Database
AppDataSource.initialize()
  .then(() => {
    console.log("Database connection established");
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

// ===== SESSIONS =====
async function serializeSession(session: VoteSession, payload?: AuthenticatedRequest) {
  let createdByName = session.createdByName || null;
  if (!createdByName && session.createdByUserId) {
    const owner = await AppDataSource.getRepository(User).findOne({ where: { userId: session.createdByUserId } });
    createdByName = owner?.fullName || null;
  }

  const permissions = payload?.user ? await computeSessionPermissions(session, payload) : undefined;
  return {
    ...session,
    createdByName,
    permissions,
  };
}

app.get("/api/sessions", attachOptionalUser, async (req: Request, res: Response) => {
  try {
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const sessions = await sessionRepo.find({ order: { createdAt: "DESC" } });

    const payload = req as AuthenticatedRequest;
    const items = await Promise.all(sessions.map((session) => serializeSession(session, payload)));

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

app.get("/api/sessions/:sessionId", attachOptionalUser, async (req: Request, res: Response) => {
  try {
    const session = await AppDataSource.getRepository(VoteSession).findOne({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: "Không tìm thấy phiên kiểm phiếu" });

    const payload = req as AuthenticatedRequest;
    const item = await serializeSession(session, payload);
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không tải được thông tin phiên" });
  }
});

app.post(
  "/api/sessions",
  authenticateJWT,
  requireRole("admin", "inspector"),
  async (req: Request, res: Response) => {
    try {
      const { name, type, startAt, endAt, candidates, seats, minWinPercent } = req.body;
      const currentUser = (req as AuthenticatedRequest).user;

      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const newSession = sessionRepo.create({
        id: Date.now().toString(),
        name,
        type,
        startAt,
        endAt,
        candidates,
        createdByUserId: currentUser?.userId || null,
        createdByEmail: currentUser?.email || null,
        createdByName: currentUser?.fullName || null,
        seatsToElect: seats ? Math.floor(Number(seats)) : null,
        minWinningPercent: minWinPercent !== undefined && minWinPercent !== null ? Number(minWinPercent) : 50,
      });

      await sessionRepo.save(newSession);
      res.json(await serializeSession(newSession, req as AuthenticatedRequest));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create session" });
    }
  }
);

app.patch(
  "/api/sessions/:sessionId/close",
  authenticateJWT,
  requireRole("admin", "inspector"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const session = await sessionRepo.findOne({ where: { id: req.params.sessionId } });
      if (!session) return res.status(404).json({ error: "Không tìm thấy phiên kiểm phiếu" });

      const now = new Date();
      const currentEnd = new Date(session.endAt).getTime();
      if (!Number.isNaN(currentEnd) && currentEnd <= now.getTime()) {
        return res.status(400).json({ error: "Phiên này đã kết thúc, không cần đóng sớm nữa" });
      }

      session.endAt = now.toISOString();
      session.closedEarlyAt = now;
      session.closedEarlyByUserId = (req as AuthenticatedRequest).user?.userId || null;
      await sessionRepo.save(session);

      res.json({ message: "Đã đóng phiên sớm", session: await serializeSession(session, req as AuthenticatedRequest) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không thể đóng phiên sớm" });
    }
  }
);

app.get(
  "/api/access-requests/inbox",
  authenticateJWT,
  requireRole("admin", "inspector"),
  async (req: Request, res: Response) => {
    try {
      const accessRepo = AppDataSource.getRepository(SessionAccessRequest);
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const currentUser = (req as AuthenticatedRequest).user!;

      let rows = await accessRepo.find({ order: { createdAt: "DESC" } });
      if (currentUser.role !== "admin") {
        const sessions = await sessionRepo.find({ where: { createdByUserId: currentUser.userId } });
        const ownedSessionIds = new Set(sessions.map((s) => s.id));
        rows = rows.filter((row) => ownedSessionIds.has(row.sessionId));
      }

      const sessionMap = new Map((await sessionRepo.find()).map((s) => [s.id, s]));
      res.json(rows.map((row) => ({ ...row, sessionName: sessionMap.get(row.sessionId)?.name || row.sessionId, requesterFullName: row.requesterFullName || row.requesterEmail })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không tải được yêu cầu truy cập" });
    }
  }
);

app.get(
  "/api/sessions/:sessionId/access-requests",
  authenticateJWT,
  requireRole("admin", "inspector"),
  requireSessionOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const rows = await AppDataSource.getRepository(SessionAccessRequest).find({
        where: { sessionId: req.params.sessionId },
        order: { createdAt: "DESC" },
      });
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không tải được yêu cầu truy cập" });
    }
  }
);

app.post(
  "/api/sessions/:sessionId/access-requests",
  authenticateJWT,
  requireRole("inspector"),
  async (req: Request, res: Response) => {
    try {
      const currentUser = (req as AuthenticatedRequest).user!;
      const { sessionId } = req.params;
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const accessRepo = AppDataSource.getRepository(SessionAccessRequest);
      const session = await sessionRepo.findOne({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ error: "Không tìm thấy phiên kiểm phiếu" });
      if (!session.createdByUserId) return res.status(400).json({ error: "Phiên chưa có chủ sở hữu rõ ràng" });
      if (session.createdByUserId === currentUser.userId) {
        return res.status(400).json({ error: "Bạn đang là chủ phiên, không cần gửi yêu cầu" });
      }

      const requestedActions = Array.isArray(req.body?.actions) && req.body.actions.length > 0
        ? (req.body.actions as string[])
        : ["upload", "review"];
      const actions = Array.from(new Set(requestedActions.filter((a): a is SessionAccessAction => a === "upload" || a === "review")));
      if (actions.length === 0) {
        return res.status(400).json({ error: "Bạn phải chọn ít nhất một quyền cần yêu cầu" });
      }

      const existing = await accessRepo.findOne({
        where: { sessionId, requesterUserId: currentUser.userId, status: "pending" },
        order: { createdAt: "DESC" },
      });

      if (existing) {
        existing.actions = actions;
        existing.note = req.body?.note || existing.note;
        await accessRepo.save(existing);
        return res.json({ message: "Đã cập nhật yêu cầu truy cập", request: existing });
      }

      const row = accessRepo.create({
        sessionId,
        ownerUserId: session.createdByUserId,
        requesterUserId: currentUser.userId,
        requesterEmail: currentUser.email,
        requesterFullName: currentUser.fullName || currentUser.email,
        actions,
        note: req.body?.note || null,
        status: "pending",
      });
      await accessRepo.save(row);
      res.status(201).json({ message: "Đã gửi yêu cầu truy cập tới chủ phiên", request: row });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không gửi được yêu cầu truy cập" });
    }
  }
);

app.patch(
  "/api/access-requests/:requestId",
  authenticateJWT,
  requireRole("admin", "inspector"),
  async (req: Request, res: Response) => {
    try {
      const accessRepo = AppDataSource.getRepository(SessionAccessRequest);
      const sessionRepo = AppDataSource.getRepository(VoteSession);
      const currentUser = (req as AuthenticatedRequest).user!;
      const row = await accessRepo.findOne({ where: { id: req.params.requestId } });
      if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu" });

      const session = await sessionRepo.findOne({ where: { id: row.sessionId } });
      if (!session) return res.status(404).json({ error: "Không tìm thấy phiên kiểm phiếu" });
      const isOwner = session.createdByUserId && session.createdByUserId === currentUser.userId;
      if (!(currentUser.role === "admin" || isOwner)) {
        return res.status(403).json({ error: "Chỉ chủ phiên hoặc admin mới được duyệt yêu cầu" });
      }

      const status = req.body?.status;
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ error: "Trạng thái yêu cầu không hợp lệ" });
      }

      row.status = status;
      row.reviewedByUserId = currentUser.userId;
      await accessRepo.save(row);
      res.json({ message: "Đã cập nhật yêu cầu truy cập", request: row });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không cập nhật được yêu cầu truy cập" });
    }
  }
);

// ===== STATS =====
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const totalSessions = await sessionRepo.count();
    
    res.json({
      totalSessions,
      totalVotes: 0,
      activeSession: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ===== UPLOADS =====
app.post("/api/uploads/:sessionId", authenticateJWT, requireRole("admin", "inspector"), requireSessionUploadPermission, upload.array("files", 50), async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const files = (req.files as Express.Multer.File[]) || [];
  
  if (files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  // Lấy voteType từ query hoặc mặc định là "trust"
  const voteType = (req.query.voteType as "trust" | "surplus") || "trust";

  // Lấy seatsToElect từ session để dùng cho surplus ballot validation
  let sessionSeatsToElect: number | null = null;
  let sessionCandidates: string[] = [];
  try {
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const sess = await sessionRepo.findOne({ where: { id: sessionId } });
    sessionSeatsToElect = sess?.seatsToElect ?? null;
    sessionCandidates = sess?.candidates ?? [];
  } catch { /* ignore, will fall back to null */ }

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
        const aiResult = await aiService.processAndWait(
          voteType,
          imagePath,
          1000, // poll every 1 second
          120000, // max wait 2 minutes
          sessionCandidates
        );

        // Lưu kết quả vào database
        await VoteService.processAndSaveVote(
          sessionId,
          voteId,
          voteType,
          aiResult,
          file.filename,
          sessionSeatsToElect
        );

        console.log(`AI processed ${file.filename}: ${aiResult.parsed?.candidate_name || "N/A"}`);
      } catch (error) {
        console.error(`AI processing failed for ${file.filename}:`, error);
        
        // Lưu lỗi vào database với status invalid
        try {
          await VoteService.processAndSaveVote(
            sessionId,
            `vote_${Date.now()}_${file.filename}`,
            voteType,
            {
              ok: false,
              error: error instanceof Error ? error.message : "AI processing failed",
              parsed: null,
            } as any,
            file.filename,
            sessionSeatsToElect
          );
        } catch (saveError) {
          console.error(`Failed to save error record:`, saveError);
        }
      }
    }
  })();
});

app.get("/api/uploads/:sessionId", authenticateJWT, requireRole("admin", "inspector", "supervisor"), requireSessionBallotViewPermission, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(uploadsDir, sessionId);
  
  try {
    if (!fs.existsSync(sessionDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(sessionDir);
    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

app.delete("/api/uploads/:sessionId/:filename", authenticateJWT, requireRole("admin", "inspector"), requireSessionUploadPermission, async (req: Request, res: Response) => {
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
      imageUrl: filename
    });
    
    res.json({ message: "File and vote deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.delete("/api/uploads/:sessionId", authenticateJWT, requireRole("admin", "inspector"), requireSessionUploadPermission, async (req: Request, res: Response) => {
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
    
    res.json({ message: "All files and votes deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete files" });
  }
});

// ===== RESULTS =====
app.get("/api/results/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const voteRepository = AppDataSource.getRepository(Vote);
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

/**
 * GET /api/sessions/:sessionId/progress
 * Trả về tiến trình xử lý AI cho một phiên bầu cử.
 */
app.get("/api/sessions/:sessionId/progress", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const voteRepository = AppDataSource.getRepository(Vote);
    const total = await voteRepository.count({ where: { sessionId } });
    const processed = await voteRepository.count({
      where: [
        { sessionId, status: "valid" as any },
        { sessionId, status: "invalid" as any },
        { sessionId, status: "failed" as any },
      ],
    });
    const percent = total === 0 ? 0 : Math.floor((processed / total) * 100);
    res.json({ total, processed, percent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get progress" });
  }
});

/**
 * GET /api/results/:sessionId/summary
 * Tổng hợp kết quả bầu cử theo từng ứng viên dựa trên rawData của AI.
 * - trust: đếm agree/disagree/empty theo từng ứng viên (chuẩn từ ballot_details)
 * - surplus: đếm selected/not-selected theo từng ứng viên
 */
app.get("/api/results/:sessionId/summary", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const voteRepository = AppDataSource.getRepository(Vote);
    const sessionRepo = AppDataSource.getRepository(VoteSession);

    const [votes, session] = await Promise.all([
      voteRepository.find({ where: { sessionId }, order: { createdAt: "ASC" } }),
      sessionRepo.findOne({ where: { id: sessionId } }),
    ]);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const voteType: "trust" | "surplus" = session.type === "tin-nhiem" ? "trust" : "surplus";

    // Per-candidate tallies
    const tally = new Map<string, { agree: number; disagree: number; selected: number; notSelected: number; empty: number }>();

    // Ensure all registered candidates are in the tally map (even if 0 votes)
    (session.candidates || []).forEach((name) => {
      const key = name.trim();
      if (key && !tally.has(key)) {
        tally.set(key, { agree: 0, disagree: 0, selected: 0, notSelected: 0, empty: 0 });
      }
    });

    let totalBallots = votes.length;
    let validBallots = 0;
    let invalidBallots = 0;
    let failedBallots = 0;

    const normKey = (s: string) =>
      s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

    for (const vote of votes) {
      if (vote.status === "valid") validBallots++;
      else if (vote.status === "invalid") invalidBallots++;
      else if (vote.status === "failed") failedBallots++;

      // Only tally from valid ballots
      if (vote.status !== "valid") continue;

      let rawData: any = null;
      try {
        rawData = vote.rawData ? JSON.parse(vote.rawData) : null;
      } catch { /* keep null */ }

      // Drill into nested shapes to find ballot_details
      const findDetails = (obj: any): any[] | null => {
        if (!obj || typeof obj !== "object") return null;
        if (Array.isArray(obj.ballot_details)) return obj.ballot_details;
        if (Array.isArray(obj.candidates)) return obj.candidates;
        // check nested
        for (const key of ["parsed", "full_analysis", "parsed_full"]) {
          const nested = findDetails(obj[key]);
          if (nested) return nested;
        }
        return null;
      };

      const rows = findDetails(rawData);
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const name = (row.name || row.label || "").toString().trim();
        if (!name) continue;

        // Find matching tally entry (fuzzy-normalize match or create new)
        let foundKey: string | undefined;
        const normRow = normKey(name);
        for (const k of tally.keys()) {
          if (normKey(k) === normRow) { foundKey = k; break; }
        }
        if (!foundKey) {
          // New name encountered in actual data not in session list
          tally.set(name, { agree: 0, disagree: 0, selected: 0, notSelected: 0, empty: 0 });
          foundKey = name;
        }

        if (!foundKey) continue;
        const entry = tally.get(foundKey)!;
        const agree = row.agree === true;
        const disagree = row.disagree === true;
        const selected = row.selected === true;
        const rowStatus = (row.row_status || "").toString().toUpperCase();

        if (voteType === "trust") {
          if (agree && !disagree) entry.agree++;
          else if (disagree && !agree) entry.disagree++;
          else if (agree && disagree) { /* DOUBLE_MARK — skip */ }
          else entry.empty++;
        } else {
          if (selected || (agree && !disagree)) entry.selected++;
          else entry.notSelected++;
        }
      }
    }

    const candidateList = Array.from(tally.entries()).map(([name, t]) => ({
      name,
      agree: t.agree,
      disagree: t.disagree,
      selected: t.selected,
      notSelected: t.notSelected,
      empty: t.empty,
      // For trust: "votes for" = agree count across all valid ballots
      votesReceived: voteType === "trust" ? t.agree : t.selected,
    }));

    // Sort by votes received desc
    candidateList.sort((a, b) => b.votesReceived - a.votesReceived);

    // Compute isElected: candidates must be in top seatsToElect AND meet >= minimumPercent
    const thresholdPct = session.minWinningPercent ?? 50;
    const threshold = thresholdPct / 100;
    const seatsToElect = session.seatsToElect ?? null;
    candidateList.forEach((c, idx) => {
      const meetsThreshold = validBallots > 0 && (c.votesReceived / validBallots) * 100 >= thresholdPct;
      const withinSeats = seatsToElect === null || idx < seatsToElect;
      (c as any).isElected = meetsThreshold && withinSeats;
      (c as any).percent = validBallots > 0 ? +((c.votesReceived / validBallots) * 100).toFixed(2) : 0;
    });

    console.log(`[summary] session=${sessionId} type=${voteType} total=${totalBallots} valid=${validBallots} invalid=${invalidBallots} failed=${failedBallots}`);

    return res.json({
      success: true,
      sessionId,
      sessionName: session.name,
      voteType,
      seatsToElect: session.seatsToElect,
      minWinningPercent: session.minWinningPercent,
      totalBallots,
      validBallots,
      invalidBallots,
      failedBallots,
      candidates: candidateList,
    });
  } catch (error) {
    console.error("Error in /api/results/:sessionId/summary:", error);
    res.status(500).json({ error: "Failed to compute summary" });
  }
});

/**
 * GET /api/results/:sessionId/ballots
 * Trả về danh sách phiếu thô (raw) để hiển thị và duyệt tay.
 */
app.get("/api/results/:sessionId/ballots", authenticateJWT, requireRole("admin", "inspector", "supervisor"), requireSessionBallotViewPermission, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const voteRepository = AppDataSource.getRepository(Vote);
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const [votes, session] = await Promise.all([
      voteRepository.find({ where: { sessionId }, order: { createdAt: "ASC" } }),
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
});

app.get("/api/results", async (req: Request, res: Response) => {
  try {
    const voteRepository = AppDataSource.getRepository(Vote);
    const votes = await voteRepository.find({
      relations: ["session"],
      order: { createdAt: "DESC" }
    });
    res.json({
      success: true,
      message: "Votes retrieved successfully",
      data: votes
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
    timestamp: new Date()
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