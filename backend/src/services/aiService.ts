import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs";

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8000";

interface AIBatchResponse {
  batch_id: string;
  total: number;
  queue_job_ids: string[];
}

interface AIBatchStatus {
  batch_id: string;
  done: number;
  total?: number;
}

interface AIResultFile {
  batch_id: string;
  job_id: string;
  ballot_type: string;
  image_path: string;
  ok: boolean;
  error: string | null;
  latency_ms: number;
  usage: any;
  parsed: any; // AI's parsed result (candidate info, confidence, etc.)
}

export class AIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: AI_BACKEND_URL,
      timeout: 300000, // 5 minutes for inference
    });
  }

  /**
   * Submit ballot images for AI processing
   * @param ballotType "trust" or "surplus"
   * @param imagePaths Array of file paths
   * @param modelName Optional model name
   * @param promptVersion Prompt version (default 1)
   */
  async submitBatch(
    ballotType: "trust" | "surplus",
    imagePaths: string[],
    modelName?: string,
    promptVersion: number = 1
  ): Promise<AIBatchResponse> {
    try {
      const formData = new FormData();
      formData.append("ballot_type", ballotType);
      if (modelName) formData.append("model_name", modelName);
      formData.append("prompt_version", promptVersion.toString());

      // Append image files
      for (const imagePath of imagePaths) {
        if (!fs.existsSync(imagePath)) {
          throw new Error(`Image file not found: ${imagePath}`);
        }
        formData.append("files", fs.createReadStream(imagePath));
      }

      const response = await this.client.post<AIBatchResponse>(
        "/api/batches",
        formData,
        {
          headers: formData.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error submitting batch to AI backend:", error);
      throw error;
    }
  }

  /**
   * Check batch status
   * @param batchId Batch ID from submitBatch response
   */
  async getBatchStatus(batchId: string): Promise<AIBatchStatus> {
    try {
      const response = await this.client.get<AIBatchStatus>(
        `/api/batches/${batchId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error getting batch status:", error);
      throw error;
    }
  }

  /**
   * Get list of result files from a batch
   * @param batchId Batch ID
   */
  async getBatchResults(batchId: string): Promise<string[]> {
    try {
      const response = await this.client.get<{ batch_id: string; files: string[] }>(
        `/api/batches/${batchId}/results`
      );
      return response.data.files;
    } catch (error) {
      console.error("Error getting batch results:", error);
      throw error;
    }
  }

  /**
   * Get single result file
   * @param batchId Batch ID
   * @param filename Filename (e.g., "job_xyz.json")
   */
  async getResultFile(batchId: string, filename: string): Promise<AIResultFile> {
    try {
      const response = await this.client.get<AIResultFile>(
        `/api/batches/${batchId}/results/${filename}`
      );
      return response.data;
    } catch (error) {
      console.error("Error getting result file:", error);
      throw error;
    }
  }

  /**
   * Process single ballot image synchronously
   * Direct API call to AI backend without job queue
   * @param ballotType "trust" or "surplus"
   * @param imagePath Path to image file
   */
  async processSync(
    ballotType: "trust" | "surplus",
    imagePath: string
  ): Promise<AIResultFile> {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      const formData = new FormData();
      formData.append("ballot_type", ballotType);
      formData.append("files", fs.createReadStream(imagePath));

      const response = await this.client.post<AIResultFile>(
        "/api/process",
        formData,
        {
          headers: formData.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error in processSync:", error);
      throw error;
    }
  }

  /**
   * Process single ballot image and wait for result
   * This is a convenience method that submits and polls for result
   * @param ballotType "trust" or "surplus"
   * @param imagePath Path to image file
   * @param pollIntervalMs Polling interval in ms (default 1000)
   * @param maxWaitMs Max wait time in ms (default 60000 = 1 min)
   */
  async processAndWait(
    ballotType: "trust" | "surplus",
    imagePath: string,
    pollIntervalMs: number = 1000,
    maxWaitMs: number = 60000
  ): Promise<AIResultFile> {
    // Try sync endpoint first
    try {
      return await this.processSync(ballotType, imagePath);
    } catch (error) {
      console.warn("Sync processing failed, trying batch queue:", error);
    }

    // Fallback to batch queue if sync fails
    // Submit batch
    const batchResp = await this.submitBatch(ballotType, [imagePath]);
    const batchId = batchResp.batch_id;

    // Poll for result
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBatchStatus(batchId);
      
      if (status.done > 0) {
        // Result ready, fetch it
        const results = await this.getBatchResults(batchId);
        if (results.length > 0) {
          const resultFile = await this.getResultFile(batchId, results[0]);
          return resultFile;
        }
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Timeout waiting for AI result after ${maxWaitMs}ms`);
  }
}

export default new AIService();
