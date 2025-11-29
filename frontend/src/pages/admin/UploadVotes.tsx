import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  uploadVoteFiles,
  getUploadedFiles,
  deleteUploadedFile,
  deleteAllUploadedFiles,
  getSessions,
} from "../../api";
import "./UploadVotes.css";

type Session = {
  id: string;
  name: string;
  type: string;
  candidates: string[];
  startAt?: string;
  endAt?: string;
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
const BACKEND_BASE = "http://localhost:5000";

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

  // lightbox viewer
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });

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

  // tải danh sách ảnh khi đổi phiên
  useEffect(() => {
    if (!selectedSessionId) return;
    (async () => {
      try {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${fn}`,
        }));
        setImages(ui);
        
        // 👇 Lưu vào localStorage
        const key = `vc_images_${selectedSessionId}`;
        localStorage.setItem(key, JSON.stringify(ui));
      } catch (e) {
        console.error("Lỗi tải danh sách ảnh:", e);
        setImages([]);
      }
    })();
  }, [selectedSessionId]);

  // upload nhiều ảnh
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !selectedSessionId) return;
    const accepted = Array.from(fileList).filter((f) => /image\/(png|jpe?g|webp)/i.test(f.type));
    if (accepted.length === 0) return;

    try {
      setBusy(true);
      const result = await uploadVoteFiles(selectedSessionId, accepted);
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
        
        // 👇 Lưu vào localStorage
        const key = `vc_images_${selectedSessionId}`;
        localStorage.setItem(key, JSON.stringify(updated));
      } else {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${selectedSessionId}/${fn}`,
        }));
        setImages(ui);
        
        // 👇 Lưu vào localStorage
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
    if (!selectedSessionId) return;
    try {
      await deleteUploadedFile(selectedSessionId, filename);
      const updated = images.filter((img) => img.id !== filename);
      setImages(updated);
      
      // 👇 Cập nhật localStorage
      const key = `vc_images_${selectedSessionId}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      alert("Lỗi khi xóa ảnh.");
      console.error(e);
    }
  };

  // xóa tất cả ảnh
  const handleClearAll = async () => {
    if (!selectedSessionId) return;
    if (!confirm("Bạn có chắc muốn xóa TẤT CẢ ảnh của phiên này?")) return;
    try {
      await deleteAllUploadedFiles(selectedSessionId);
      setImages([]);
      
      // 👇 Xóa khỏi localStorage
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
    handleFiles(e.dataTransfer.files);
  };

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId) || null;

  // open/close viewer
  const openViewer = (index: number) => setViewer({ open: true, index });
  const closeViewer = () => setViewer((v) => ({ ...v, open: false }));

  return (
    <div className="upload-container">
      <h1 className="upload-title">Tải ảnh lá phiếu (AI)</h1>

      {/* Chọn phiên */}
      <section className="upload-section">
        <label htmlFor="session-select" className="label-strong">
          Chọn phiên đang diễn ra <span className="required">*</span>
        </label>

        {runningSessions.length === 0 ? (
          <p className="muted-text">
            Hiện không có phiên nào đang diễn ra. Vui lòng tạo phiên hoặc chờ đến thời gian mở phiên.
          </p>
        ) : (
          <select
            id="session-select"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="select"
          >
            {runningSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — Mở: {s.startAt ? new Date(s.startAt).toLocaleString("vi-VN") : "—"} | Đóng:{" "}
                {s.endAt ? new Date(s.endAt).toLocaleString("vi-VN") : "—"}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Upload */}
      <section
        className={`upload-dropzone ${!selectedSessionId ? "disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className={`drop-area ${dragOver ? "active" : ""}`} onClick={() => !busy && fileInputRef.current?.click()}>
          <p className="drop-text">
            Kéo & thả ảnh vào đây hoặc <span className="file-link">chọn nhiều ảnh</span>
          </p>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={busy}
            style={{ display: "none" }}
          />
          <p className="hint-text">Hỗ trợ: PNG, JPG, JPEG, WEBP {busy ? " • Đang upload..." : ""}</p>
        </div>

        {images.length > 0 && (
          <div className="upload-actions">
            <button onClick={() => fileInputRef.current?.click()} className="btn" disabled={busy}>
              Thêm ảnh
            </button>
            <button onClick={handleClearAll} className="btn btn--danger">
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
                  <button onClick={() => handleDelete(img.id)} className="btn btn--danger">
                    Xóa
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

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