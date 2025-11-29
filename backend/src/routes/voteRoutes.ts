import { Router } from "express";
import { VoteController } from "../controllers/voteController";

const router = Router();

// Vote routes
router.post("/vote", VoteController.submitVote);
router.get("/votes", VoteController.getAllVotes);
router.get("/results", VoteController.getResults);
router.get("/stats", VoteController.getStats);
router.delete("/vote/:id", VoteController.deleteVote);
router.delete("/votes/clear", VoteController.clearAllVotes);

export default router;