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
exports.CandidateResult = void 0;
const typeorm_1 = require("typeorm");
const Candidate_1 = require("./Candidate");
let CandidateResult = class CandidateResult {
};
exports.CandidateResult = CandidateResult;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], CandidateResult.prototype, "resultId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], CandidateResult.prototype, "voteCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], CandidateResult.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Candidate_1.Candidate, (candidate) => candidate.results),
    __metadata("design:type", Candidate_1.Candidate)
], CandidateResult.prototype, "candidate", void 0);
exports.CandidateResult = CandidateResult = __decorate([
    (0, typeorm_1.Entity)("candidate_result")
], CandidateResult);
