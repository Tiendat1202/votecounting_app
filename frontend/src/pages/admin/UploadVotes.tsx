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
const BACKEND_BASE = "http://localhost:5050";

const UploadVotes: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [images, setImages] = useState<UIImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  // Lấy danh sách phiên từ backend
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

  // Nếu có param :id và có phiên khớp → chọn sẵn
  useEffect(() => {
    if (paramId && allSessions.find((s) => s.id === paramId)) {
      setSelectedSessionId(paramId);
    }
  }, [paramId, allSessions]);

  // Auto-chọn phiên đang diễn ra đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedSessionId && runningSessions.length > 0) {
      setSelectedSessionId(runningSessions[0].id);
    }
  }, [runningSessions, selectedSessionId]);

  // Tải danh sách ảnh khi đổi phiên
  useEffect(() => {
    if (!selectedSessionId) return;
    (async () => {
      try {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${fn}`,
        }));
        setImages(ui);
      } catch (e) {
        console.error("Lỗi tải danh sách ảnh:", e);
        setImages([]);
      }
    })();
  }, [selectedSessionId]);

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
          url: `${BACKEND_BASE}/uploads/${f.filename}`,
        }));
        setImages((prev) => [...appended, ...prev]);
      } else {
        const list: string[] = await getUploadedFiles(selectedSessionId);
        const ui = list.map((fn) => ({
          id: fn,
          name: fn,
          url: `${BACKEND_BASE}/uploads/${fn}`,
        }));
        setImages(ui);
      }
    } catch (err: any) {
      alert(`Upload thất bại: ${err?.message || "Không rõ lỗi"}`);
      console.error(err);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (filename: string) => {
    if (!selectedSessionId) return;
    try {
      await deleteUploadedFile(selectedSessionId, filename);
      setImages((prev) => prev.filter((img) => img.id !== filename));
    } catch (e) {
      alert("Lỗi khi xóa ảnh.");
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!selectedSessionId) return;
    if (!confirm("Bạn có chắc muốn xóa TẤT CẢ ảnh của phiên này?")) return;
    try {
      await deleteAllUploadedFiles(selectedSessionId);
      setImages([]);
    } catch (e) {
      alert("Lỗi khi xóa tất cả ảnh.");
      console.error(e);
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <div className="upload-container">
      <h1 className="upload-title">Tải ảnh lá phiếu (AI)</h1>

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

      <section className="gallery-section">
        <div className="gallery-header">
          <h2>Ảnh đã tải {selectedSession ? `— ${selectedSession.name}` : ""}</h2>
        </div>

        {images.length === 0 ? (
          <p className="muted-text">Chưa có ảnh nào cho phiên này.</p>
        ) : (
          <div className="gallery-grid">
            {images.map((img) => (
              <figure key={img.id} className="gallery-item">
                <img src={img.url} alt={img.name} />
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
    </div>
  );
};

export default UploadVotes;
