import React, { useState, useRef, useEffect } from "react";
import "./ResultAssistant.css";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  summary: {
    totalVotes: number;
    totalValid: number;
    totalInvalid: number;
    candidates: { name: string; votes: number; isElected: boolean }[];
  };
}

const ResultAssistant: React.FC<Props> = ({ summary }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Xin chào! Tôi là trợ lý kiểm phiếu 🤖. Bạn muốn tôi giải thích điều gì về kết quả bầu cử?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const reply = (question: string) => {
    const q = question.toLowerCase();
    const { totalVotes, totalValid, totalInvalid, candidates } = summary;
    const elected = candidates.filter((c) => c.isElected);
    const winner = elected[0];
    const validRate =
      totalVotes > 0 ? ((totalValid / totalVotes) * 100).toFixed(2) : "0.00";

    let answer = "Xin lỗi, tôi chưa hiểu câu hỏi của bạn.";

    if (q.includes("trúng") || q.includes("thắng")) {
      if (winner)
        answer = `Ứng viên ${winner.name} đã trúng cử với ${winner.votes.toLocaleString()} phiếu.`;
      else answer = "Hiện chưa có ứng viên nào đạt đủ phiếu để trúng cử.";
    } else if (q.includes("phiếu hợp lệ")) {
      answer = `Có ${totalValid.toLocaleString()} phiếu hợp lệ, chiếm ${validRate}% tổng số phiếu.`;
    } else if (q.includes("phiếu không hợp lệ")) {
      answer = `Có ${totalInvalid.toLocaleString()} phiếu không hợp lệ.`;
    } else if (q.includes("tổng") || q.includes("bao nhiêu")) {
      answer = `Tổng cộng có ${totalVotes.toLocaleString()} phiếu được kiểm.`;
    } else if (q.includes("tỉ lệ") || q.includes("phần trăm")) {
      answer = `Tỉ lệ phiếu hợp lệ là ${validRate}%.`;
    } else if (q.includes("ứng viên")) {
      const list = candidates
        .map((c) => `${c.name}: ${c.votes.toLocaleString()} phiếu`)
        .join("; ");
      answer = `Danh sách ứng viên và số phiếu: ${list}.`;
    }

    return answer;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => {
      const botReply = reply(input.trim());
      setMessages((prev) => [...prev, { role: "assistant", text: botReply }]);
    }, 600);
    setInput("");
  };

  return (
    <>
      {/* Nút nổi để mở chat */}
      {!isOpen && (
        <button className="assistant-toggle" onClick={() => setIsOpen(true)}>
          🤖
        </button>
      )}

      {/* Cửa sổ chat */}
      {isOpen && (
        <div className="assistant-container">
          <div className="assistant-header">
            <span>🧠 Trợ lý kiểm phiếu</span>
            <button
              className="assistant-close"
              onClick={() => setIsOpen(false)}
              title="Đóng"
            >
              ×
            </button>
          </div>

          <div className="assistant-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="bubble">{m.text}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="assistant-input">
            <input
              type="text"
              placeholder="Nhập câu hỏi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit">Gửi</button>
          </form>
        </div>
      )}
    </>
  );
};

export default ResultAssistant;
