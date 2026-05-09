import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Vote } from "./Vote";
import { User } from "./User";
import { VoteSession } from "./VoteSession";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid", { name: "logID" })
  logId: string;

  @Column({ type: "text" })
  oldData: string;

  @Column({ type: "text" })
  newData: string;

  @CreateDateColumn({ type: "datetime", name: "changeAt" })
  changeAt: Date;

  @Column({ type: "varchar", length: 255, name: "voteID" })
  voteId: string;

  @Column({ type: "varchar", length: 255, name: "userID" })
  userId: string;

  @Column({ type: "varchar", length: 255, name: "sessionID" })
  sessionId: string;

  @ManyToOne(() => Vote, { onDelete: "CASCADE" })
  @JoinColumn({ name: "voteID" })
  vote: Vote;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userID" })
  user: User;

  @ManyToOne(() => VoteSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionID" })
  session: VoteSession;
}
