import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { VoteSession } from "./VoteSession";
import { CandidateResult } from "./CandidateResult";

@Entity("candidate")
export class Candidate {
  @PrimaryGeneratedColumn("uuid")
  candidateId: string;

  @Column({ type: "varchar", length: 255 })
  candidateName: string;

  @Column({ type: "text", nullable: true })
  candidateInfo: string;

  @ManyToOne(() => VoteSession, (session) => session.candidates)
  session: VoteSession;

  @OneToMany(() => CandidateResult, (result) => result.candidate)
  results: CandidateResult[];
}