import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ví dụ route test
app.get("/", (req: Request, res: Response) => {
  res.send("Vote Counting API is running 🚀");
});

// Route để đếm phiếu
app.post("/vote", (req: Request, res: Response) => {
  const { candidate } = req.body;
  // TODO: xử lý logic lưu phiếu bầu
  res.json({ message: `Vote received for ${candidate}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
