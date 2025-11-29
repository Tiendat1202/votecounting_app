import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { VoteSession } from "./VoteSession";

@Entity("user")
export class User {
  @PrimaryGeneratedColumn("uuid")
  userId: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({ type: "varchar", length: 50, default: "user" })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

 
}