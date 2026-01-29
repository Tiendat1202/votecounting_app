import React, { useState, useEffect } from "react";
import axios from "axios";
import "./VoteResults.css";

interface Vote {
  id: string;
  ballotId: string;
  ballotType: "trust" | "surplus";
  selectedCandidate: string | null;
  confidenceScore: number;
  status: "pending" | "valid" | "invalid" | "duplicate";
  validationNotes?: string;
  createdAt: string;
}

interface VoteStats {
  total: number;
  pending: number;
  valid: number;
  invalid: number;
  duplicate: number;
  byCandidate: Array<{ name: string; count: number }>;
  byBallotType: {
    trust: number;
    surplus: number;
  };
}

interface VoteResultsProps {
  sessionId: string;
}

export const VoteResults: React.FC<VoteResultsProps> = ({ sessionId }) => {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    ballotType: "",
    candidateName: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Reload mỗi 5 giây
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [sessionId, filters, page]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("Loading votes for session:", sessionId);

      // Load votes
      const votesRes = await axios.get(
        `http://localhost:5050/api/votes/session/${sessionId}`,
        {
          params: {
            status: filters.status || undefined,
            ballotType: filters.ballotType || undefined,
            candidateName: filters.candidateName || undefined,
            page,
            limit: 20,
          },
          withCredentials: true,
        }
      );
      console.log("Votes loaded:", votesRes.data);
      setVotes(votesRes.data.votes || []);
      setTotal(votesRes.data.total || 0);

      // Load stats
      const statsRes = await axios.get(
        `http://localhost:5050/api/votes/stats/${sessionId}`,
        { withCredentials: true }
      );
      console.log("Stats loaded:", statsRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      console.error("Lỗi tải dữ liệu:", error);
      console.error("Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      // Set default stats if error
      setStats({
        total: 0,
        pending: 0,
        valid: 0,
        invalid: 0,
        duplicate: 0,
        byCandidate: [],
        byBallotType: { trust: 0, surplus: 0 },
      });
      setVotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (voteId: string, isValid: boolean) => {
    try {
      setValidatingId(voteId);
      await axios.put(
        `http://localhost:5050/api/votes/${voteId}/validate`,
        { isValid, notes: isValid ? "Xác nhận hợp lệ" : "Xác nhận không hợp lệ" },
        { withCredentials: true }
      );
      loadData();
    } catch (error) {
      console.error("Lỗi xác nhận phiếu:", error);
    } finally {
      setValidatingId(null);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPage(1); // Reset about page when filter changes
  };

  if (!stats) {
    return <div className="vote-results loading">Đang tải dữ liệu...</div>;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="vote-results">
      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Tổng phiếu</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Chờ xác nhận</div>
        </div>
        <div className="stat-card valid">
          <div className="stat-value">{stats.valid}</div>
          <div className="stat-label">Hợp lệ</div>
        </div>
        <div className="stat-card invalid">
          <div className="stat-value">{stats.invalid}</div>
          <div className="stat-label">Không hợp lệ</div>
        </div>
      </div>

      {/* Candidate Breakdown */}
      {stats.byCandidate.length > 0 && (
        <div className="candidate-breakdown">
          <h3>Kết quả theo ứng cử viên</h3>
          <div className="candidate-table">
            {stats.byCandidate.map((candidate) => (
              <div key={candidate.name} className="candidate-row">
                <div className="candidate-name">{candidate.name}</div>
                <div className="candidate-votes">{candidate.count} phiếu</div>
                <div className="candidate-percentage">
                  {((candidate.count / stats.total) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          name="candidateName"
          placeholder="Tìm ứng cử viên..."
          value={filters.candidateName}
          onChange={handleFilterChange}
          className="filter-input"
        />
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ xác nhận</option>
          <option value="valid">Hợp lệ</option>
          <option value="invalid">Không hợp lệ</option>
        </select>
        <select
          name="ballotType"
          value={filters.ballotType}
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="">Tất cả loại phiếu</option>
          <option value="trust">Tin tưởng</option>
          <option value="surplus">Thừa</option>
        </select>
      </div>

      {/* Votes Table */}
      <div className="votes-table-container">
        <table className="votes-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Loại</th>
              <th>Ứng cử viên</th>
              <th>Độ tin cậy</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((vote) => (
              <tr key={vote.id} className={`vote-row status-${vote.status}`}>
                <td className="ballot-id">{vote.ballotId}</td>
                <td className="ballot-type">
                  {vote.ballotType === "trust" ? "Tin tưởng" : "Thừa"}
                </td>
                <td className="candidate">
                  {vote.selectedCandidate || "—"}
                </td>
                <td className="confidence">
                  {(vote.confidenceScore * 100).toFixed(0)}%
                </td>
                <td className="status">
                  <span className={`badge badge-${vote.status}`}>
                    {vote.status === "pending" && "Chờ xác nhận"}
                    {vote.status === "valid" && "✓ Hợp lệ"}
                    {vote.status === "invalid" && "✗ Không hợp lệ"}
                    {vote.status === "duplicate" && "Trùng lặp"}
                  </span>
                </td>
                <td className="actions">
                  {vote.status === "pending" && (
                    <>
                      <button
                        className="btn-validate btn-valid"
                        onClick={() => handleValidate(vote.id, true)}
                        disabled={validatingId === vote.id}
                        title="Xác nhận hợp lệ"
                      >
                        ✓
                      </button>
                      <button
                        className="btn-validate btn-invalid"
                        onClick={() => handleValidate(vote.id, false)}
                        disabled={validatingId === vote.id}
                        title="Xác nhận không hợp lệ"
                      >
                        ✗
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="pagination-btn"
          >
            ← Trước
          </button>
          <span className="page-info">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="pagination-btn"
          >
            Tiếp →
          </button>
        </div>
      )}

      {loading && <div className="loading-overlay">Đang tải...</div>}
    </div>
  );
};

export default VoteResults;
