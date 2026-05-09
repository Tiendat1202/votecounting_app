import React, { useEffect, useState } from "react";
import "./UploadVotes.css";

interface Props {
  onPickFile: () => void;
  onCamera: () => void;
  onClose: () => void;
}

const UploadMethodModal: React.FC<Props> = ({ onPickFile, onCamera, onClose }) => {
  const [cameraSupported, setCameraSupported] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
    );
    setIsDesktop(window.innerWidth > 1024);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="method-modal-overlay" onClick={onClose}>
      <div className="method-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="method-modal-title">Chọn cách thêm ảnh phiếu</h2>

        <div className="method-option-cards">
          {/* Card 1: File picker */}
          <button className="method-option-card" onClick={onPickFile}>
            <div className="method-option-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0F62FE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="method-option-label">Tải ảnh lên</div>
            <div className="method-option-desc">
              Chọn ảnh có sẵn từ thiết bị · Hỗ trợ nhiều ảnh cùng lúc
            </div>
          </button>

          {/* Card 2: Camera */}
          <div className="method-option-card-wrapper">
            <button
              className={`method-option-card ${!cameraSupported ? "method-option-card--disabled" : ""}`}
              onClick={cameraSupported ? onCamera : undefined}
              disabled={!cameraSupported}
              title={!cameraSupported ? "Trình duyệt không hỗ trợ camera" : undefined}
            >
              <div className="method-option-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={cameraSupported ? "#0F62FE" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7 16 12 23 17V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div className="method-option-label" style={{ color: cameraSupported ? undefined : "#94a3b8" }}>
                Chụp ảnh
              </div>
              <div className="method-option-desc">
                {cameraSupported
                  ? "Dùng camera để chụp phiếu · Phù hợp khi kiểm phiếu trực tiếp"
                  : "Trình duyệt không hỗ trợ camera"}
              </div>
            </button>
            {cameraSupported && isDesktop && (
              <p className="method-camera-hint">
                💡 Khuyến nghị dùng điện thoại để chụp phiếu rõ hơn
              </p>
            )}
          </div>
        </div>

        <button className="method-cancel-btn" onClick={onClose}>
          Hủy
        </button>
      </div>
    </div>
  );
};

export default UploadMethodModal;
