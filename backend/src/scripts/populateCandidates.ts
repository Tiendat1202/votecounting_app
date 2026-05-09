/**
 * Migration script to populate Candidate table from existing VoteSession.candidates
 * Run with: npm run ts-node -- src/scripts/populateCandidates.ts
 */
import { AppDataSource } from "../config/database";
import { VoteSession } from "../entities/VoteSession";
import { Candidate } from "../entities/Candidate";
import { v4 as uuidv4 } from "uuid";

async function populateCandidates() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const sessionRepo = AppDataSource.getRepository(VoteSession);
    const candidateRepo = AppDataSource.getRepository(Candidate);

    // Get all sessions
    const sessions = await sessionRepo.find();
    console.log(`Found ${sessions.length} sessions`);

    let totalCreated = 0;

    for (const session of sessions) {
      if (!session.candidates || !Array.isArray(session.candidates)) {
        console.log(`Session ${session.id} has no candidates, skipping`);
        continue;
      }

      // candidates is already an array (TypeORM simple-array)
      const candidateNames = session.candidates
        .map((name: string) => String(name).trim())
        .filter((name: string) => name.length > 0);

      console.log(
        `Processing session ${session.id} (${session.name}) with ${candidateNames.length} candidates`
      );

      for (const name of candidateNames) {
        // Check if candidate already exists for this session
        const existing = await candidateRepo.findOneBy({
          sessionId: session.id,
          candidateName: name,
        });

        if (existing) {
          console.log(`  - Candidate "${name}" already exists, skipping`);
          continue;
        }

        // Create new candidate
        const candidate = candidateRepo.create({
          candidateId: uuidv4(),
          candidateName: name,
          sessionId: session.id,
          candidateDate: null,
          candidateGender: null,
          candidateUnit: null,
          votesCount: 0,
          candidateInfo: null,
        });

        await candidateRepo.save(candidate);
        totalCreated++;
        console.log(`  ✓ Created candidate "${name}"`);
      }
    }

    console.log(`\n✅ Migration complete! Created ${totalCreated} new candidates`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

populateCandidates();
