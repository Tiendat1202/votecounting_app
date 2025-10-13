import React, { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useVoteSessions } from "../../context/VoteSessionContext";
import "./CreateSession.css";

const CreateSession: React.FC = () => {
  const [sessionName, setSessionName] = useState("");
  const [voteType, setVoteType] = useState("tin-nhiem");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // refs cho drag & drop (native)
  const dragFromIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const { addSession } = useVoteSessions();
  const navigate = useNavigate();

  const handleCandidateChange = (index: number, value: string) => {
    setCandidates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addCandidate = () => setCandidates((prev) => [...prev, ""]);
  const removeCandidate = (index: number) =>
    setCandidates((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!sessionName.trim()) {
      alert("Vui lòng nhập tên phiên kiểm phiếu!");
      return false;
    }
    if (!voteType) {
      alert("Vui lòng chọn loại phiếu!");
      return false;
    }
    if (!startAt) {
      alert("Vui lòng chọn thời điểm mở phiên!");
      return false;
    }
    if (!endAt) {
      alert("Vui lòng chọn thời điểm đóng phiên!");
      return false;
    }
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();

    if (isNaN(start) || isNaN(end)) {
      alert("Vui lòng nhập đầy đủ thời điểm mở và đóng phiên!");
      return;
    }

    if (start >= end) {
      alert("Thời điểm đóng phiên phải sau thời điểm mở phiên!");
      return;
    }

    const validCandidates = candidates.map((c) => c.trim()).filter(Boolean);
    if (validCandidates.length === 0) {
      alert("Vui lòng nhập ít nhất một ứng viên!");
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addSession({
      id: Date.now().toString(),
      name: sessionName.trim(),
      type: voteType,
      candidates: candidates.map((c) => c.trim()).filter(Boolean),
      startAt,
      endAt,
    });

    navigate("/sessions");
  };

  // Dán nguyên danh sách → tách dòng
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (lines.length > 0) {
      e.preventDefault();
      setCandidates(lines);
    }
  };

  // ---- Kéo-thả native ----
  const onDragStart = (index: number) => (e: React.DragEvent<HTMLLIElement>) => {
    dragFromIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    // Firefox cần setData để drag hoạt động
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault(); // cho phép drop
    dragOverIndex.current = index;
  };

  const onDrop =
    (index: number) => (e: React.DragEvent<HTMLLIElement | HTMLUListElement>) => {
      e.preventDefault();
      const from = dragFromIndex.current;
      const to = dragOverIndex.current ?? index;
      if (from === null || to === null || from === to) {
        dragFromIndex.current = dragOverIndex.current = null;
        return;
      }
      setCandidates((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      dragFromIndex.current = dragOverIndex.current = null;
    };

  return (
    <div className="create-session-container">
      <div className="form-box">
        <div className="form-header">
          <h1 className="form-title">Tạo phiên kiểm phiếu</h1>
          <p className="form-subtitle">
            Dán danh sách ứng viên (mỗi người 1 dòng), sau đó có thể chỉnh sửa, xóa, kéo thả để sắp xếp.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-body" noValidate>
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label>
                Tên phiên <span className="required">*</span>
              </label>
              <input
                className="input"
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Ví dụ: Phiên kiểm phiếu Đại hội 2025"
              />
            </div>

            <div className="form-group">
              <label>
                Loại phiếu <span className="required">*</span>
              </label>
              <select
                className="select"
                value={voteType}
                onChange={(e) => setVoteType(e.target.value)}
              >
                <option value="tin-nhiem">Phiếu tín nhiệm</option>
                <option value="so-du">Phiếu có số dư</option>
              </select>
            </div>

            <div className="form-group col-span-2 time-row">
              <div className="time-field">
                <label>
                  Thời điểm mở phiên <span className="required">*</span>
                </label>
                <input
                  className="input"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>

              <div className="time-field">
                <label>
                  Thời điểm đóng phiên <span className="required">*</span>
                </label>
                <input
                  className="input"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  min={startAt || undefined}
                />
              </div>
            </div>

            <div className="form-group col-span-2">
              <label>
                Danh sách ứng viên <span className="required">*</span>{" "}
                <span style={{ color: "#64748b", fontWeight: 500 }}>
                  (đang có {candidates.filter(Boolean).length})
                </span>
              </label>

              {/* Ô dán danh sách */}
              <textarea
                className="input"
                placeholder="Dán danh sách ứng viên, mỗi người 1 dòng"
                rows={5}
                onPaste={handlePaste}
              ></textarea>

              <div className="candidate-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.querySelector(
                      "textarea"
                    ) as HTMLTextAreaElement;
                    if (textarea?.value) {
                      const lines = textarea.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter((l) => l !== "");
                      setCandidates(lines);
                      textarea.value = "";
                    }
                  }}
                  className="btn btn--primary"
                >
                  Nhập danh sách
                </button>
              </div>

              {/* Danh sách có thể chỉnh sửa + kéo thả */}
              <ul
                className="candidate-list"
                onDrop={onDrop(-1)}
                onDragOver={(e) => e.preventDefault()}
                style={{ listStyle: "none", padding: 0, marginTop: 12 }}
              >
                {candidates.map((candidate, index) => (
                  <li
                    key={index}
                    className="candidate-row"
                    draggable
                    onDragStart={onDragStart(index)}
                    onDragOver={onDragOver(index)}
                    onDrop={onDrop(index)}
                    aria-label={`Ứng viên ${index + 1}`}
                  >
                    <span className="drag-handle" aria-hidden>⋮⋮</span>
                    <input
                      className="input"
                      type="text"
                      value={candidate}
                      onChange={(e) =>
                        handleCandidateChange(index, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      className="btn btn--danger"
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>

              <div className="candidate-actions">
                <button type="button" onClick={addCandidate} className="btn btn--subtle">
                  Thêm ứng viên
                </button>
                <button type="button" onClick={() => setCandidates([])} className="btn btn--danger">
                  Xóa tất cả
                </button>
              </div>
            </div>
          </div>

          <div className="form-footer">
            <Link to="/sessions" className="btn btn--subtle">
              Quay lại danh sách phiên
            </Link>
            <button type="submit" className="btn btn--primary btn--block">
              Tạo phiên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSession;
