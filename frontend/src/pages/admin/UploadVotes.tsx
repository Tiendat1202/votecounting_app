import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  uploadVoteFiles,
  getUploadedFiles,
  deleteUploadedFile,
  deleteAllUploadedFiles,
  getSessions,
  requestSessionAccess,
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
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: start polling for a given sessionId (stable reference via useCallback)
  const startPolling = useCallback((sessionId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/sessions/${sessionId}/progress`);
        const data = await r.json();
        setAiTotal(data.total);
        setAiDone(data.processed);
        setAiProgress(data.percent);
        if (data.percent >= 100) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setIsProcessing(false);
        }
      } catch {}
    }, 1500);
  }, []);

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
  const canRequestAccess = !!selectedSession && !canUpload;

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
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${fn}`,
        }));
        setImages(ui);
        const key = `vc_images_${selectedSessionId}`;
        localStorage.setItem(key, JSON.stringify(ui));
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
        const r = await fetch(`/api/sessions/${selectedSessionId}/progress`);
        const data = await r.json();
        if (data.total > 0) {
          setAiTotal(data.total);
          setAiDone(data.processed);
          setAiProgress(data.percent);
          if (data.percent < 100) {
            setIsProcessing(true);
            startPolling(selectedSessionId);
          } else {
            setIsProcessing(false);
          }
        } else {
          // No votes yet — reset progress bar so it stays hidden
          setAiProgress(0);
          setAiDone(0);
          setAiTotal(0);
          setIsProcessing(false);
        }
      } catch { /* silent – progress bar stays hidden */ }
    })();
  }, [selectedSessionId]);

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
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${f.filename}`,
        }));
        const updated = [...appended, ...images];
        setImages(updated);
        
        // Lưu vào localStorage
        const key = `vc_images_${selectedSessionId}`;
        localStorage.setItem(key, JSON.stringify(updated));

        // Start AI progress polling
        setAiProgress(0);
        setAiDone(0);
        setIsProcessing(true);
        startPolling(selectedSessionId);
      } else {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${fn}`,
        }));
        setImages(ui);
        
        // Lưu vào localStorage
        const key = `vc_images_${selectedSessionId}`;
        localStorage.setItem(key, JSON.stringify(ui));
      }
    } catch (err: any) {
      alert(`Upload thất bại: ${err?.message || "Không rõ lỗi"}`);
      console.error(err);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // xóa 1 ảnh
  const handleDelete = async (filename: string) => {
    if (!selectedSessionId || !canUpload) return;
    try {
      await deleteUploadedFile(selectedSessionId, filename);
      const updated = images.filter((img) => img.id !== filename);
      setImages(updated);
      
      // Cập nhật localStorage
      const key = `vc_images_${selectedSessionId}`;
      localStorage.setItem(key, JSON.stringify(updated));
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
      
      // Xóa khỏi localStorage
      const key = `vc_images_${selectedSessionId}`;
      localStorage.removeItem(key);
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

  return (
    <div className="upload-container">
      <div className="upload-header">
        <div>
          <h1 className="upload-title">Tải ảnh lá phiếu</h1>
          <p className="upload-subtitle">Chọn đúng phiên đang diễn ra, sau đó tải ảnh từ máy hoặc chụp nhanh để hệ thống AI xử lý.</p>
        </div>
      </div>

      {/* AI Processing Progress — below title */}
      {(isProcessing || aiProgress > 0) && (
        <section className="ai-progress-section">
          <div className="ai-progress-header">
            <span className="ai-progress-label">
              {aiProgress >= 100 ? "✅ Tất cả phiếu đã được xử lý xong" : "🤖 AI đang xử lý phiếu..."}
            </span>
            <span className="ai-progress-count">{aiDone} / {aiTotal} phiếu</span>
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
          <div className="ai-progress-footer">
            {aiProgress >= 100 ? (
              <a href="/results" className="ai-progress-results-link">Xem kết quả →</a>
            ) : (
              `${aiProgress}% hoàn thành`
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
            Bạn chưa có quyền upload phiếu cho phiên này. Chỉ inspector tạo phiên hoặc inspector đã được cấp quyền mới được tải phiếu.
          </div>
          {canRequestAccess && (
            <button
              className="btn btn--primary-accent"
              onClick={async () => {
                try {
                  await requestSessionAccess(selectedSessionId, ["upload", "review"], "Xin tham gia tải phiếu và chỉnh sửa kết quả cho phiên này.");
                  alert("Đã gửi yêu cầu tới chủ phiên.");
                } catch (e: any) {
                  alert(e?.message || "Không gửi được yêu cầu");
                }
              }}
            >
              Yêu cầu quyền
            </button>
          )}
        </div>
      )}

      {/* Upload */}
      <section
        className={`upload-dropzone ${!selectedSessionId || !canUpload ? "disabled" : ""}`}
        onDragOver={(e) => { if (!canUpload) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canUpload ? onDrop : undefined}
      >
        <div className={`drop-area ${dragOver ? "active" : ""}`}>
          <button
            className="btn-upload-main"
            onClick={() => !busy && selectedSessionId && canUpload && setShowMethodPicker(true)}
            disabled={busy || !selectedSessionId || !canUpload}
          >
            📤 Upload phiếu
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
            disabled={busy}
            style={{ display: "none" }}
          />
        </div>

        {images.length > 0 && (
          <div className="upload-actions">
            <button onClick={() => setShowMethodPicker(true)} className="btn" disabled={busy || !canUpload}>
              Thêm ảnh
            </button>
            <button onClick={handleClearAll} className="btn btn--danger" disabled={!canUpload}>
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
                  <button onClick={() => handleDelete(img.id)} className="btn btn--danger" disabled={!canUpload}>
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