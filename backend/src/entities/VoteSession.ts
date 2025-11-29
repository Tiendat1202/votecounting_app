import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("sessions")
export class VoteSession {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column("simple-array")
  candidates: string[];

  @Column()
  startAt: string;

  @Column()
  endAt: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}