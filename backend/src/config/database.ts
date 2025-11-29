import { DataSource } from "typeorm";
import { Vote } from "../entities/Vote";
import { VoteSession } from "../entities/VoteSession";
import { User } from "../entities/User";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "votecounting.db",
  synchronize: true,
  logging: false,
  entities: [Vote, VoteSession, User],
});