import { Request, Response } from "express";
import { VoteService } from "../services/voteService";
import { VoteRequest, ApiResponse } from "../types";

export class VoteController {
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