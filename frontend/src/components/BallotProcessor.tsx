import React, { useRef, useState } from "react";
import { aiApi } from "../api/aiApi";
import "./BallotProcessor.css";

interface BallotProcessorProps {
  sessionId: string;
  ballotType: "trust" | "surplus";
  onUploadComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export const BallotProcessor: React.FC<BallotProcessorProps> = ({
  sessionId,
  ballotType,
  onUploadComplete,
  onError,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const processFile = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(0);

      console.log("📤 Starting ballot upload:", {
        filename: file.name,
        size: file.size,
        type: file.type,
        ballotType,
        sessionId,
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => {
          const next = p + Math.random() * 30;
          return next > 90 ? 90 : next;
        });
      }, 500);

      // Process ballot
      const aiResult = await aiApi.processVoteImage(file, ballotType, sessionId);

      clearInterval(progressInterval);
      setProgress(100);

      console.log("Ballot processed:", aiResult);

      if (aiResult.success) {
        setResult(aiResult);
        onUploadComplete?.(aiResult);
      } else {
        const errorMsg = aiResult.result?.error || "Unknown AI error";
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      console.error("Ballot processing error:", errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="ballot-processor">
      {!result && (
        <div
          className={`dropzone ${dragOver ? "drag-over" : ""} ${
            loading ? "loading" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {loading ? (
            <div className="loading-content">
              <div className="spinner"></div>
              <p>Đang xử lý...</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="progress-text">{Math.round(progress)}%</p>
            </div>
          ) : (
            <div className="dropzone-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7V12C2 16.4183 5.58172 20 10 20H14C18.4183 20 22 16.4183 22 12V7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 9V15M9 12H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <p className="title">Kéo thả hoặc nhấp để tải lên</p>
              <p className="subtitle">PNG, JPG, WebP | Tối đa 10MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      )}

      {error && (
        <div className="error-message">
          <p className="error-title">⚠️ Lỗi</p>
          <p className="error-text">{error}</p>
          <button className="btn-retry" onClick={() => setError(null)}>
            ← Quay lại
          </button>
        </div>
      )}

      {result && result.success && (
        <div className="result-display">
          <div className="result-header">
            <p className="result-title">✓ Xử lý thành công</p>
            <p className="result-time">{result.result?.latency_ms ?? 0}ms</p>
          </div>

          <div className="result-content">
            {result.result.parsed && (
              <div className="parsed-info">
                <h4>Kết quả AI:</h4>
                <div className="parsed-data">
                  {result.result.parsed.selected_candidate ? (
                    <>
                      <p>
                        <strong>Ứng cử viên:</strong>{" "}
                        {result.result.parsed.selected_candidate}
                      </p>
                      {result.result.parsed.confidence && (
                        <p>
                          <strong>Độ tin cậy:</strong> {(
                            result.result.parsed.confidence * 100
                          ).toFixed(1)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p>Không thể xác định ứng cử viên</p>
                  )}
                  {result.batchId && <p className="meta">Batch: {result.batchId}</p>}
                  {result.jobId && <p className="meta">Job: {result.jobId}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              ← Xử lý phiếu khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BallotProcessor;
