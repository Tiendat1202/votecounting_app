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