import path from "path";
import fs from "fs";
import { AppDataSource } from "../config/database";
import aiService from "../services/aiService";
import { VoteService } from "../services/voteService";
import { VoteSession } from "../entities/VoteSession";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: ts-node src/scripts/reprocessSession.ts <sessionId>");
    process.exit(2);
  }

  const sessionId = args[0];

  // Initialize DB
  await AppDataSource.initialize();

  const sessionRepo = AppDataSource.getRepository(VoteSession);
  const session = await sessionRepo.findOne({ where: { id: sessionId } });

  let ballotType: "trust" | "surplus" = "trust";
  if (session) {
    ballotType = session.type === "tin-nhiem" ? "trust" : "surplus";
    console.log(`Session ${sessionId} found. ballotType=${ballotType}`);
  } else {
    console.warn(`Session ${sessionId} not found in DB; defaulting ballotType=trust`);
  }

  const uploadsDir = path.join(__dirname, "../../../backend/uploads", sessionId);
  if (!fs.existsSync(uploadsDir)) {
    console.error("Uploads directory not found:", uploadsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(uploadsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`Found ${files.length} files in ${uploadsDir}`);

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    console.log("Processing", filePath);
    try {
      const aiResult = await aiService.processAndWait(ballotType, filePath);

      const voteId = `reproc_${Date.now()}`;
      const vote = await VoteService.processAndSaveVote(
        sessionId,
        voteId,
        ballotType,
        aiResult,
        file
      );

      console.log(`Saved vote ${vote.id} selected=${vote.selectedCandidate} status=${vote.status}`);
    } catch (e) {
      console.error("Failed to process", file, e);
    }
  }

  console.log("Done reprocessing session", sessionId);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
