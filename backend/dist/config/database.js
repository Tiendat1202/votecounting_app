"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const path_1 = __importDefault(require("path"));
const Vote_1 = require("../entities/Vote");
const VoteSession_1 = require("../entities/VoteSession");
const User_1 = require("../entities/User");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "sqlite",
    database: path_1.default.join(__dirname, "../../database.sqlite"),
    synchronize: true,
    logging: false,
    entities: [Vote_1.Vote, VoteSession_1.VoteSession, User_1.User],
});
