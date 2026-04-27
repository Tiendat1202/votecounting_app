import React, { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createSession as apiCreateSession } from "../../api";
import "./CreateSession.css";

const CreateSession: React.FC = () => {
  const [sessionName, setSessionName] = useState("");
  const [voteType, setVoteType] = useState("tin-nhiem");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [seatsInput, setSeatsInput] = useState<string>("1");
  const [minWinPercent, setMinWinPercent] = useState<number>(50);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dragFromIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
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

  const applyPasteText = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (lines.length > 0) {
      setCandidates(lines);
      if (pasteRef.current) pasteRef.current.value = "";
    }
  };

  const validate = () => {
    if (!sessionName.trim()) return alert("Vui lòng nhập tên phiên kiểm phiếu!"), false;
    if (!voteType) return alert("Vui lòng chọn loại phiếu!"), false;
    if (!startAt || !endAt) return alert("Vui lòng nhập thời điểm mở/đóng phiên!"), false;

    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    if (isNaN(start) || isNaN(end)) return alert("Thời gian không hợp lệ!"), false;
    if (start >= end) return alert("Đóng phiên phải sau mở phiên!"), false;

    const validCandidates = candidates.map((c) => c.trim()).filter(Boolean);
    if (validCandidates.length === 0) return alert("Vui lòng nhập ít nhất một ứng viên!"), false;

    const seats = Math.floor(Number(seatsInput));
    if (!Number.isFinite(seats) || seats <= 0) return alert("Số lượng cần bầu phải lớn hơn 0!"), false;
    if (seats > validCandidates.length)
      return alert("Số lượng cần bầu không được lớn hơn số ứng cử viên!"), false;
    if (!Number.isFinite(minWinPercent) || minWinPercent < 0 || minWinPercent > 100)
      return alert("% tối thiểu để trúng cử phải trong khoảng 0-100!"), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) return;

    const payload = {
      name: sessionName.trim(),
      type: voteType,
      candidates: candidates.map((c) => c.trim()).filter(Boolean),
      seats: Math.floor(Number(seatsInput)),
      minWinPercent,
      startAt,
      endAt,
    };

    try {
      setSubmitting(true);
      const created = await apiCreateSession(payload);
      navigate(`/admin/sessions/${created.id}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Tạo phiên thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length > 0) {
      e.preventDefault();
      setCandidates(lines);
      if (pasteRef.current) pasteRef.current.value = "";
    }
  };

  const onDragStart = (index: number) => (e: React.DragEvent<HTMLLIElement>) => {
    dragFromIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    dragOverIndex.current = index;
  };

  const onDrop = (index: number) => (e: React.DragEvent<HTMLLIElement | HTMLUListElement>) => {
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

  const candidateCount = candidates.map((c) => c.trim()).filter(Boolean).length;

  return (
    <div className="create-session-page">
      <div className="create-session-shell">
        <section className="create-hero card-surface">
          <div>
            <span className="eyebrow">Thiết lập phiên kiểm phiếu</span>
            <h1>Tạo phiên mới</h1>
            <p>
              Nhập thông tin phiên, thời gian diễn ra và danh sách ứng viên. Sau khi tạo xong bạn sẽ được chuyển
              đến trang chi tiết để kiểm tra và quản lý phiên.
            </p>
          </div>

          <div className="hero-highlight">
            <div>
              <span className="highlight-label">Ứng viên hiện có</span>
              <strong>{candidateCount}</strong>
            </div>
            <div>
              <span className="highlight-label">Số ghế dự kiến</span>
              <strong>{seatsInput || "0"}</strong>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-form" noValidate>
          <section className="card-surface form-section">
            <div className="section-heading">
              <div>
                <h2>1. Thông tin phiên</h2>
                <p>Nhập các thông tin chung và quy tắc áp dụng cho toàn bộ phiên kiểm phiếu.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-row form-row--single">
                <div className="form-group">
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
              </div>

              <div className="form-row form-row--single">
                <div className="form-group">
                  <label>
                    Loại phiếu <span className="required">*</span>
                  </label>
                  <div className="select-wrapper">
                    <select className="select" value={voteType} onChange={(e) => setVoteType(e.target.value)}>
                      <option value="tin-nhiem">Phiếu tín nhiệm</option>
                      <option value="so-du">Phiếu có số dư</option>
                    </select>
                    <span className="select-arrow">▼</span>
                  </div>
                </div>
              </div>

              <div className="form-row form-row--double">
                <div className="form-group">
                  <label>
                    Số lượng cần bầu <span className="required">*</span>
                  </label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    step={1}
                    value={seatsInput}
                    onChange={(e) => setSeatsInput(e.target.value)}
                    onBlur={() => {
                      const n = Math.floor(Number(seatsInput));
                      setSeatsInput(String(Number.isFinite(n) && n > 0 ? n : 1));
                    }}
                    placeholder="Ví dụ: 15"
                  />
                </div>

                <div className="form-group">
                  <label>
                    % tối thiểu để trúng cử <span className="required">*</span>
                  </label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={minWinPercent}
                    onChange={(e) => setMinWinPercent(Math.max(0, Number(e.target.value || 0)))}
                    placeholder="Ví dụ: 50"
                  />
                </div>
              </div>

              <div className="form-row form-row--double">
                <div className="form-group">
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

                <div className="form-group">
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
            </div>
          </section>

          <section className="card-surface form-section">
            <div className="section-heading">
              <div>
                <h2>2. Danh sách ứng viên</h2>
                <p>Dán danh sách ứng viên, mỗi người một dòng. Bạn có thể kéo thả để sắp xếp lại thứ tự.</p>
              </div>
              <div className="count-pill">{candidateCount} ứng viên</div>
            </div>

            <div className="candidate-import-box">
              <label>
                Dán nhanh danh sách ứng viên <span className="required">*</span>
              </label>
              <textarea
                ref={pasteRef}
                className="input textarea"
                placeholder={"Ví dụ:\nNguyễn Văn A\nTrần Thị B\nLê Văn C"}
                rows={6}
                onPaste={handlePaste}
              />
              <div className="candidate-actions">
                <button
                  type="button"
                  onClick={() => applyPasteText(pasteRef.current?.value || "")}
                  className="btn btn--primary"
                >
                  Nhập danh sách
                </button>
                <button type="button" onClick={addCandidate} className="btn btn--subtle">
                  Thêm ứng viên
                </button>
                <button type="button" onClick={() => setCandidates([])} className="btn btn--danger-outline">
                  Xóa tất cả
                </button>
              </div>
            </div>

            <ul className="candidate-list" onDrop={onDrop(-1)} onDragOver={(e) => e.preventDefault()}>
              {candidates.length === 0 ? (
                <li className="candidate-empty">Chưa có ứng viên nào. Hãy dán danh sách hoặc thêm thủ công.</li>
              ) : (
                candidates.map((candidate, index) => (
                  <li
                    key={index}
                    className="candidate-row"
                    draggable
                    onDragStart={onDragStart(index)}
                    onDragOver={onDragOver(index)}
                    onDrop={onDrop(index)}
                    aria-label={`Ứng viên ${index + 1}`}
                  >
                    <span className="candidate-index">{index + 1}</span>
                    <span className="drag-handle" aria-hidden>
                      ⋮⋮
                    </span>

                    <div className="candidate-input-wrap">
                      <input
                        className="input candidate-input"
                        type="text"
                        value={candidate}
                        onChange={(e) => handleCandidateChange(index, e.target.value)}
                        placeholder={`Ứng viên ${index + 1}`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      className="btn btn--danger-outline candidate-remove-btn"
                    >
                      Xóa
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <div className="form-footer">
            <Link to="/admin/sessions" className="btn btn--subtle footer-link btn--block">
              Quay lại danh sách phiên
            </Link>
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo phiên"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSession;