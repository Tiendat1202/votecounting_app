import { DataSource } from "typeorm";
import path from "path";
import { Vote } from "../entities/Vote";
import { VoteSession } from "../entities/VoteSession";
import { User } from "../entities/User";
import { SessionMember } from "../entities/SessionMember";
import { AuditLog } from "../entities/AuditLog";
import { Candidate } from "../entities/Candidate";
import { VoteCandidate } from "../entities/VoteCandidate";
import { CandidateResult } from "../entities/CandidateResult";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: path.join(__dirname, "../../database.sqlite"),
  synchronize: true,
  logging: false,
  entities: [
    Vote,
    VoteSession,
    User,
    SessionMember,
    AuditLog,
    Candidate,
    VoteCandidate,
    CandidateResult,
  ],
});
