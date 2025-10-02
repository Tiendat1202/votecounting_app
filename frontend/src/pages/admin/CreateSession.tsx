import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useVoteSessions } from "../../context/VoteSessionContext";
import "./CreateSession.css";

const CreateSession: React.FC = () => {
  const [sessionName, setSessionName] = useState("");
  const [voteType, setVoteType] = useState("tin-nhiem");
  const [candidates, setCandidates] = useState<string[]>([""]);

  const { addSession } = useVoteSessions();
  const navigate = useNavigate();

  const handleCandidateChange = (index: number, value: string) => {
    const next = [...candidates];
    next[index] = value;
    setCandidates(next);
  };
  const addCandidate = () => setCandidates((prev) => [...prev, ""]);
  const removeCandidate = (index: number) =>
    setCandidates((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      alert("Vui lòng nhập tên phiên kiểm phiếu!");
      return;
    }
    const newSession = {
      id: Date.now().toString(),
      name: sessionName.trim(),
      type: voteType,
      candidates: candidates.map((c) => c.trim()).filter(Boolean),
    };
    addSession(newSession);
    navigate("/sessions");
  };

  return (
    <div className="create-session-container">
      <div className="form-box">
        {/* Header card */}
        <div className="form-header">
          <h1 className="form-title">Tạo phiên kiểm phiếu</h1>
          <p className="form-subtitle">
            Nhập thông tin phiên và danh sách ứng viên. Bạn có thể chỉnh sửa sau.
          </p>
        </div>

        {/* Stepper nhẹ */}
        <div className="stepper" aria-hidden="true">
          <div className="step active">
            <span className="dot" />
            Thông tin phiên
          </div>
          <div className="step-sep" />
          <div className="step">
            <span className="dot" />
            Ứng viên
          </div>
          <div className="step-sep" />
          <div className="step">
            <span className="dot" />
            Xác nhận
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="form-body">
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label htmlFor="sessionName">Tên phiên</label>
              <input
                id="sessionName"
                className="input"
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Ví dụ: Phiên kiểm phiếu Đại hội 2025"
              />
              <div className="help">
                Tên nên ngắn gọn, mô tả rõ phạm vi (tổ chức, sự kiện, niên khóa…)
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="voteType">Loại phiếu</label>
              <select
                id="voteType"
                className="select"
                value={voteType}
                onChange={(e) => setVoteType(e.target.value)}
              >
                <option value="tin-nhiem">Phiếu tín nhiệm</option>
                <option value="so-du">Phiếu có số dư</option>
              </select>
              <div className="help">Chọn cơ chế tính phù hợp với quy chế của bạn.</div>
            </div>

            <div className="form-group col-span-2">
              <label>Danh sách ứng viên</label>

              {candidates.map((candidate, index) => (
                <div key={index} className="candidate-item ">
                  <input
                    className="input"
                    type="text"
                    value={candidate}
                    onChange={(e) => handleCandidateChange(index, e.target.value)}
                    placeholder={`Ứng viên ${index + 1}`}
                    aria-label={`Ứng viên ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCandidate(index)}
                    className="btn btn--danger"
                    aria-label={`Xóa ứng viên ${index + 1}`}
                  >
                    Xóa
                  </button>
                </div>
              ))}

              <div className="candidate-actions">
                <button
                  type="button"
                  onClick={addCandidate}
                  className="btn btn--subtle"
                >
                  Thêm ứng viên
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCandidates((prev) => [...prev, ...Array(10).fill("")])
                  }
                  className="btn btn--subtle"
                >
                  Thêm 10 ứng viên
                </button>
                <button
                  type="button"
                  onClick={() => setCandidates([])}
                  className="btn btn--danger"
                >
                  Xóa tất cả
                </button>
              </div>



              <div className="section-divider" />
              <div className="help">
                Nên nhập “Họ và tên” đầy đủ; mỗi dòng là một ứng viên.
              </div>
            </div>
          </div>

          {/* Footer hành động */}
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
