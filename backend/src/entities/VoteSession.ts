import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { User } from "./User";
import { Candidate } from "./Candidate";

@Entity("sessions")
export class VoteSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: "varchar", length: 100, nullable: true, default: null })
  voteRule: string | null;

  /** Các cột/cách đánh giá của phiếu tín nhiệm, lưu JSON string array. */
  @Column({ type: "text", nullable: true, default: null })
  evaluationOptions: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  electionUnit: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  location: string | null;

  @Column("simple-array")
  candidates: string[];

  @Column()
  startAt: string;

  @Column()
  endAt: string;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  createdByUserId: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  createdByEmail: string | null;

  @Column({ type: "varchar", length: 120, nullable: true, default: null })
  createdByName: string | null;

  /** Số ghế cần bầu (tùy chọn). Null = không giới hạn theo ghế. */
  @Column({ type: "int", nullable: true, default: null })
  seatsToElect: number | null;

  /** Ngưỡng % tối thiểu để trúng cử (0-100). Mặc định 50. */
  @Column({ type: "float", nullable: true, default: 50 })
  minWinningPercent: number | null;

  @Column({ type: "datetime", nullable: true, default: null })
  closedEarlyAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  closedEarlyByUserId: string | null;

  @Column({ type: "int", nullable: false, default: 0 })
  totalVotes: number;

  @Column({ type: "int", nullable: false, default: 0 })
  validVotes: number;

  @Column({ type: "int", nullable: false, default: 0 })
  invalidVotes: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "createdBy" })
  createdByUser?: User | null;

  @OneToMany(() => Candidate, (candidate) => candidate.session)
  candidateRecords: Candidate[];
}
