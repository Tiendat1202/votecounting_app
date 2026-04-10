import axios from "axios";
import type { AxiosInstance } from "axios";

const API_BASE = "http://localhost:5050/api/ai";

interface AIProcessResult {
  success: boolean;
  batchId?: string;
  jobId?: string;
  result: {
    ok: boolean;
    error: string | null;
    parsed: any; // AI's parsed result
    latency_ms: number;
    usage?: any;
  };
}

interface AIHealthResponse {
  ok: boolean;
  error?: string;
  aiBackend?: string;
}

class AIApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 300000, // 5 minutes for inference
      withCredentials: true, // Include cookies for JWT
    });

    // Add request interceptor to include JWT token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Process single vote image
   * @param file Image file to process
   * @param voteType "trust" or "surplus"
   * @param sessionId Session ID for storing results
   */
  async processVoteImage(
    file: File,
    voteType: "trust" | "surplus",
    sessionId?: string
  ): Promise<AIProcessResult> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("voteType", voteType);
      if (sessionId) {
        formData.append("sessionId", sessionId);
      }

      const { data } = await this.client.post<AIProcessResult>(
        "/process-ballot",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return data;
    } catch (error) {
      console.error("Error processing vote image:", error);
      throw error;
    }
  }

  /**
   * Process multiple ballot images in batch
   * @param files Array of image files
   * @param ballotType "trust" or "surplus"
   */
  async processBatchBallots(
    files: File[],
    ballotType: "trust" | "surplus"
  ): Promise<any> {
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      formData.append("ballotType", ballotType);

      const { data } = await this.client.post(
        "/batch-process",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return data;
    } catch (error) {
      console.error("Error processing batch:", error);
      throw error;
    }
  }

  /**
   * Check AI backend health
   */
  async checkHealth(): Promise<AIHealthResponse> {
    try {
      const { data } = await this.client.get<AIHealthResponse>("/health");
      return data;
    } catch (error) {
      console.error("Error checking AI health:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const aiApi = new AIApi();
export default aiApi;
