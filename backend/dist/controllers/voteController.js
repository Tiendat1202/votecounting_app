"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteController = void 0;
const voteService_1 = require("../services/voteService");
const database_1 = require("../config/database");
const Vote_1 = require("../entities/Vote");
class VoteController {
    /**
     * GET /api/votes/session/:sessionId
     * Lấy danh sách phiếu của một phiên
     */
    static async getSessionVotes(req, res) {
        try {
            const { sessionId } = req.params;
            const { status, ballotType, candidateName, page = "1", limit = "20" } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            const filters = {
                status: status,
                ballotType: ballotType,
                candidateName: candidateName,
            };
            const { votes, total } = await voteService_1.VoteService.getSessionVotes(sessionId, filters, parseInt(limit), offset);
            res.json({
                votes,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            });
        }
        catch (error) {
            console.error("Lỗi tải phiếu:", error);
            res.status(500).json({ error: "Failed to fetch votes" });
        }
    }
    /**
     * GET /api/votes/stats/:sessionId
     * Lấy thống kê của một phiên
     */
    static async getSessionStats(req, res) {
        try {
            const { sessionId } = req.params;
            const stats = await voteService_1.VoteService.getSessionStats(sessionId);
            res.json(stats);
        }
        catch (error) {
            console.error("Lỗi tải thống kê:", error);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    }
    /**
     * GET /api/votes/:voteId
     * Lấy chi tiết một phiếu
     */
    static async getVoteDetails(req, res) {
        try {
            const { voteId } = req.params;
            const vote = await database_1.AppDataSource.getRepository(Vote_1.Vote).findOneBy({
                id: voteId,
            });
            if (!vote) {
                return res.status(404).json({ error: "Vote not found" });
            }
            res.json(vote);
        }
        catch (error) {
            console.error("Lỗi tải chi tiết phiếu:", error);
            res.status(500).json({ error: "Failed to fetch vote details" });
        }
    }
    /**
     * GET /api/votes/:voteId/raw-data
     * Lấy dữ liệu thô (JSON) từ AI
     */
    static async getVoteRawData(req, res) {
        try {
            const { voteId } = req.params;
            const vote = await database_1.AppDataSource.getRepository(Vote_1.Vote).findOneBy({
                id: voteId,
            });
            if (!vote) {
                return res.status(404).json({ error: "Vote not found" });
            }
            let rawData = {};
            if (vote.rawData) {
                try {
                    rawData = JSON.parse(vote.rawData);
                }
                catch {
                    rawData = { raw: vote.rawData };
                }
            }
            res.json(rawData);
        }
        catch (error) {
            console.error("Lỗi tải dữ liệu thô:", error);
            res.status(500).json({ error: "Failed to fetch vote raw data" });
        }
    }
    /**
     * PUT /api/votes/:voteId/validate
     * Xác nhận phiếu (đánh dấu là hợp lệ/không hợp lệ)
     */
    static async validateVote(req, res) {
        try {
            const { voteId } = req.params;
            const { isValid, notes } = req.body;
            const updatedVote = await voteService_1.VoteService.validateVote(voteId, isValid, notes);
            if (!updatedVote) {
                return res.status(404).json({ error: "Vote not found" });
            }
            res.json({
                success: true,
                vote: updatedVote,
            });
        }
        catch (error) {
            console.error("Lỗi xác nhận phiếu:", error);
            res.status(500).json({ error: "Failed to validate vote" });
        }
    }
    /**
     * Các phương thức cũ để tương thích
     */
    static async submitVote(req, res) {
        try {
            const { candidate, notes } = req.body;
            if (!candidate || candidate.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Candidate name is required",
                    error: "Invalid input",
                });
            }
            const vote = await voteService_1.VoteService.submitVote({ candidate, notes });
            res.status(201).json({
                success: true,
                message: `Vote received for ${candidate}`,
                data: vote,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error submitting vote",
                error: String(error),
            });
        }
    }
    static async getAllVotes(req, res) {
        try {
            const votes = await voteService_1.VoteService.getAllVotes();
            res.json({
                success: true,
                message: "Votes retrieved successfully",
                data: votes,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error retrieving votes",
                error: String(error),
            });
        }
    }
    static async getResults(req, res) {
        try {
            const results = await voteService_1.VoteService.getVoteResults();
            res.json({
                success: true,
                message: "Results retrieved successfully",
                data: results,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error retrieving results",
                error: String(error),
            });
        }
    }
    static async getStats(req, res) {
        try {
            const stats = await voteService_1.VoteService.getVoteStats();
            res.json({
                success: true,
                message: "Stats retrieved successfully",
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error retrieving stats",
                error: String(error),
            });
        }
    }
    static async deleteVote(req, res) {
        try {
            const { id } = req.params;
            const deleted = await voteService_1.VoteService.deleteVote(id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: "Vote not found",
                    error: "Not found",
                });
            }
            res.json({
                success: true,
                message: "Vote deleted successfully",
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error deleting vote",
                error: String(error),
            });
        }
    }
    static async clearAllVotes(req, res) {
        try {
            const deletedCount = await voteService_1.VoteService.clearAllVotes();
            res.json({
                success: true,
                message: `${deletedCount} votes deleted successfully`,
                data: { deletedCount },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Error clearing votes",
                error: String(error),
            });
        }
    }
}
exports.VoteController = VoteController;
