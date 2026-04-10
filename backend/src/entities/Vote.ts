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
  @Column({ type: "varchar", length: 50, default: "pending" })
  status: "pending" | "valid" | "invalid" | "duplicate"; // Trạng thái

  @Column({ type: "text", nullable: true })
  validationNotes: string; // Ghi chú từ kiểm tra

  @Column({ type: "varchar", length: 120, nullable: true })
  manualOverrideReason: string; // Lý do override thủ công

  @Column({ type: "varchar", length: 255, nullable: true })
  manualOverrideBy: string; // Email/UserId người duyệt tay

  @Column({ type: "datetime", nullable: true })
  manualOverrideAt: Date; // Thời gian duyệt tay gần nhất

  @Column({ type: "varchar", length: 255, nullable: true })
  imageUrl: string; // URL ảnh gốc

  // VALIDATION FIELDS (NEW)
  @Column({ type: "varchar", length: 50, nullable: true, default: "UNKNOWN" })
  validity: "VALID" | "INVALID" | "UNKNOWN" | "ERROR"; // Kết quả validation

  @Column({ type: "text", nullable: true })
  invalidReasons: string; // JSON array of reasons ["NO_SELECTION", "OVER_SEATS", etc]

  @Column({ type: "int", nullable: true, default: 0 })
  agreeCount: number; // Số lượng đồng ý

  @Column({ type: "int", nullable: true, default: 0 })
  doubleMarkCount: number; // Số lượng dấu kép (cho phiếu không có số dư)

  // Thời gian
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Compat với code cũ
  @Column({ type: "varchar", length: 255, default: "unknown" })
  candidate: string;

  @Column({ type: "text", nullable: true })
  notes: string;
}