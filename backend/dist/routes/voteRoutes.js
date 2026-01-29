"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const voteController_1 = require("../controllers/voteController");
const router = (0, express_1.Router)();
// Vote routes
router.post("/vote", voteController_1.VoteController.submitVote);
router.get("/votes", voteController_1.VoteController.getAllVotes);
router.get("/results", voteController_1.VoteController.getResults);
router.get("/stats", voteController_1.VoteController.getStats);
router.delete("/vote/:id", voteController_1.VoteController.deleteVote);
router.delete("/votes/clear", voteController_1.VoteController.clearAllVotes);
exports.default = router;
