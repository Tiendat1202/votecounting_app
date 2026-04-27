import React, { useEffect, useMemo, useState } from "react";
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
  PieChart,
  Pie,
  Legend,
} from "recharts";
import "./Results.css";
import ResultAssistant from "../components/ResultAssistant";
import BallotReviewModal, { type BallotVote } from "../components/BallotReviewModal";
import { getSessions, type SessionPermissions } from "../api";
import { useAuth } from "../context/AuthContext";

interface CandidateSummary {
  name: string;
  agree: number;
  disagree: number;
  selected: number;
  notSelected: number;
  empty: number;
  votesReceived: number;
  percent?: number;
  isElected?: boolean;
}

interface SessionSummary {
  success: boolean;
  sessionId: string;
  sessionName: string;
  voteType: "trust" | "surplus";
  seatsToElect: number | null;
  minWinningPercent: number | null;
  totalBallots: number;
  validBallots: number;
  invalidBallots: number;
  failedBallots: number;
  candidates: CandidateSummary[];
}

interface SessionItem {
  id: string;
  name: string;
  type: string;
  startAt?: string;
  endAt?: string;
  permissions?: SessionPermissions;
}
interface ModalState {
  index: number;
  mode: "view" | "review";
}

const nf = new Intl.NumberFormat("vi-VN");
const truncateName = (name: string, max = 14) =>
  !name ? "" : name.length > max ? `${name.slice(0, max - 1)}…` : name;

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === "valid"
      ? { label: "HỢP LỆ", bg: "#dcfce7", fg: "#166534" }
      : status === "invalid"
        ? { label: "KHÔNG HỢP LỆ", bg: "#fee2e2", fg: "#991b1b" }
        : { label: status.toUpperCase(), bg: "#fef3c7", fg: "#854d0e" };
  return (
    <span className="status-badge" style={{ background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

const Results: React.FC = () => {
  const { id: routeSessionId } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [ballots, setBallots] = useState<BallotVote[]>([]);
  const [ballotsLoading, setBallotsLoading] = useState(false);
  const [ballotAccessMessage, setBallotAccessMessage] = useState<string>("");
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );
  const permissions = selectedSession?.permissions;
  const canViewBallots = !!permissions?.canViewBallots;
  const canReview = !!permissions?.canReview;

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSummary(selectedSessionId);
      if (user) {
        fetchBallots(selectedSessionId);
      } else {
        setBallots([]);
        setBallotAccessMessage("");
      }
    }
  }, [selectedSessionId, user?.userId]);

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      if (routeSessionId && list.some((s: SessionItem) => s.id === routeSessionId)) {
        setSelectedSessionId(routeSessionId);
      } else if (list.length > 0) {
        setSelectedSessionId(list[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
      setLoading(false);
    }
  };

  const fetchSummary = async (sessionId: string) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/results/${sessionId}/summary`);
      if (!res.ok) throw new Error("Không thể lấy dữ liệu kết quả");
      setSummary(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const fetchBallots = async (sessionId: string) => {
    try {
      setBallotsLoading(true);
      setBallotAccessMessage("");
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/results/${sessionId}/ballots`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBallots([]);
        setBallotAccessMessage(
          (data as any).message ||
            (data as any).error ||
            "Bạn không có quyền xem phiếu của phiên này."
        );
        return;
      }
      setBallots((data as any).votes || []);
    } catch (e) {
      console.error("[Results] fetchBallots error:", e);
      setBallots([]);
      setBallotAccessMessage("Không tải được danh sách phiếu.");
    } finally {
      setBallotsLoading(false);
    }
  };

  const refresh = () => {
    if (!selectedSessionId) return;
    fetchSummary(selectedSessionId);
    if (user) fetchBallots(selectedSessionId);
  };

  const handleBallotSaved = (
    updatedBallot: BallotVote,
    oldBallot: BallotVote,
    newSelectedCandidates: string[]
  ) => {
    setBallots((prev) => prev.map((b) => (b.id === updatedBallot.id ? updatedBallot : b)));

    setSummary((prev) => {
      if (!prev) return prev;
      let { validBallots, invalidBallots, failedBallots } = prev;
      const oldStatus = oldBallot.status;
      const newStatus = updatedBallot.status;

      if (oldStatus !== newStatus) {
        if (newStatus === "valid") {
          validBallots += 1;
          if (oldStatus === "invalid") invalidBallots -= 1;
          else if (oldStatus === "failed") failedBallots -= 1;
        } else if (newStatus === "invalid") {
          invalidBallots += 1;
          if (oldStatus === "valid") validBallots -= 1;
          else if (oldStatus === "failed") failedBallots -= 1;
        }
      }

      const normalize = (s: string) => s.trim().toLowerCase();
      const oldNames =
        oldStatus === "valid"
          ? (oldBallot.selectedCandidate || "")
              .split(",")
              .map((x) => normalize(x))
              .filter(Boolean)
          : [];
      const newNames = newStatus === "valid" ? newSelectedCandidates.map(normalize) : [];

      const updatedCandidates = prev.candidates.map((candidate) => {
        const key = normalize(candidate.name);
        const wasIn = oldNames.includes(key);
        const isIn = newNames.includes(key);
        if (wasIn === isIn) return candidate;
        const delta = isIn ? 1 : -1;
        return prev.voteType === "trust"
          ? { ...candidate, agree: candidate.agree + delta, votesReceived: candidate.votesReceived + delta }
          : { ...candidate, selected: candidate.selected + delta, votesReceived: candidate.votesReceived + delta };
      });

      return { ...prev, validBallots, invalidBallots, failedBallots, candidates: updatedCandidates };
    });

    setModalState(null);
    setTimeout(() => refresh(), 1200);
  };

  const totalVotes = summary?.totalBallots ?? 0;
  const totalValid = summary?.validBallots ?? 0;
  const totalInvalid = summary?.invalidBallots ?? 0;
  const totalFailed = summary?.failedBallots ?? 0;
  const voteType = summary?.voteType ?? "trust";
  const candidates = summary?.candidates ?? [];
  const seatsToElect = summary?.seatsToElect ?? null;

  const hasComputedResults = totalVotes > 0 || totalValid > 0 || totalInvalid > 0 || totalFailed > 0;
  const hasCandidateStats = candidates.some(
    (candidate) =>
      candidate.votesReceived > 0 ||
      candidate.agree > 0 ||
      candidate.disagree > 0 ||
      candidate.selected > 0 ||
      candidate.notSelected > 0
  );

  const computeIsElected = (votesReceived: number, idx: number) => {
    if (totalValid === 0) return false;
    const pct = (votesReceived / totalValid) * 100;
    const meetsThreshold = pct >= (summary?.minWinningPercent ?? 50);
    const withinSeats = seatsToElect === null || idx < seatsToElect;
    return meetsThreshold && withinSeats;
  };

  const candidatesForAssistant = candidates.map((candidate, idx) => ({
    name: candidate.name,
    votes: candidate.votesReceived,
    isElected: computeIsElected(candidate.votesReceived, idx),
  }));

  const chartData = candidates.map((candidate, idx) => ({
    name: candidate.name,
    votesReceived: candidate.votesReceived,
    isElected: computeIsElected(candidate.votesReceived, idx),
    percent: totalValid > 0 ? (candidate.votesReceived / totalValid) * 100 : 0,
  }));

  const leaderboard = [...chartData].sort((a, b) => b.votesReceived - a.votesReceived);
  const ballotDistribution = [
    { name: "Hợp lệ", value: totalValid, color: "#16a34a" },
    { name: "Không hợp lệ", value: totalInvalid, color: "#dc2626" },
    { name: "Đang chờ / lỗi", value: totalFailed, color: "#d97706" },
  ].filter((item) => item.value > 0);

  if (loading) {
    return (
      <div className="results-container">
        <h1 className="results-title">Kết quả bầu cử</h1>
        <div className="results-loading">
          <div className="loading-spinner" />
          <p>Đang tải dữ liệu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-container">
        <h1 className="results-title">Kết quả bầu cử</h1>
        <div className="results-error">
          <p>⚠ {error}</p>
          <button className="btn-primary" onClick={fetchSessions}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-page-header">
        <div>
          <h1 className="results-title">Kết quả bầu cử</h1>
          <p className="results-lead">
            Theo dõi kết quả tổng hợp, so sánh ứng viên và kiểm tra tình trạng phiếu của từng phiên.
          </p>
        </div>
        <div className="session-selector-row">
          <label htmlFor="sessionSelect" className="selector-label">
            Phiên bầu cử
          </label>
          <select
            id="sessionSelect"
            className="session-select"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} — {session.type === "tin-nhiem" ? "Tín nhiệm" : "Số dư"}
              </option>
            ))}
          </select>
          <button className="btn-refresh" onClick={refresh}>
            ↺ Làm mới
          </button>
        </div>
        {summary && (
          <p className="session-rules-hint">
            Phiên: <strong>{summary.sessionName}</strong> · Loại phiếu:{" "}
            <strong>{voteType === "trust" ? "Tín nhiệm" : "Số dư"}</strong> · Cần bầu:{" "}
            <strong>{seatsToElect ?? "—"} người</strong> · Ngưỡng trúng cử:{" "}
            <strong>≥ {summary.minWinningPercent ?? 50}%</strong>
          </p>
        )}
        {user && permissions && (
          <p className="session-rules-hint secondary-hint">
            Quyền của bạn với phiên này: <strong>{permissions.isOwner ? "Chủ phiên" : "Thành viên"}</strong>
            {permissions.canUpload ? " · Upload" : ""}
            {permissions.canReview ? " · Chỉnh sửa kết quả" : ""}
            {permissions.canViewBallots ? " · Xem phiếu" : ""}
          </p>
        )}
      </div>

      {!hasComputedResults ? (
        <section className="section-card empty-state-card" aria-label="Chưa có kết quả">
          <div className="empty-state-icon">📊</div>
          <h2>Hiện chưa có kết quả</h2>
          <p>
            Phiên này chưa có dữ liệu tổng hợp để hiển thị. Khi hệ thống xử lý xong phiếu, bảng kết quả và biểu đồ
            sẽ xuất hiện tại đây.
          </p>
        </section>
      ) : (
        <>
          <section className="stat-grid" aria-label="Thống kê tổng quan">
            <div className="stat-card stat-card--total">
              <p className="stat-label">Tổng số phiếu</p>
              <p className="stat-value">{nf.format(totalVotes)}</p>
              <p className="stat-sub">Toàn bộ phiếu đã ghi nhận</p>
            </div>
            <div className="stat-card stat-card--valid">
              <p className="stat-label">Hợp lệ</p>
              <p className="stat-value">{nf.format(totalValid)}</p>
              {totalVotes > 0 && <p className="stat-sub">{((totalValid / totalVotes) * 100).toFixed(1)}%</p>}
            </div>
            <div className="stat-card stat-card--invalid">
              <p className="stat-label">Không hợp lệ</p>
              <p className="stat-value">{nf.format(totalInvalid)}</p>
              {totalVotes > 0 && <p className="stat-sub">{((totalInvalid / totalVotes) * 100).toFixed(1)}%</p>}
            </div>
            <div className="stat-card stat-card--failed">
              <p className="stat-label">Đang chờ / lỗi</p>
              <p className="stat-value">{nf.format(totalFailed)}</p>
              <p className="stat-sub">Cần kiểm tra thêm</p>
            </div>
          </section>

          <section className="results-visual-grid">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Phân bố tình trạng phiếu</h2>
              </div>
              {ballotDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={ballotDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {ballotDistribution.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => nf.format(Number(value))} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="mini-empty">Chưa có dữ liệu phiếu để hiển thị biểu đồ.</div>
              )}
            </div>

            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Tương quan ứng viên nổi bật</h2>
              </div>
              {hasCandidateStats ? (
                <div className="leaderboard-list">
                  {leaderboard.slice(0, 5).map((candidate, index) => {
                    const winnerClass = candidate.isElected ? "leaderboard-item winner" : "leaderboard-item";
                    return (
                      <div className={winnerClass} key={candidate.name}>
                        <div className="leaderboard-rank">#{index + 1}</div>
                        <div className="leaderboard-content">
                          <div className="leaderboard-topline">
                            <strong>{candidate.name}</strong>
                            <span>{nf.format(candidate.votesReceived)} phiếu</span>
                          </div>
                          <div className="leaderboard-bar-track">
                            <div className="leaderboard-bar-fill" style={{ width: `${Math.max(candidate.percent, 4)}%` }} />
                          </div>
                          <div className="leaderboard-meta">
                            <span>{candidate.percent.toFixed(1)}% phiếu hợp lệ</span>
                            {candidate.isElected && <span className="leaderboard-badge">Đang dẫn đầu</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mini-empty">Hệ thống chưa tính xong kết quả theo từng ứng viên.</div>
              )}
            </div>
          </section>

          <section className="section-card" aria-label="Bảng kết quả ứng viên">
            <div className="section-header-row">
              <h2 className="section-title">Kết quả ứng viên</h2>
              {hasCandidateStats && (
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--elected" /> Trúng cử / đạt ngưỡng
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--not" /> Chưa đạt ngưỡng
                  </span>
                </div>
              )}
            </div>

            {hasCandidateStats ? (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-num">STT</th>
                        <th>Họ và tên</th>
                        <th className="col-num">{voteType === "trust" ? "Đồng ý" : "Được bầu"}</th>
                        <th className="col-num">{voteType === "trust" ? "Không đồng ý" : "Bị gạch"}</th>
                        <th className="col-num">Tỉ lệ</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate, idx) => {
                        const votes = voteType === "trust" ? candidate.agree : candidate.selected;
                        const isElected = computeIsElected(votes, idx);
                        const rate = totalValid > 0 ? ((votes / totalValid) * 100).toFixed(2) : "0.00";
                        return (
                          <tr key={idx} className={isElected ? "row-elected" : "row-not-elected"}>
                            <td className="col-num">{idx + 1}</td>
                            <td className="col-name">{candidate.name}</td>
                            <td className="col-num">{nf.format(votes)}</td>
                            <td className="col-num">
                              {nf.format(voteType === "trust" ? candidate.disagree : candidate.notSelected)}
                            </td>
                            <td className="col-num">{rate}%</td>
                            <td>
                              {isElected ? (
                                <span className="badge badge--elected">✓ Trúng cử</span>
                              ) : (
                                <span className="badge badge--not">Không trúng cử</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 70, left: 8 }} barCategoryGap={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={66}
                      tickFormatter={(v) => truncateName(String(v), 14)}
                      tick={{ fontSize: 12, fill: "#334155" }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#334155" }} tickFormatter={(v) => nf.format(Number(v))} />
                    <Tooltip formatter={(value) => nf.format(Number(value))} labelFormatter={(l) => String(l)} />
                    <Bar dataKey="votesReceived" barSize={32} radius={[8, 8, 0, 0]}>
                      {chartData.map((candidate, idx) => (
                        <Cell key={`cell-${idx}`} fill={candidate.isElected ? "#0F62FE" : "#94A3B8"} />
                      ))}
                      <LabelList
                        dataKey="votesReceived"
                        position="top"
                        formatter={(label: React.ReactNode) => {
                          const value = typeof label === "number" ? label : Number(label ?? 0);
                          return value > 0 ? nf.format(value) : "";
                        }}
                        style={{ fontSize: 11, fill: "#0F172A", fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="mini-empty">Hiện chưa có kết quả theo ứng viên.</div>
            )}
          </section>
        </>
      )}

      {user && (
        <section className="section-card" aria-label="Chi tiết duyệt tay">
          <div className="section-header-row">
            <h2 className="section-title">
              Chi tiết AI &amp; duyệt tay <span className="section-count">({ballots.length} phiếu)</span>
            </h2>
            <button className="btn-refresh-sm" onClick={refresh} disabled={ballotsLoading}>
              {ballotsLoading ? "Đang tải…" : "↺ Làm mới"}
            </button>
          </div>

          {ballotAccessMessage && <div className="results-error inline-message">{ballotAccessMessage}</div>}

          {ballotsLoading ? (
            <div className="results-loading compact-loading">
              <div className="loading-spinner" />
              <p>Đang tải danh sách phiếu…</p>
            </div>
          ) : canViewBallots ? (
            <div className="table-scroll">
              <table className="data-table ballot-table">
                <thead>
                  <tr>
                    <th className="col-num">STT</th>
                    <th>Mã phiếu</th>
                    <th>Danh sách trúng cử</th>
                    <th>Tính hợp lệ</th>
                    <th className="col-actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {ballots.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Chưa có phiếu nào được tải lên trong phiên này.
                      </td>
                    </tr>
                  ) : (
                    ballots.map((vote, idx) => (
                      <tr key={vote.id}>
                        <td className="col-num">{idx + 1}</td>
                        <td>
                          <span className="vote-id-cell" title={vote.voteId}>
                            {vote.voteId ? vote.voteId.slice(-14) : "—"}
                          </span>
                        </td>
                        <td className="col-candidate">
                          {vote.selectedCandidate || <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <StatusBadge status={vote.status} />
                        </td>
                        <td className="col-actions">
                          <button className="tbl-btn tbl-btn--view" onClick={() => setModalState({ index: idx, mode: "view" })}>
                            Xem ảnh
                          </button>
                          {canReview ? (
                            <button className="tbl-btn tbl-btn--review" onClick={() => setModalState({ index: idx, mode: "review" })}>
                              Duyệt tay
                            </button>
                          ) : (
                            <span className="tbl-btn tbl-btn--review is-disabled">Chỉ xem</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}

      {hasComputedResults && (
        <ResultAssistant
          summary={{
            totalVotes,
            totalValid,
            totalInvalid,
            candidates: candidatesForAssistant,
          }}
        />
      )}

      {modalState !== null && ballots.length > 0 && (
        <BallotReviewModal
          ballots={ballots}
          initialIndex={modalState.index}
          initialMode={modalState.mode}
          sessionId={selectedSessionId}
          canEdit={canReview}
          onClose={() => setModalState(null)}
          onSaved={handleBallotSaved}
        />
      )}
    </div>
  );
};

export default Results;
