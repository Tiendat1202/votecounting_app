import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import "./Results.css";
import ResultAssistant from "../components/ResultAssistant";

interface Vote {
  id: string;
  sessionId: string;
  voteId: string;
  voteType: string;
  candidate: string;
  confidenceScore: number;
  rawData: string;
  status?: string;
  session?: {
    id: string;
    name: string;
    type: string;
    candidates: string[];
  };
}

interface Candidate {
  name: string;
  validVotes: number;
  invalidVotes: number;
  votesReceived: number;
  isElected: boolean;
}

const nf = new Intl.NumberFormat("vi-VN");

function truncateName(name: string, max = 14) {
  if (!name) return "";
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

interface Session {
  id: string;
  name: string;
  type: string;
  startAt: string;
  endAt: string;
}

const Results: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalValid, setTotalValid] = useState<number>(0);
  const [totalInvalid, setTotalInvalid] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchAndProcessVotes(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/sessions");
      if (!response.ok) {
        throw new Error("Không thể lấy danh sách phiên bầu cử");
      }
      const data = await response.json();
      setSessions(data);
      
      // Tự động chọn phiên đầu tiên
      if (data.length > 0) {
        setSelectedSessionId(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
      console.error("Error fetching sessions:", err);
      setLoading(false);
    }
  };

  const fetchAndProcessVotes = async (sessionId: string) => {
    try {
      setLoading(true);
      setError("");
      
      const response = await fetch(`/api/results/${sessionId}`);
      if (!response.ok) {
        throw new Error("Không thể lấy dữ liệu votes từ server");
      }

      const data = await response.json();
      const votes: Vote[] = data.data || [];

      if (votes.length === 0) {
        setLoading(false);
        setCandidates([]);
        setTotalValid(0);
        setTotalInvalid(0);
        return;
      }

      const processed = processVotesFromDB(votes);
      setCandidates(processed.candidates);
      setTotalValid(processed.totalValid);
      setTotalInvalid(processed.totalInvalid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
      console.error("Error fetching votes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Parse dữ liệu từ API: tìm các ứng viên duy nhất và đếm phiếu
  const processVotesFromDB = (votes: Vote[]) => {
    const candidateMap = new Map<string, number>();
    let totalValidVotes = 0;
    let totalInvalidVotes = 0;
    let allCandidates: string[] = [];

    // Lấy danh sách tất cả ứng viên từ session (nếu có)
    if (votes.length > 0 && votes[0].session?.candidates) {
      allCandidates = votes[0].session.candidates;
    }

    votes.forEach((vote) => {
      // Đếm phiếu hợp lệ
      if (vote.status !== "invalid") {
        totalValidVotes++;
        
        // Parse candidate names từ cột candidate (có thể là danh sách)
        if (vote.candidate) {
          const names = vote.candidate.split(",").map((n) => n.trim());
          names.forEach((name) => {
            if (name) {
              candidateMap.set(name, (candidateMap.get(name) || 0) + 1);
            }
          });
        }
      } else {
        totalInvalidVotes++;
      }
    });

    // Nếu có danh sách ứng viên từ session, dùng nó làm cơ sở
    const candidateNames = allCandidates.length > 0 
      ? allCandidates 
      : Array.from(candidateMap.keys());

    const parsed: Candidate[] = candidateNames.map((name) => ({
      name,
      validVotes: totalValidVotes,
      invalidVotes: totalInvalidVotes,
      votesReceived: candidateMap.get(name) || 0,
      isElected: totalValidVotes > 0 && (candidateMap.get(name) || 0) / totalValidVotes > 0.5,
    }));

    const sorted = parsed.sort((a, b) => b.votesReceived - a.votesReceived);

    return {
      candidates: sorted,
      totalValid: totalValidVotes,
      totalInvalid: totalInvalidVotes,
    };
  };

  const totalVotes = totalValid + totalInvalid;

  if (loading) {
    return (
      <div className="results-container">
        <h1 className="results-title">Kết quả bầu cử</h1>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-container">
        <h1 className="results-title">Kết quả bầu cử</h1>
        <div style={{ textAlign: "center", padding: "40px", color: "red" }}>
          <p>Lỗi: {error}</p>
          <button onClick={fetchSessions} style={{ marginTop: "10px", padding: "8px 16px" }}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <h1 className="results-title">Kết quả bầu cử</h1>

      <section className="results-actions" aria-label="Chọn phiên bầu cử">
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="sessionSelect" style={{ marginRight: "10px", fontWeight: "500" }}>
            Chọn phiên bầu cử:
          </label>
          <select
            id="sessionSelect"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{ padding: "8px 12px", fontSize: "14px", minWidth: "200px" }}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} - {session.type === "tin-nhiem" ? "Tín nhiệm" : "Số dư"}
              </option>
            ))}
          </select>
          <button 
            onClick={() => fetchAndProcessVotes(selectedSessionId)} 
            style={{ padding: "8px 16px", cursor: "pointer", marginLeft: "10px" }}
          >
            Làm mới dữ liệu
          </button>
        </div>
      </section>

      {/* 3 card thống kê */}
      <section className="stats-cards" aria-label="Thống kê tổng quan">
        <div className="stat-card">
          <h3>Tổng số phiếu</h3>
          <p>{nf.format(totalVotes)}</p>
        </div>
        <div className="stat-card">
          <h3>Phiếu hợp lệ</h3>
          <p>{nf.format(totalValid)}</p>
        </div>
        <div className="stat-card">
          <h3>Phiếu không hợp lệ</h3>
          <p>{nf.format(totalInvalid)}</p>
        </div>
      </section>

            {/* 2 card tỉ lệ hợp lệ/không hợp lệ */}
      <section className="ratio-cards" aria-label="Tỉ lệ hợp lệ">
        <div className="ratio-card valid">
          <h3>Tỉ lệ phiếu hợp lệ</h3>
          <p>
            {totalVotes > 0
              ? ((totalValid / totalVotes) * 100).toFixed(2) + "%"
              : "0.00%"}
          </p>
        </div>
        <div className="ratio-card invalid">
          <h3>Tỉ lệ phiếu không hợp lệ</h3>
          <p>
            {totalVotes > 0
              ? ((totalInvalid / totalVotes) * 100).toFixed(2) + "%"
              : "0.00%"}
          </p>
        </div>
      </section>

      {/* Bảng + Biểu đồ */}
      {candidates.length > 0 && (
        <>
          <section aria-label="Bảng kết quả">
            <div className="table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Họ và tên</th>
                    <th>Số phiếu bầu</th>
                    <th>Tỉ lệ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, idx) => {
                    const rate =
                      totalValid > 0
                        ? ((c.votesReceived / totalValid) * 100).toFixed(2)
                        : "0.00";
                    return (
                      <tr key={idx} className={c.isElected ? "" : "not-winner"}>
                        <td>{idx + 1}</td>
                        <td>{c.name}</td>
                        <td>{nf.format(c.votesReceived)}</td>
                        <td>{rate}%</td>
                        <td>{c.isElected ? "Trúng cử" : "Không trúng cử"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Legend thủ công */}
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch--elected" />
              Trúng cử
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch--not" />
              Không trúng cử
            </span>
          </div>

          {/* Biểu đồ */}
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              data={candidates}
              margin={{ top: 12, right: 16, bottom: 70, left: 8 }}
              barCategoryGap={18}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={64}
                tickFormatter={(v) => truncateName(String(v), 14)}
                tick={{ fontSize: 12, fill: "#334155" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#334155" }}
                tickFormatter={(v) => nf.format(v as number)}
              />
              <Tooltip
                formatter={(value) => nf.format(value as number)}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="votesReceived" barSize={28} radius={[6, 6, 0, 0]}>
                {candidates.map((c, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={c.isElected ? "#0F62FE" : "#94A3B8"}
                  />
                ))}
                <LabelList
                  dataKey="votesReceived"
                  position="top"
                  formatter={(label: React.ReactNode) => {
                    const v =
                      typeof label === "number" ? label : Number(label ?? 0);
                    return v > 0 ? nf.format(v) : "";
                  }}
                  style={{ fontSize: 11, fill: "#0F172A", fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
      {/* Trợ lý giải thích kết quả */}
      <ResultAssistant
        summary={{
          totalVotes,
          totalValid,
          totalInvalid,
          candidates: candidates.map((c) => ({
            name: c.name,
            votes: c.votesReceived,
            isElected: c.isElected,
          })),
        }}
      />

    </div>
  );
};

export default Results;
