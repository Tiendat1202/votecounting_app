import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { Candidate } from "./Candidate";

@Entity("candidate_result")
export class CandidateResult {
  @PrimaryGeneratedColumn("uuid")
  resultId: string;

  @Column({ type: "int", default: 0 })
  voteCount: number;

  @Column({ type: "int", default: 0 })
  rank: number;

  @ManyToOne(() => Candidate, (candidate) => candidate.results)
  candidate: Candidate;
}