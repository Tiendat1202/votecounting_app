import { Router } from "express";
import { VoteController } from "../controllers/voteController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Các route có auth (yêu cầu JWT)
router.get(
  "/session/:sessionId",
  authenticateJWT,
  VoteController.getSessionVotes
);
router.get(
  "/stats/:sessionId",
  authenticateJWT,
  VoteController.getSessionStats
);
router.get(
  "/:voteId",
  authenticateJWT,
  VoteController.getVoteDetails
);
router.get(
  "/:voteId/raw-data",
  authenticateJWT,
  VoteController.getVoteRawData
);
router.put(
  "/:voteId/validate",
  authenticateJWT,
  VoteController.validateVote
);

// Các route cũ (không có auth - tương thích)
router.post("/vote", VoteController.submitVote);
router.get("/votes", VoteController.getAllVotes);
router.get("/results", VoteController.getResults);
router.get("/stats", VoteController.getStats);
router.delete("/vote/:id", VoteController.deleteVote);
router.delete("/votes/clear", VoteController.clearAllVotes);

export default router;
