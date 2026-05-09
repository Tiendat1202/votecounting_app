import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "active" | "rejected";

@Entity("user")
export class User {
  @PrimaryGeneratedColumn("uuid")
  userId: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  fullName: string | null;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  workUnit: string | null;

  @Column({ type: "varchar", length: 50, default: "user" })
  role: UserRole;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: UserStatus;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  approvedByUserId: string | null;

  @Column({ type: "datetime", nullable: true, default: null })
  approvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
