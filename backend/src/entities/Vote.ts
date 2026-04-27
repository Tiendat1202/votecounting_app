import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { VoteSession } from "./VoteSession";

@Entity("votes")
export class Vote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Quan hệ với session
  @Column({ type: "varchar" })
  sessionId: string;

  @ManyToOne(() => VoteSession, { eager: true })
  @JoinColumn({ name: "sessionId" })
  session: VoteSession;

  // Thông tin phiếu từ upload
  @Column({ type: "varchar", length: 255, nullable: true })
  voteId: string;

  @Column({ type: "varchar", length: 50 })
  voteType: "trust" | "surplus"; // loại phiếu

  // Kết quả AI
  @Column({ type: "text", nullable: true })
  rawData: string; // JSON thô từ AI

  @Column({ type: "varchar", length: 255, nullable: true })
  selectedCandidate: string; // Ứng cử viên được chọn

  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  confidenceScore: number; // Độ tin cậy (0-1)

  // Xử lý/kiểm tra
  @Column({ type: "varchar", length: 50 })
  status: "pending" | "valid" | "invalid" | "duplicate" | "failed"; // Trạng thái

  @Column({ type: "text", nullable: true })
  validationNotes: string; // Ghi chú từ kiểm tra

  @Column({ type: "varchar", length: 255, nullable: true })
  imageUrl: string; // URL ảnh gốc

  // Thời gian
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Compat với code cũ - allow null to avoid storing 'unknown' by default
  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  candidate: string | null;

  @Column({ type: "text", nullable: true })
  notes: string;
}