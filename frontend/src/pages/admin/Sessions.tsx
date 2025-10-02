import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useVoteSessions } from "../../context/VoteSessionContext";
import "./Sessions.css";

const Sessions: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { sessions, removeSession, getSessionById } = useVoteSessions();

  // Nếu có id trên URL => hiển thị Chi tiết phiên (được gộp từ ResultDetails.tsx)
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
        <article
          className="result-details-container"
          aria-labelledby="session-title"
        >
          <h1 id="session-title">Chi tiết phiên: {session.name}</h1>

          <p>
            <strong>Loại phiếu:</strong> {loaiPhieu}
          </p>

          <h3>Danh sách ứng viên</h3>
          {session.candidates.length === 0 ? (
            <p>Không có ứng viên.</p>
          ) : (
            <ul className="candidate-list" aria-label="Danh sách ứng viên">
              {session.candidates
                .slice()
                .sort((a, b) =>
                  a.localeCompare(b, "vi", { sensitivity: "base" })
                )
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

  // Ngược lại: hiển thị Danh sách phiên (giống file Sessions.tsx cũ)
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
              <th>Số ứng viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, index) => (
              <tr key={session.id}>
                <td>{index + 1}</td>
                <td>{session.name}</td>
                <td>{session.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư"}</td>
                <td>{session.candidates.length}</td>
                <td>
                  {/* Giữ nguyên đường dẫn /results/:id để không phá cấu trúc cũ */}
                  <Link to={`/results/${session.id}`} className="view-btn">
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Sessions;
