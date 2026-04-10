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
import voteRoutes from "./routes/voteRoutes";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import voteControllerRoutes from "./routes/voteControllerRoutes";
import { errorHandler } from "./middleware/errorHandler";
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
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow predefined origins and any localhost/127.0.0.1 port used by Vite
    const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    if (allowedOrigins.has(origin) || isLocalDevOrigin) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());

// Serve uploads folder
app.use("/uploads", express.static(uploadsDir));

// Initialize Database
AppDataSource.initialize()
  .then(async () => {
    console.log("Database connection established");
    try {
      const updated = await VoteService.backfillValidationStatus();
      if (updated > 0) {
        console.log(`Backfilled validation status for ${updated} votes`);
      }
    } catch (err) {
      console.error("Failed to backfill validation status:", err);
    }
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
app.get("/api/sessions", async (req: Request, res: Response) => {
  try {
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const sessions = await sessionRepo.find();
    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

app.post("/api/sessions", async (req: Request, res: Response) => {
  try {
    const { name, type, startAt, endAt, candidates, seats, minWinPercent } = req.body;

    const candidateList = Array.isArray(candidates)
      ? candidates.map((c: any) => String(c).trim()).filter(Boolean)
      : [];

    const parsedSeats = Number(seats);
    const parsedMinPercent = Number(minWinPercent);

    if (!name || !type || !startAt || !endAt) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc khi tạo phiên" });
    }

    if (candidateList.length === 0) {
      return res.status(400).json({ error: "Cần ít nhất 1 ứng cử viên" });
    }

    if (!Number.isFinite(parsedSeats) || parsedSeats <= 0) {
      return res.status(400).json({ error: "Số lượng cần bầu phải lớn hơn 0" });
    }

    if (parsedSeats > candidateList.length) {
      return res.status(400).json({ error: "Số lượng cần bầu không được lớn hơn số ứng cử viên" });
    }

    if (!Number.isFinite(parsedMinPercent) || parsedMinPercent < 0 || parsedMinPercent > 100) {
      return res.status(400).json({ error: "% tối thiểu để trúng cử phải trong khoảng 0-100" });
    }
    
    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const newSession = sessionRepo.create({
      id: Date.now().toString(),
      name,
      type,
      startAt,
      endAt,
      candidates: candidateList,
      seats: Math.floor(parsedSeats),
      minWinPercent: parsedMinPercent,
    });
    
    await sessionRepo.save(newSession);
    res.json(newSession);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

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
app.post("/api/uploads/:sessionId", upload.array("files", 50), async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const files = (req.files as Express.Multer.File[]) || [];
  
  if (files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  // Lấy voteType từ query hoặc mặc định là "trust"
  const voteType = (req.query.voteType as "trust" | "surplus") || "trust";

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
          120000 // max wait 2 minutes
        );

        // Lưu kết quả vào database
        await VoteService.processAndSaveVote(
          sessionId,
          voteId,
          voteType,
          aiResult,
          file.filename
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
            file.filename
          );
        } catch (saveError) {
          console.error(`Failed to save error record:`, saveError);
        }
      }
    }
  })();
});

app.get("/api/uploads/:sessionId", (req: Request, res: Response) => {
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

app.delete("/api/uploads/:sessionId/:filename", async (req: Request, res: Response) => {
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

app.delete("/api/uploads/:sessionId", async (req: Request, res: Response) => {
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