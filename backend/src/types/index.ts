export interface VoteRequest {
  candidate: string;
  notes?: string;
}

export interface VoteResponse {
  id: string;
  candidate: string;
  createdAt: Date;
  status: string;
}

export interface VoteResult {
  candidate: string;
  votes: number;
  percentage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// AI Validation types
export interface ValidationResult {
  ballot_id?: string;
  ballot_type?: string;
  validity: "VALID" | "INVALID" | "UNKNOWN" | "ERROR";
  invalid_reasons: string[];
  ballot_details?: any[];
  agree_count?: number;
  double_mark_count?: number;
  seats?: number;
}

export interface AIResultFile {
  batch_id: string;
  job_id: string;
  ballot_type: string;
  image_path: string;
  ok: boolean;
  error: string | null;
  latency_ms: number;
  usage: any;
  parsed: any;
  validation?: ValidationResult;
  processor: string;
}