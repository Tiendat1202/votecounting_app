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
import BallotReviewModal, {
  type BallotVote,
} from "../components/BallotReviewModal";
import { getSessions, type SessionPermissions } from "../api";
import { useAuth } from "../context/AuthContext";

interface EvaluationCount {
  key: string;
  label: string;
  count: number;
  percent: number;
}

interface CandidateSummary {
  name: string;
  agree: number;
  disagree: number;
  selected: number;
  notSelected: number;
  empty: number;
  trustHigh?: number;
  trustMedium?: number;
  trustLow?: number;
  votesReceived: number;
  percent?: number;
  agreePercent?: number;
  disagreePercent?: number;
  selectedPercent?: number;
  notSelectedPercent?: number;
  trustHighPercent?: number;
  trustMediumPercent?: number;
  trustLowPercent?: number;
  isElected?: boolean;
  evaluationCounts?: EvaluationCount[];
  evaluationOptions?: { key: string; label: string }[];
}

interface SessionSummary {
  success: boolean;
  sessionId: string;
  sessionName: string;
  voteType: "trust" | "surplus";
  voteRule?:
    | "agree-disagree"
    | "trust-3-level"
    | "custom-evaluation"
    | "elect-by-seats"
    | string
    | null;
  evaluationOptions?: { key: string; label: string }[];
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

type ReportTemplateId =
  | "default"
  | "ward_household"
  | "company_2019"
  | "custom";

const DEFAULT_CUSTOM_REPORT_TEMPLATE = `BIÊN BẢN KIỂM PHIẾU

Đơn vị tổ chức: {{electionUnit}}
Địa điểm diễn ra: {{location}}
Phiên kiểm phiếu: {{sessionName}}
Ngày lập biên bản: {{reportDate}}

Tổng số phiếu: {{totalBallots}}
Số phiếu hợp lệ: {{validBallots}}
Số phiếu không hợp lệ: {{invalidBallots}}
Số phiếu đang chờ/lỗi: {{failedBallots}}

Kết quả cụ thể:
{{candidateResults}}

Người lập biên bản: {{reportCreator}}
`;

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
    <span
      className="status-badge"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
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
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTemplateId, setReportTemplateId] =
    useState<ReportTemplateId>("default");
  const [reportFields, setReportFields] = useState<Record<string, string>>({});
  const [customTemplate, setCustomTemplate] = useState(
    DEFAULT_CUSTOM_REPORT_TEMPLATE,
  );
  const [reportPreview, setReportPreview] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );
  const permissions = selectedSession?.permissions;
  const canViewBallots = !!permissions?.canViewBallots;
  const canReview = !!permissions?.canReview;
  const canExportReport = !!permissions?.canExportReport;

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
      if (
        routeSessionId &&
        list.some((s: SessionItem) => s.id === routeSessionId)
      ) {
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
            "Bạn không có quyền xem phiếu của phiên này.",
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

  const updateReportField = (key: string, value: string) => {
    setReportFields((prev) => ({ ...prev, [key]: value }));
  };

  const buildReportPayload = () => ({
    templateId: reportTemplateId,
    fields: {
      ...reportFields,
      electionUnit:
        reportFields.electionUnit || (summary as any)?.electionUnit || "",
      location: reportFields.location || (summary as any)?.location || "",
    },
    customTemplate,
  });

  const handlePreviewReport = async () => {
    if (!selectedSessionId || !canExportReport) return;

    try {
      setReportLoading(true);
      setReportError("");
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/results/${selectedSessionId}/report/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(buildReportPayload()),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Không tạo được bản xem trước biên bản");
      setReportPreview(data.content || "");
    } catch (err) {
      setReportError(
        err instanceof Error
          ? err.message
          : "Không tạo được bản xem trước biên bản",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!selectedSessionId || !canExportReport) return;

    try {
      setReportLoading(true);
      setReportError("");
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/results/${selectedSessionId}/report/export.txt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(buildReportPayload()),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không xuất được biên bản");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeSessionName = (summary?.sessionName || "bien-ban-kiem-phieu")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^\w\d-]+/g, "_");
      a.href = url;
      a.download = `${safeSessionName || "bien-ban-kiem-phieu"}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : "Không xuất được biên bản",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleBallotSaved = (
    updatedBallot: BallotVote,
    oldBallot: BallotVote,
    newSelectedCandidates: string[],
  ) => {
    setBallots((prev) =>
      prev.map((b) => (b.id === updatedBallot.id ? updatedBallot : b)),
    );

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
      const newNames =
        newStatus === "valid" ? newSelectedCandidates.map(normalize) : [];

      const updatedCandidates = prev.candidates.map((candidate) => {
        const key = normalize(candidate.name);
        const wasIn = oldNames.includes(key);
        const isIn = newNames.includes(key);
        if (wasIn === isIn) return candidate;
        const delta = isIn ? 1 : -1;
        return prev.voteType === "trust"
          ? {
              ...candidate,
              agree: candidate.agree + delta,
              votesReceived: candidate.votesReceived + delta,
            }
          : {
              ...candidate,
              selected: candidate.selected + delta,
              votesReceived: candidate.votesReceived + delta,
            };
      });

      return {
        ...prev,
        validBallots,
        invalidBallots,
        failedBallots,
        candidates: updatedCandidates,
      };
    });

    setModalState(null);
    setTimeout(() => refresh(), 1200);
  };

  const totalVotes = summary?.totalBallots ?? 0;
  const totalValid = summary?.validBallots ?? 0;
  const totalInvalid = summary?.invalidBallots ?? 0;
  const totalFailed = summary?.failedBallots ?? 0;
  const voteType = summary?.voteType ?? "trust";
  const voteRule =
    summary?.voteRule ??
    (voteType === "trust" ? "agree-disagree" : "elect-by-seats");
  const isTrustVote = voteType === "trust";
  const isThreeLevelTrust = isTrustVote && voteRule === "trust-3-level";
  const evaluationOptions = isTrustVote
    ? summary?.evaluationOptions?.length
      ? summary.evaluationOptions
      : isThreeLevelTrust
        ? [
            { key: "tin_nhiem_cao", label: "Tín nhiệm cao" },
            { key: "tin_nhiem", label: "Tín nhiệm" },
            { key: "tin_nhiem_thap", label: "Tín nhiệm thấp" },
          ]
        : [
            { key: "dong_y", label: "Đồng ý" },
            { key: "khong_dong_y", label: "Không đồng ý" },
          ]
    : [];
  const candidates = summary?.candidates ?? [];
  const seatsToElect = summary?.seatsToElect ?? null;

  const hasComputedResults =
    totalVotes > 0 || totalValid > 0 || totalInvalid > 0 || totalFailed > 0;
  const hasCandidateStats = candidates.some(
    (candidate) =>
      candidate.votesReceived > 0 ||
      candidate.selected > 0 ||
      candidate.notSelected > 0 ||
      (candidate.evaluationCounts ?? []).some((item) => item.count > 0) ||
      candidate.agree > 0 ||
      candidate.disagree > 0 ||
      (candidate.trustHigh ?? 0) > 0 ||
      (candidate.trustMedium ?? 0) > 0 ||
      (candidate.trustLow ?? 0) > 0,
  );

  const computeIsElected = (votesReceived: number, idx: number) => {
    if (isTrustVote || totalValid === 0) return false;
    const pct = (votesReceived / totalValid) * 100;
    const meetsThreshold = pct >= (summary?.minWinningPercent ?? 50);
    const withinSeats = seatsToElect === null || idx < seatsToElect;
    return meetsThreshold && withinSeats;
  };

  const pct = (value: number | undefined) =>
    `${Number(value ?? 0).toFixed(2)}%`;

  const getEvalCount = (candidate: CandidateSummary, key: string) =>
    candidate.evaluationCounts?.find((item) => item.key === key)?.count ?? 0;

  const getEvalPercent = (candidate: CandidateSummary, key: string) =>
    candidate.evaluationCounts?.find((item) => item.key === key)?.percent ?? 0;

  const getPrimaryCount = (candidate: CandidateSummary) => {
    if (isTrustVote)
      return (
        candidate.evaluationCounts?.[0]?.count ??
        candidate.votesReceived ??
        candidate.agree ??
        0
      );
    return candidate.selected;
  };

  const getPrimaryPercent = (candidate: CandidateSummary) => {
    if (isTrustVote)
      return (
        candidate.evaluationCounts?.[0]?.percent ??
        candidate.percent ??
        candidate.agreePercent ??
        0
      );
    return candidate.selectedPercent ?? 0;
  };

  const candidatesForAssistant = candidates.map((candidate, idx) => ({
    name: candidate.name,
    votes: candidate.votesReceived,
    isElected: computeIsElected(candidate.votesReceived, idx),
  }));

  const chartData = candidates.map((candidate, idx) => {
    const evalValues = Object.fromEntries(
      (candidate.evaluationCounts ?? []).map((item) => [item.key, item.count]),
    );
    return {
      name: candidate.name,
      votesReceived: getPrimaryCount(candidate),
      ...evalValues,
      trustHigh: candidate.trustHigh ?? 0,
      trustMedium: candidate.trustMedium ?? 0,
      trustLow: candidate.trustLow ?? 0,
      agree: candidate.agree,
      disagree: candidate.disagree,
      selected: candidate.selected,
      isElected: computeIsElected(candidate.votesReceived, idx),
      percent: getPrimaryPercent(candidate),
    };
  });

  const trustChartBars = isTrustVote
    ? evaluationOptions.map((option, index) => ({
        dataKey: option.key,
        name: option.label,
        fill: [
          "#16a34a",
          "#ef4444",
          "#f59e0b",
          "#0f62fe",
          "#7c3aed",
          "#0891b2",
        ][index % 6],
      }))
    : [];

  const leaderboard = useMemo<any[]>(() => {
    if (!isTrustVote) {
      return [...chartData].sort((a, b) => b.votesReceived - a.votesReceived);
    }

    return candidates
      .map((candidate) => {
        const primary = candidate.evaluationCounts?.[0];
        return {
          ...candidate,
          votesReceived: primary?.count ?? candidate.votesReceived ?? 0,
          percent: primary?.percent ?? candidate.percent ?? 0,
        };
      })
      .sort(
        (a, b) =>
          (b.percent ?? 0) - (a.percent ?? 0) ||
          (b.votesReceived ?? 0) - (a.votesReceived ?? 0),
      );
  }, [isTrustVote, chartData, candidates]);
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
            Theo dõi kết quả tổng hợp, so sánh ứng viên và kiểm tra tình trạng
            phiếu của từng phiên.
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
                {session.name} —{" "}
                {session.type === "tin-nhiem" ? "Tín nhiệm" : "Số dư"}
              </option>
            ))}
          </select>
          <button className="btn-refresh" onClick={refresh}>
            ↺ Làm mới
          </button>
          <button
            className="btn-export-report"
            onClick={() => {
              setReportModalOpen(true);
              setReportPreview("");
              setReportError("");
            }}
            disabled={!summary || !canExportReport}
            title={!canExportReport ? "Chỉ inspector của phiên được xuất biên bản" : ""}
          >
            Xuất biên bản
          </button>
        </div>
        {summary && (
          <p className="session-rules-hint">
            Phiên: <strong>{summary.sessionName}</strong> · Loại phiếu:{" "}
            <strong>{voteType === "trust" ? "Tín nhiệm" : "Số dư"}</strong>
            {isTrustVote ? (
              <>
                {" "}
                · Cột đánh giá:{" "}
                <strong>
                  {evaluationOptions.map((item) => item.label).join(" / ") ||
                    "—"}
                </strong>
              </>
            ) : (
              <>
                {" "}
                · Cần bầu: <strong>{seatsToElect ?? "—"} người</strong> · Ngưỡng
                trúng cử: <strong>≥ {summary.minWinningPercent ?? 50}%</strong>
              </>
            )}
          </p>
        )}
        {user && permissions && (
          <p className="session-rules-hint secondary-hint">
            Quyền của bạn với phiên này:{" "}
            <strong>
              {permissions.isOwner
                ? "Chủ phiên"
                : permissions.sessionRole === "inspector"
                  ? "Inspector"
                  : permissions.sessionRole === "supervisor"
                    ? "Supervisor"
                    : "Thành viên"}
            </strong>
            {permissions.canUpload ? " · Upload" : ""}
            {permissions.canReview ? " · Chỉnh sửa kết quả" : ""}
            {permissions.canViewBallots ? " · Xem phiếu" : ""}
          </p>
        )}
      </div>

      {!hasComputedResults ? (
        <section
          className="section-card empty-state-card"
          aria-label="Chưa có kết quả"
        >
          <div className="empty-state-icon">📊</div>
          <h2>Hiện chưa có kết quả</h2>
          <p>
            Phiên này chưa có dữ liệu tổng hợp để hiển thị. Khi hệ thống xử lý
            xong phiếu, bảng kết quả và biểu đồ sẽ xuất hiện tại đây.
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
              {totalVotes > 0 && (
                <p className="stat-sub">
                  {((totalValid / totalVotes) * 100).toFixed(1)}%
                </p>
              )}
            </div>
            <div className="stat-card stat-card--invalid">
              <p className="stat-label">Không hợp lệ</p>
              <p className="stat-value">{nf.format(totalInvalid)}</p>
              {totalVotes > 0 && (
                <p className="stat-sub">
                  {((totalInvalid / totalVotes) * 100).toFixed(1)}%
                </p>
              )}
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
                    <Tooltip
                      formatter={(value: any) => nf.format(Number(value))}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="mini-empty">
                  Chưa có dữ liệu phiếu để hiển thị biểu đồ.
                </div>
              )}
            </div>

            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">
                  {isTrustVote
                    ? "Tổng hợp tín nhiệm nổi bật"
                    : "Tương quan ứng viên nổi bật"}
                </h2>
              </div>
              {hasCandidateStats ? (
                <div className="leaderboard-list">
                  {leaderboard.slice(0, 5).map((candidate, index) => {
                    const winnerClass = candidate.isElected
                      ? "leaderboard-item winner"
                      : "leaderboard-item";

                    if (isTrustVote) {
                      const counts = candidate.evaluationCounts ?? [];
                      const primary = counts[0];

                      return (
                        <div className={winnerClass} key={candidate.name}>
                          <div className="leaderboard-rank">#{index + 1}</div>
                          <div className="leaderboard-content">
                            <div className="leaderboard-topline">
                              <strong>{candidate.name}</strong>
                              <span>
                                {primary
                                  ? `${nf.format(primary.count)} phiếu ${primary.label.toLowerCase()}`
                                  : `${nf.format(candidate.votesReceived)} phiếu`}
                              </span>
                            </div>
                            <div className="trust-meta-row dynamic-eval-meta">
                              {counts.map((item: EvaluationCount) => (
                                <span className="trust-meta" key={item.key}>
                                  {item.label}: {nf.format(item.count)} phiếu (
                                  {item.percent.toFixed(1)}%)
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const barPercent = Number(candidate.percent ?? 0);

                    return (
                      <div className={winnerClass} key={candidate.name}>
                        <div className="leaderboard-rank">#{index + 1}</div>
                        <div className="leaderboard-content">
                          <div className="leaderboard-topline">
                            <strong>{candidate.name}</strong>
                            <span>
                              {nf.format(candidate.votesReceived)} phiếu
                            </span>
                          </div>
                          <div className="leaderboard-bar-track">
                            <div
                              className="leaderboard-bar-fill"
                              style={{ width: `${Math.max(barPercent, 4)}%` }}
                            />
                          </div>
                          <div className="leaderboard-meta">
                            <span>{barPercent.toFixed(1)}% phiếu hợp lệ</span>
                            {!isTrustVote && candidate.isElected && (
                              <span className="leaderboard-badge">
                                Đang dẫn đầu
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mini-empty">
                  Hệ thống chưa tính xong kết quả theo từng ứng viên.
                </div>
              )}
            </div>
          </section>

          <section className="section-card" aria-label="Bảng kết quả ứng viên">
            <div className="section-header-row">
              <h2 className="section-title">Kết quả ứng viên</h2>
              {hasCandidateStats && (
                <div className="chart-legend">
                  {isTrustVote ? (
                    <span className="legend-item">
                      Kết quả hiển thị theo số phiếu và tỉ lệ trên tổng phiếu
                      hợp lệ
                    </span>
                  ) : (
                    <>
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--elected" />{" "}
                        Trúng cử / đạt ngưỡng
                      </span>
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--not" />{" "}
                        Chưa đạt ngưỡng
                      </span>
                    </>
                  )}
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
                        {isTrustVote ? (
                          <>
                            {evaluationOptions.map((option) => (
                              <React.Fragment key={option.key}>
                                <th className="col-num">{option.label}</th>
                                <th className="col-num">Tỉ lệ</th>
                              </React.Fragment>
                            ))}
                          </>
                        ) : (
                          <>
                            <th className="col-num">Được bầu</th>
                            <th className="col-num">Bị gạch</th>
                            <th className="col-num">Tỉ lệ</th>
                            <th>Trạng thái</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate, idx) => {
                        const votes = isTrustVote
                          ? getPrimaryCount(candidate)
                          : candidate.selected;
                        const isElected = computeIsElected(
                          candidate.votesReceived,
                          idx,
                        );
                        const rate =
                          totalValid > 0
                            ? ((votes / totalValid) * 100).toFixed(2)
                            : "0.00";

                        return (
                          <tr
                            key={idx}
                            className={
                              !isTrustVote && isElected
                                ? "row-elected"
                                : "row-not-elected"
                            }
                          >
                            <td className="col-num">{idx + 1}</td>
                            <td className="col-name">{candidate.name}</td>

                            {isTrustVote ? (
                              <>
                                {evaluationOptions.map((option) => {
                                  const count = getEvalCount(
                                    candidate,
                                    option.key,
                                  );
                                  const percent = getEvalPercent(
                                    candidate,
                                    option.key,
                                  );
                                  return (
                                    <React.Fragment key={option.key}>
                                      <td className="col-num">
                                        {nf.format(count)}
                                      </td>
                                      <td className="col-num">
                                        {pct(percent)}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </>
                            ) : (
                              <>
                                <td className="col-num">
                                  {nf.format(candidate.selected)}
                                </td>
                                <td className="col-num">
                                  {nf.format(candidate.notSelected)}
                                </td>
                                <td className="col-num">{rate}%</td>
                                <td>
                                  {isElected ? (
                                    <span className="badge badge--elected">
                                      ✓ Trúng cử
                                    </span>
                                  ) : (
                                    <span className="badge badge--not">
                                      Không trúng cử
                                    </span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={380}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 16, right: 16, bottom: 70, left: 8 }}
                    barCategoryGap={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={66}
                      tickFormatter={(v: any) => truncateName(String(v), 14)}
                      tick={{ fontSize: 12, fill: "#334155" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#334155" }}
                      tickFormatter={(v: any) => nf.format(Number(v))}
                    />
                    <Tooltip
                      formatter={(value: any) => nf.format(Number(value))}
                      labelFormatter={(l: any) => String(l)}
                    />
                    {isTrustVote ? (
                      <>
                        {trustChartBars.map((bar) => (
                          <Bar
                            key={bar.dataKey}
                            dataKey={bar.dataKey}
                            name={bar.name}
                            fill={bar.fill}
                            barSize={isThreeLevelTrust ? 18 : 24}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey={bar.dataKey}
                              position="top"
                              formatter={(label: React.ReactNode) => {
                                const value =
                                  typeof label === "number"
                                    ? label
                                    : Number(label ?? 0);
                                return value > 0 ? nf.format(value) : "";
                              }}
                              style={{
                                fontSize: 11,
                                fill: "#0F172A",
                                fontWeight: 700,
                              }}
                            />
                          </Bar>
                        ))}
                      </>
                    ) : (
                      <Bar
                        dataKey="votesReceived"
                        name="Được bầu"
                        barSize={32}
                        radius={[8, 8, 0, 0]}
                      >
                        {chartData.map((candidate, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={candidate.isElected ? "#0F62FE" : "#94A3B8"}
                          />
                        ))}
                        <LabelList
                          dataKey="votesReceived"
                          position="top"
                          formatter={(label: React.ReactNode) => {
                            const value =
                              typeof label === "number"
                                ? label
                                : Number(label ?? 0);
                            return value > 0 ? nf.format(value) : "";
                          }}
                          style={{
                            fontSize: 11,
                            fill: "#0F172A",
                            fontWeight: 700,
                          }}
                        />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="mini-empty">
                Hiện chưa có kết quả theo ứng viên.
              </div>
            )}
          </section>
        </>
      )}

      {user && (
        <section className="section-card" aria-label="Chi tiết duyệt tay">
          <div className="section-header-row">
            <h2 className="section-title">
              Chi tiết AI &amp; duyệt tay{" "}
              <span className="section-count">({ballots.length} phiếu)</span>
            </h2>
            <button
              className="btn-refresh-sm"
              onClick={refresh}
              disabled={ballotsLoading}
            >
              {ballotsLoading ? "Đang tải…" : "↺ Làm mới"}
            </button>
          </div>

          {ballotAccessMessage && (
            <div className="results-error inline-message">
              {ballotAccessMessage}
            </div>
          )}

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
                          {vote.selectedCandidate || (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={vote.status} />
                        </td>
                        <td className="col-actions">
                          <button
                            className="tbl-btn tbl-btn--view"
                            onClick={() =>
                              setModalState({ index: idx, mode: "view" })
                            }
                          >
                            Xem ảnh
                          </button>
                          {canReview ? (
                            <button
                              className="tbl-btn tbl-btn--review"
                              onClick={() =>
                                setModalState({ index: idx, mode: "review" })
                              }
                            >
                              Duyệt tay
                            </button>
                          ) : (
                            <span className="tbl-btn tbl-btn--review is-disabled">
                              Chỉ xem
                            </span>
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

      {hasComputedResults && !isTrustVote && (
        <ResultAssistant
          summary={{
            totalVotes,
            totalValid,
            totalInvalid,
            candidates: candidatesForAssistant,
          }}
        />
      )}

      {reportModalOpen && summary && (
        <div className="report-modal-backdrop" role="dialog" aria-modal="true">
          <div className="report-modal">
            <div className="report-modal-header">
              <div>
                <h2>Xuất biên bản kiểm phiếu</h2>
                <p>
                  Chọn mẫu, nhập thông tin bổ sung, xem trước rồi tải file TXT.
                </p>
              </div>
              <button
                className="report-modal-close"
                onClick={() => setReportModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="report-modal-grid">
              <div className="report-form-panel">
                <label className="report-field">
                  <span>Mẫu biên bản</span>
                  <select
                    value={reportTemplateId}
                    onChange={(e) => {
                      setReportTemplateId(e.target.value as ReportTemplateId);
                      setReportPreview("");
                    }}
                  >
                    <option value="default">Mẫu mặc định</option>
                    <option value="ward_household">
                      Mẫu thôn / tổ dân phố
                    </option>
                    <option value="company_2019">Mẫu đại hội / công ty</option>
                    <option value="custom">Tự custom</option>
                  </select>
                </label>

                <div className="report-field-row">
                  <label className="report-field">
                    <span>Đơn vị tổ chức</span>
                    <input
                      value={
                        reportFields.electionUnit ??
                        (summary as any).electionUnit ??
                        ""
                      }
                      onChange={(e) =>
                        updateReportField("electionUnit", e.target.value)
                      }
                      placeholder="Ví dụ: UBND phường A / Công ty CP ABC"
                    />
                  </label>

                  <label className="report-field">
                    <span>Địa điểm diễn ra</span>
                    <input
                      value={
                        reportFields.location ?? (summary as any).location ?? ""
                      }
                      onChange={(e) =>
                        updateReportField("location", e.target.value)
                      }
                      placeholder="Ví dụ: Hội trường tầng 2"
                    />
                  </label>
                </div>

                {reportTemplateId === "default" && (
                  <>
                    <div className="report-field-row">
                      <label className="report-field">
                        <span>Ngày lập biên bản</span>
                        <input
                          value={reportFields.reportDate || ""}
                          onChange={(e) =>
                            updateReportField("reportDate", e.target.value)
                          }
                          placeholder="Ví dụ: 02/05/2026"
                        />
                      </label>
                      <label className="report-field">
                        <span>Người lập biên bản</span>
                        <input
                          value={reportFields.reportCreator || ""}
                          onChange={(e) =>
                            updateReportField("reportCreator", e.target.value)
                          }
                          placeholder="Họ tên người lập"
                        />
                      </label>
                    </div>
                    <label className="report-field">
                      <span>Ghi chú</span>
                      <textarea
                        value={reportFields.notes || ""}
                        onChange={(e) =>
                          updateReportField("notes", e.target.value)
                        }
                        placeholder="Ghi chú thêm nếu có"
                      />
                    </label>
                  </>
                )}

                {reportTemplateId === "ward_household" && (
                  <>
                    <div className="report-field-row">
                      <label className="report-field">
                        <span>Xã / phường</span>
                        <input
                          value={reportFields.ward || ""}
                          onChange={(e) =>
                            updateReportField("ward", e.target.value)
                          }
                        />
                      </label>
                      <label className="report-field">
                        <span>Thôn / tổ dân phố</span>
                        <input
                          value={reportFields.hamlet || ""}
                          onChange={(e) =>
                            updateReportField("hamlet", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="report-field-row">
                      <label className="report-field">
                        <span>Thời gian họp</span>
                        <input
                          value={reportFields.meetingTime || ""}
                          onChange={(e) =>
                            updateReportField("meetingTime", e.target.value)
                          }
                          placeholder="Ví dụ: 08 giờ 00 phút"
                        />
                      </label>
                      <label className="report-field">
                        <span>Nội dung / về việc</span>
                        <input
                          value={reportFields.purpose || ""}
                          onChange={(e) =>
                            updateReportField("purpose", e.target.value)
                          }
                          placeholder="Ví dụ: bầu trưởng thôn"
                        />
                      </label>
                    </div>
                    <div className="report-field-row report-field-row--third">
                      <label className="report-field">
                        <span>Ngày</span>
                        <input
                          value={reportFields.day || ""}
                          onChange={(e) =>
                            updateReportField("day", e.target.value)
                          }
                        />
                      </label>
                      <label className="report-field">
                        <span>Tháng</span>
                        <input
                          value={reportFields.month || ""}
                          onChange={(e) =>
                            updateReportField("month", e.target.value)
                          }
                        />
                      </label>
                      <label className="report-field">
                        <span>Năm</span>
                        <input
                          value={reportFields.year || ""}
                          onChange={(e) =>
                            updateReportField("year", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <label className="report-field">
                      <span>Tổ trưởng ban kiểm phiếu</span>
                      <input
                        value={reportFields.teamLeader || ""}
                        onChange={(e) =>
                          updateReportField("teamLeader", e.target.value)
                        }
                      />
                    </label>
                    <label className="report-field">
                      <span>Thành viên ban kiểm phiếu</span>
                      <textarea
                        value={reportFields.members || ""}
                        onChange={(e) =>
                          updateReportField("members", e.target.value)
                        }
                        placeholder="Ví dụ: Ông/Bà A; Ông/Bà B; Ông/Bà C"
                      />
                    </label>
                  </>
                )}

                {reportTemplateId === "company_2019" && (
                  <>
                    <label className="report-field">
                      <span>Tên công ty / đơn vị</span>
                      <input
                        value={reportFields.companyName || ""}
                        onChange={(e) =>
                          updateReportField("companyName", e.target.value)
                        }
                        placeholder="Ví dụ: Công ty CP VLXD & XNK Hồng Hà"
                      />
                    </label>
                    <label className="report-field">
                      <span>Tên đại hội / hội nghị</span>
                      <input
                        value={reportFields.congressName || ""}
                        onChange={(e) =>
                          updateReportField("congressName", e.target.value)
                        }
                        placeholder="Ví dụ: ĐẠI HỘI ĐỒNG CỔ ĐÔNG THƯỜNG NIÊN NĂM 2026"
                      />
                    </label>
                    <label className="report-field">
                      <span>Căn cứ pháp lý</span>
                      <textarea
                        value={reportFields.legalBases || ""}
                        onChange={(e) =>
                          updateReportField("legalBases", e.target.value)
                        }
                        placeholder="- Căn cứ Luật Doanh nghiệp; ..."
                      />
                    </label>
                    <label className="report-field">
                      <span>Ban kiểm phiếu</span>
                      <textarea
                        value={reportFields.voteCountingBoard || ""}
                        onChange={(e) =>
                          updateReportField("voteCountingBoard", e.target.value)
                        }
                        placeholder="Bà/Ông ... - Trưởng ban"
                      />
                    </label>
                    <label className="report-field">
                      <span>Trưởng ban kiểm phiếu</span>
                      <input
                        value={reportFields.chiefName || ""}
                        onChange={(e) =>
                          updateReportField("chiefName", e.target.value)
                        }
                      />
                    </label>
                  </>
                )}

                {reportTemplateId === "custom" && (
                  <label className="report-field">
                    <span>Template custom</span>
                    <textarea
                      className="custom-template-textarea"
                      value={customTemplate}
                      onChange={(e) => setCustomTemplate(e.target.value)}
                    />
                    <small>
                      Có thể dùng: {"{{sessionName}}"}, {"{{electionUnit}}"},{" "}
                      {"{{location}}"}, {"{{totalBallots}}"},
                      {" {{validBallots}}"}, {"{{invalidBallots}}"},{" "}
                      {"{{failedBallots}}"}, {"{{candidateResults}}"}.
                    </small>
                  </label>
                )}

                {reportError && (
                  <div className="report-error">{reportError}</div>
                )}

                <div className="report-actions">
                  <button
                    className="btn-secondary-report"
                    onClick={handlePreviewReport}
                    disabled={reportLoading}
                  >
                    {reportLoading ? "Đang xử lý…" : "Xem trước"}
                  </button>
                  <button
                    className="btn-primary-report"
                    onClick={handleExportReport}
                    disabled={reportLoading}
                  >
                    Tải TXT
                  </button>
                </div>
              </div>

              <div className="report-preview-panel">
                <div className="report-preview-title">Xem trước nội dung</div>
                <pre>
                  {reportPreview ||
                    "Bấm “Xem trước” để kiểm tra nội dung biên bản trước khi tải file."}
                </pre>
              </div>
            </div>
          </div>
        </div>
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
