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
}
