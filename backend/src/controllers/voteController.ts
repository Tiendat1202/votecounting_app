import { Request, Response } from "express";
import { VoteService } from "../services/voteService";
import { VoteRequest, ApiResponse } from "../types";
import { AppDataSource } from "../config/database";
import { Vote } from "../entities/Vote";

export class VoteController {
  /**
   * GET /api/votes/session/:sessionId
   * Lấy danh sách phiếu của một phiên
   */
  static async getSessionVotes(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { status, ballotType, candidateName, page = "1", limit = "20" } =
        req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const filters = {
        status: status as string | undefined,
        ballotType: ballotType as string | undefined,
        candidateName: candidateName as string | undefined,
      };

      const { votes, total } = await VoteService.getSessionVotes(
        sessionId,
        filters,
        parseInt(limit as string),
        offset
      );

      res.json({
        votes,
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      console.error("Lỗi tải phiếu:", error);
      res.status(500).json({ error: "Failed to fetch votes" });
    }
  }

  /**
   * GET /api/votes/stats/:sessionId
   * Lấy thống kê của một phiên
   */
  static async getSessionStats(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const stats = await VoteService.getSessionStats(sessionId);

      res.json(stats);
    } catch (error) {
      console.error("Lỗi tải thống kê:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  }

  /**
   * GET /api/votes/:voteId
   * Lấy chi tiết một phiếu
   */
  static async getVoteDetails(req: Request, res: Response) {
    try {
      const { voteId } = req.params;
      const vote = await AppDataSource.getRepository(Vote).findOneBy({
        id: voteId,
      });

      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      res.json(vote);
    } catch (error) {
      console.error("Lỗi tải chi tiết phiếu:", error);
      res.status(500).json({ error: "Failed to fetch vote details" });
    }
  }

  /**
   * GET /api/votes/:voteId/raw-data
   * Lấy dữ liệu thô (JSON) từ AI
   */
  static async getVoteRawData(req: Request, res: Response) {
    try {
      const { voteId } = req.params;
      const vote = await AppDataSource.getRepository(Vote).findOneBy({
        id: voteId,
      });

      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      let rawData = {};
      if (vote.rawData) {
        try {
          rawData = JSON.parse(vote.rawData);
        } catch {
          rawData = { raw: vote.rawData };
        }
      }

      res.json(rawData);
    } catch (error) {
      console.error("Lỗi tải dữ liệu thô:", error);
      res.status(500).json({ error: "Failed to fetch vote raw data" });
    }
  }

  /**
   * PUT /api/votes/:voteId/validate
   * Xác nhận phiếu (đánh dấu là hợp lệ/không hợp lệ)
   */
  static async validateVote(req: Request, res: Response) {
    try {
      const { voteId } = req.params;
      const { isValid, notes, selectedCandidates, overrideReason } = req.body;

      const updatedVote = await VoteService.validateVote(
        voteId,
        isValid,
        notes,
        selectedCandidates,
        overrideReason
      );

      if (!updatedVote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      res.json({
        success: true,
        vote: updatedVote,
      });
    } catch (error) {
      console.error("Lỗi xác nhận phiếu:", error);
      res.status(500).json({ error: "Failed to validate vote" });
    }
  }

  /**
   * Các phương thức cũ để tương thích
   */
  static async submitVote(req: Request, res: Response) {
    try {
      const { candidate, notes } = req.body as VoteRequest;

      if (!candidate || candidate.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Candidate name is required",
          error: "Invalid input",
        } as ApiResponse<null>);
      }

      const vote = await VoteService.submitVote({ candidate, notes });

      res.status(201).json({
        success: true,
        message: `Vote received for ${candidate}`,
        data: vote,
      } as ApiResponse<typeof vote>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error submitting vote",
        error: String(error),
      } as ApiResponse<null>);
    }
  }

  static async getAllVotes(req: Request, res: Response) {
    try {
      const votes = await VoteService.getAllVotes();

      res.json({
        success: true,
        message: "Votes retrieved successfully",
        data: votes,
      } as ApiResponse<typeof votes>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error retrieving votes",
        error: String(error),
      } as ApiResponse<null>);
    }
  }

  static async getResults(req: Request, res: Response) {
    try {
      const results = await VoteService.getVoteResults();

      res.json({
        success: true,
        message: "Results retrieved successfully",
        data: results,
      } as ApiResponse<typeof results>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error retrieving results",
        error: String(error),
      } as ApiResponse<null>);
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const stats = await VoteService.getVoteStats();

      res.json({
        success: true,
        message: "Stats retrieved successfully",
        data: stats,
      } as ApiResponse<typeof stats>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error retrieving stats",
        error: String(error),
      } as ApiResponse<null>);
    }
  }

  static async deleteVote(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const deleted = await VoteService.deleteVote(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Vote not found",
          error: "Not found",
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        message: "Vote deleted successfully",
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting vote",
        error: String(error),
      } as ApiResponse<null>);
    }
  }

  static async clearAllVotes(req: Request, res: Response) {
    try {
      const deletedCount = await VoteService.clearAllVotes();

      res.json({
        success: true,
        message: `${deletedCount} votes deleted successfully`,
        data: { deletedCount },
      } as ApiResponse<{ deletedCount: number }>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error clearing votes",
        error: String(error),
      } as ApiResponse<null>);
    }
  }
}