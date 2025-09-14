import { useState } from "react";
import axios from "axios";

function App() {
  const [candidate, setCandidate] = useState("");
  const [message, setMessage] = useState("");

  const submitVote = async () => {
    try {
      const res = await axios.post("http://localhost:5000/vote", { candidate });
      setMessage(res.data.message);
    } catch (err) {
      setMessage("Error submitting vote");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Vote Counting App 🗳️</h1>
      <input
        type="text"
        placeholder="Enter candidate name"
        value={candidate}
        onChange={(e) => setCandidate(e.target.value)}
      />
      <button onClick={submitVote}>Vote</button>
      <p>{message}</p>
    </div>
  );
}

export default App;
