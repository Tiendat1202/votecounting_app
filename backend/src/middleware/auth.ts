import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole, UserStatus } from "../entities/User";

const JWT_SECRET = process.env.JWT_SECRET || "please_set_a_secret";

export type AuthPayload = {
  userId: string;
  fullName?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type AuthenticatedRequest = Request & {
  user?: AuthPayload;
};

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const attachOptionalUser = (req: Request, _res: Response, next: NextFunction) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as AuthenticatedRequest).user = payload;
  } catch {
    // ignore invalid token on optional auth paths
  }
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này" });
    }
    next();
  };
};
