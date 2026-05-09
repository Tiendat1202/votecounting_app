import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { VoteSession } from "./VoteSession";
import { VoteCandidate } from "./VoteCandidate";
import { CandidateResult } from "./CandidateResult";

@Entity("candidate")
export class Candidate {
  @PrimaryGeneratedColumn("uuid")
  candidateId: string;

  @Column({ type: "varchar", length: 255, name: "candidateName" })
  candidateName: string;

  @Column({ type: "date", name: "candidateDate", nullable: true, default: null })
  candidateDate: string | null;

  @Column({ type: "varchar", length: 20, name: "candidateGender", nullable: true, default: null })
  candidateGender: "male" | "female" | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null, name: "candidateUnit" })
  candidateUnit: string | null;

  @Column({ type: "int", default: 0, name: "votesCount" })
  votesCount: number;

  @Column({ type: "text", nullable: true, default: null })
  candidateInfo: string | null;

  @Column({ type: "varchar", length: 255, name: "sessionID" })
  sessionId: string;

  @ManyToOne(() => VoteSession, (session) => session.candidateRecords)
  @JoinColumn({ name: "sessionID" })
  session: VoteSession;

  @OneToMany(() => VoteCandidate, (voteCandidate) => voteCandidate.candidate)
  voteLinks: VoteCandidate[];

  @OneToMany(() => CandidateResult, (result) => result.candidate)
  results: CandidateResult[];
}