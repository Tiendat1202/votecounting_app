import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAccessInbox, getSessions, requestSessionAccess, reviewAccessRequest, type SessionPermissions, type SessionRecord } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./Sessions.css";

type Session = SessionRecord & {
  permissions?: SessionPermissions;
};

type InboxItem = {
  id: string;
  sessionId: string;
  sessionName?: string;
  requesterEmail: string;
  requesterFullName?: string;
  actions: string[];
  status: "pending" | "approved" | "rejected";
  note?: string | null;
  createdAt: string;
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
    case "Chưa diễn ra": return "chưa-bắt-đầu";
    case "Đang diễn ra": return "đang-diễn-ra";
    case "Đã kết thúc": return "đã-kết-thúc";
    default: return "";
  }
}

const Sessions: React.FC = () => {
  const { role } = useAuth();
  const [items, setItems] = useState<Session[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "finished" | "upcoming">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "tin-nhiem" | "so-du">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "shared" | "with-upload">("all");

  const fetchData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [sessions, inboxItems] = await Promise.all([
        getSessions(),
        role ? getAccessInbox().catch(() => []) : Promise.resolve([]),
      ]);
      setItems(Array.isArray(sessions) ? sessions : []);
      setInbox(Array.isArray(inboxItems) ? inboxItems : []);
    } catch (e: any) {
      setErr(e?.message || "Không tải được danh sách phiên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [role]);

  const stats = useMemo(() => {
    let running = 0, finished = 0, upcoming = 0;
    for (const s of items) {
      const st = getSessionStatus(s.startAt, s.endAt);
      if (st === "Đang diễn ra") running++;
      else if (st === "Đã kết thúc") finished++;
      else if (st === "Chưa diễn ra") upcoming++;
    }
    return { total: items.length, running, finished, upcoming };
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((s) => {
      const status = getSessionStatus(s.startAt, s.endAt);
      const perms = s.permissions;
      const owner = s.createdByName || s.createdByEmail || "";
      const combined = [s.name, s.type, owner, ...(s.candidates || [])].join(" ").toLowerCase();

      if (keyword && !combined.includes(keyword)) return false;
      if (statusFilter === "running" && status !== "Đang diễn ra") return false;
      if (statusFilter === "finished" && status !== "Đã kết thúc") return false;
      if (statusFilter === "upcoming" && status !== "Chưa diễn ra") return false;
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (scopeFilter === "mine" && !perms?.isOwner) return false;
      if (scopeFilter === "shared" && (perms?.isOwner || !perms?.approvedActions?.length)) return false;
      if (scopeFilter === "with-upload" && !perms?.canUpload) return false;
      return true;
    });
  }, [items, search, statusFilter, typeFilter, scopeFilter]);

  const handleRequestAccess = async (sessionId: string) => {
    try {
      setRequestingId(sessionId);
      await requestSessionAccess(sessionId, ["upload", "review"], "Xin tham gia upload và duyệt kết quả cho phiên này.");
      alert("Đã gửi yêu cầu tới inspector tạo phiên.");
      await fetchData();
    } catch (e: any) {
      alert(e?.message || "Không gửi được yêu cầu truy cập");
    } finally {
      setRequestingId(null);
    }
  };

  const handleReview = async (requestId: string, status: "approved" | "rejected") => {
    try {
      await reviewAccessRequest(requestId, status);
      await fetchData();
    } catch (e: any) {
      alert(e?.message || "Không cập nhật được yêu cầu");
    }
  };

  return (
    <div className="sessions-container">
      <div className="header">
        <h1>Danh sách phiên kiểm phiếu</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {(role === "admin" || role === "inspector") && (
            <Link to="/admin/create-session" className="create-btn">+ Tạo phiên</Link>
          )}
          <button onClick={fetchData} className="create-btn" style={{ background: "#475569" }}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {err && <div className="alert-error" role="alert" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>{err}</div>}

      <div className="sessions-stats">
        <div className="sessions-stat-card"><div>Tổng số phiên</div><strong>{stats.total}</strong></div>
        <div className="sessions-stat-card"><div>Đang diễn ra</div><strong>{stats.running}</strong></div>
        <div className="sessions-stat-card"><div>Đã kết thúc</div><strong>{stats.finished}</strong></div>
        <div className="sessions-stat-card"><div>Chưa diễn ra</div><strong>{stats.upcoming}</strong></div>
      </div>

      <div className="sessions-filters">
        <input
          className="sessions-filter-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên phiên, người tạo, loại phiếu hoặc ứng viên"
        />
        <select className="sessions-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="running">Đang diễn ra</option>
          <option value="finished">Đã kết thúc</option>
          <option value="upcoming">Chưa diễn ra</option>
        </select>
        <select className="sessions-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">Tất cả loại phiếu</option>
          <option value="tin-nhiem">Phiếu tín nhiệm</option>
          <option value="so-du">Phiếu có số dư</option>
        </select>
        <select className="sessions-filter-select" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as any)}>
          <option value="all">Tất cả quyền truy cập</option>
          <option value="mine">Phiên do tôi tạo</option>
          <option value="shared">Phiên được cấp quyền</option>
          <option value="with-upload">Phiên tôi có thể upload</option>
        </select>
      </div>

      <table className="sessions-table" aria-label="Danh sách phiên">
        <thead>
          <tr>
            <th style={{ width: 56 }}>#</th>
            <th>Tên phiên</th>
            <th>Loại</th>
            <th>Chủ phiên</th>
            <th>Ứng viên</th>
            <th>Trạng thái</th>
            <th style={{ width: 340 }}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {!loading && filteredItems.length === 0 ? (
            <tr><td colSpan={7} style={{ padding: 20, color: "var(--muted)" }}>Không có phiên phù hợp với bộ lọc hiện tại.</td></tr>
          ) : filteredItems.map((s, idx) => {
            const status = getSessionStatus(s.startAt, s.endAt);
            const running = status === "Đang diễn ra";
            const perms = s.permissions;
            const canUpload = !!perms?.canUpload;
            const canReview = !!perms?.canReview;
            const isOwner = !!perms?.isOwner;
            const canRequest = role === "inspector" && !isOwner && !canUpload && !canReview;
            return (
              <tr key={s.id}>
                <td>{idx + 1}</td>
                <td style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {s.startAt ? new Date(s.startAt).toLocaleString("vi-VN") : "—"} → {s.endAt ? new Date(s.endAt).toLocaleString("vi-VN") : "—"}
                  </div>
                </td>
                <td>{s.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư"}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{s.createdByName || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.createdByEmail || ""}</div>
                </td>
                <td>{s.candidates?.length ?? 0}</td>
                <td><span className={`status-badge ${statusToClass(status)}`}>{status}</span></td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Link className="view-btn" to={`/admin/sessions/${s.id}`}>Chi tiết</Link>
                    <Link className="view-btn" to={`/admin/results/${s.id}`}>Kết quả</Link>
                    {running && canUpload ? (
                      <Link className="view-btn" to={`/admin/upload/${s.id}`}>Upload</Link>
                    ) : (
                      <span className="view-btn is-disabled" title={running ? "Bạn chưa có quyền upload" : "Chỉ upload khi phiên đang diễn ra"}>Upload</span>
                    )}
                    {canRequest && (
                      <button className="view-btn" style={{ border: "none", cursor: "pointer" }} disabled={requestingId === s.id} onClick={() => handleRequestAccess(s.id)}>
                        {requestingId === s.id ? "Đang gửi..." : "Yêu cầu quyền"}
                      </button>
                    )}
                  </div>
                  {perms && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                      {perms.isOwner ? "Bạn là chủ phiên" : `Quyền hiện có: ${[perms.canUpload ? "upload" : null, perms.canReview ? "review" : null, role === "supervisor" ? "xem" : null].filter(Boolean).join(", ") || "chỉ xem tổng hợp"}`}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(role === "admin" || role === "inspector") && inbox.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Yêu cầu tham gia phiên</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {inbox.map((item) => (
              <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.sessionName || item.sessionId}</div>
                    <div style={{ fontSize: 14, color: "#475569" }}>
                      {(item.requesterFullName || item.requesterEmail)} yêu cầu quyền: {item.actions.join(", ")}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{new Date(item.createdAt).toLocaleString("vi-VN")}</div>
                    {item.note && <div style={{ fontSize: 13, color: "#334155", marginTop: 8 }}>{item.note}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`status-badge ${item.status === "approved" ? "đang-diễn-ra" : item.status === "rejected" ? "đã-kết-thúc" : "chưa-bắt-đầu"}`}>{item.status}</span>
                    {item.status === "pending" && (
                      <>
                        <button className="view-btn" style={{ border: "none", cursor: "pointer", background: "#16a34a" }} onClick={() => handleReview(item.id, "approved")}>Duyệt</button>
                        <button className="view-btn" style={{ border: "none", cursor: "pointer", background: "#dc2626" }} onClick={() => handleReview(item.id, "rejected")}>Từ chối</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Sessions;
