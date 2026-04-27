import React, { useState, useEffect } from "react";
import { BallotProcessor } from "../components/BallotProcessor";
import { VoteResults } from "../components/VoteResults";
import "./VoteCountingSession.css";

interface Session {
  id: string;
  name: string;
  type: "trust" | "surplus";
  status?: string;
  startAt?: string;
  endAt?: string;
  candidates?: string[];
}

export const VoteCountingSession: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "surplus" as "surplus" | "trust",
    candidates: "",
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5050/api/sessions", {
        credentials: "include",
      });
      const data = await response.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tải phiên:", error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5050/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          candidates: formData.candidates
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c),
          startAt: new Date().toISOString(),
          endAt: null,
        }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSessions([...sessions, newSession]);
        setShowCreateForm(false);
        setFormData({ name: "", type: "surplus", candidates: "" });
        setSelectedSession(newSession);
      }
    } catch (error) {
      console.error("Lỗi tạo phiên:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa phiên này?")) return;
    try {
      await fetch(`http://localhost:5050/api/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error("Lỗi xóa phiên:", error);
    }
  };

  // View: Session List
  if (!selectedSession) {
    return (
      <div className="session-container">
        <div className="session-header">
          <h1>📋 Quản lý phiên kiểm phiếu</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Hủy" : "+ Tạo phiên mới"}
          </button>
        </div>

        {showCreateForm && (
          <form className="create-form" onSubmit={handleCreateSession}>
            <h2>Tạo phiên kiểm phiếu</h2>
            <div className="form-group">
              <label>Tên phiên</label>
              <input
                type="text"
                required
                placeholder="VD: Kiểm phiếu ngày 15/12/2024"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label>Loại phiếu</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as "surplus" | "trust",
                  }))
                }
              >
                <option value="surplus">Kiểm phiếu thừa</option>
                <option value="trust">Kiểm phiếu tin tưởng</option>
              </select>
            </div>

            <div className="form-group">
              <label>Danh sách ứng cử viên (phân cách bằng dấu phẩy)</label>
              <textarea
                placeholder="Ứng cử viên A, Ứng cử viên B, Ứng cử viên C"
                value={formData.candidates}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    candidates: e.target.value,
                  }))
                }
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo phiên"}
            </button>
          </form>
        )}

        {loading && !showCreateForm && <p className="loading-text">Đang tải...</p>}

        <div className="sessions-grid">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="session-card"
              onClick={() => setSelectedSession(session)}
            >
              <h3>{session.name}</h3>
              <p className="session-type">
                <span className="badge">
                  {session.type === "surplus" ? "🔄 Thừa" : "👥 Tin tưởng"}
                </span>
              </p>
              {session.candidates && (
                <p className="session-count">
                  <strong>{session.candidates.length}</strong> ứng cử viên
                </p>
              )}
              <div className="session-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  Xem chi tiết
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>

        {sessions.length === 0 && !showCreateForm && (
          <div className="empty-state">
            <p>Chưa có phiên nào. Tạo một phiên mới để bắt đầu.</p>
          </div>
        )}
      </div>
    );
  }

  // View: Session Detail
  return (
    <div className="session-detail">
      <div className="detail-header">
        <button
          className="btn btn-secondary btn-back"
          onClick={() => setSelectedSession(null)}
        >
          ← Quay lại
        </button>
        <h1>{selectedSession.name}</h1>
        <span className="session-type-badge">
          {selectedSession.type === "surplus" ? "🔄 Thừa" : "👥 Tin tưởng"}
        </span>
      </div>

      <div className="detail-grid">
        <div className="upload-section">
          <h2>📤 Tải lên phiếu</h2>
          <BallotProcessor
            sessionId={selectedSession.id}
            ballotType={selectedSession.type}
            onUploadComplete={() => {
              // Refresh by making a small delay then reloading
              setTimeout(() => {
                window.location.hash = Math.random().toString();
              }, 1000);
            }}
          />
        </div>

        <div className="results-section">
          <h2>📊 Kết quả kiểm phiếu</h2>
          <VoteResults sessionId={selectedSession.id} />
        </div>
      </div>
    </div>
  );
};

export default VoteCountingSession;
