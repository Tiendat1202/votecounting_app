import React, { useState, useEffect } from "react";
import "./BallotReviewModal.css";

export interface BallotVote {
  id: string;
  voteId: string;
  status: string;
  imageUrl: string | null;
  selectedCandidate: string | null;
  validationNotes: string | null;
  confidenceScore?: number;
  sessionId: string;
  createdAt: string;
  updatedAt?: string;
  session?: { candidates: string[] };
}

type AuditUser = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  workUnit?: string | null;
};

type AuditLogEntry = {
  logId: string;
  voteId: string;
  sessionId: string;
  changeAt: string;
  oldData: any;
  newData: any;
  user?: AuditUser | null;
};

interface Props {
  ballots: BallotVote[];
  initialIndex: number;
  initialMode: "view" | "review";
  sessionId?: string;
  canEdit?: boolean;
  onClose: () => void;
  onSaved: (updatedBallot: BallotVote, oldBallot: BallotVote, newSelectedCandidates: string[]) => void;
}

type ReviewAction = "convert-valid" | "convert-invalid" | "edit-valid-result";

const REASON_OPTIONS: Record<ReviewAction, { value: string; label: string }[]> = {
  "convert-valid": [
    { value: "MANUAL_CONFIRM", label: "Xác nhận thủ công" },
    { value: "AI_READ_WRONG_BOX", label: "AI đọc sai ô" },
    { value: "BLUR_IMAGE", label: "Ảnh mờ" },
    { value: "OTHER", label: "Khác" },
  ],
  "convert-invalid": [
    { value: "AI_READ_WRONG_BOX", label: "AI đọc sai ô" },
    { value: "OVER_SEATS", label: "Chọn quá số lượng" },
    { value: "NO_SELECTION", label: "Không chọn ứng cử viên" },
    { value: "BLUR_IMAGE", label: "Ảnh mờ" },
    { value: "OTHER", label: "Khác" },
  ],
  "edit-valid-result": [
    { value: "AI_READ_WRONG_BOX", label: "AI đọc sai ô" },
    { value: "MANUAL_CONFIRM", label: "Xác nhận thủ công" },
    { value: "OTHER", label: "Khác" },
  ],
};

const statusMeta = (status: string) => {
  if (status === "valid") return { label: "HỢP LỆ", bg: "#dcfce7", fg: "#166534", dot: "#16a34a" };
  if (status === "invalid") return { label: "KHÔNG HỢP LỆ", bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626" };
  return { label: "LỖI / PENDING", bg: "#fef9c3", fg: "#854d0e", dot: "#d97706" };
};

const BallotReviewModal: React.FC<Props> = ({ ballots, initialIndex, initialMode, canEdit = false, onClose, onSaved }) => {
  const [idx, setIdx] = useState(initialIndex);
  const [panelOpen, setPanelOpen] = useState(initialMode === "review" && canEdit);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("MANUAL_CONFIRM");
  const [notes, setNotes] = useState("");
  const [selCandidates, setSelCandidates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const vote = ballots[idx];

  useEffect(() => {
    if (!vote) return;
    setAction(null);
    setNotes(vote.validationNotes || "");
    if (vote.status === "failed") setSelCandidates([]);
    else setSelCandidates((vote.selectedCandidate || "").split(",").map((x) => x.trim()).filter(Boolean));
  }, [idx, vote?.id]);

  useEffect(() => {
    if (!vote || !canEdit) return;
    let active = true;

    const loadAuditLogs = async () => {
      try {
        setAuditLoading(true);
        setAuditError(null);
        const token = localStorage.getItem("token");
        const res = await fetch(
          `/api/results/${vote.sessionId}/audit-logs?voteId=${vote.id}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any).message || (data as any).error || "Không tải được audit log");
        }
        if (!active) return;
        setAuditLogs(Array.isArray((data as any).logs) ? (data as any).logs : []);
      } catch (e: any) {
        if (!active) return;
        setAuditLogs([]);
        setAuditError(e?.message || "Không tải được audit log");
      } finally {
        if (active) setAuditLoading(false);
      }
    };

    loadAuditLogs();
    return () => {
      active = false;
    };
  }, [vote?.id, vote?.sessionId, canEdit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) setIdx((i) => i - 1);
      if (e.key === "ArrowRight" && idx < ballots.length - 1) setIdx((i) => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, ballots.length, onClose]);

  if (!vote) return null;

  const total = ballots.length;
  const sessionCandidates = vote.session?.candidates || [];
  const meta = statusMeta(vote.status);
  const imgSrc = vote.imageUrl ? (vote.imageUrl.startsWith("http") ? vote.imageUrl : `http://localhost:5050/uploads/${vote.sessionId}/${vote.imageUrl}`) : null;

  const formatAuditValue = (value: any) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text ? text : "—";
  };

  const formatAuditUser = (entry: AuditLogEntry) => {
    const user = entry.user || null;
    return user?.fullName || user?.email || user?.userId || "Không rõ";
  };

  const toggleCandidate = (name: string) => setSelCandidates((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const pickAction = (picked: ReviewAction) => {
    if (!canEdit) return;
    setAction(picked);
    setReason(REASON_OPTIONS[picked][0].value);
    setPanelOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit || !action) return;
    if ((action === "convert-valid" || action === "edit-valid-result") && selCandidates.length === 0) {
      alert("Vui lòng tick ít nhất 1 ứng cử viên.");
      return;
    }
    const isValid = action !== "convert-invalid";
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/votes/${vote.id}/validate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          isValid,
          notes: notes || (isValid ? "Xác nhận hợp lệ thủ công" : "Xác nhận không hợp lệ thủ công"),
          overrideReason: reason,
          selectedCandidates: isValid ? selCandidates : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message || (data as any).error || `HTTP ${res.status}`);
      const updatedBallot: BallotVote = {
        ...vote,
        status: isValid ? "valid" : "invalid",
        selectedCandidate: isValid ? selCandidates.join(", ") : "",
        validationNotes: notes || (isValid ? "Xác nhận hợp lệ thủ công" : "Xác nhận không hợp lệ thủ công"),
        updatedAt: new Date().toISOString(),
      };
      onSaved(updatedBallot, vote, isValid ? selCandidates : []);
    } catch (e: any) {
      alert(e?.message || "Lỗi khi cập nhật phiếu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="brm-overlay" onClick={onClose}>
      <div className="brm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brm-header">
          <div className="brm-header-left">
            <span className="brm-header-title">Kiểm tra phiếu</span>
            <span className="brm-status-badge" style={{ background: meta.bg, color: meta.fg }}>
              <span className="brm-status-dot" style={{ background: meta.dot }} />
              {meta.label}
            </span>
          </div>
          <div className="brm-nav-bar">
            <button className="brm-nav-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
            <span className="brm-nav-pos">{idx + 1} / {total}</span>
            <button className="brm-nav-btn" onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} disabled={idx === total - 1}>›</button>
          </div>
          <button className="brm-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="brm-body">
          <div className="brm-image-panel">
            {imgSrc ? <img src={imgSrc} alt={`Phiếu ${vote.voteId}`} className="brm-image" /> : <div className="brm-no-image"><span className="brm-no-image-icon">🖼</span><p>Không có ảnh phiếu</p></div>}
            <div className="brm-image-footer"><span className="brm-vote-id">Mã: {vote.voteId || "—"}</span></div>
          </div>

          <div className="brm-info-panel">
            <div className="brm-info-block">
              <p className="brm-block-title">Kết quả từ AI</p>
              <dl className="brm-dl">
                <dt>Ứng viên đọc được</dt>
                <dd>{vote.selectedCandidate || <span className="brm-dash">—</span>}</dd>
                {vote.confidenceScore !== undefined && <><dt>Độ tin cậy</dt><dd><span className="brm-confidence">{(Number(vote.confidenceScore) * 100).toFixed(1)}%</span></dd></>}
                <dt>Ghi chú AI</dt>
                <dd className="brm-notes-text">{vote.validationNotes || <span className="brm-dash">—</span>}</dd>
              </dl>
            </div>

            {canEdit && (
              <div className="brm-info-block">
                <p className="brm-block-title">Lịch sử chỉnh sửa</p>
                {auditLoading ? (
                  <p className="brm-audit-loading">Đang tải log...</p>
                ) : auditError ? (
                  <p className="brm-audit-error">{auditError}</p>
                ) : auditLogs.length === 0 ? (
                  <p className="brm-audit-empty">Chưa có chỉnh sửa nào.</p>
                ) : (
                  <div className="brm-audit-list">
                    {auditLogs.map((entry) => (
                      <div className="brm-audit-item" key={entry.logId}>
                        <div className="brm-audit-row">
                          <span className="brm-audit-time">
                            {new Date(entry.changeAt).toLocaleString("vi-VN")}
                          </span>
                          <span className="brm-audit-user">{formatAuditUser(entry)}</span>
                        </div>
                        <div className="brm-audit-changes">
                          <div>
                            <span className="brm-audit-label">Trạng thái:</span>
                            <span>{formatAuditValue(entry.oldData?.status)}</span>
                            <span className="brm-audit-arrow">→</span>
                            <span>{formatAuditValue(entry.newData?.status)}</span>
                          </div>
                          <div>
                            <span className="brm-audit-label">Ứng viên:</span>
                            <span>{formatAuditValue(entry.oldData?.selectedCandidate)}</span>
                            <span className="brm-audit-arrow">→</span>
                            <span>{formatAuditValue(entry.newData?.selectedCandidate)}</span>
                          </div>
                          {entry.newData?.overrideReason && (
                            <div>
                              <span className="brm-audit-label">Lý do:</span>
                              <span>{formatAuditValue(entry.newData?.overrideReason)}</span>
                            </div>
                          )}
                          {entry.newData?.validationNotes && (
                            <div>
                              <span className="brm-audit-label">Ghi chú:</span>
                              <span>{formatAuditValue(entry.newData?.validationNotes)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canEdit ? (
              <button className={`brm-toggle-btn ${panelOpen ? "brm-toggle-btn--open" : ""}`} onClick={() => { setPanelOpen((v) => !v); if (panelOpen) setAction(null); }}>
                {panelOpen ? "▲ Ẩn bảng duyệt tay" : "▼ Mở bảng duyệt tay"}
              </button>
            ) : (
              <div className="brm-info-block" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
                <p className="brm-block-title">Chế độ xem</p>
                <p style={{ margin: 0, color: "#1e3a8a" }}>Bạn chỉ có quyền xem phiếu. Muốn sửa kết quả, inspector này cần được chủ phiên hoặc admin cấp quyền.</p>
              </div>
            )}

            {panelOpen && canEdit && (
              <div className="brm-review-panel">
                <p className="brm-block-title">Duyệt tay</p>
                <div className="brm-action-row">
                  {vote.status === "invalid" && <button className={`brm-act-btn brm-act-btn--valid ${action === "convert-valid" ? "brm-act-btn--active" : ""}`} onClick={() => pickAction("convert-valid")}>✓ Chuyển thành VALID</button>}
                  {vote.status === "valid" && <><button className={`brm-act-btn brm-act-btn--invalid ${action === "convert-invalid" ? "brm-act-btn--active" : ""}`} onClick={() => pickAction("convert-invalid")}>✗ Chuyển thành INVALID</button><button className={`brm-act-btn brm-act-btn--edit ${action === "edit-valid-result" ? "brm-act-btn--active" : ""}`} onClick={() => pickAction("edit-valid-result")}>✎ Chỉnh sửa kết quả</button></>}
                  {vote.status === "failed" && <><button className={`brm-act-btn brm-act-btn--valid ${action === "convert-valid" ? "brm-act-btn--active" : ""}`} onClick={() => pickAction("convert-valid")}>✓ Đánh dấu VALID</button><button className={`brm-act-btn brm-act-btn--invalid ${action === "convert-invalid" ? "brm-act-btn--active" : ""}`} onClick={() => pickAction("convert-invalid")}>✗ Đánh dấu INVALID</button></>}
                </div>

                {action && (
                  <div className="brm-form">
                    <label className="brm-form-label">Lý do override</label>
                    <select className="brm-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                      {REASON_OPTIONS[action].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>

                    {(action === "convert-valid" || action === "edit-valid-result") && (
                      <>
                        <label className="brm-form-label">Chọn ứng cử viên</label>
                        <div className="brm-candidate-list">
                          {sessionCandidates.map((candidate) => (
                            <label key={candidate} className="brm-check-item">
                              <input type="checkbox" checked={selCandidates.includes(candidate)} onChange={() => toggleCandidate(candidate)} />
                              <span>{candidate}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}

                    <label className="brm-form-label">Ghi chú</label>
                    <textarea className="brm-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Nhập ghi chú khi duyệt tay..." />

                    <div className="brm-form-actions">
                      <button className="brm-save-btn" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu kết quả"}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BallotReviewModal;
