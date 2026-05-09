import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  uploadVoteFiles,
  getUploadedFiles,
  deleteUploadedFile,
  deleteAllUploadedFiles,
  getSessions,
  getCountingProgress,
  startVoteCounting,
  type CountingProgress,
  type SessionPermissions,
} from "../../api";
import UploadMethodModal from "./UploadMethodModal";
import CameraModal from "./CameraModal";
import "./UploadVotes.css";

type Session = {
  id: string;
  name: string;
  type: string;
  candidates: string[];
  startAt?: string;
  endAt?: string;
  permissions?: SessionPermissions;
};

type SessionStatus = "Chưa bắt đầu" | "Đang diễn ra" | "Đã kết thúc" | "—";
function getSessionStatus(startAt?: string, endAt?: string): SessionStatus {
  if (!startAt || !endAt) return "—";
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  if (now < start) return "Chưa bắt đầu";
  if (now >= start && now <= end) return "Đang diễn ra";
  return "Đã kết thúc";
}

type UIImage = {
  id: string;
  name: string;
  size?: number;
  addedAt?: number;
  url: string;
};

const nf = new Intl.NumberFormat("vi-VN");
const BACKEND_BASE = "http://localhost:5050";

function safeRememberImages(sessionId: string, items: UIImage[]) {
  try {
    localStorage.setItem(`vc_images_${sessionId}`, JSON.stringify(items));
  } catch (error) {
    // Safari/localStorage có thể báo "QuotaExceededError".
    // Upload đã thành công ở backend, nên không được biến lỗi lưu cache thành "Upload thất bại".
    console.warn("Không lưu được cache ảnh đã tải; sẽ tải lại từ backend khi quay lại trang.", error);
  }
}

function safeForgetImages(sessionId: string) {
  try {
    localStorage.removeItem(`vc_images_${sessionId}`);
  } catch (error) {
    console.warn("Không xóa được cache ảnh đã tải.", error);
  }
}


const UploadVotes: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();

  // sessions
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // images
  const [images, setImages] = useState<UIImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  // method picker / camera modals
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // AI processing progress
  const [aiProgress, setAiProgress] = useState(0);
  const [aiTotal, setAiTotal] = useState(0);
  const [aiDone, setAiDone] = useState(0);
  const [countingFailed, setCountingFailed] = useState(0);
  const [countingStatus, setCountingStatus] = useState<CountingProgress["status"]>("idle");
  const [countingMessage, setCountingMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyProgress = useCallback((data: CountingProgress) => {
    setAiTotal(data.total || 0);
    setAiDone(data.processed || 0);
    setAiProgress(data.percent || 0);
    setCountingFailed(data.failed || 0);
    setCountingStatus(data.status || "idle");
    setCountingMessage(data.message || "");
    setIsProcessing(data.status === "processing" || !!data.isProcessing);
  }, []);

  // Helper: start polling for a given sessionId (stable reference via useCallback)
  const startPolling = useCallback((sessionId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getCountingProgress(sessionId);
        applyProgress(data);
        if (data.status !== "processing" || data.percent >= 100) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        }
      } catch (e) {
        console.error("Không tải được tiến độ kiểm phiếu:", e);
      }
    }, 1500);
  }, [applyProgress]);

  // lightbox viewer
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });

  // cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ---- CHẶN ĐIỀU HƯỚNG TOÀN TRANG KHI KÉO/THẢ NGOÀI DROPZONE ----
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  // ---- LIGHTBOX: phím tắt ESC/←/→ ----
  useEffect(() => {
    if (!viewer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer((v) => ({ ...v, open: false }));
      if (e.key === "ArrowLeft")
        setViewer((v) => ({ ...v, index: (v.index - 1 + images.length) % images.length }));
      if (e.key === "ArrowRight")
        setViewer((v) => ({ ...v, index: (v.index + 1) % images.length }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer.open, images.length]);

  // fetch sessions
  useEffect(() => {
    (async () => {
      try {
        const data: Session[] = await getSessions();
        setAllSessions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Không tải được danh sách phiên:", e);
        setAllSessions([]);
      }
    })();
  }, []);

  const runningSessions = useMemo(
    () => allSessions.filter((s) => getSessionStatus(s.startAt, s.endAt) === "Đang diễn ra"),
    [allSessions]
  );

  const selectedSession = useMemo(
    () => allSessions.find((s) => s.id === selectedSessionId) || null,
    [allSessions, selectedSessionId]
  );
  const canUpload = !!selectedSession?.permissions?.canUpload;
  const canRequestAccess = !!selectedSession && !selectedSession.permissions?.sessionRole;

  // chọn theo param :id nếu hợp lệ
  useEffect(() => {
    if (paramId && allSessions.find((s) => s.id === paramId)) {
      setSelectedSessionId(paramId);
    }
  }, [paramId, allSessions]);

  // auto-chọn phiên đang diễn ra đầu tiên
  useEffect(() => {
    if (!selectedSessionId && runningSessions.length > 0) {
      setSelectedSessionId(runningSessions[0].id);
    }
  }, [runningSessions, selectedSessionId]);

  // tải danh sách ảnh khi đổi phiên + khôi phục thanh tiến trình khi reload
  useEffect(() => {
    if (!selectedSessionId) return;
    (async () => {
      // Load images
      try {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${encodeURIComponent(fn)}`,
        }));
        setImages(ui);
        safeRememberImages(selectedSessionId, ui);
      } catch (e) {
        console.error("Lỗi tải danh sách ảnh:", e);
        setImages([]);
      }

      // Restore progress bar on mount/session-change (also fires after navigation back to this page)
      // Always clear any stale interval first
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      try {
        const data = await getCountingProgress(selectedSessionId);
        applyProgress(data);
        if (data.status === "processing") {
          startPolling(selectedSessionId);
        }
      } catch (e) {
        console.error("Không tải được tiến độ kiểm phiếu:", e);
        setAiProgress(0);
        setAiDone(0);
        setAiTotal(0);
        setCountingFailed(0);
        setCountingStatus("idle");
        setCountingMessage("");
        setIsProcessing(false);
      }
    })();
  }, [selectedSessionId, applyProgress, startPolling]);

  // upload nhiều ảnh (nhận File[] — dùng cho cả file picker lẫn camera)
  const handleFiles = async (accepted: File[]) => {
    if (!accepted.length || !selectedSessionId) return;
    if (!canUpload) {
      alert("Bạn chưa có quyền tải phiếu cho phiên này. Hãy yêu cầu chủ phiên cấp quyền.");
      return;
    }

    try {
      setBusy(true);
      // Lấy session type để truyền vào API
      const session = allSessions.find(s => s.id === selectedSessionId);
      const result = await uploadVoteFiles(selectedSessionId, accepted, session?.type);
      if (result?.files?.length) {
        const appended: UIImage[] = result.files.map((f: any) => ({
          id: f.filename,
          name: f.originalname || f.filename,
          size: f.size,
          addedAt: Date.now(),
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${encodeURIComponent(f.filename)}`,
        }));
        const updated = [...appended, ...images];
        setImages(updated);
        
        // Lưu cache nhẹ; nếu Safari đầy quota thì bỏ qua, không báo upload thất bại.
        safeRememberImages(selectedSessionId, updated);

        // Upload xong chỉ chờ xác nhận, chưa chạy AI.
        setAiTotal(updated.length);
        setAiDone(0);
        setAiProgress(0);
        setCountingFailed(0);
        setCountingStatus("uploaded");
        setCountingMessage("Đã upload phiếu. Bấm Bắt đầu kiểm phiếu để hệ thống xử lý.");
        setIsProcessing(false);
      } else {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${encodeURIComponent(fn)}`,
        }));
        setImages(ui);
        
        // Lưu vào localStorage
        safeRememberImages(selectedSessionId, ui);
        setAiTotal(ui.length);
        setAiDone(0);
        setAiProgress(0);
        setCountingFailed(0);
        setCountingStatus(ui.length > 0 ? "uploaded" : "idle");
        setCountingMessage(ui.length > 0 ? "Đã upload phiếu. Bấm Bắt đầu kiểm phiếu để hệ thống xử lý." : "");
        setIsProcessing(false);
      }
    } catch (err: any) {
      alert(`Upload thất bại: ${err?.message || "Không rõ lỗi"}`);
      console.error(err);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStartCounting = async () => {
    if (!selectedSessionId || !canUpload) return;
    if (images.length === 0) {
      alert("Bạn cần upload ít nhất 1 phiếu trước khi kiểm phiếu.");
      return;
    }
    if (!confirm(`Bắt đầu kiểm phiếu ${images.length} phiếu của phiên này?`)) return;

    try {
      setBusy(true);
      const result = await startVoteCounting(selectedSessionId);
      if (result?.progress) applyProgress(result.progress);
      setIsProcessing(true);
      startPolling(selectedSessionId);
    } catch (err: any) {
      if (err?.message) alert(err.message);
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // xóa 1 ảnh
  const handleDelete = async (filename: string) => {
    if (!selectedSessionId || !canUpload) return;
    try {
      await deleteUploadedFile(selectedSessionId, filename);
      const updated = images.filter((img) => img.id !== filename);
      setImages(updated);
      
      // Cập nhật cache nhẹ; nếu Safari đầy quota thì bỏ qua.
      safeRememberImages(selectedSessionId, updated);
      setAiTotal(updated.length);
      setAiDone(0);
      setAiProgress(0);
      setCountingFailed(0);
      setCountingStatus(updated.length > 0 ? "uploaded" : "idle");
      setCountingMessage(updated.length > 0 ? "Đã cập nhật danh sách phiếu. Bấm Bắt đầu kiểm phiếu để tính lại." : "");
      setIsProcessing(false);
    } catch (e) {
      alert("Lỗi khi xóa ảnh.");
      console.error(e);
    }
  };

  // xóa tất cả ảnh
  const handleClearAll = async () => {
    if (!selectedSessionId || !canUpload) return;
    if (!confirm("Bạn có chắc muốn xóa TẤT CẢ ảnh của phiên này?")) return;
    try {
      await deleteAllUploadedFiles(selectedSessionId);
      setImages([]);
      
      // Xóa cache nhẹ; nếu Safari lỗi thì bỏ qua.
      safeForgetImages(selectedSessionId);
      setAiTotal(0);
      setAiDone(0);
      setAiProgress(0);
      setCountingFailed(0);
      setCountingStatus("idle");
      setCountingMessage("");
      setIsProcessing(false);
    } catch (e) {
      alert("Lỗi khi xóa tất cả ảnh.");
      console.error(e);
    }
  };

  // drop trong vùng dropzone
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    const accepted = Array.from(e.dataTransfer.files).filter((f) =>
      /image\/(png|jpe?g|webp)/i.test(f.type)
    );
    handleFiles(accepted);
  };

  // file input change
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const accepted = Array.from(e.target.files ?? []).filter((f) =>
      /image\/(png|jpe?g|webp)/i.test(f.type)
    );
    handleFiles(accepted);
  };

  // photos from camera — same upload path
  const handleCameraPhotos = useCallback(
    (photos: File[]) => {
      if (photos.length > 0) handleFiles(photos);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSessionId]
  );

  // open/close viewer
  const openViewer = (index: number) => setViewer({ open: true, index });
  const closeViewer = () => setViewer((v) => ({ ...v, open: false }));

  const shouldShowCountingPanel = selectedSessionId && images.length > 0;
  const canStartCounting = canUpload && images.length > 0 && countingStatus !== "processing" && !busy;
  const progressLabel = countingStatus === "completed" || aiProgress >= 100
    ? "✅ Kiểm phiếu hoàn tất"
    : countingStatus === "failed"
    ? "⚠️ Kiểm phiếu xong nhưng có phiếu lỗi"
    : countingStatus === "processing"
    ? "🤖 Hệ thống đang kiểm phiếu..."
    : "📌 Phiếu đã upload, chờ xác nhận kiểm phiếu";

  return (
    <div className="upload-container">
      <div className="upload-header">
        <div>
          <h1 className="upload-title">Tải ảnh lá phiếu</h1>
          <p className="upload-subtitle">Chọn đúng phiên đang diễn ra, sau đó tải ảnh từ máy hoặc chụp nhanh để hệ thống AI xử lý.</p>
        </div>
      </div>

      {/* Progress + confirmation */}
      {shouldShowCountingPanel && (
        <section className="ai-progress-section">
          <div className="ai-progress-header">
            <span className="ai-progress-label">{progressLabel}</span>
            <span className="ai-progress-count">{aiDone} / {aiTotal || images.length} phiếu</span>
          </div>
          <div className="ai-progress-bar-track">
            <div
              className="ai-progress-bar-fill"
              style={{
                width: `${aiProgress}%`,
                background: aiProgress >= 100 ? "#16a34a" : "#0F62FE",
              }}
            />
          </div>
          <div className="ai-progress-footer ai-progress-footer--split">
            <span>
              {countingMessage || (countingStatus === "processing" ? `${aiProgress}% hoàn thành` : "Upload xong chưa tự tính kết quả.")}
              {countingFailed > 0 ? ` Có ${countingFailed} phiếu lỗi cần xem lại.` : ""}
            </span>
            {aiProgress >= 100 || countingStatus === "completed" || countingStatus === "failed" ? (
              <Link to={`/admin/results/${selectedSessionId}`} className="ai-progress-results-link">Xem kết quả →</Link>
            ) : (
              <button
                type="button"
                className="btn btn--primary-accent"
                onClick={handleStartCounting}
                disabled={!canStartCounting}
              >
                {isProcessing ? "Đang kiểm phiếu..." : "Bắt đầu kiểm phiếu"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Chọn phiên */}
      <section className="upload-section session-card">
        <div className="session-card__header">
          <div>
            <label htmlFor="session-select" className="label-strong">
              Chọn phiên đang diễn ra <span className="required">*</span>
            </label>
            <p className="muted-text">Chỉ những phiên đang mở mới có thể nhận phiếu.</p>
          </div>
        </div>

        {runningSessions.length === 0 ? (
          <p className="muted-text">
            Hiện không có phiên nào đang diễn ra. Vui lòng tạo phiên hoặc chờ đến thời gian mở phiên.
          </p>
        ) : (
          <>
            <select
              id="session-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="select"
            >
              {runningSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {selectedSession && (
              <div className="session-meta-grid">
                <div className="session-meta-item">
                  <span>Mở phiên</span>
                  <strong>{selectedSession.startAt ? new Date(selectedSession.startAt).toLocaleString("vi-VN") : "—"}</strong>
                </div>
                <div className="session-meta-item">
                  <span>Đóng phiên</span>
                  <strong>{selectedSession.endAt ? new Date(selectedSession.endAt).toLocaleString("vi-VN") : "—"}</strong>
                </div>
                <div className="session-meta-item">
                  <span>Loại phiếu</span>
                  <strong>{selectedSession.type === "tin-nhiem" ? "Tín nhiệm" : "Có số dư"}</strong>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedSessionId && !canUpload && (
        <div className="access-callout">
          <div>
            Bạn chưa có quyền upload phiếu cho phiên này. Chỉ chủ phiên hoặc inspector của phiên mới được tải phiếu.
          </div>
          <p style={{fontSize: 12, marginTop: 8, color: "#666"}}>Liên hệ với chủ phiên để được phân công quyền upload.</p>
        </div>
      )}

      {/* Upload */}
      <section
        className={`upload-dropzone ${!selectedSessionId || !canUpload ? "disabled" : ""}`}
        onDragOver={(e) => { if (!canUpload || isProcessing) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canUpload && !isProcessing ? onDrop : undefined}
      >
        <div className={`drop-area ${dragOver ? "active" : ""}`}>
          <button
            className="btn-upload-main"
            onClick={() => !busy && !isProcessing && selectedSessionId && canUpload && setShowMethodPicker(true)}
            disabled={busy || isProcessing || !selectedSessionId || !canUpload}
          >
            {isProcessing ? "Đang kiểm phiếu..." : "📤 Upload phiếu"}
          </button>
          <p className="hint-text" style={{ marginTop: 10 }}>
            Hoặc kéo &amp; thả ảnh vào đây{busy ? " • Đang upload..." : ""}
          </p>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={onFileInputChange}
            disabled={busy || isProcessing}
            style={{ display: "none" }}
          />
        </div>

        {images.length > 0 && (
          <div className="upload-actions">
            <button onClick={() => setShowMethodPicker(true)} className="btn" disabled={busy || isProcessing || !canUpload}>
              Thêm ảnh
            </button>
            <button onClick={handleClearAll} className="btn btn--danger" disabled={!canUpload || isProcessing}>
              Xóa tất cả ({images.length})
            </button>
          </div>
        )}
      </section>

      {/* Thư viện ảnh */}
      <section className="gallery-section">
        <div className="gallery-header">
          <h2>Ảnh đã tải:</h2>
        </div>

        {images.length === 0 ? (
          <p className="muted-text">Chưa có ảnh nào cho phiên này.</p>
        ) : (
          <div className="gallery-grid">
            {images.map((img, idx) => (
              <figure key={img.id} className="gallery-item">
                <img
                  src={img.url}
                  alt={img.name}
                  onClick={() => openViewer(idx)}
                  style={{ cursor: "zoom-in" }}
                />
                <figcaption>
                  <div className="image-name" title={img.name}>
                    {img.name}
                  </div>
                  <div className="image-size">
                    {typeof img.size === "number" ? `${nf.format(Math.round(img.size / 1024))} KB` : "—"}
                  </div>
                  <button onClick={() => handleDelete(img.id)} className="btn btn--danger" disabled={!canUpload || isProcessing}>
                    Xóa
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Method picker modal */}
      {showMethodPicker && (
        <UploadMethodModal
          onPickFile={() => { setShowMethodPicker(false); fileInputRef.current?.click(); }}
          onCamera={() => { setShowMethodPicker(false); setShowCamera(true); }}
          onClose={() => setShowMethodPicker(false)}
        />
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onPhotos={handleCameraPhotos}
          onClose={() => setShowCamera(false)}
          onFallbackFilePicker={() => { setShowCamera(false); fileInputRef.current?.click(); }}
        />
      )}

      {/* LIGHTBOX VIEWER */}
      {viewer.open && images[viewer.index] && (
        <div className="lightbox" onClick={closeViewer} role="dialog" aria-modal="true">
          <div className="lightbox__backdrop" />
          <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox__close" onClick={closeViewer} aria-label="Đóng">×</button>
            <button
              className="lightbox__nav lightbox__nav--left"
              onClick={() => setViewer((v) => ({ ...v, index: (v.index - 1 + images.length) % images.length }))}
              aria-label="Ảnh trước"
            >
              ‹
            </button>
            <img className="lightbox__img" src={images[viewer.index].url} alt={images[viewer.index].name} />
            <button
              className="lightbox__nav lightbox__nav--right"
              onClick={() => setViewer((v) => ({ ...v, index: (v.index + 1) % images.length }))}
              aria-label="Ảnh kế"
            >
              ›
            </button>
            <div className="lightbox__caption">
              {images[viewer.index].name} ({viewer.index + 1}/{images.length})
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadVotes;