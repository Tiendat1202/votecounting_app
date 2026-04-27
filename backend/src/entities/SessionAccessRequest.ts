import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type SessionAccessAction = "upload" | "review";
export type SessionAccessStatus = "pending" | "approved" | "rejected";

@Entity("session_access_requests")
export class SessionAccessRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  sessionId: string;

  @Column({ type: "varchar", length: 255 })
  ownerUserId: string;

  @Column({ type: "varchar", length: 255 })
  requesterUserId: string;

  @Column({ type: "varchar", length: 255 })
  requesterEmail: string;

  @Column({ type: "varchar", length: 120, nullable: true, default: null })
  requesterFullName: string | null;

  @Column("simple-array")
  actions: SessionAccessAction[];

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: SessionAccessStatus;

  @Column({ type: "text", nullable: true, default: null })
  note: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  reviewedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
