// src/pages/admin/Dashboard.tsx
import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { getSessions } from "../../api";

type Session = {
  id: string;
  name: string;
  type: string;
  candidates: { id?: string; name: string }[] | string[];
  startAt?: string;
  endAt?: string;
};

type UploadCount = { sessionId: string; count: number };

const COLORS = {
  running: "#0F62FE",   // xanh: đang diễn ra
  finished: "#94A3B8",  // xám: đã diễn ra
  upcoming: "#F59E0B",  // vàng: chưa diễn ra
};

/* ==== Helpers: đếm ảnh đã upload từ phía client (giữ tương thích) ==== */
// 1) localStorage (các bản cũ)
function readLocalUploadCounts(): UploadCount[] {
  const out: UploadCount[] = [];
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("vc_images_")) {
      const sessionId = key.replace("vc_images_", "");
      try {
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        out.push({ sessionId, count: Array.isArray(arr) ? arr.length : 0 });
      } catch {
        out.push({ sessionId, count: 0 });
      }
    }
  });
  return out;
}

// 2) IndexedDB (bản mới)
async function readIndexedDBUploadCounts(): Promise<UploadCount[]> {
  const DB_NAME = "vc_images_db";
  const STORE = "images";
  if (!("indexedDB" in window)) return [];

  try {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const counts: Record<string, number> = {};
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = (e: any) => {
        const cursor: IDBCursorWithValue | null = e.target.result;
        if (cursor) {
          const value = cursor.value as { sessionId: string; id: string };
          counts[value.sessionId] = (counts[value.sessionId] || 0) + 1;
          cursor.continue();
        } else resolve();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    return Object.entries(counts).map(([sessionId, count]) => ({
      sessionId,
      count,
    }));
  } catch {
    return [];
  }
}

function isRunning(s?: string, e?: string) {
  if (!s || !e) return false;
  const now = Date.now();
  const ss = new Date(s).getTime();
  const ee = new Date(e).getTime();
  return !Number.isNaN(ss) && !Number.isNaN(ee) && now >= ss && now <= ee;
}
function isFinished(e?: string) {
  if (!e) return false;
  const ee = new Date(e).getTime();
  return !Number.isNaN(ee) && Date.now() > ee;
}
function isUpcoming(s?: string) {
  if (!s) return false;
  const ss = new Date(s).getTime();
  return !Number.isNaN(ss) && Date.now() < ss;
}

const Dashboard: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [uploads, setUploads] = useState<UploadCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Lấy phiên từ backend
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = (await getSessions()) as Session[];
        setSessions(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Không tải được danh sách phiên.");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Gom số ảnh đã upload từ localStorage + IndexedDB (client-side)
  useEffect(() => {
    (async () => {
      const ls = readLocalUploadCounts();
      const idb = await readIndexedDBUploadCounts();
      const map = new Map<string, number>();
      ls.forEach((u) => map.set(u.sessionId, u.count));
      idb.forEach((u) => map.set(u.sessionId, u.count));
      setUploads(
        Array.from(map.entries()).map(([sessionId, count]) => ({
          sessionId,
          count,
        }))
      );
    })();
  }, []);

  const totalSessions = sessions.length;
  const running = sessions.filter((s) => isRunning(s.startAt, s.endAt));
  const finished = sessions.filter((s) => isFinished(s.endAt));
  const upcoming = sessions.filter((s) => isUpcoming(s.startAt));

  // Pie: trạng thái các phiên
  const pieData = [
    { name: "Đang diễn ra", value: running.length, color: COLORS.running },
    { name: "Đã diễn ra", value: finished.length, color: COLORS.finished },
    { name: "Chưa diễn ra", value: upcoming.length, color: COLORS.upcoming },
  ];

  // Bar: số ứng viên mỗi phiên
  const barData = sessions.map((s) => {
    const names = Array.isArray(s.candidates)
      ? (s.candidates as any[]).map((c: any) => (typeof c === "string" ? c : c?.name)).filter(Boolean)
      : [];
    const short = s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name;
    return { name: short, candidates: names.length };
  });
  const avgCandidates =
    sessions.length > 0
      ? (
          sessions.reduce((sum, s) => {
            const names = Array.isArray(s.candidates)
              ? (s.candidates as any[]).map((c: any) => (typeof c === "string" ? c : c?.name)).filter(Boolean)
              : [];
            return sum + names.length;
          }, 0) / sessions.length
        ).toFixed(1)
      : 0;

  // Line: tổng phiếu upload theo thời gian (dựa mốc startAt của phiên)
  const lineData = uploads.map((u) => {
    const s = sessions.find((x) => x.id === u.sessionId);
    const date = s?.startAt ? new Date(s.startAt) : new Date();
    const dayLabel = date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
    return { date: dayLabel, uploads: u.count };
  });

  const totalUploads = uploads.reduce((sum, u) => sum + u.count, 0);

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">📊 Tổng quan kiểm phiếu</h1>

      {err && (
        <div
          className="alert-error"
          role="alert"
          style={{
            marginBottom: 16,
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

      {/* Thống kê tổng quan */}
      <section className="stats-overview">
        <div className="stat-card">
          <h3>Tổng số phiên</h3>
          <p>{loading ? "…" : totalSessions}</p>
        </div>
        <div className="stat-card">
          <h3>Đang diễn ra</h3>
          <p>{loading ? "…" : running.length}</p>
        </div>
        <div className="stat-card">
          <h3>Đã diễn ra</h3>
          <p>{loading ? "…" : finished.length}</p>
        </div>
        <div className="stat-card">
          <h3>Chưa diễn ra</h3>
          <p>{loading ? "…" : upcoming.length}</p>
        </div>
        <div className="stat-card">
          <h3>Phiếu đã upload</h3>
          <p>{totalUploads}</p>
        </div>
      </section>

      {/* Biểu đồ */}
      <section className="charts-grid">
        {/* PieChart */}
        <div className="chart-card">
          <h3>Trạng thái các phiên</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={50}
                labelLine={false}
                label={(props) =>
                  typeof (props as any).percent === "number" &&
                  (props as any).percent > 0
                    ? `${(((props as any).percent as number) * 100).toFixed(0)}%`
                    : ""
                }
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value: any, name: any) => {
                  const total = pieData.reduce((sum, d) => sum + d.value, 0);
                  const percent =
                    total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0";
                  return [`${value} phiên (${percent}%)`, name];
                }}
              />

              <Legend
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                formatter={(value: string) => (
                  <span style={{ color: "#0F172A", fontSize: "0.9rem" }}>
                    {value}
                  </span>
                )}
              />

              {/* Tổng số phiên giữa hình tròn */}
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  fill: "#0F172A",
                }}
              >
                {totalSessions}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* BarChart */}
        <div className="chart-card">
          <h3>Số lượng ứng viên mỗi phiên</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="candidates" fill={COLORS.running} />
            </BarChart>
          </ResponsiveContainer>
          <p className="chart-note">
            Trung bình <b>{avgCandidates}</b> ứng viên / phiên
          </p>
        </div>

        {/* LineChart */}
        <div className="chart-card">
          <h3>Tổng phiếu upload theo thời gian</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="uploads" stroke="#82ca9d" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
