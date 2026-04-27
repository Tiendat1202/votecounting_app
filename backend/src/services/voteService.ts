import { Vote } from "../entities/Vote";
import { AppDataSource } from "../config/database";
import { VoteRequest, VoteResult } from "../types";

const voteRepository = AppDataSource.getRepository(Vote);

type SupportedVoteType = "trust" | "surplus";

type NormalizedRow = {
  name: string | null;
  agree: boolean;
  disagree: boolean;
  selected: boolean;
};

type EvaluatedBallot = {
  status: "valid" | "invalid" | "failed";
  selectedNames: string[];
  rows: NormalizedRow[];
};

export class VoteService {
  private static parseBool(value: any): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      return v === "true" || v === "1" || v === "yes" || v === "y";
    }
    return false;
  }

  private static parseNumber(value: any): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number(value.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private static safeParseJson(input: string): any | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  private static extractFirstJsonObject(input: string): any | null {
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
          return this.safeParseJson(candidate);
        }
      }
    }
    return null;
  }

  private static normalizeArray(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") {
      const vals = Object.values(raw);
      if (vals.length > 0) return vals;
    }
    return [];
  }

  private static normalizeParsed(aiResult: any): any {
    let parsed: any = aiResult?.parsed ?? aiResult ?? {};

    if (typeof parsed === "string") {
      parsed = this.safeParseJson(parsed) ?? this.extractFirstJsonObject(parsed) ?? { raw: parsed };
    }

    if (!parsed || typeof parsed !== "object") {
      parsed = { raw: String(parsed ?? "") };
    }

    if (!parsed.full_analysis || typeof parsed.full_analysis !== "object") {
      parsed.full_analysis = parsed.parsed_full && typeof parsed.parsed_full === "object"
        ? parsed.parsed_full
        : parsed;
    }

    const raw = parsed?.full_analysis?.raw;
    if (typeof raw === "string") {
      const inner = this.safeParseJson(raw) ?? this.extractFirstJsonObject(raw);
      if (inner && typeof inner === "object") {
        parsed.full_analysis = { ...parsed.full_analysis, ...inner };
      }
    }

    return parsed;
  }

  private static extractRawRows(parsed: any): any[] {
    const full = parsed?.full_analysis ?? {};
    const sources = [
      full?.ballot_details,
      full?.full_analysis?.ballot_details,
      full?.vote_details,
      parsed?.parsed_full?.ballot_details,
      parsed?.parsed_full?.full_analysis?.ballot_details,
      parsed?.candidates,
    ];

    for (const src of sources) {
      const arr = this.normalizeArray(src);
      if (arr.length > 0) return arr;
    }

    return [];
  }

  private static normalizeRows(rows: any[]): NormalizedRow[] {
    return rows
      .filter((r) => r && typeof r === "object")
      .map((r) => {
        const agree = this.parseBool(r.agree);
        const disagree = this.parseBool(r.disagree);
        // selected: explicit field (new co_du.py schema) or fallback to agree for
        // surplus rows that use the old agree/disagree convention (agree=true = not crossed)
        const selected = r.selected !== undefined
          ? this.parseBool(r.selected)
          : (agree && !disagree);
        return {
          name: (r.name ?? r.label ?? r.candidate_name ?? null)
            ? String(r.name ?? r.label ?? r.candidate_name).trim()
            : null,
          agree,
          disagree,
          selected,
        };
      });
  }

  private static evaluateBallot(
    voteType: SupportedVoteType,
    rows: NormalizedRow[],
    parsed: any,
    seatsToElect?: number | null
  ): EvaluatedBallot {
    // =========================================================
    // SOLE SOURCE OF TRUTH FOR BALLOT VALIDITY.
    // AI only extracts rows — backend decides status.
    //
    // TRUST BALLOT rules:
    //   F. FAILED  — no rows extracted at all
    //   A. DOUBLE_MARK (agree=true AND disagree=true) — ballot stays VALID,
    //                  that row is IGNORED (candidate gets 0 vote)
    //   B. INVALID — after ignoring double-mark rows, no row has agree=true AND disagree=false
    //   C. VALID   — at least one row has agree=true AND disagree=false
    //   D. disagree=true alone does NOT invalidate the ballot
    //   E. EMPTY rows (both false) are allowed
    //
    // SURPLUS BALLOT rules:
    //   FAILED  — no rows
    //   INVALID — selected count > seatsToElect (over-voted)
    //   INVALID — selected count == 0 (no selection)
    //   VALID   — 1 <= selected count <= seatsToElect
    // =========================================================

    if (!rows.length) {
      return { status: "failed", selectedNames: [], rows };
    }

    // ── NEW RULE A: handwriting / signature detected
    const hasExtraWriting = parsed?.full_analysis?.has_extra_writing === true
      || parsed?.has_extra_writing === true;
    if (hasExtraWriting) {
      return { status: "invalid", selectedNames: [], rows };
    }

    // ── NEW RULE B: unknown candidate name on ballot
    const unknownCandidates: string[] =
      Array.isArray(parsed?.full_analysis?.unknown_candidates)
        ? parsed.full_analysis.unknown_candidates
        : Array.isArray(parsed?.unknown_candidates)
        ? parsed.unknown_candidates
        : [];
    if (unknownCandidates.length > 0) {
      return { status: "invalid", selectedNames: [], rows };
    }

    if (voteType === "trust") {
      // DOUBLE_MARK rows: ballot stays valid, row is just skipped (not counted)
      const positiveRows = rows.filter((r) => r.agree && !r.disagree);

      // If zero positive rows (after ignoring double-marks and blanks) → invalid
      if (positiveRows.length === 0) {
        return { status: "invalid", selectedNames: [], rows };
      }

      return {
        status: "valid",
        selectedNames: positiveRows.map((r) => r.name).filter(Boolean) as string[],
        rows,
      };
    }

    // === SURPLUS BALLOT ===
    const selectedRows = rows.filter((r) => r.selected);

    if (selectedRows.length === 0) {
      return { status: "invalid", selectedNames: [], rows };
    }

    // Use seatsToElect from session (preferred) or fall back to AI-provided field
    const allowed =
      (seatsToElect != null && Number.isFinite(seatsToElect) ? seatsToElect : null) ??
      this.parseNumber(parsed?.full_analysis?.allowed) ??
      this.parseNumber(parsed?.full_analysis?.max_selected) ??
      this.parseNumber(parsed?.full_analysis?.maxAllowed) ??
      this.parseNumber(parsed?.allowed) ??
      this.parseNumber(parsed?.max_selected) ??
      null;

    if (allowed !== null && selectedRows.length > allowed) {
      return {
        status: "invalid",
        selectedNames: selectedRows.map((r) => r.name).filter(Boolean) as string[],
        rows,
      };
    }

    return {
      status: "valid",
      selectedNames: selectedRows.map((r) => r.name).filter(Boolean) as string[],
      rows,
    };
  }

  /**
   * Xử lý và lưu kết quả từ AI
   */
  static async processAndSaveVote(
    sessionId: string,
    voteId: string,
    voteType: SupportedVoteType,
    aiResult: any,
    imageUrl?: string,
    seatsToElect?: number | null
  ): Promise<Vote> {
    const parsed = this.normalizeParsed(aiResult);
    const rawRows = this.extractRawRows(parsed);
    const rows = this.normalizeRows(rawRows);
    const evaluated = this.evaluateBallot(voteType, rows, parsed, seatsToElect);

    const selectedNames = evaluated.selectedNames.filter((n) => n && n.toLowerCase() !== "unknown");
    const selectedText = selectedNames.length > 0 ? selectedNames.join(", ") : null;
    const confidenceScore = this.calculateConfidence({ parsed, ok: aiResult?.ok });

    const voteData = {
      sessionId,
      voteId,
      voteType,
      rawData: JSON.stringify(aiResult ?? null),
      selectedCandidate: selectedText ?? undefined,
      candidate: selectedText ?? undefined,
      confidenceScore,
      status: evaluated.status,
      imageUrl: imageUrl || undefined,
      notes: `AI kết quả: ${aiResult?.error || "OK"}`,
    };

    const vote = voteRepository.create(voteData as any);
    return (await voteRepository.save(vote as any)) as Vote;
  }

  /**
   * Trích xuất ứng cử viên từ kết quả AI
   */
  static extractSelectedCandidate(aiResult: any): string | null {
    if (!aiResult) return null;

    const parsed = this.normalizeParsed(aiResult);
    const rawRows = this.extractRawRows(parsed);
    const rows = this.normalizeRows(rawRows);

    const voteType: SupportedVoteType =
      parsed?.ballot_type === "surplus" || aiResult?.ballot_type === "surplus"
        ? "surplus"
        : "trust";

    const evaluated = this.evaluateBallot(voteType, rows, parsed);
    const names = evaluated.selectedNames.filter((n) => n && n.toLowerCase() !== "unknown");

    if (names.length > 0) return names.join(", ");
    return null;
  }

  /**
   * Tính độ tin cậy
   */
  static calculateConfidence(aiResult: any): number {
    if (!aiResult) return 0;

    const parsedConfidence = this.parseNumber(aiResult?.parsed?.confidence);
    if (parsedConfidence !== null) {
      return Math.max(0, Math.min(1, parsedConfidence));
    }

    return aiResult?.ok ? 0.95 : 0.5;
  }

  /**
   * Xác nhận phiếu (đánh dấu là hợp lệ/không hợp lệ)
   */
  static async validateVote(
    voteId: string,
    isValid: boolean,
    notes?: string,
    selectedCandidates?: string[],
    overrideReason?: string
  ): Promise<Vote | null> {
    const vote = await voteRepository.findOneBy({ id: voteId });
    if (!vote) return null;

    vote.status = isValid ? ("valid" as const) : ("invalid" as const);
    if (notes) vote.validationNotes = notes;
    if (selectedCandidates && selectedCandidates.length > 0) {
      vote.selectedCandidate = selectedCandidates.join(",");
    }

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
      query = query.andWhere("vote.status = :status", { status: filters.status });
    }

    if (filters?.voteType) {
      query = query.andWhere("vote.voteType = :voteType", { voteType: filters.voteType });
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

    return {
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
      const candidate = vote.candidate ?? "";
      if (!candidate) return;
      voteCounts.set(candidate, (voteCounts.get(candidate) || 0) + 1);
    });

    const totalVotes = votes.length;
    const results: VoteResult[] = Array.from(voteCounts.entries()).map(([candidate, count]) => ({
      candidate,
      votes: count,
      percentage: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
    }));

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