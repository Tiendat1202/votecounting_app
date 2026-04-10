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

  @Column({ type: "int", default: 0 })
  seats: number; // số lượng cần bầu

  @Column({ type: "float", default: 50 })
  minWinPercent: number; // % tối thiểu để trúng cử (ứng viên phải > giá trị này)

  @Column()
  startAt: string;

  @Column()
  endAt: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}