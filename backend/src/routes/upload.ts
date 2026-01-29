import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import aiService from "../services/aiService";
import { VoteService } from "../services/voteService";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.sessionId;
    const uploadDir = path.join(__dirname, "../../uploads", sessionId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
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

// Upload ảnh VÀ tự động xử lý AI
router.post("/api/upload/:sessionId", upload.array("files", 50), async (req: Request, res: Response) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const { sessionId } = req.params;
  const uploadedFiles = req.files as Express.Multer.File[];
  
  const files = uploadedFiles.map((f) => ({
    filename: f.filename,
    originalname: f.originalname,
    size: f.size,
  }));

  // Lấy ballotType từ query hoặc mặc định là "trust"
  const ballotType = (req.query.ballotType as "trust" | "surplus") || "trust";

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
        const aiResult = await aiService.processAndWait(
          ballotType,
          imagePath,
          1000, // poll every 1 second
          120000 // max wait 2 minutes
        );

        // Lưu kết quả vào database
        await VoteService.processAndSaveVote(
          sessionId,
          ballotId,
          ballotType,
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
            `ballot_${Date.now()}_${file.filename}`,
            ballotType,
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

// Get uploaded files
router.get("/api/uploads/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads", sessionId);

  if (!fs.existsSync(uploadDir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(uploadDir);
  res.json(files);
});

// Delete file
router.delete("/api/uploads/:sessionId/:filename", (req: Request, res: Response) => {
  const { sessionId, filename } = req.params;
  const filepath = path.join(__dirname, "../../uploads", sessionId, filename);

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "File not found" });
});

// Delete all files in session
router.delete("/api/uploads/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads", sessionId);

  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true });
  }

  res.json({ success: true });
});

export default router;