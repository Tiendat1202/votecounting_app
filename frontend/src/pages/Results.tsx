import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  selectedCandidate?: string;
  imageUrl?: string;
  confidenceScore: number;
  rawData: string;
  status?: string;
  validity?: "VALID" | "INVALID" | "UNKNOWN" | "ERROR";
  invalidReasons?: string;
  validationNotes?: string;
  manualOverrideReason?: string;
  manualOverrideBy?: string;
  manualOverrideAt?: string;
  agreeCount?: number;
  session?: {
    id: string;
    name: string;
    type: string;
    candidates: string[];
    seats?: number;
    minWinPercent?: number;
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

function parseInvalidReasons(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [raw];
  }
}

function getBallotImageUrl(vote: Vote): string | null {
  if (!vote.imageUrl) return null;
  if (vote.imageUrl.startsWith("http://") || vote.imageUrl.startsWith("https://")) {
    return vote.imageUrl;
  }
  if (!vote.sessionId) return null;
  return `http://localhost:5050/uploads/${vote.sessionId}/${vote.imageUrl}`;
}

function shortVoteId(voteId: string): string {
  if (!voteId) return "—";
  if (voteId.length <= 14) return voteId;
  return `${voteId.slice(0, 6)}...${voteId.slice(-6)}`;
}

interface Session {
  id: string;
  name: string;
  type: string;
  seats?: number;
  minWinPercent?: number;
  createdAt?: string;
  startAt: string;
  endAt: string;
}

const Results: React.FC = () => {
  const { id: routeSessionId } = useParams<{ id: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessionVotes, setSessionVotes] = useState<Vote[]>([]);
  const [totalValid, setTotalValid] = useState<number>(0);
  const [totalInvalid, setTotalInvalid] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [updatingVoteId, setUpdatingVoteId] = useState<string | null>(null);
  const [reviewVote, setReviewVote] = useState<Vote | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number>(-1);
  const [overrideReason, setOverrideReason] = useState<string>("MANUAL_CONFIRM");
  const [overrideNotes, setOverrideNotes] = useState<string>("");
  const [reviewAction, setReviewAction] = useState<"convert-valid" | "convert-invalid" | "edit-valid-result" | null>(null);
  const [overrideCandidates, setOverrideCandidates] = useState<string[]>([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchAndProcessVotes(selectedSessionId);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    if (routeSessionId && sessions.some((s) => s.id === routeSessionId) && routeSessionId !== selectedSessionId) {
      setSelectedSessionId(routeSessionId);
    }
  }, [routeSessionId, sessions, selectedSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/sessions");
      if (!response.ok) {
        throw new Error("Không thể lấy danh sách phiên bầu cử");
      }
      const data = await response.json();
      const normalized = (Array.isArray(data) ? data : []).sort((a: Session, b: Session) => {
        const ta = new Date(a.createdAt || a.startAt || 0).getTime();
        const tb = new Date(b.createdAt || b.startAt || 0).getTime();
        return tb - ta;
      });
      setSessions(normalized);

      // Ưu tiên session từ route /admin/results/:id
      if (normalized.length > 0) {
        if (routeSessionId && normalized.some((s: Session) => s.id === routeSessionId)) {
          setSelectedSessionId(routeSessionId);
        } else {
          setSelectedSessionId(normalized[0].id);
        }
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
      setSessionVotes(votes);

      if (votes.length === 0) {
        setLoading(false);
        setSessionVotes([]);
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

  const openReviewModal = (vote: Vote) => {
    const idx = sessionVotes.findIndex((x) => x.id === vote.id);
    setReviewIndex(idx);
    setReviewVote(vote);
    setOverrideReason(vote.manualOverrideReason || "MANUAL_CONFIRM");
    setOverrideNotes(vote.validationNotes || "");
    setReviewAction(null);
    const selected = (vote.selectedCandidate || vote.candidate || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    setOverrideCandidates(selected);
  };

  const gotoReviewByIndex = (idx: number) => {
    if (idx < 0 || idx >= sessionVotes.length) return;
    const vote = sessionVotes[idx];
    setReviewIndex(idx);
    setReviewVote(vote);
    setOverrideReason(vote.manualOverrideReason || "MANUAL_CONFIRM");
    setOverrideNotes(vote.validationNotes || "");
    setReviewAction(null);
    const selected = (vote.selectedCandidate || vote.candidate || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    setOverrideCandidates(selected);
  };

  const handleManualValidate = async (
    vote: Vote,
    isValid: boolean,
    options?: { notes?: string; reason?: string; selectedCandidates?: string[] }
  ) => {
    try {
      setUpdatingVoteId(vote.id);
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token: vui lòng đăng nhập lại để duyệt tay");
      }
      const res = await fetch(`/api/votes/${vote.id}/validate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          isValid,
          notes: options?.notes || (isValid ? "Xác nhận hợp lệ thủ công" : "Xác nhận không hợp lệ thủ công"),
          overrideReason: options?.reason || (isValid ? "MANUAL_CONFIRM" : "MANUAL_OVERRIDE_INVALID"),
          selectedCandidates: options?.selectedCandidates || [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || `Không thể cập nhật phiếu (HTTP ${res.status})`);
      }

      if (selectedSessionId) {
        await fetchAndProcessVotes(selectedSessionId);
      }
    } catch (e: any) {
      alert(e?.message || "Lỗi khi cập nhật phiếu");
    } finally {
      setUpdatingVoteId(null);
    }
  };

  // Parse dữ liệu từ API: tìm các ứng viên duy nhất và đếm phiếu
  const processVotesFromDB = (votes: Vote[]) => {
    const candidateMap = new Map<string, number>();
    let totalValidVotes = 0;
    let totalInvalidVotes = 0;
    let allCandidates: string[] = [];
    let seats = 0;
    let minWinPercent = 50;

    // Lấy danh sách tất cả ứng viên từ session (nếu có)
    if (votes.length > 0 && votes[0].session?.candidates) {
      allCandidates = votes[0].session.candidates;
      const sessionSeats = Number(votes[0].session?.seats ?? 0);
      const sessionMinPercent = Number(votes[0].session?.minWinPercent ?? 50);
      seats = Number.isFinite(sessionSeats) && sessionSeats > 0 ? Math.floor(sessionSeats) : allCandidates.length;
      minWinPercent = Number.isFinite(sessionMinPercent) ? sessionMinPercent : 50;
    }

    votes.forEach((vote) => {
      const isInvalid =
        vote.validity === "INVALID" ||
        vote.status === "invalid";

      const isValid =
        vote.validity === "VALID" ||
        (!vote.validity && vote.status === "valid");

      if (isInvalid) {
        totalInvalidVotes++;
        return;
      }

      if (!isValid) {
        return;
      }

      totalValidVotes++;

      const candidateSource = vote.selectedCandidate || vote.candidate;
      if (candidateSource) {
        const names = candidateSource.split(",").map((n) => n.trim());
        names.forEach((name) => {
          if (name) {
            candidateMap.set(name, (candidateMap.get(name) || 0) + 1);
          }
        });
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
      isElected: false,
    }));

    const sorted = parsed.sort((a, b) => b.votesReceived - a.votesReceived);

    const qualified = sorted.filter((c) => {
      if (totalValidVotes <= 0) return false;
      const rate = (c.votesReceived / totalValidVotes) * 100;
      return rate > minWinPercent;
    });

    const electedNames = new Set(
      qualified
        .slice(0, Math.max(0, Math.min(seats || candidateNames.length, candidateNames.length)))
        .map((c) => c.name)
    );

    sorted.forEach((c) => {
      c.isElected = electedNames.has(c.name);
    });

    return {
      candidates: sorted,
      totalValid: totalValidVotes,
      totalInvalid: totalInvalidVotes,
    };
  };

  const totalVotes = sessionVotes.length;
  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  const isVoteValid = (vote: Vote) =>
    vote.validity === "VALID" || (!vote.validity && vote.status === "valid");

  const isVoteInvalid = (vote: Vote) =>
    vote.validity === "INVALID" || vote.status === "invalid";

  const toggleOverrideCandidate = (name: string) => {
    setOverrideCandidates((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

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
      {activeSession && (
        <p style={{ textAlign: "center", marginTop: -10, marginBottom: 16, color: "#475569" }}>
          Rule phiên: cần bầu {activeSession.seats ?? "—"} người, ngưỡng trúng cử &gt; {activeSession.minWinPercent ?? 50}%
        </p>
      )}

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

      {/* Chi tiết AI gần nhất */}
      <section id="manual-review-section" aria-label="Chi tiết AI" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 10 }}>
          Chi tiết AI & duyệt tay (tất cả {sessionVotes.length} phiếu đã tải lên)
        </h3>
        <div className="table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Hợp lệ hay không?</th>
                <th aria-label="Xem lại ảnh phiếu"></th>
                <th aria-label="Duyệt tay"></th>
              </tr>
            </thead>
            <tbody>
              {sessionVotes.map((v) => (
                <tr key={v.id}>
                  <td title={v.voteId}>{shortVoteId(v.voteId)}</td>
                  <td>
                    {v.validity === "VALID" && "VALID"}
                    {v.validity === "INVALID" && "INVALID"}
                    {!v.validity && v.status === "valid" && "VALID"}
                    {!v.validity && v.status === "invalid" && "INVALID"}
                    {!v.validity && (!v.status || v.status === "pending") && "PENDING"}
                  </td>
                  <td>
                    <button
                      onClick={() => openReviewModal(v)}
                      className="table-action-btn table-action-btn--view"
                      title="Xem lại ảnh phiếu trong popup"
                    >
                      Xem ảnh
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => openReviewModal(v)}
                      className="table-action-btn table-action-btn--manual"
                      title="Duyệt tay trong popup"
                    >
                      Duyệt tay
                    </button>
                  </td>
                </tr>
              ))}
              {sessionVotes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Chưa có dữ liệu phiếu trong phiên này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {reviewVote && (
        <div className="review-modal-overlay" onClick={() => setReviewVote(null)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>Kiểm tra phiếu: {reviewVote.voteId}</h3>
              <button onClick={() => setReviewVote(null)} className="review-close-btn">
                ✕
              </button>
            </div>

            <div className="review-modal-body">
              <div className="review-image-wrap">
                {getBallotImageUrl(reviewVote) ? (
                  <img
                    src={getBallotImageUrl(reviewVote)!}
                    alt={reviewVote.voteId}
                    className="review-image"
                  />
                ) : (
                  <div className="review-no-image">Không có ảnh phiếu</div>
                )}
              </div>

              <div className="review-info">
                <div className="review-nav">
                  <button className="review-nav-btn" onClick={() => gotoReviewByIndex(reviewIndex - 1)} disabled={reviewIndex <= 0}>
                    ← Phiếu trước
                  </button>
                  <span>
                    {reviewIndex >= 0 ? reviewIndex + 1 : 0}/{sessionVotes.length}
                  </span>
                  <button
                    className="review-nav-btn"
                    onClick={() => gotoReviewByIndex(reviewIndex + 1)}
                    disabled={reviewIndex < 0 || reviewIndex >= sessionVotes.length - 1}
                  >
                    Phiếu sau →
                  </button>
                </div>

                <p><strong>Validation:</strong> {reviewVote.validity || reviewVote.status || "—"}</p>
                <p>
                  <strong>Lý do invalid:</strong>{" "}
                  {(reviewVote.validity === "INVALID" || reviewVote.status === "invalid")
                    ? (parseInvalidReasons(reviewVote.invalidReasons).join("; ") || "—")
                    : "—"}
                </p>
                <p><strong>Kết quả AI đọc:</strong> {reviewVote.selectedCandidate || reviewVote.candidate || "—"}</p>
                <p><strong>Độ tin cậy:</strong> {((reviewVote.confidenceScore || 0) * 100).toFixed(0)}%</p>
                <p><strong>Người duyệt gần nhất:</strong> {reviewVote.manualOverrideBy || "—"}</p>
                <p>
                  <strong>Lúc duyệt gần nhất:</strong>{" "}
                  {reviewVote.manualOverrideAt ? new Date(reviewVote.manualOverrideAt).toLocaleString("vi-VN") : "—"}
                </p>

                <div className="review-actions">
                  {isVoteInvalid(reviewVote) && (
                    <button
                      className="review-action-btn review-action-btn--valid"
                      onClick={() => {
                        setReviewAction("convert-valid");
                        setOverrideReason("MANUAL_CONFIRM");
                      }}
                      disabled={updatingVoteId === reviewVote.id}
                    >
                      Chuyển thành valid
                    </button>
                  )}

                  {isVoteValid(reviewVote) && (
                    <>
                      <button
                        className="review-action-btn review-action-btn--invalid"
                        onClick={() => {
                          setReviewAction("convert-invalid");
                          setOverrideReason("AI_READ_WRONG_BOX");
                        }}
                        disabled={updatingVoteId === reviewVote.id}
                      >
                        Chuyển thành invalid
                      </button>
                      <button
                        className="review-action-btn review-action-btn--edit"
                        onClick={() => {
                          setReviewAction("edit-valid-result");
                          setOverrideReason("AI_READ_WRONG_BOX");
                        }}
                        disabled={updatingVoteId === reviewVote.id}
                      >
                        Chỉnh sửa kết quả phiếu
                      </button>
                    </>
                  )}
                </div>

                {reviewAction && (
                  <div className="review-form">
                    <label htmlFor="overrideReason"><strong>Lý do override</strong></label>
                    <select
                      id="overrideReason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    >
                      {reviewAction === "convert-valid" ? (
                        <>
                          <option value="AI_READ_WRONG_BOX">AI đọc sai ô</option>
                          <option value="BLUR_IMAGE">Ảnh mờ</option>
                          <option value="MANUAL_CONFIRM">Xác nhận thủ công</option>
                          <option value="OTHER">Khác</option>
                        </>
                      ) : reviewAction === "convert-invalid" ? (
                        <>
                          <option value="AI_READ_WRONG_BOX">AI đọc sai ô</option>
                          <option value="OVER_SEATS">Chọn quá số lượng</option>
                          <option value="NO_SELECTION">Không chọn ứng cử viên</option>
                          <option value="BLUR_IMAGE">Ảnh mờ</option>
                          <option value="OTHER">Khác</option>
                        </>
                      ) : (
                        <>
                          <option value="AI_READ_WRONG_BOX">AI đọc sai ô</option>
                          <option value="MANUAL_CONFIRM">Xác nhận thủ công</option>
                          <option value="OTHER">Khác</option>
                        </>
                      )}
                    </select>

                    {(reviewAction === "convert-valid" || reviewAction === "edit-valid-result") && (
                      <>
                        <label><strong>Kết quả phiếu(chọn những ứng viên được chọn trên phiếu)</strong></label>
                        <div className="candidate-checklist">
                          {(reviewVote.session?.candidates || []).map((name) => (
                            <label key={name} className="candidate-item">
                              <input
                                type="checkbox"
                                checked={overrideCandidates.includes(name)}
                                onChange={() => toggleOverrideCandidate(name)}
                              />
                              <span>{name}</span>
                            </label>
                          ))}
                          {(reviewVote.session?.candidates || []).length === 0 && (
                            <span>Không có danh sách ứng cử viên trong phiên.</span>
                          )}
                        </div>
                      </>
                    )}

                    <label htmlFor="overrideNotes"><strong>Ghi chú kiểm phiếu</strong></label>
                    <textarea
                      id="overrideNotes"
                      value={overrideNotes}
                      onChange={(e) => setOverrideNotes(e.target.value)}
                      rows={3}
                      placeholder="Nhập ghi chú..."
                    />

                    <button
                      onClick={async () => {
                        if (!overrideReason) {
                          alert("Vui lòng chọn lý do override.");
                          return;
                        }

                        if ((reviewAction === "convert-valid" || reviewAction === "edit-valid-result") && overrideCandidates.length === 0) {
                          alert("Vui lòng tick ít nhất 1 ứng cử viên trong kết quả phiếu.");
                          return;
                        }

                        if (reviewAction === "convert-invalid" && isVoteValid(reviewVote) && !overrideReason) {
                          alert("Vui lòng chọn lý do khi duyệt VALID → INVALID.");
                          return;
                        }

                        const nextIsValid = reviewAction !== "convert-invalid";
                        await handleManualValidate(reviewVote, nextIsValid, {
                          reason: overrideReason,
                          notes: overrideNotes,
                          selectedCandidates:
                            reviewAction === "convert-valid" || reviewAction === "edit-valid-result"
                              ? overrideCandidates
                              : [],
                        });
                        setReviewVote(null);
                      }}
                      disabled={updatingVoteId === reviewVote.id}
                    >
                      {updatingVoteId === reviewVote.id
                        ? "Đang cập nhật..."
                        : reviewAction === "edit-valid-result"
                        ? "Lưu chỉnh sửa kết quả phiếu"
                        : "Lưu cập nhật duyệt tay"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Results;
