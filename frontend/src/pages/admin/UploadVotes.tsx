import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVoteSessions } from "../../context/VoteSessionContext";
import "./UploadVotes.css";

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

type UploadedImage = {
  id: string;
  name: string;
  size: number;
  src: string;
  addedAt: number;
};

const storageKey = (sessionId: string) => `vc_images_${sessionId}`;
function loadImages(sessionId: string): UploadedImage[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as UploadedImage[]) : [];
  } catch {
    return [];
  }
}
function saveImages(sessionId: string, images: UploadedImage[]) {
  localStorage.setItem(storageKey(sessionId), JSON.stringify(images));
}

const nf = new Intl.NumberFormat("vi-VN");

const UploadVotes: React.FC = () => {
  const { sessions } = useVoteSessions();
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runningSessions = useMemo(
    () =>
      sessions.filter(
        (s) => getSessionStatus(s.startAt, s.endAt) === "Đang diễn ra"
      ),
    [sessions]
  );

  useEffect(() => {
    if (!selectedSessionId && runningSessions.length > 0) {
      setSelectedSessionId(runningSessions[0].id);
    }
  }, [runningSessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setImages(loadImages(selectedSessionId));
  }, [selectedSessionId]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !selectedSessionId) return;
    const accepted = Array.from(fileList).filter((f) =>
      /image\/(png|jpe?g|webp)/i.test(f.type)
    );

    const toDataURL = (file: File) =>
      new Promise<UploadedImage>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () =>
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            src: String(fr.result),
            addedAt: Date.now(),
          });
        fr.onerror = () => reject(new Error("Read file error"));
        fr.readAsDataURL(file);
      });

    const newImages = await Promise.all(accepted.map(toDataURL));
    setImages((prev) => {
      const next = [...prev, ...newImages];
      saveImages(selectedSessionId, next);
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    if (!selectedSessionId) return;
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      saveImages(selectedSessionId, next);
      return next;
    });
  };

  const handleClearAll = () => {
    if (!selectedSessionId) return;
    if (!confirm("Xóa tất cả ảnh của phiên này?")) return;
    setImages([]);
    saveImages(selectedSessionId, []);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) || null;

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
            Hiện không có phiên nào đang diễn ra. Vui lòng tạo phiên hoặc chờ
            đến thời gian mở phiên.
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
                {s.name} — Mở:{" "}
                {s.startAt ? new Date(s.startAt).toLocaleString("vi-VN") : "—"}{" "}
                | Đóng:{" "}
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
        <div
          className={`drop-area ${dragOver ? "active" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="drop-text">
            Kéo & thả ảnh vào đây hoặc{" "}
            <span className="file-link">chọn nhiều ảnh</span>
          </p>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
          <p className="hint-text">Hỗ trợ: PNG, JPG, JPEG, WEBP</p>
        </div>

        {images.length > 0 && (
          <div className="upload-actions">
            <button onClick={() => fileInputRef.current?.click()} className="btn">
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
          <h2>
            Ảnh đã tải {selectedSession ? `— ${selectedSession.name}` : ""}
          </h2>
          <span className="muted-text">
            Tổng: <strong>{nf.format(images.length)}</strong> ảnh
          </span>
        </div>

        {images.length === 0 ? (
          <p className="muted-text">Chưa có ảnh nào cho phiên này.</p>
        ) : (
          <div className="gallery-grid">
            {images
              .slice()
              .sort((a, b) => b.addedAt - a.addedAt)
              .map((img) => (
                <figure key={img.id} className="gallery-item">
                  <img src={img.src} alt={img.name} />
                  <figcaption>
                    <div className="image-name" title={img.name}>
                      {img.name}
                    </div>
                    <div className="image-size">
                      {nf.format(Math.round(img.size / 1024))} KB
                    </div>
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="btn btn--danger"
                    >
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
