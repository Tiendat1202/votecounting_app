import React, { useEffect, useState } from "react";
import { useVoteSessions } from "../../context/VoteSessionContext";
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

type UploadCount = { sessionId: string; count: number };

const COLORS = {
  running: "#0F62FE",   // xanh: đang diễn ra
  finished: "#94A3B8",  // xám: đã diễn ra
  upcoming: "#F59E0B",  // vàng: chưa diễn ra
};

// —— Helpers: đọc số ảnh đã upload ——
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

const Dashboard: React.FC = () => {
  const { sessions } = useVoteSessions();
  const [uploads, setUploads] = useState<UploadCount[]>([]);

  useEffect(() => {
    (async () => {
      const ls = readLocalUploadCounts();
      const idb = await readIndexedDBUploadCounts();
      const map = new Map<string, number>();
      ls.forEach((u) => map.set(u.sessionId, u.count));
      idb.forEach((u) => map.set(u.sessionId, u.count));
      setUploads(Array.from(map.entries()).map(([sessionId, count]) => ({ sessionId, count })));
    })();
  }, []);

  const totalSessions = sessions.length;
  const now = Date.now();

  const running = sessions.filter(
    (s) =>
      s.startAt &&
      s.endAt &&
      new Date(s.startAt).getTime() <= now &&
      new Date(s.endAt).getTime() >= now
  );
  const finished = sessions.filter(
    (s) => s.endAt && new Date(s.endAt).getTime() < now
  );
  const upcoming = sessions.filter(
    (s) => s.startAt && new Date(s.startAt).getTime() > now
  );

  // Pie: trạng thái các phiên
  const pieData = [
    { name: "Đang diễn ra", value: running.length, color: COLORS.running },
    { name: "Đã diễn ra", value: finished.length, color: COLORS.finished },
    { name: "Chưa diễn ra", value: upcoming.length, color: COLORS.upcoming },
  ];

  // Bar: số ứng viên mỗi phiên
  const barData = sessions.map((s) => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
    candidates: s.candidates.length,
  }));
  const avgCandidates =
    sessions.length > 0
      ? (
          sessions.reduce((sum, s) => sum + s.candidates.length, 0) /
          sessions.length
        ).toFixed(1)
      : 0;

  // Line: tổng phiếu upload theo thời gian
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

      {/* Thống kê tổng quan */}
      <section className="stats-overview">
        <div className="stat-card">
          <h3>Tổng số phiên</h3>
          <p>{totalSessions}</p>
        </div>
        <div className="stat-card">
          <h3>Đang diễn ra</h3>
          <p>{running.length}</p>
        </div>
        <div className="stat-card">
          <h3>Đã diễn ra</h3>
          <p>{finished.length}</p>
        </div>
        <div className="stat-card">
          <h3>Chưa diễn ra</h3>
          <p>{upcoming.length}</p>
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
                // ✅ Fix lỗi TypeScript: check typeof percent
                label={(props) =>
                  typeof props.percent === "number" && props.percent > 0
                    ? `${(props.percent * 100).toFixed(0)}%`
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
            <BarChart
              data={barData}
              margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
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
            <LineChart
              data={lineData}
              margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="uploads"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
