import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useVoteSessions } from "../../context/VoteSessionContext";
import "./Sessions.css";

type SessionStatus = "Chưa bắt đầu" | "Đang diễn ra" | "Đã kết thúc" | "—";

function getSessionStatus(startAt?: string, endAt?: string): SessionStatus {
  if (!startAt || !endAt) return "—"; // thiếu dữ liệu thời gian
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  if (now < start) return "Chưa bắt đầu";
  if (now >= start && now <= end) return "Đang diễn ra";
  return "Đã kết thúc";
}

function formatDT(dt?: string) {
  if (!dt) return "—";
  const t = new Date(dt);
  if (isNaN(t.getTime())) return "—";
  return t.toLocaleString("vi-VN");
}

const Sessions: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { sessions, removeSession, getSessionById } = useVoteSessions();

  // ========== CHI TIẾT PHIÊN ==========
  if (id) {
    const session = getSessionById(id);

    if (!session) {
      return (
        <div className="background-rd-container">
          <div className="result-details-container" role="alert">
            <h2>Phiên không tồn tại</h2>
            <p>Không tìm thấy dữ liệu cho phiên đã yêu cầu.</p>
            <button className="back-btn" onClick={() => navigate("/sessions")}>
              Quay lại danh sách
            </button>
          </div>
        </div>
      );
    }

    const loaiPhieu = session.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư";

    return (
      <div className="background-rd-container">
        <article className="result-details-container" aria-labelledby="session-title">
          <h1 id="session-title">Chi tiết phiên: {session.name}</h1>

          <p><strong>Loại phiếu:</strong> {loaiPhieu}</p>
          <p>
            <strong>Mở:</strong> {formatDT(session.startAt)} &nbsp;|&nbsp;{" "}
            <strong>Đóng:</strong> {formatDT(session.endAt)}
          </p>
          <p>
            <strong>Trạng thái:</strong>{" "}
            <span
              className={`status-badge ${getSessionStatus(session.startAt, session.endAt)
                .replaceAll(" ", "-")
                .toLowerCase()}`}
            >
              {getSessionStatus(session.startAt, session.endAt)}
            </span>
          </p>

          <h3>Danh sách ứng viên</h3>
          {session.candidates.length === 0 ? (
            <p>Không có ứng viên.</p>
          ) : (
            <ul className="candidate-list" aria-label="Danh sách ứng viên">
              {session.candidates
                .slice()
                .sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))
                .map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
            </ul>
          )}

          <button className="back-btn" onClick={() => navigate("/sessions")}>
            Quay lại danh sách
          </button>
        </article>
      </div>
    );
  }

  // ========== DANH SÁCH PHIÊN ==========

  // 🔽 Sắp xếp danh sách phiên
  const sortedSessions = sessions
    .slice()
    .sort((a, b) => {
      const startA = new Date(a.startAt ?? "").getTime();
      const startB = new Date(b.startAt ?? "").getTime();
      // Ưu tiên trạng thái: Đang diễn ra > Chưa bắt đầu > Đã kết thúc
      const statusOrder = { "Đang diễn ra": 1, "Chưa bắt đầu": 2, "Đã kết thúc": 3, "—": 4 };
      const statusA = getSessionStatus(a.startAt, a.endAt);
      const statusB = getSessionStatus(b.startAt, b.endAt);
      if (statusA !== statusB) return statusOrder[statusA] - statusOrder[statusB];
      return startA - startB;
    });

  return (
    <div className="sessions-container">
      <div className="header">
        <h1>Danh sách các phiên kiểm phiếu</h1>
        <Link to="/admin/create" className="create-btn">
          Tạo phiên mới
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p>Chưa có phiên nào được tạo.</p>
      ) : (
        <table className="sessions-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tên phiên</th>
              <th>Loại phiếu</th>
              <th>Mở</th>
              <th>Đóng</th>
              <th>Trạng thái</th>
              <th>Số ứng viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.map((session, index) => {
              const status = getSessionStatus(session.startAt, session.endAt);
              const canView = status === "Đã kết thúc";
              return (
                <tr key={session.id}>
                  <td>{index + 1}</td>
                  <td>{session.name}</td>
                  <td>
                    {session.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư"}
                  </td>
                  <td>{formatDT(session.startAt)}</td>
                  <td>{formatDT(session.endAt)}</td>
                  <td>
                    <span
                      className={`status-badge ${status
                        .replaceAll(" ", "-")
                        .toLowerCase()}`}
                      title={status}
                    >
                      {status}
                    </span>
                  </td>
                  <td>{session.candidates.length}</td>
                  <td>
                    <Link
                      to={`/results/${session.id}`}
                      className={`view-btn ${canView ? "" : "is-disabled"}`}
                      aria-disabled={!canView}
                      title={
                        canView
                          ? "Xem kết quả"
                          : "Kết thúc phiên để xem kết quả"
                      }
                      onClick={(e) => {
                        if (!canView) e.preventDefault();
                      }}
                    >
                      Xem
                    </Link>
                    <button
                      onClick={() => removeSession(session.id)}
                      className="delete-btn"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Sessions;
