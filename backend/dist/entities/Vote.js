"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vote = void 0;
const typeorm_1 = require("typeorm");
const VoteSession_1 = require("./VoteSession");
let Vote = class Vote {
};
exports.Vote = Vote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Vote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar" }),
    __metadata("design:type", String)
], Vote.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => VoteSession_1.VoteSession, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: "sessionId" }),
    __metadata("design:type", VoteSession_1.VoteSession)
], Vote.prototype, "session", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "voteId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], Vote.prototype, "voteType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "rawData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "selectedCandidate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 3, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Vote.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, default: "pending" }),
    __metadata("design:type", String)
], Vote.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "validationNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Vote.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Vote.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, default: "unknown" }),
    __metadata("design:type", String)
], Vote.prototype, "candidate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Vote.prototype, "notes", void 0);
exports.Vote = Vote = __decorate([
    (0, typeorm_1.Entity)("votes")
], Vote);
