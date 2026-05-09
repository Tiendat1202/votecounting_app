const API_BASE = "http://localhost:5050/api";

export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "active" | "rejected";

export type SessionRole = "owner" | "inspector" | "supervisor";

export type SessionPermissions = {
  isOwner: boolean;
  sessionRole: SessionRole | null;
  canManageMembers: boolean;
  canUpload: boolean;
  canReview: boolean;
  canViewBallots: boolean;
  canExportReport: boolean;
  approvedActions: string[];
};

export type ActiveUser = {
  userId: string;
  fullName: string | null;
  workUnit?: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type SessionMember = {
  id: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  userFullName?: string | null;
  role: SessionRole;
  createdAt?: string;
};

export type SessionRecord = {
  id: string;
  name: string;
  type: string;
  voteRule?: string | null;
  evaluationOptions?: { key: string; label: string }[] | string[] | null;
  electionUnit?: string | null;
  location?: string | null;
  candidates: string[];
  startAt?: string;
  endAt?: string;
  createdAt?: string;
  createdByEmail?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  seatsToElect?: number | null;
  minWinningPercent?: number | null;
  closedEarlyAt?: string | null;
  closedEarlyByUserId?: string | null;
  permissions?: SessionPermissions;
};

function authHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function getVoteTypeFromSessionType(sessionType?: string): "trust" | "surplus" {
  const normalized = String(sessionType || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "-");

  return ["tin-nhiem", "trust", "tin-nhiem-phieu"].includes(normalized)
    ? "trust"
    : "surplus";
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data as any).message || (data as any).error || "Đã có lỗi xảy ra",
    );
  return data;
}

/** AUTH */
export const registerUser = async (
  fullName: string,
  workUnit: string,
  email: string,
  password: string,
) => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, workUnit, email, password }),
  });
  return await parseJson(res);
};

export const login = async (
  email: string,
  password: string,
  remember = false,
) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, remember }),
  });
  return await parseJson(res);
};

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const logoutApi = async () => {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return await parseJson(res);
};

export const getActiveUsers = async (): Promise<ActiveUser[]> => {
  const res = await fetch(`${API_BASE}/auth/active-users`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const getUsers = async () => {
  const res = await fetch(`${API_BASE}/auth/users`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const updateUserStatus = async (userId: string, status: UserStatus) => {
  const res = await fetch(`${API_BASE}/auth/users/${userId}/status`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  return await parseJson(res);
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  const res = await fetch(`${API_BASE}/auth/users/${userId}/role`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ role }),
  });
  return await parseJson(res);
};

export const deleteUserAccount = async (userId: string) => {
  const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return await parseJson(res);
};

/* ===========================
   🔹 PHIÊN KIỂM PHIẾU
   =========================== */
export const getSessions = async (): Promise<SessionRecord[]> => {
  const res = await fetch(`${API_BASE}/sessions`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const getSessionDetail = async (
  sessionId: string,
): Promise<SessionRecord> => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const createSession = async (session: any): Promise<SessionRecord> => {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(session),
  });
  return await parseJson(res);
};

export const closeSessionEarly = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/close`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return await parseJson(res);
};

export const getSessionMembers = async (
  sessionId: string,
): Promise<SessionMember[]> => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/members`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const addSessionMember = async (
  sessionId: string,
  userId: string,
  role: "inspector" | "supervisor",
) => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/members`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ userId, role }),
  });
  return await parseJson(res);
};

export const removeSessionMember = async (
  sessionId: string,
  memberId: string,
) => {
  const res = await fetch(
    `${API_BASE}/sessions/${sessionId}/members/${memberId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  return await parseJson(res);
};

/* ===========================
   🔹 THỐNG KÊ DASHBOARD
   =========================== */
export const getStats = async () => {
  const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders() });
  return await parseJson(res);
};

/* ===========================
   🔹 UPLOAD ẢNH THẬT
   =========================== */
export const uploadVoteFiles = async (
  sessionId: string,
  files: File[],
  sessionType?: string,
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const voteType = getVoteTypeFromSessionType(sessionType);

  const res = await fetch(
    `${API_BASE}/uploads/${sessionId}?voteType=${voteType}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    },
  );
  return await parseJson(res);
};

export const getUploadedFiles = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export type CountingProgress = {
  sessionId: string;
  status: "idle" | "uploaded" | "processing" | "completed" | "failed";
  total: number;
  processed: number;
  failed?: number;
  percent: number;
  isProcessing?: boolean;
  canStart?: boolean;
  currentFile?: string | null;
  message?: string;
};

export const getCountingProgress = async (
  sessionId: string,
): Promise<CountingProgress> => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/progress`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const startVoteCounting = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/start-counting`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return await parseJson(res);
};

export const getHealth = async () => {
  const res = await fetch(`${API_BASE}/health`);
  return await res.json();
};

export const deleteUploadedFile = async (
  sessionId: string,
  filename: string,
) => {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}/${filename}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const deleteAllUploadedFiles = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export { aiApi } from "./api/aiApi";
