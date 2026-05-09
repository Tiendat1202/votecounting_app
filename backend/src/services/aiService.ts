import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs";

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8000";

interface AIBatchResponse {
  batch_id: string;
  total?: number;
  total_files?: number;
  queue_job_ids?: string[];
  job_ids?: string[];
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
  parsed: any;
  processor?: string;
}

type NormalizationResult = {
  parsed: any;
  warnings: string[];
};

export class AIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: AI_BACKEND_URL,
      timeout: 300000,
    });
  }

  private tryParseJson(input: string): any | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  private extractFirstJsonObject(input: string): any | null {
    const source = String(input || "");
    const start = source.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          return this.tryParseJson(candidate);
        }
      }
    }

    return null;
  }

  private normalizeParsedPayload(rawParsed: any): NormalizationResult {
    const warnings: string[] = [];
    let parsed = rawParsed;

    if (typeof parsed === "string") {
      const direct = this.tryParseJson(parsed);
      const extracted = direct ?? this.extractFirstJsonObject(parsed);
      if (extracted && typeof extracted === "object") {
        parsed = extracted;
      } else {
        warnings.push("parsed is a string but could not be decoded as JSON");
        parsed = { raw: parsed };
      }
    }

    if (!parsed || typeof parsed !== "object") {
      warnings.push("parsed payload is not an object; wrapped into raw field");
      parsed = { raw: String(parsed ?? "") };
    }

    const parsedFull = parsed?.parsed_full;
    if (parsedFull && typeof parsedFull !== "object") {
      warnings.push("parsed.parsed_full exists but is not an object");
    }

    if (!parsed.full_analysis || typeof parsed.full_analysis !== "object") {
      if (parsedFull && typeof parsedFull === "object") {
        parsed.full_analysis = { ...parsedFull };
      } else {
        parsed.full_analysis = {};
      }
    }

    const rawFullAnalysis = parsed?.full_analysis?.raw;
    if (typeof rawFullAnalysis === "string") {
      const direct = this.tryParseJson(rawFullAnalysis);
      const extracted = direct ?? this.extractFirstJsonObject(rawFullAnalysis);

      if (extracted && typeof extracted === "object") {
        parsed.full_analysis = {
          ...parsed.full_analysis,
          ...extracted,
        };
      } else {
        warnings.push("parsed.full_analysis.raw is string but JSON extraction failed");
      }
    }

    if (parsed.content_text !== undefined) {
      parsed.content_text = parsed.content_text;
    }
    if (parsed.reasoning_text !== undefined) {
      parsed.reasoning_text = parsed.reasoning_text;
    }

    return { parsed, warnings };
  }

  private normalizeApiResult(payload: any): AIResultFile {
    const data = payload as AIResultFile;
    const { parsed, warnings } = this.normalizeParsedPayload(data?.parsed);
    data.parsed = parsed;

    if (warnings.length > 0) {
      data.parsed = {
        ...data.parsed,
        _normalizationWarnings: [
          ...(Array.isArray(data.parsed?._normalizationWarnings)
            ? data.parsed._normalizationWarnings
            : []),
          ...warnings,
        ],
      };
      console.warn("AI response normalization warnings:", warnings, {
        batch_id: data.batch_id,
        job_id: data.job_id,
      });
    }

    return data;
  }

  async submitBatch(
    ballotType: "trust" | "surplus",
    imagePaths: string[],
    modelName?: string,
    promptVersion: number = 1
  ): Promise<AIBatchResponse> {
    const formData = new FormData();
    formData.append("ballot_type", ballotType);
    if (modelName) formData.append("model_name", modelName);
    formData.append("prompt_version", String(promptVersion));

    for (const imagePath of imagePaths) {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      formData.append("files", fs.createReadStream(imagePath));
    }

    try {
      const response = await this.client.post<AIBatchResponse>("/api/batches", formData, {
        headers: formData.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error("Error submitting batch to AI backend:", error);
      throw error;
    }
  }

  async getBatchStatus(batchId: string): Promise<AIBatchStatus> {
    try {
      const response = await this.client.get<AIBatchStatus>(`/api/batches/${batchId}`);
      return response.data;
    } catch (error) {
      console.error("Error getting batch status:", error);
      throw error;
    }
  }

  async getBatchResults(batchId: string): Promise<string[]> {
    try {
      const response = await this.client.get<{ batch_id: string; files: string[] }>(
        `/api/batches/${batchId}/results`
      );
      return response.data.files || [];
    } catch (error) {
      console.error("Error getting batch results:", error);
      throw error;
    }
  }

  async getResultFile(batchId: string, filename: string): Promise<AIResultFile> {
    try {
      const response = await this.client.get<AIResultFile>(
        `/api/batches/${batchId}/results/${filename}`
      );
      return this.normalizeApiResult(response.data);
    } catch (error) {
      console.error("Error getting result file:", error);
      throw error;
    }
  }

  async processSync(
    ballotType: "trust" | "surplus",
    imagePath: string,
    officialCandidates?: string[]
  ): Promise<AIResultFile> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const formData = new FormData();
    formData.append("ballot_type", ballotType);
    if (officialCandidates && officialCandidates.length > 0) {
      formData.append("candidates", JSON.stringify(officialCandidates));
    }
    formData.append("files", fs.createReadStream(imagePath));

    try {
      const response = await this.client.post<AIResultFile>("/api/process", formData, {
        headers: formData.getHeaders(),
      });
      return this.normalizeApiResult(response.data);
    } catch (error) {
      console.error("Error in processSync:", error);
      throw error;
    }
  }

  async processAndWait(
    ballotType: "trust" | "surplus",
    imagePath: string,
    pollIntervalMs: number = 1000,
    maxWaitMs: number = 120000, // Increased from 60s to 2 minutes
    officialCandidates?: string[]
  ): Promise<AIResultFile> {
    console.log(`[AIService] Starting processAndWait for ${ballotType}:`, {
      imagePath,
      pollIntervalMs,
      maxWaitMs,
    });

    try {
      console.log(`[AIService] Attempting sync processing...`);
      const result = await this.processSync(ballotType, imagePath, officialCandidates);
      console.log(`[AIService] Sync processing succeeded`);
      return result;
    } catch (error) {
      console.error(`[AIService] Sync processing failed, falling back to batch flow:`, error);
    }

    console.log(`[AIService] Starting batch processing for ${ballotType}`);
    const batchResp = await this.submitBatch(ballotType, [imagePath]);
    const batchId = batchResp.batch_id;
    console.log(`[AIService] Batch submitted with ID: ${batchId}`);

    const startTime = Date.now();
    let lastLogTime = startTime;
    const logIntervalMs = 5000; // Log status every 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const elapsedMs = Date.now() - startTime;
      
      // Log progress every 5 seconds
      if (Date.now() - lastLogTime > logIntervalMs) {
        console.log(`[AIService] Batch ${batchId} still processing... (${elapsedMs}ms elapsed)`);
        lastLogTime = Date.now();
      }

      const status = await this.getBatchStatus(batchId);
      console.log(`[AIService] Batch ${batchId} status:`, status);
      
      if (status.done > 0) {
        console.log(`[AIService] Batch ${batchId} completed! Fetching results...`);
        const files = await this.getBatchResults(batchId);
        
        if (files.length > 0) {
          console.log(`[AIService] Getting result file: ${files[0]}`);
          const result = await this.getResultFile(batchId, files[0]);
          console.log(`[AIService] Result file retrieved successfully`);
          return result;
        } else {
          console.warn(`[AIService] Batch ${batchId} completed but no result files found`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const timeoutError = `Timeout waiting for AI result after ${maxWaitMs}ms for batch ${batchId}`;
    console.error(`[AIService] ${timeoutError}`);
    throw new Error(timeoutError);
  }
}

export default new AIService();
