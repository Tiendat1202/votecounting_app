import { NextFunction, Response } from "express";
import { AppDataSource } from "../config/database";
import { VoteSession } from "../entities/VoteSession";
import { SessionMember, SessionRole } from "../entities/SessionMember";
import { Vote } from "../entities/Vote";
import { AuthenticatedRequest } from "./auth";

export type SessionPermissionSummary = {
  isOwner: boolean;
  sessionRole: SessionRole | null;
  canManageMembers: boolean;
  canUpload: boolean;
  canReview: boolean;
  canViewBallots: boolean;
  canExportReport: boolean;
  approvedActions: string[];
};

async function findSessionMember(sessionId: string, userId: string) {
  return AppDataSource.getRepository(SessionMember).findOne({ where: { sessionId, userId } });
}

export async function computeSessionPermissions(session: VoteSession, req: AuthenticatedRequest): Promise<SessionPermissionSummary> {
  const user = req.user;
  const empty = {
    isOwner: false,
    sessionRole: null,
    canManageMembers: false,
    canUpload: false,
    canReview: false,
    canViewBallots: false,
    canExportReport: false,
    approvedActions: [],
  };
  if (!user) return empty;

  if (user.role === "admin") {
    return {
      isOwner: true,
      sessionRole: "owner",
      canManageMembers: true,
      canUpload: true,
      canReview: true,
      canViewBallots: true,
      canExportReport: false,
      approvedActions: ["upload", "review", "manage"],
    };
  }

  const isCreator = !!session.createdByUserId && session.createdByUserId === user.userId;
  const member = await findSessionMember(session.id, user.userId);
  const sessionRole: SessionRole | null = member?.role || (isCreator ? "inspector" : null);

  const canManageMembers = isCreator || sessionRole === "owner";
  const canUpload = sessionRole === "owner" || sessionRole === "inspector";
  const canReview = sessionRole === "owner" || sessionRole === "inspector" || sessionRole === "supervisor";
  const canViewBallots = sessionRole === "owner" || sessionRole === "inspector" || sessionRole === "supervisor";
  const canExportReport = sessionRole === "inspector";

  return {
    isOwner: isCreator || sessionRole === "owner",
    sessionRole,
    canManageMembers,
    canUpload,
    canReview,
    canViewBallots,
    canExportReport,
    approvedActions: [
      canUpload ? "upload" : null,
      canReview ? "review" : null,
      canManageMembers ? "manage" : null,
      canViewBallots ? "view" : null,
      canExportReport ? "export" : null,
    ].filter(Boolean) as string[],
  };
}

async function requireSessionPermissionInternal(
  req: AuthenticatedRequest,
  res: Response,
  permission: keyof Pick<SessionPermissionSummary, "canUpload" | "canReview" | "canViewBallots" | "canManageMembers" | "canExportReport">
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

export const requireSessionReportPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const session = await requireSessionPermissionInternal(req, res, "canExportReport");
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
