import { DataSource } from "typeorm";
import path from "path";
import { Vote } from "../entities/Vote";
import { VoteSession } from "../entities/VoteSession";
import { User } from "../entities/User";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: path.join(__dirname, "../../database.sqlite"),
  synchronize: true,
  logging: false,
  entities: [Vote, VoteSession, User],
});