import "reflect-metadata";
import { AppDataSource } from "../config/database";
import { Vote } from "../entities/Vote";
import { VoteService } from "../services/voteService";

async function run() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("Usage: ts-node migrateSessionVotes.ts <sessionId>");
    process.exit(1);
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const repo = AppDataSource.getRepository(Vote);
    const votes = await repo.findBy({ sessionId });
    console.log(`Found ${votes.length} votes for session ${sessionId}`);

    let updated = 0;
    for (const v of votes) {
      try {
        let aiResult: any = null;
        if (v.rawData) {
          try {
            aiResult = JSON.parse(v.rawData);
          } catch (e) {
            // fallback: rawData might contain escaped JSON; try to extract first JSON
            const s = String(v.rawData || '');
            const start = s.indexOf('{');
            const end = s.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
              try {
                aiResult = JSON.parse(s.slice(start, end + 1));
              } catch (e2) {
                aiResult = null;
              }
            }
          }
        }

        const selected = VoteService.extractSelectedCandidate(aiResult);
        const confidence = VoteService.calculateConfidence(aiResult);

        let newStatus: Vote['status'] = v.status || 'pending';
        if (selected && String(selected).trim()) {
          newStatus = 'valid';
        } else if (aiResult && typeof aiResult === 'object') {
          newStatus = 'invalid';
        } else {
          newStatus = 'failed';
        }

        v.selectedCandidate = selected || '';
        v.candidate = selected || '';
        v.confidenceScore = confidence || v.confidenceScore;
        v.status = newStatus;

        await repo.save(v);
        updated++;
      } catch (e) {
        console.error(`Failed to migrate vote ${v.id}:`, e);
      }
    }

    console.log(`Migration complete. Updated ${updated} votes.`);
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
}

run();
