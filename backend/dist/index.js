"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ví dụ route test
app.get("/", (req, res) => {
    res.send("Vote Counting API is running 🚀");
});
// Route để đếm phiếu
app.post("/vote", (req, res) => {
    const { candidate } = req.body;
    // TODO: xử lý logic lưu phiếu bầu
    res.json({ message: `Vote received for ${candidate}` });
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
