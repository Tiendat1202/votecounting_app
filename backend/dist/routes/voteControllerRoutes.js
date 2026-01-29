"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const voteController_1 = require("../controllers/voteController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Các route có auth (yêu cầu JWT)
router.get("/session/:sessionId", auth_1.authenticateJWT, voteController_1.VoteController.getSessionVotes);
router.get("/stats/:sessionId", auth_1.authenticateJWT, voteController_1.VoteController.getSessionStats);
router.get("/:voteId", auth_1.authenticateJWT, voteController_1.VoteController.getVoteDetails);
router.get("/:voteId/raw-data", auth_1.authenticateJWT, voteController_1.VoteController.getVoteRawData);
router.put("/:voteId/validate", auth_1.authenticateJWT, voteController_1.VoteController.validateVote);
// Các route cũ (không có auth - tương thích)
router.post("/vote", voteController_1.VoteController.submitVote);
router.get("/votes", voteController_1.VoteController.getAllVotes);
router.get("/results", voteController_1.VoteController.getResults);
router.get("/stats", voteController_1.VoteController.getStats);
router.delete("/vote/:id", voteController_1.VoteController.deleteVote);
router.delete("/votes/clear", voteController_1.VoteController.clearAllVotes);
exports.default = router;
