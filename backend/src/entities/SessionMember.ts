import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type SessionRole = "owner" | "inspector" | "supervisor";

@Entity("session_members")
export class SessionMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  sessionId: string;

  @Column({ type: "varchar", length: 255 })
  userId: string;

  @Column({ type: "varchar", length: 255 })
  userEmail: string;

  @Column({ type: "varchar", length: 120, nullable: true, default: null })
  userFullName: string | null;

  @Column({ type: "varchar", length: 30 })
  role: SessionRole;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  addedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get assignmentId() {
    return this.id;
  }

  set assignmentId(value: string) {
    this.id = value;
  }
}
