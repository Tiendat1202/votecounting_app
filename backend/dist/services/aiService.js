"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const AI_BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8000";
class AIService {
    constructor() {
        this.client = axios_1.default.create({
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
    async submitBatch(ballotType, imagePaths, modelName, promptVersion = 1) {
        try {
            const formData = new form_data_1.default();
            formData.append("ballot_type", ballotType);
            if (modelName)
                formData.append("model_name", modelName);
            formData.append("prompt_version", promptVersion.toString());
            // Append image files
            for (const imagePath of imagePaths) {
                if (!fs_1.default.existsSync(imagePath)) {
                    throw new Error(`Image file not found: ${imagePath}`);
                }
                formData.append("files", fs_1.default.createReadStream(imagePath));
            }
            const response = await this.client.post("/api/batches", formData, {
                headers: formData.getHeaders(),
            });
            return response.data;
        }
        catch (error) {
            console.error("Error submitting batch to AI backend:", error);
            throw error;
        }
    }
    /**
     * Check batch status
     * @param batchId Batch ID from submitBatch response
     */
    async getBatchStatus(batchId) {
        try {
            const response = await this.client.get(`/api/batches/${batchId}`);
            return response.data;
        }
        catch (error) {
            console.error("Error getting batch status:", error);
            throw error;
        }
    }
    /**
     * Get list of result files from a batch
     * @param batchId Batch ID
     */
    async getBatchResults(batchId) {
        try {
            const response = await this.client.get(`/api/batches/${batchId}/results`);
            return response.data.files;
        }
        catch (error) {
            console.error("Error getting batch results:", error);
            throw error;
        }
    }
    /**
     * Get single result file
     * @param batchId Batch ID
     * @param filename Filename (e.g., "job_xyz.json")
     */
    async getResultFile(batchId, filename) {
        try {
            const response = await this.client.get(`/api/batches/${batchId}/results/${filename}`);
            return response.data;
        }
        catch (error) {
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
    async processSync(ballotType, imagePath) {
        try {
            if (!fs_1.default.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }
            const formData = new form_data_1.default();
            formData.append("ballot_type", ballotType);
            formData.append("files", fs_1.default.createReadStream(imagePath));
            const response = await this.client.post("/api/process", formData, {
                headers: formData.getHeaders(),
            });
            return response.data;
        }
        catch (error) {
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
    async processAndWait(ballotType, imagePath, pollIntervalMs = 1000, maxWaitMs = 60000) {
        // Try sync endpoint first
        try {
            return await this.processSync(ballotType, imagePath);
        }
        catch (error) {
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
exports.AIService = AIService;
exports.default = new AIService();
