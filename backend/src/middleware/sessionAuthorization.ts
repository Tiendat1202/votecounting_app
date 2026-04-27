import { NextFunction, Response } from "express";
import { AppDataSource } from "../config/database";
import { VoteSession } from "../entities/VoteSession";
import { SessionAccessRequest } from "../entities/SessionAccessRequest";
import { Vote } from "../entities/Vote";
import { AuthenticatedRequest } from "./auth";

export type SessionPermissionSummary = {
  isOwner: boolean;
  canUpload: boolean;
  canReview: boolean;
  canViewBallots: boolean;
  approvedActions: string[];
};

export async function getApprovedActions(sessionId: string, userId: string): Promise<string[]> {
  const repo = AppDataSource.getRepository(SessionAccessRequest);
  const rows = await repo.find({
    where: { sessionId, requesterUserId: userId, status: "approved" },
    order: { updatedAt: "DESC" },
  });

  const actionSet = new Set<string>();
  for (const row of rows) {
    for (const action of row.actions || []) {
      actionSet.add(action);
    }
  }
  return Array.from(actionSet);
}

export async function computeSessionPermissions(session: VoteSession, req: AuthenticatedRequest): Promise<SessionPermissionSummary> {
  const user = req.user;
  if (!user) {
    return {
      isOwner: false,
      canUpload: false,
      canReview: false,
      canViewBallots: false,
      approvedActions: [],
    };
  }

  if (user.role === "admin") {
    return {
      isOwner: true,
      canUpload: true,
      canReview: true,
      canViewBallots: true,
      approvedActions: ["upload", "review"],
    };
  }

  const isOwner = !!session.createdByUserId && session.createdByUserId === user.userId;
  const approvedActions = isOwner ? ["upload", "review"] : await getApprovedActions(session.id, user.userId);
  const canUpload = user.role === "inspector" && (isOwner || approvedActions.includes("upload"));
  const canReview = user.role === "inspector" && (isOwner || approvedActions.includes("review"));
  const canViewBallots = user.role === "supervisor" || canReview || canUpload || isOwner;

  return {
    isOwner,
    canUpload,
    canReview,
    canViewBallots,
    approvedActions,
  };
}

async function requireSessionPermissionInternal(
  req: AuthenticatedRequest,
  res: Response,
  permission: keyof Omit<SessionPermissionSummary, "approvedActions" | "isOwner">
): Promise<VoteSession | null> {
  const { sessionId } = req.params;
  const session = await AppDataSource.getRepository(VoteSession).findOne({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ message: "Không tìm thấy phiên kiểm phiếu" });
    return null;
  }

  const perms = await computeSessionPermissions(session, req);
  if (!perms[permission]) {
    res.status(403).json({ message: "Bạn không có quyền với phiên kiểm phiếu này" });
    return null;
  }

  (req as any).session = session;
  (req as any).sessionPermissions = perms;
  return session;
}

export const requireSessionUploadPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const session = await requireSessionPermissionInternal(req, res, "canUpload");
  if (!session) return;
  next();
};

export const requireSessionReviewPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const session = await requireSessionPermissionInternal(req, res, "canReview");
  if (!session) return;
  next();
};

export const requireSessionBallotViewPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const session = await requireSessionPermissionInternal(req, res, "canViewBallots");
  if (!session) return;
  next();
};

export const requireSessionOwnerOrAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const session = await AppDataSource.getRepository(VoteSession).findOne({ where: { id: sessionId } });
  if (!session) {
    return res.status(404).json({ message: "Không tìm thấy phiên kiểm phiếu" });
  }
  const perms = await computeSessionPermissions(session, req);
  if (!(req.user?.role === "admin" || perms.isOwner)) {
    return res.status(403).json({ message: "Chỉ chủ phiên hoặc admin mới được thao tác" });
  }
  (req as any).session = session;
  (req as any).sessionPermissions = perms;
  next();
};

export const requireVoteReviewPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { voteId } = req.params;
  const vote = await AppDataSource.getRepository(Vote).findOne({ where: { id: voteId } });
  if (!vote) {
    return res.status(404).json({ message: "Không tìm thấy phiếu" });
  }
  const session = await AppDataSource.getRepository(VoteSession).findOne({ where: { id: vote.sessionId } });
  if (!session) {
    return res.status(404).json({ message: "Không tìm thấy phiên kiểm phiếu" });
  }
  const perms = await computeSessionPermissions(session, req);
  if (!perms.canReview) {
    return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa kết quả của phiên này" });
  }
  (req as any).vote = vote;
  (req as any).session = session;
  (req as any).sessionPermissions = perms;
  next();
};
