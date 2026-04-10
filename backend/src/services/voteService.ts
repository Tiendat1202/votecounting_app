import { Vote } from "../entities/Vote";
import { AppDataSource } from "../config/database";
import { VoteRequest, VoteResult } from "../types";

const voteRepository = AppDataSource.getRepository(Vote);

export class VoteService {
  /**
   * Xử lý và lưu kết quả từ AI
   */
  static async processAndSaveVote(
    sessionId: string,
    voteId: string,
    voteType: "trust" | "surplus",
    aiResult: any,
    imageUrl?: string
  ): Promise<Vote> {
    const validation = this.extractValidation(aiResult);

    const mappedStatus: "pending" | "valid" | "invalid" | "duplicate" =
      validation?.validity === "VALID"
        ? "valid"
        : validation?.validity === "INVALID"
        ? "invalid"
        : "pending";

    // Trích xuất ứng cử viên từ kết quả AI
    const selectedCandidate = this.extractSelectedCandidate(aiResult);
    const confidenceScore = this.calculateConfidence(aiResult);

    const voteData = {
      sessionId,
      voteId,
      voteType,
      rawData: JSON.stringify(aiResult),
      selectedCandidate: selectedCandidate || undefined,
      confidenceScore,
      status: mappedStatus,
      validity: validation?.validity || "UNKNOWN",
      invalidReasons: JSON.stringify(validation?.invalid_reasons || []),
      agreeCount: validation?.agree_count || 0,
      doubleMarkCount: validation?.double_mark_count || 0,
      imageUrl: imageUrl || undefined,
      candidate: selectedCandidate || "unknown",
      notes: `AI kết quả: ${aiResult?.error || "OK"}`,
    };

    const vote = voteRepository.create(voteData as any);
    return (await voteRepository.save(vote as any)) as Vote;
  }

  static extractValidation(aiResult: any): any | null {
    if (!aiResult) return null;

    // New format from ai_backend.py
    if (aiResult.validation && typeof aiResult.validation === "object") {
      return aiResult.validation;
    }

    // Fallback: validation embedded in parsed.full_analysis
    const full = aiResult?.parsed?.full_analysis;
    if (full && (full.validity || full.invalid_reasons)) {
      return {
        validity: full.validity || "UNKNOWN",
        invalid_reasons: full.invalid_reasons || [],
        agree_count: full.agree_count || 0,
        double_mark_count: full.double_mark_count || 0,
      };
    }

    return null;
  }

  static async backfillValidationStatus(): Promise<number> {
    const votes = await voteRepository.find();
    let updated = 0;

    for (const vote of votes) {
      if (!vote.rawData) continue;

      let parsed: any = null;
      try {
        parsed = JSON.parse(vote.rawData);
      } catch {
        continue;
      }

      const fullAnalysis = parsed?.parsed?.full_analysis || parsed?.full_analysis;
      let validation: any | null = null;

      if (fullAnalysis && typeof fullAnalysis === "object") {
        validation = {
          validity: fullAnalysis.validity || "UNKNOWN",
          invalid_reasons: fullAnalysis.invalid_reasons || [],
          agree_count: fullAnalysis.agree_count || 0,
          double_mark_count: fullAnalysis.double_mark_count || 0,
        };

        // Fallback for older payloads that expose raw row data without counts
        if (!validation.invalid_reasons.length && Array.isArray(fullAnalysis.vote_details)) {
          const validRows = fullAnalysis.vote_details.filter((detail: any) => {
            if (vote.voteType === "trust") {
              return detail.agree === true && detail.row_status === "OK";
            }
            return detail.selected === true && detail.row_status === "OK";
          });

          if (vote.voteType === "trust") {
            validation.agree_count = validRows.length;
            validation.validity = validRows.length > 0 ? "VALID" : "INVALID";
            validation.invalid_reasons = validRows.length > 0 ? [] : ["NO_BALLOT_DETAILS"];
          }
        }
      }

      if (!validation) {
        validation = this.extractValidation(parsed);
      }
      if (!validation) continue;

      const nextValidity = validation?.validity || "UNKNOWN";
      const nextStatus: "pending" | "valid" | "invalid" | "duplicate" =
        nextValidity === "VALID"
          ? "valid"
          : nextValidity === "INVALID"
          ? "invalid"
          : "pending";

      const nextReasons = JSON.stringify(validation?.invalid_reasons || []);
      const nextAgreeCount = validation?.agree_count || 0;
      const nextDoubleMarkCount = validation?.double_mark_count || 0;

      const changed =
        vote.status !== nextStatus ||
        vote.validity !== nextValidity ||
        (vote.invalidReasons || "[]") !== nextReasons ||
        (vote.agreeCount || 0) !== nextAgreeCount ||
        (vote.doubleMarkCount || 0) !== nextDoubleMarkCount;

      if (!changed) continue;

      vote.status = nextStatus;
      vote.validity = nextValidity as any;
      vote.invalidReasons = nextReasons;
      vote.agreeCount = nextAgreeCount;
      vote.doubleMarkCount = nextDoubleMarkCount;

      await voteRepository.save(vote as any);
      updated++;
    }

    return updated;
  }

  /**
   * Trích xuất ứng cử viên từ kết quả AI
   */
  static extractSelectedCandidate(aiResult: any): string | null {
    if (!aiResult) return null;

    // NEW: Extract from full_analysis.vote_details (Qwen format)
    if (aiResult.parsed?.full_analysis?.vote_details) {
      const voteDetails = aiResult.parsed.full_analysis.vote_details;
      const voteType = aiResult.parsed?.ballot_type || aiResult.ballot_type;
      
      const selected = voteDetails
        .filter((detail: any) => {
          if (voteType === 'trust') {
            return detail.agree === true && detail.row_status === 'OK';
          } else if (voteType === 'surplus') {
            return detail.selected === true && detail.row_status === 'OK';
          }
          return false;
        })
        .map((detail: any) => detail.name);
      
      if (selected.length > 0) {
        return selected.join(', ');
      }
    }

    // Fallback: Lấy từ candidate_name (Qwen processor)
    if (aiResult.parsed?.candidate_name && aiResult.parsed.candidate_name !== 'Unknown') {
      return aiResult.parsed.candidate_name;
    }

    // Cố gắng lấy từ parsed.selected_candidate
    if (aiResult.parsed?.selected_candidate) {
      return aiResult.parsed.selected_candidate;
    }

    // Hoặc từ parsed.extra_names[0]
    if (aiResult.parsed?.extra_names?.[0]) {
      return aiResult.parsed.extra_names[0];
    }

    // Hoặc từ parsed.ballot_details.selected_name
    if (aiResult.parsed?.ballot_details?.selected_name) {
      return aiResult.parsed.ballot_details.selected_name;
    }

    return null;
  }

  /**
   * Tính độ tin cậy
   */
  static calculateConfidence(aiResult: any): number {
    if (!aiResult) return 0;
    
    // NEW: Lấy từ parsed.confidence (Qwen processor)
    if (typeof aiResult.parsed?.confidence === 'number') {
      return Math.min(1, Math.max(0, aiResult.parsed.confidence));
    }

    // Legacy: parsed.confidence
    if (aiResult.parsed?.confidence) {
      return Math.min(1, Math.max(0, aiResult.parsed.confidence));
    }

    // Nếu OK thì gán 0.95, ngược lại 0.5
    return aiResult.ok ? 0.95 : 0.5;
  }

  /**
   * Xác nhận phiếu (đánh dấu là hợp lệ/không hợp lệ)
   */
  static async validateVote(
    voteId: string,
    isValid: boolean,
    options?: {
      notes?: string;
      overrideReason?: string;
      overrideBy?: string;
      selectedCandidates?: string[];
    }
  ): Promise<Vote | null> {
    const vote = await voteRepository.findOneBy({ id: voteId });
    if (!vote) return null;

    vote.status = isValid ? ("valid" as const) : ("invalid" as const);
    vote.validity = isValid ? ("VALID" as any) : ("INVALID" as any);
    if (isValid) {
      vote.invalidReasons = JSON.stringify([]);
      if (Array.isArray(options?.selectedCandidates) && options!.selectedCandidates.length > 0) {
        const normalized = options!.selectedCandidates
          .map((x) => String(x).trim())
          .filter(Boolean);
        if (normalized.length > 0) {
          const merged = normalized.join(", ");
          vote.selectedCandidate = merged;
          vote.candidate = merged;
        }
      }
    } else {
      const reason = options?.overrideReason || "MANUAL_OVERRIDE_INVALID";
      vote.invalidReasons = JSON.stringify([reason]);
    }

    vote.validationNotes = options?.notes?.trim() || "";
    vote.manualOverrideReason = options?.overrideReason || (isValid ? "MANUAL_CONFIRM" : "MANUAL_OVERRIDE_INVALID");
    vote.manualOverrideBy = options?.overrideBy || "unknown";
    vote.manualOverrideAt = new Date();

    return (await voteRepository.save(vote as any)) as Vote;
  }

  /**
   * Lấy danh sách phiếu của một phiên
   */
  static async getSessionVotes(
    sessionId: string,
    filters?: {
      status?: string;
      voteType?: string;
      candidateName?: string;
    },
    limit: number = 20,
    offset: number = 0
  ): Promise<{ votes: Vote[]; total: number }> {
    let query = voteRepository
      .createQueryBuilder("vote")
      .where("vote.sessionId = :sessionId", { sessionId });

    if (filters?.status) {
      query = query.andWhere("vote.status = :status", {
        status: filters.status,
      });
    }

    if (filters?.voteType) {
      query = query.andWhere("vote.voteType = :voteType", {
        voteType: filters.voteType,
      });
    }

    if (filters?.candidateName) {
      query = query.andWhere("vote.selectedCandidate LIKE :candidateName", {
        candidateName: `%${filters.candidateName}%`,
      });
    }

    const [votes, total] = await query
      .orderBy("vote.createdAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { votes, total };
  }

  /**
   * Lấy thống kê của một phiên
   */
  static async getSessionStats(sessionId: string) {
    const votes = await voteRepository.findBy({ sessionId });

    const stats = {
      total: votes.length,
      pending: votes.filter((v) => v.status === "pending").length,
      valid: votes.filter((v) => v.status === "valid").length,
      invalid: votes.filter((v) => v.status === "invalid").length,
      duplicate: votes.filter((v) => v.status === "duplicate").length,
      byCandidate: this.countVotesByCandidate(votes),
      byVoteType: {
        trust: votes.filter((v) => v.voteType === "trust").length,
        surplus: votes.filter((v) => v.voteType === "surplus").length,
      },
    };

    return stats;
  }

  /**
   * Đếm phiếu theo ứng cử viên
   */
  static countVotesByCandidate(votes: Vote[]) {
    const counts = new Map<string, number>();

    votes
      .filter((v) => v.selectedCandidate)
      .forEach((v) => {
        const name = v.selectedCandidate!;
        counts.set(name, (counts.get(name) || 0) + 1);
      });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  // --- Các phương thức cũ để tương thích ---

  static async submitVote(voteData: VoteRequest): Promise<Vote> {
    const votePayload = {
      candidate: voteData.candidate.trim(),
      notes: voteData.notes,
      status: "pending" as const,
      voteType: "surplus" as const,
      sessionId: "default",
    };
    const vote = voteRepository.create(votePayload as any);
    return (await voteRepository.save(vote as any)) as Vote;
  }

  static async getAllVotes(): Promise<Vote[]> {
    return await voteRepository.find({
      order: {
        createdAt: "DESC",
      },
    });
  }

  static async getVoteResults(): Promise<VoteResult[]> {
    const votes = await voteRepository.find();

    const voteCounts = new Map<string, number>();
    votes.forEach((vote) => {
      const candidate = vote.candidate;
      voteCounts.set(candidate, (voteCounts.get(candidate) || 0) + 1);
    });

    const totalVotes = votes.length;
    const results: VoteResult[] = Array.from(voteCounts.entries()).map(
      ([candidate, count]) => ({
        candidate,
        votes: count,
        percentage: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
      })
    );

    return results.sort((a, b) => b.votes - a.votes);
  }

  static async getVoteStats() {
    const totalVotes = await voteRepository.count();
    const uniqueCandidates = await voteRepository
      .createQueryBuilder("vote")
      .select("DISTINCT vote.candidate")
      .getRawMany();

    return {
      totalVotes,
      uniqueCandidates: uniqueCandidates.length,
      lastVoteTime:
        (await voteRepository.findOne({
          order: { createdAt: "DESC" },
        }))?.createdAt || null,
    };
  }

  static async deleteVote(id: string): Promise<boolean> {
    const result = await voteRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  static async clearAllVotes(): Promise<number> {
    const result = await voteRepository.delete({});
    return result.affected || 0;
  }
}