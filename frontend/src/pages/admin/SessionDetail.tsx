import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { closeSessionEarly, getSessionDetail, type SessionRecord } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./CreateSession.css";

type SessionStatus = "Chưa diễn ra" | "Đang diễn ra" | "Đã kết thúc" | "—";

function getSessionStatus(startAt?: string, endAt?: string): SessionStatus {
  if (!startAt || !endAt) return "—";

  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  if (now < start) return "Chưa diễn ra";
  if (now <= end) return "Đang diễn ra";
  return "Đã kết thúc";
}

const SessionDetail: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSessionDetail(id);
      setSession(data);
    } catch (e: any) {
      setError(e?.message || "Không tải được thông tin phiên");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const status = useMemo(
    () => getSessionStatus(session?.startAt, session?.endAt),
    [session]
  );

  const canManage = !!session?.permissions?.isOwner || user?.role === "admin";
  const canCloseEarly = !!canManage && status !== "Đã kết thúc";

  const handleCloseEarly = async () => {
    if (!session) return;

    if (!window.confirm(`Bạn có chắc muốn đóng sớm phiên "${session.name}"?`)) {
      return;
    }

    try {
      setBusy(true);
      const res = await closeSessionEarly(session.id);
      setSession(res.session || session);
      alert(res.message || "Đã đóng phiên sớm");
    } catch (e: any) {
      alert(e?.message || "Không thể đóng phiên sớm");
    } finally {
      setBusy(false);
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("vi-VN");
  };

  if (loading) {
    return (
      <div className="create-session-page">
        <div className="create-session-shell">
          <div className="card-surface form-section">
            Đang tải thông tin phiên...
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="create-session-page">
        <div className="create-session-shell">
          <div className="card-surface form-section">
            <div className="alert-error" role="alert">
              {error || "Không tìm thấy phiên"}
            </div>

            <div className="detail-action-grid detail-action-grid--single">
              <Link to="/admin/sessions" className="btn btn--subtle detail-action-btn">
                Quay lại danh sách phiên
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const permissionText = session.permissions?.isOwner
    ? "Bạn là chủ phiên."
    : `Bạn có quyền: ${
        [
          session.permissions?.canUpload ? "upload" : null,
          session.permissions?.canReview ? "review" : null,
          session.permissions?.canViewBallots ? "xem phiếu" : null,
        ]
          .filter(Boolean)
          .join(", ") || "chỉ xem kết quả tổng hợp"
      }`;

  return (
    <div className="create-session-page session-detail-page">
      <style>{`
        .session-detail-page {
          font-family: var(--font-sans);
        }

        .session-detail-page .detail-title {
          margin: 0;
          font-size: 2rem;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--text);
          font-weight: 800;
        }

        .session-detail-page .detail-subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 1rem;
          line-height: 1.5;
        }

        .session-detail-page .detail-status-pill {
          padding: 9px 14px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 800;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .session-detail-page .detail-content {
          display: grid;
          gap: 14px;
        }

        .session-detail-page .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .session-detail-page .detail-card {
          min-height: 78px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: #ffffff;
          display: grid;
          align-content: center;
          gap: 6px;
          box-sizing: border-box;
        }

        .session-detail-page .detail-card-label {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .session-detail-page .detail-card-value {
          color: var(--text);
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .session-detail-page .detail-card-note {
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 600;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .session-detail-page .detail-card-note--warning {
          color: #b45309;
          font-weight: 700;
        }

        .session-detail-page .detail-candidates {
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: #ffffff;
        }

        .session-detail-page .detail-candidates-title,
        .session-detail-page .detail-permission-title {
          margin: 0 0 10px;
          font-size: 1rem;
          font-weight: 800;
          color: var(--text);
        }

        .session-detail-page .detail-candidate-list {
          margin: 0;
          padding-left: 22px;
          display: grid;
          gap: 8px;
          color: var(--text);
          font-size: 0.98rem;
          line-height: 1.4;
        }

        .session-detail-page .detail-permission {
          padding: 16px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          background: #f8fafc;
        }

        .session-detail-page .detail-permission-text {
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .session-detail-page .detail-action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .session-detail-page .detail-action-grid--single {
          grid-template-columns: minmax(0, 1fr);
        }

        .session-detail-page .detail-action-btn {
          min-height: 54px;
          width: 100%;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 800;
          text-align: center;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }

        .session-detail-page .detail-action-primary {
          background: linear-gradient(135deg, #2563eb, #0f62fe);
          color: #ffffff;
          border-color: transparent;
        }

        .session-detail-page .detail-action-primary:hover {
          background: linear-gradient(135deg, #1d4ed8, #0050e6);
          color: #ffffff;
        }

        .session-detail-page .detail-action-danger {
          background: #fff5f5;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .session-detail-page .detail-action-danger:hover {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fca5a5;
        }

        @media (max-width: 980px) {
          .session-detail-page .detail-grid,
          .session-detail-page .detail-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .session-detail-page .detail-title {
            font-size: 1.55rem;
          }

          .session-detail-page .section-heading {
            align-items: flex-start;
          }

          .session-detail-page .detail-grid,
          .session-detail-page .detail-action-grid {
            grid-template-columns: 1fr;
          }

          .session-detail-page .detail-action-btn {
            min-height: 50px;
          }
        }
      `}</style>

      <div className="create-session-shell">
        <section className="card-surface form-section">
          <div className="section-heading">
            <div>
              <h1 className="detail-title">Thông tin phiên kiểm phiếu</h1>
              <p className="detail-subtitle">
                Xem lại thông tin phiên, quy tắc kiểm phiếu và đóng phiên sớm khi cần.
              </p>
            </div>

            <span className="detail-status-pill">{status}</span>
          </div>

          <div className="detail-content">
            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-card-label">Tên phiên</span>
                <strong className="detail-card-value">{session.name}</strong>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Loại phiếu</span>
                <strong className="detail-card-value">
                  {session.type === "tin-nhiem" ? "Phiếu tín nhiệm" : "Phiếu có số dư"}
                </strong>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Trạng thái</span>
                <strong className="detail-card-value">{status}</strong>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Người tạo phiên</span>
                <strong className="detail-card-value">{session.createdByName || "—"}</strong>
                {session.createdByEmail && (
                  <span className="detail-card-note">{session.createdByEmail}</span>
                )}
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-card-label">Mở phiên</span>
                <strong className="detail-card-value">{formatDateTime(session.startAt)}</strong>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Đóng phiên</span>
                <strong className="detail-card-value">{formatDateTime(session.endAt)}</strong>

                {session.closedEarlyAt && (
                  <span className="detail-card-note detail-card-note--warning">
                    Đã đóng sớm lúc {formatDateTime(session.closedEarlyAt)}
                  </span>
                )}
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Số lượng cần bầu</span>
                <strong className="detail-card-value">{session.seatsToElect ?? "—"}</strong>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">% tối thiểu để trúng cử</span>
                <strong className="detail-card-value">
                  {session.minWinningPercent ?? "—"}%
                </strong>
              </div>
            </div>

            <div className="detail-candidates">
              <h2 className="detail-candidates-title">
                Danh sách ứng viên ({session.candidates?.length || 0})
              </h2>

              <ol className="detail-candidate-list">
                {(session.candidates || []).map((candidate, index) => (
                  <li key={`${candidate}-${index}`}>{candidate}</li>
                ))}
              </ol>
            </div>

            {session.permissions && (
              <div className="detail-permission">
                <h2 className="detail-permission-title">Quyền của bạn trong phiên này</h2>
                <div className="detail-permission-text">{permissionText}</div>
              </div>
            )}
          </div>

          <div className="detail-action-grid">
            <Link to="/admin/sessions" className="btn btn--subtle detail-action-btn">
              Quay lại danh sách phiên
            </Link>

            <button
              type="button"
              className="btn detail-action-btn detail-action-primary"
              onClick={() => nav(`/admin/results/${session.id}`)}
            >
              Xem kết quả
            </button>

            {status === "Đang diễn ra" && session.permissions?.canUpload && (
              <button
                type="button"
                className="btn btn--subtle detail-action-btn"
                onClick={() => nav(`/admin/upload/${session.id}`)}
              >
                Đi tới upload phiếu
              </button>
            )}

            {canCloseEarly && (
              <button
                type="button"
                className="btn detail-action-btn detail-action-danger"
                onClick={handleCloseEarly}
                disabled={busy}
              >
                {busy ? "Đang đóng phiên..." : "Đóng phiên sớm"}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SessionDetail;