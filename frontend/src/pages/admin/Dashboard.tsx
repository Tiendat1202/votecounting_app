import React, { useEffect, useMemo, useState } from "react";
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

const COLORS = {
  running: "#0F62FE",
  finished: "#94A3B8",
  upcoming: "#F59E0B",
  trust: "#2563EB",
  surplus: "#10B981",
};

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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  const totalSessions = sessions.length;
  const running = sessions.filter((s) => isRunning(s.startAt, s.endAt));
  const finished = sessions.filter((s) => isFinished(s.endAt));
  const upcoming = sessions.filter((s) => isUpcoming(s.startAt));

  const pieData = [
    { name: "Đang diễn ra", value: running.length, color: COLORS.running },
    { name: "Đã diễn ra", value: finished.length, color: COLORS.finished },
    { name: "Chưa diễn ra", value: upcoming.length, color: COLORS.upcoming },
  ];

  const barData = sessions.map((s) => {
    const names = Array.isArray(s.candidates)
      ? (s.candidates as any[]).map((c: any) => (typeof c === "string" ? c : c?.name)).filter(Boolean)
      : [];
    const short = s.name.length > 14 ? `${s.name.slice(0, 14)}…` : s.name;
    return { name: short, candidates: names.length };
  });

  const typeData = [
    {
      name: "Phiếu tín nhiệm",
      value: sessions.filter((s) => s.type === "tin-nhiem").length,
      color: COLORS.trust,
    },
    {
      name: "Phiếu có số dư",
      value: sessions.filter((s) => s.type === "so-du").length,
      color: COLORS.surplus,
    },
  ];

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
      : "0";

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime())
        .slice(0, 5),
    [sessions]
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tổng quan kiểm phiếu</h1>
          <p className="dashboard-subtitle">
            Theo dõi nhanh tình trạng các phiên, cơ cấu loại phiếu và mức độ phân bổ ứng viên trong hệ thống.
          </p>
        </div>
      </div>

      {err && (
        <div className="alert-error" role="alert">
          {err}
        </div>
      )}

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
      </section>

      <section className="charts-grid">
        <div className="chart-card">
          <div className="chart-card__header">
            <h3>Trạng thái các phiên</h3>
            <span>{totalSessions} phiên</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={96}
                innerRadius={58}
                labelLine={false}
                label={(props) =>
                  typeof (props as any).percent === "number" && (props as any).percent > 0
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
                  const percent = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0";
                  return [`${value} phiên (${percent}%)`, name];
                }}
              />
              <Legend verticalAlign="bottom" align="center" iconType="circle" />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: "1.15rem", fontWeight: 800, fill: "#0F172A" }}
              >
                {totalSessions}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h3>Số lượng ứng viên mỗi phiên</h3>
            <span>TB {avgCandidates} ứng viên</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [`${value} ứng viên`, "Số lượng"]} />
              <Bar dataKey="candidates" fill={COLORS.running} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h3>Cơ cấu loại phiếu</h3>
            <span>Phân bổ theo cấu hình</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={typeData} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [`${value} phiên`, "Số lượng"]} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {typeData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="recent-card">
        <div className="chart-card__header">
          <h3>Phiên gần đây</h3>
          <span>{recentSessions.length} phiên mới nhất</span>
        </div>
        {recentSessions.length === 0 ? (
          <p className="chart-note">Chưa có phiên nào để hiển thị.</p>
        ) : (
          <div className="recent-list">
            {recentSessions.map((session) => {
              const status = isRunning(session.startAt, session.endAt)
                ? "Đang diễn ra"
                : isFinished(session.endAt)
                  ? "Đã diễn ra"
                  : "Chưa diễn ra";
              return (
                <div key={session.id} className="recent-item">
                  <div>
                    <strong>{session.name}</strong>
                    <p>
                      {session.startAt ? new Date(session.startAt).toLocaleString("vi-VN") : "—"} · {session.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư"}
                    </p>
                  </div>
                  <span className={`recent-status recent-status--${status === "Đang diễn ra" ? "running" : status === "Đã diễn ra" ? "finished" : "upcoming"}`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
