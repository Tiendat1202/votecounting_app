import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Sessions.css";
import { getSessions } from "../../api";

type Session = {
  id: string;
  name: string;
  type: string;
  candidates: string[];
  seats?: number;
  minWinPercent?: number;
  startAt?: string;
  endAt?: string;
};

type SessionStatus = "Chưa diễn ra" | "Đang diễn ra" | "Đã kết thúc" | "—";

function getSessionStatus(startAt?: string, endAt?: string): SessionStatus {
  if (!startAt || !endAt) return "—";
  const now = Date.now();
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return "—";
  if (now < s) return "Chưa diễn ra";
  if (now >= s && now <= e) return "Đang diễn ra";
  return "Đã kết thúc";
}

function statusToClass(status: SessionStatus) {
  switch (status) {
    case "Chưa diễn ra":
      return "chưa-bắt-đầu";
    case "Đang diễn ra":
      return "đang-diễn-ra";
    case "Đã kết thúc":
      return "đã-kết-thúc";
    default:
      return "";
  }
}

const Sessions: React.FC = () => {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data: Session[] = await getSessions();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Không tải được danh sách phiên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    let running = 0,
      finished = 0,
      upcoming = 0;
    for (const s of items) {
      const st = getSessionStatus(s.startAt, s.endAt);
      if (st === "Đang diễn ra") running++;
      else if (st === "Đã kết thúc") finished++;
      else if (st === "Chưa diễn ra") upcoming++;
    }
    return { total: items.length, running, finished, upcoming };
  }, [items]);

  return (
    <div className="sessions-container">
      <div className="header">
        <h1>Danh sách phiên kiểm phiếu</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/admin/create-session" className="create-btn">
            + Tạo phiên
          </Link>
          <button onClick={fetchData} className="create-btn" style={{ background: "#475569" }}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {err && (
        <div
          className="alert-error"
          role="alert"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#FEE2E2",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
          }}
        >
          {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Tổng số phiên</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.total}</div>
        </div>
        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Đang diễn ra</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.running}</div>
        </div>
        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Đã kết thúc</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.finished}</div>
        </div>
        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Chưa diễn ra</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.upcoming}</div>
        </div>
      </div>

      <table className="sessions-table" aria-label="Danh sách phiên">
        <thead>
          <tr>
            <th style={{ width: 56 }}>#</th>
            <th>Tên phiên</th>
            <th>Loại</th>
            <th>Ứng viên</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th>Trạng thái</th>
            <th style={{ width: 220 }}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {!loading && items.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 20, color: "var(--muted)" }}>
                Chưa có phiên nào.
              </td>
            </tr>
          ) : (
            items.map((s, idx) => {
              const status = getSessionStatus(s.startAt, s.endAt);
              const badgeClass = statusToClass(status);
              const finished = status === "Đã kết thúc";
              return (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td style={{ textAlign: "left" }}>{s.name}</td>
                  <td>{s.type}</td>
                  <td>{s.candidates?.length ?? 0}</td>
                  <td>{s.startAt ? new Date(s.startAt).toLocaleString("vi-VN") : "—"}</td>
                  <td>{s.endAt ? new Date(s.endAt).toLocaleString("vi-VN") : "—"}</td>
                  <td>
                    <span className={`status-badge ${badgeClass}`}>{status}</span>
                  </td>
                  <td>
                    {finished ? (
                      <Link className="view-btn" to={`/admin/results/${s.id}`}>
                        Kết quả
                      </Link>
                    ) : (
                      <span className="view-btn is-disabled" title="Chỉ xem khi phiên đã kết thúc">
                        Kết quả
                      </span>
                    )}

                    {status === "Đang diễn ra" ? (
                      <Link className="view-btn" to={`/admin/upload/${s.id}`}>
                        Upload
                      </Link>
                    ) : (
                      <span className="view-btn is-disabled" title="Chỉ upload khi phiên đang diễn ra">
                        Upload
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Sessions;
