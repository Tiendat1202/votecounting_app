import React, { useCallback, useEffect, useRef, useState } from "react";
import "./CameraModal.css";

interface Props {
  onPhotos: (files: File[]) => void;
  onClose: () => void;
  onFallbackFilePicker: () => void;
}

type CameraState = "requesting" | "preview" | "review" | "error";

const CameraModal: React.FC<Props> = ({ onPhotos, onClose, onFallbackFilePicker }) => {
  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    stopStream();
    setCameraState("requesting");
    try {
      // Check how many video inputs exist
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoInputs.length > 1);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState("preview");
    } catch {
      setCameraState("error");
    }
  }, [stopStream]);

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode);
    return () => stopStream();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update video element when stream changes
  useEffect(() => {
    if (cameraState === "preview" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  // Clean up review object URL
  useEffect(() => {
    return () => {
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    };
  }, [reviewUrl]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  const flipCamera = useCallback(() => {
    const next: "environment" | "user" = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (reviewUrl) URL.revokeObjectURL(reviewUrl);
        const url = URL.createObjectURL(blob);
        setReviewBlob(blob);
        setReviewUrl(url);
        setCameraState("review");
      },
      "image/jpeg",
      0.88
    );
  }, [reviewUrl]);

  const rotateImage = useCallback(
    (degrees: 90 | -90) => {
      if (!reviewBlob || !reviewUrl) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const abs = Math.abs(degrees);
        if (abs === 90) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext("2d")!;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            URL.revokeObjectURL(reviewUrl);
            const url = URL.createObjectURL(blob);
            setReviewBlob(blob);
            setReviewUrl(url);
          },
          "image/jpeg",
          0.88
        );
      };
      img.src = reviewUrl;
    },
    [reviewBlob, reviewUrl]
  );

  const acceptPhoto = useCallback(
    (blob: Blob): File => {
      const name = `camera_${Date.now()}_${capturedFiles.length + 1}.jpg`;
      return new File([blob], name, { type: "image/jpeg" });
    },
    [capturedFiles.length]
  );

  // "Chụp tiếp" — accept + go back to camera
  const handleKeepAndContinue = useCallback(() => {
    if (!reviewBlob) return;
    const file = acceptPhoto(reviewBlob);
    setCapturedFiles((prev) => [...prev, file]);
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewBlob(null);
    setReviewUrl("");
    setCameraState("preview");
  }, [reviewBlob, reviewUrl, acceptPhoto]);

  // "Dùng ảnh này & Hoàn tất" — accept + upload all
  const handleFinish = useCallback(() => {
    if (!reviewBlob) return;
    const file = acceptPhoto(reviewBlob);
    const all = [...capturedFiles, file];
    stopStream();
    onPhotos(all);
    onClose();
  }, [reviewBlob, capturedFiles, acceptPhoto, stopStream, onPhotos, onClose]);

  // "Hoàn tất" without a new photo (from preview state, after capturing ≥1)
  const handleFinishWithExisting = useCallback(() => {
    if (capturedFiles.length === 0) {
      handleClose();
      return;
    }
    stopStream();
    onPhotos(capturedFiles);
    onClose();
  }, [capturedFiles, stopStream, onPhotos, onClose, handleClose]);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (cameraState === "requesting") {
    return (
      <div className="cam-modal">
        <div className="cam-requesting">
          <div className="cam-spinner" />
          <p>Đang yêu cầu quyền camera…</p>
        </div>
      </div>
    );
  }

  if (cameraState === "error") {
    return (
      <div className="cam-modal">
        <div className="cam-error">
          <span className="cam-error-icon">⚠️</span>
          <p className="cam-error-msg">Ứng dụng cần quyền camera để chụp ảnh phiếu</p>
          <div className="cam-error-actions">
            <button className="cam-btn cam-btn--primary" onClick={() => startCamera(facingMode)}>
              Thử lại
            </button>
            <button
              className="cam-btn cam-btn--secondary"
              onClick={() => { handleClose(); onFallbackFilePicker(); }}
            >
              Tải ảnh lên thay thế
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cameraState === "review") {
    return (
      <div className="cam-modal cam-modal--review">
        <div className="cam-review-header">
          <span className="cam-review-title">Xem lại ảnh vừa chụp</span>
          {capturedFiles.length > 0 && (
            <span className="cam-captured-badge">{capturedFiles.length} ảnh đã chụp</span>
          )}
        </div>

        <div className="cam-review-body">
          <img src={reviewUrl} alt="Ảnh vừa chụp" className="cam-review-img" />

          <div className="cam-rotate-strip">
            <button className="cam-btn cam-btn--icon" onClick={() => rotateImage(-90)} title="Xoay trái">
              ↺ Xoay trái
            </button>
            <button className="cam-btn cam-btn--icon" onClick={() => rotateImage(90)} title="Xoay phải">
              ↻ Xoay phải
            </button>
          </div>

          <p className="cam-quality-hint">
            Kiểm tra: ảnh không mờ · đủ 4 góc · thấy rõ dấu đánh · không bị che tay / bóng đổ
          </p>
        </div>

        <div className="cam-review-actions">
          <button
            className="cam-btn cam-btn--secondary"
            onClick={() => {
              if (reviewUrl) URL.revokeObjectURL(reviewUrl);
              setReviewBlob(null);
              setReviewUrl("");
              setCameraState("preview");
            }}
          >
            Chụp lại
          </button>
          <button className="cam-btn cam-btn--secondary" onClick={handleKeepAndContinue}>
            Chụp tiếp
          </button>
          <button className="cam-btn cam-btn--primary" onClick={handleFinish}>
            ✓ Dùng ảnh này &amp; Hoàn tất
          </button>
        </div>
      </div>
    );
  }

  // ─── Preview (live camera) ────────────────────────────────────────────────
  return (
    <div className="cam-modal">
      {/* Top bar */}
      <div className="cam-topbar">
        <button className="cam-btn cam-btn--ghost" onClick={handleClose}>
          ✕ Đóng
        </button>
        <div className="cam-topbar-right">
          {capturedFiles.length > 0 && (
            <button className="cam-btn cam-btn--finish" onClick={handleFinishWithExisting}>
              Hoàn tất ({capturedFiles.length} ảnh)
            </button>
          )}
          {hasMultipleCameras && (
            <button className="cam-btn cam-btn--ghost" onClick={flipCamera} title="Đổi camera">
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="cam-video-wrapper">
        <video
          ref={videoRef}
          className="cam-video"
          autoPlay
          playsInline
          muted
        />
        <div className="cam-guide-rect">
          <span className="cam-guide-label">Căn đủ 4 góc phiếu trong khung</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="cam-bottombar">
        {/* Thumbnail strip */}
        {capturedFiles.length > 0 && (
          <div className="cam-thumb-strip">
            <span className="cam-thumb-count">Đã chụp {capturedFiles.length} ảnh</span>
          </div>
        )}
        <div className="cam-capture-row">
          <button className="cam-capture-btn" onClick={takeSnapshot} aria-label="Chụp ảnh" />
        </div>
        <p className="cam-hint-text">Đặt phiếu vào giữa khung hình · Chụp rõ toàn bộ phiếu</p>
      </div>

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default CameraModal;
