import { Vote } from "../entities/Vote";
import { AppDataSource } from "../config/database";
import { VoteRequest, VoteResult } from "../types";

const voteRepository = AppDataSource.getRepository(Vote);

export class VoteService {
  static async submitVote(voteData: VoteRequest): Promise<Vote> {
    const vote = voteRepository.create({
      candidate: voteData.candidate.trim(),
      notes: voteData.notes,
      status: "confirmed",
    });

    return await voteRepository.save(vote);
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