import { Router } from "express";
import { VoteController } from "../controllers/voteController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { requireVoteReviewPermission } from "../middleware/sessionAuthorization";

const router = Router();

router.get(
  "/session/:sessionId",
  authenticateJWT,
  requireRole("admin", "inspector", "supervisor"),
  VoteController.getSessionVotes
);
router.get(
  "/stats/:sessionId",
  authenticateJWT,
  requireRole("admin", "inspector", "supervisor"),
  VoteController.getSessionStats
);
router.get(
  "/:voteId",
  authenticateJWT,
  requireRole("admin", "inspector", "supervisor"),
  VoteController.getVoteDetails
);
router.get(
  "/:voteId/raw-data",
  authenticateJWT,
  requireRole("admin", "inspector", "supervisor"),
  VoteController.getVoteRawData
);
router.put(
  "/:voteId/validate",
  authenticateJWT,
  requireRole("admin", "inspector"),
  requireVoteReviewPermission,
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
