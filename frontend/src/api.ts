const API_BASE = "http://localhost:5050/api";

export type UserRole = "admin" | "inspector" | "supervisor";
export type UserStatus = "pending" | "active" | "rejected";

export type SessionPermissions = {
  isOwner: boolean;
  canUpload: boolean;
  canReview: boolean;
  canViewBallots: boolean;
  approvedActions: string[];
};

export type SessionRecord = {
  id: string;
  name: string;
  type: string;
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

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).message || (data as any).error || "Đã có lỗi xảy ra");
  return data;
}

/** AUTH */
export const registerUser = async (fullName: string, email: string, password: string, role: UserRole) => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, email, password, role }),
  });
  return await parseJson(res);
};

export const login = async (email: string, password: string, remember = false) => {
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

export const getSessionDetail = async (sessionId: string): Promise<SessionRecord> => {
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

export const requestSessionAccess = async (
  sessionId: string,
  actions: Array<"upload" | "review"> = ["upload", "review"],
  note = ""
) => {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/access-requests`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ actions, note }),
  });
  return await parseJson(res);
};

export const getAccessInbox = async () => {
  const res = await fetch(`${API_BASE}/access-requests/inbox`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const reviewAccessRequest = async (requestId: string, status: "approved" | "rejected") => {
  const res = await fetch(`${API_BASE}/access-requests/${requestId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
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
export const uploadVoteFiles = async (sessionId: string, files: File[], sessionType?: string) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const voteType = sessionType === "tin-nhiem" ? "trust" : "surplus";

  const res = await fetch(`${API_BASE}/uploads/${sessionId}?voteType=${voteType}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return await parseJson(res);
};

export const getUploadedFiles = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`, {
    headers: authHeaders(),
  });
  return await parseJson(res);
};

export const getHealth = async () => {
  const res = await fetch(`${API_BASE}/health`);
  return await res.json();
};

export const deleteUploadedFile = async (sessionId: string, filename: string) => {
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
