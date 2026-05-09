import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { Vote } from "./Vote";
import { Candidate } from "./Candidate";

@Entity("vote_candidate")
export class VoteCandidate {
  @PrimaryColumn({ type: "varchar", length: 255, name: "voteID" })
  voteId: string;

  @PrimaryColumn({ type: "varchar", length: 255, name: "candidateID" })
  candidateId: string;

  @ManyToOne(() => Vote, (vote) => vote.candidateLinks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "voteID" })
  vote: Vote;

  @ManyToOne(() => Candidate, (candidate) => candidate.voteLinks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "candidateID" })
  candidate: Candidate;
}
