import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("votes")
export class Vote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  candidate: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string;

  @Column({ type: "text", nullable: true })
  notes: string;
}